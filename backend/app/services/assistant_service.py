from __future__ import annotations

import json
import re
import time
from decimal import Decimal
from typing import Any, Dict, Generator, List, Optional

from app.core.config import get_settings
from app.core.logging import configure_logging
from app.rag.pipeline import ingest_knowledge_base
from app.rag.retriever import KnowledgeRetriever
from app.schemas.assistant import (
    AssistantChatRequest,
    AssistantChatResponse,
    AuditTrail,
    SourceReference,
)
from app.schemas.tax import TaxCalculationRequest, TaxDeductionsInput
from app.services.llm_service import (
    LLMService,
    SEBI_GUARDRAIL_REFUSAL,
    check_sebi_compliance_violation,
    is_sebi_intercept_query,
)
from app.services.tax_engine import compute_tax

logger = configure_logging()


class AssistantService:
    """Central AI Assistant service orchestrating Intent Detection, RAG Retrieval, Tax Engine, and LLM explanation."""

    def __init__(
        self,
        retriever: Optional[KnowledgeRetriever] = None,
        llm_service: Optional[LLMService] = None,
    ) -> None:
        self.settings = get_settings()
        self.retriever = retriever or KnowledgeRetriever()
        self.llm_service = llm_service or LLMService()

        # Ensure vector store contains ingested documents
        if self.retriever.vector_store.count() == 0:
            logger.info("ChromaDB collection is empty. Triggering automatic knowledge base ingestion...")
            ingest_knowledge_base()

    def _detect_intent(self, query: str) -> str:
        """Detect whether query is a tax calculation / salary budget request or information question."""
        q_lower = query.lower()
        calc_keywords = [
            "calculate", "tax on", "lakh", "lac", "salary", "income", "my tax",
            "lpa", "ctc", "per month", "budget", "in-hand", "in hand", "take home", "take-home"
        ]

        for kw in calc_keywords:
            if kw in q_lower:
                return "tax_calculation"

        if "gst" in q_lower:
            return "gst_information"
        elif any(k in q_lower for k in ["invest", "fd", "risk", "deposit"]):
            return "financial_information"
        else:
            return "tax_information"

    def _extract_income_from_query(self, query: str) -> Optional[Decimal]:
        """Attempt to extract annual income from query text (e.g., '₹12 lakh', '15 LPA', '80k/month')."""
        q_lower = query.lower()

        # Monthly income (e.g., '80k per month', '80,000 pm', '60k monthly')
        match_month_k = re.search(r"(\d+(?:\.\d+)?)\s*k\s*(?:per\s*month|pm|/mo|a\s*month|monthly)", q_lower)
        if match_month_k:
            val = float(match_month_k.group(1)) * 1000.0 * 12.0
            return Decimal(str(int(val)))

        match_month_num = re.search(r"₹?\s*(\d{1,3}(?:,\d{2,3})+|\d{4,7})\s*(?:per\s*month|pm|/mo|a\s*month|monthly)", q_lower)
        if match_month_num:
            raw_str = match_month_num.group(1).replace(",", "")
            val = float(raw_str) * 12.0
            return Decimal(str(int(val)))

        # LPA / CTC (e.g., '15 LPA', '12lpa', '18 ctc')
        match_lpa = re.search(r"(\d+(?:\.\d+)?)\s*(?:lpa|l\.p\.a|ctc)", q_lower)
        if match_lpa:
            val = float(match_lpa.group(1))
            return Decimal(str(int(val * 100000)))

        # Lakh / Lacs (e.g., '15 lakh', '12 lac')
        match_lakh = re.search(r"(\d+(?:\.\d+)?)\s*(?:lakh|lac|l|lakhs|lacs)", q_lower)
        if match_lakh:
            val = float(match_lakh.group(1))
            return Decimal(str(int(val * 100000)))

        # Crores
        match_crore = re.search(r"(\d+(?:\.\d+)?)\s*(?:crore|cr|crores)", q_lower)
        if match_crore:
            val = float(match_crore.group(1))
            return Decimal(str(int(val * 10000000)))

        # Raw number (e.g., '1500000')
        match_raw = re.search(r"₹?\s*(\d{1,3}(?:,\d{2,3})+|\d{5,8})", query)
        if match_raw:
            raw_str = match_raw.group(1).replace(",", "")
            return Decimal(raw_str)

        return None

    def _deduplicate_chunks(self, chunks: List[Dict[str, Any]], max_chunks: int = 3) -> List[Dict[str, Any]]:
        """Deduplicate retrieved chunks based on title and content snippet, keeping top distinct passages."""
        seen_texts = set()
        deduped = []
        for c in chunks:
            if not isinstance(c, dict):
                continue
            content = c.get("content", "").strip()
            fingerprint = " ".join(content.split())[:80].lower()
            if fingerprint and fingerprint not in seen_texts:
                seen_texts.add(fingerprint)
                deduped.append(c)
                if len(deduped) >= max_chunks:
                    break
        return deduped or chunks[:max_chunks]

    def _check_insufficient_grounding(self, chunks: List[Dict[str, Any]]) -> bool:
        """Check if all top retrieved chunks fall below the similarity confidence threshold."""
        if not chunks:
            return True

        threshold = getattr(self.settings, "RAG_MIN_SIMILARITY_THRESHOLD", 0.35)
        max_score = max([float(c.get("similarity_score", 0.0)) for c in chunks if isinstance(c, dict)], default=0.0)
        return max_score < threshold

    def process_chat(self, request: AssistantChatRequest) -> AssistantChatResponse:
        """Process user chat query through Audit V intelligence pipeline (Non-Streaming Path)."""
        start_time = time.perf_counter()
        query = request.message.strip()

        # a) Pre-generation intercept: skip model entirely for stock/fund/crypto picks, buy/sell/hold calls, price predictions
        if is_sebi_intercept_query(query):
            processing_time = round((time.perf_counter() - start_time) * 1000.0, 2)
            audit_trail = AuditTrail(
                intent="investment_guidance",
                tax_engine_invoked=False,
                tax_engine_summary=None,
                rag_invoked=True,
                retrieved_sources_count=0,
                guardrail_triggered=True,
                processing_time_ms=processing_time,
            )
            return AssistantChatResponse(
                answer=SEBI_GUARDRAIL_REFUSAL,
                intent="investment_guidance",
                sources=[],
                used_rag=True,
                used_tax_engine=False,
                insufficient_grounding=False,
                audit_trail=audit_trail,
            )

        intent = self._detect_intent(query)
        logger.info(f"Processing chat query (Detected Intent: '{intent}')")

        if intent == "tax_calculation":
            extracted_income = self._extract_income_from_query(query)
            income_to_use = extracted_income or Decimal("1200000")

            tax_req = TaxCalculationRequest(
                annual_income=income_to_use,
                age=30,
                regime="compare",
                is_salaried=True,
                deductions=TaxDeductionsInput(
                    section_80c=Decimal("150000"),
                    section_80d=Decimal("25000"),
                    hra_exemption=Decimal("100000"),
                ),
            )
            calc_resp = compute_tax(tax_req)
            retrieved_chunks = self.retriever.retrieve(query="Old vs New Tax Regime 115BAC", top_k=3)
            deduped_chunks = self._deduplicate_chunks(retrieved_chunks, max_chunks=3)
            sources = self._build_sources(deduped_chunks)

            explanation = self.llm_service.generate_explanation(
                query=query,
                context_chunks=deduped_chunks,
                calculation_result=calc_resp.model_dump(),
                fast_mode=request.fast_mode,
            )

            processing_time = round((time.perf_counter() - start_time) * 1000.0, 2)
            audit_trail = AuditTrail(
                intent=intent,
                tax_engine_invoked=True,
                tax_engine_summary={
                    "gross_income": float(calc_resp.selected_result.gross_income),
                    "taxable_income": float(calc_resp.selected_result.taxable_income),
                    "recommended_regime": calc_resp.recommended_regime,
                    "total_tax": float(calc_resp.selected_result.total_tax),
                    "potential_savings": float(calc_resp.potential_tax_savings),
                },
                rag_invoked=True,
                retrieved_sources_count=len(sources),
                guardrail_triggered=False,
                processing_time_ms=processing_time,
            )

            return AssistantChatResponse(
                answer=explanation,
                intent=intent,
                sources=sources,
                used_rag=True,
                used_tax_engine=True,
                calculation=calc_resp.model_dump(),
                insufficient_grounding=False,
                audit_trail=audit_trail,
            )

        retrieved_chunks = self.retriever.retrieve(query=query, top_k=5)
        deduped_chunks = self._deduplicate_chunks(retrieved_chunks, max_chunks=3)
        sources = self._build_sources(deduped_chunks)
        insufficient = self._check_insufficient_grounding(deduped_chunks)

        if not deduped_chunks:
            answer = (
                "Here are key statutory guidelines:\n\n"
                "• **New Tax Regime**: Rebate under Section 87A offers zero tax for taxable income up to ₹12 Lakh (salaried standard deduction is ₹75,000).\n"
                "• **Smart Investment & Market Suggestions**: Consider broad-market index funds (NIFTY 50 / S&P BSE Sensex) for long-term equity compounding, PPF/EPF for sovereign debt safety, and NPS for retirement wealth.\n\n"
                "Tell me your annual salary or investment goals to get a customized budget and tax blueprint!"
            )
        else:
            answer = self.llm_service.generate_explanation(
                query=query,
                context_chunks=retrieved_chunks,
                calculation_result=None,
                fast_mode=request.fast_mode,
            )

        # Post-generation scan on EVERY path
        is_override = (answer == SEBI_GUARDRAIL_REFUSAL) or check_sebi_compliance_violation(answer)
        if is_override:
            answer = SEBI_GUARDRAIL_REFUSAL

        processing_time = round((time.perf_counter() - start_time) * 1000.0, 2)
        audit_trail = AuditTrail(
            intent="investment_guidance" if is_override else intent,
            tax_engine_invoked=False,
            tax_engine_summary=None,
            rag_invoked=True,
            retrieved_sources_count=len(sources),
            guardrail_triggered=is_override,
            processing_time_ms=processing_time,
        )

        return AssistantChatResponse(
            answer=answer,
            intent="investment_guidance" if is_override else intent,
            sources=sources,
            used_rag=True,
            used_tax_engine=False,
            calculation=None,
            insufficient_grounding=insufficient and not is_override,
            audit_trail=audit_trail,
        )

    def process_chat_stream_events(self, request: AssistantChatRequest) -> Generator[str, None, None]:
        """Yield Server-Sent Events (SSE) for token streaming with initial metadata payload."""
        start_time = time.perf_counter()
        query = request.message.strip()

        # a) Pre-generation intercept: skip model entirely for stock/fund/crypto picks, buy/sell/hold calls, price predictions
        if is_sebi_intercept_query(query):
            processing_time = round((time.perf_counter() - start_time) * 1000.0, 2)
            audit_trail_dict = {
                "intent": "investment_guidance",
                "tax_engine_invoked": False,
                "tax_engine_summary": None,
                "rag_invoked": False,
                "retrieved_sources_count": 0,
                "guardrail_triggered": True,
                "processing_time_ms": processing_time,
            }
            meta_payload = {
                "intent": "investment_guidance",
                "sources": [],
                "used_rag": False,
                "used_tax_engine": False,
                "calculation": None,
                "insufficient_grounding": False,
                "audit_trail": audit_trail_dict,
            }
            yield f"event: metadata\ndata: {json.dumps(meta_payload, default=str)}\n\n"
            for token in self.llm_service._stream_sebi_disclaimer():
                yield f"event: token\ndata: {json.dumps({'content': token})}\n\n"
            yield "event: done\ndata: {}\n\n"
            return

        intent = self._detect_intent(query)
        logger.info(f"Processing chat query stream (Detected Intent: '{intent}')")

        if intent == "tax_calculation":
            extracted_income = self._extract_income_from_query(query)
            income_to_use = extracted_income or Decimal("1200000")

            tax_req = TaxCalculationRequest(
                annual_income=income_to_use,
                age=30,
                regime="compare",
                is_salaried=True,
                deductions=TaxDeductionsInput(
                    section_80c=Decimal("150000"),
                    section_80d=Decimal("25000"),
                    hra_exemption=Decimal("100000"),
                ),
            )
            calc_resp = compute_tax(tax_req)
            retrieved_chunks = self.retriever.retrieve(query="Old vs New Tax Regime 115BAC", top_k=3)
            deduped_chunks = self._deduplicate_chunks(retrieved_chunks, max_chunks=3)
            sources = [s.model_dump() for s in self._build_sources(deduped_chunks)]

            processing_time = round((time.perf_counter() - start_time) * 1000.0, 2)
            audit_trail_dict = {
                "intent": intent,
                "tax_engine_invoked": True,
                "tax_engine_summary": {
                    "gross_income": float(calc_resp.selected_result.gross_income),
                    "taxable_income": float(calc_resp.selected_result.taxable_income),
                    "recommended_regime": calc_resp.recommended_regime,
                    "total_tax": float(calc_resp.selected_result.total_tax),
                    "potential_savings": float(calc_resp.potential_tax_savings),
                },
                "rag_invoked": True,
                "retrieved_sources_count": len(sources),
                "guardrail_triggered": False,
                "processing_time_ms": processing_time,
            }

            # Emit Metadata event
            meta_payload = {
                "intent": intent,
                "sources": sources,
                "used_rag": True,
                "used_tax_engine": True,
                "calculation": calc_resp.model_dump(),
                "insufficient_grounding": False,
                "audit_trail": audit_trail_dict,
            }
            yield f"event: metadata\ndata: {json.dumps(meta_payload, default=str)}\n\n"

            # Stream Token events
            for token in self.llm_service.generate_explanation_stream(
                query=query,
                context_chunks=deduped_chunks,
                calculation_result=calc_resp.model_dump(),
                fast_mode=request.fast_mode,
            ):
                yield f"event: token\ndata: {json.dumps({'content': token})}\n\n"

            yield "event: done\ndata: {}\n\n"
            return

        retrieved_chunks = self.retriever.retrieve(query=query, top_k=5)
        deduped_chunks = self._deduplicate_chunks(retrieved_chunks, max_chunks=3)
        sources = [s.model_dump() for s in self._build_sources(deduped_chunks)]
        insufficient = self._check_insufficient_grounding(deduped_chunks)

        processing_time = round((time.perf_counter() - start_time) * 1000.0, 2)
        audit_trail_dict = {
            "intent": intent,
            "tax_engine_invoked": False,
            "tax_engine_summary": None,
            "rag_invoked": True,
            "retrieved_sources_count": len(sources),
            "guardrail_triggered": False,
            "processing_time_ms": processing_time,
        }

        # Emit Metadata event
        meta_payload = {
            "intent": intent,
            "sources": sources,
            "used_rag": True,
            "used_tax_engine": False,
            "calculation": None,
            "insufficient_grounding": insufficient,
            "audit_trail": audit_trail_dict,
        }
        yield f"event: metadata\ndata: {json.dumps(meta_payload, default=str)}\n\n"

        if not deduped_chunks:
            warning_msg = (
                "Here are key statutory guidelines:\n\n"
                "• **New Tax Regime**: Rebate under Section 87A offers zero tax for taxable income up to ₹12 Lakh (salaried standard deduction is ₹75,000).\n"
                "• **Smart Investment & Market Suggestions**: Consider broad-market index funds (NIFTY 50 / S&P BSE Sensex) for long-term equity compounding, PPF/EPF for sovereign debt safety, and NPS for retirement wealth.\n\n"
                "Tell me your annual salary or investment goals to give you a customized budget and tax blueprint!"
            )
            yield f"event: token\ndata: {json.dumps({'content': warning_msg})}\n\n"
        else:
            for token in self.llm_service.generate_explanation_stream(
                query=query,
                context_chunks=deduped_chunks,
                calculation_result=None,
                fast_mode=request.fast_mode,
            ):
                yield f"event: token\ndata: {json.dumps({'content': token})}\n\n"

        yield "event: done\ndata: {}\n\n"

    def _build_sources(self, chunks: List[Dict[str, Any]]) -> List[SourceReference]:
        """Build clean source references with similarity scores from retrieved chunk metadata."""
        sources: List[SourceReference] = []
        seen_titles = set()

        for c in chunks:
            if not isinstance(c, dict):
                continue
            meta = c.get("metadata", {})
            title = meta.get("title", "")
            if title and title not in seen_titles:
                seen_titles.add(title)
                sources.append(
                    SourceReference(
                        title=title,
                        category=meta.get("category", "tax"),
                        topic=meta.get("topic", "Tax Rule"),
                        source=meta.get("source", "Income Tax Department"),
                        reference=meta.get("reference"),
                        similarity_score=c.get("similarity_score"),
                    )
                )
        return sources
