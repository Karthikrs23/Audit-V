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
from app.services.llm_service import LLMService
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
        """Detect whether query is a tax calculation request or information question."""
        q_lower = query.lower()
        calc_keywords = ["calculate", "tax on", "lakh", "lac", "salary of", "income of", "my tax"]

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
        """Attempt to extract annual income from query text (e.g., '₹12 lakh' -> 1200000)."""
        q_lower = query.lower()

        match_lakh = re.search(r"(\d+(?:\.\d+)?)\s*(?:lakh|lac|l|lakhs)", q_lower)
        if match_lakh:
            val = float(match_lakh.group(1))
            return Decimal(str(int(val * 100000)))

        match_crore = re.search(r"(\d+(?:\.\d+)?)\s*(?:crore|cr|crores)", q_lower)
        if match_crore:
            val = float(match_crore.group(1))
            return Decimal(str(int(val * 10000000)))

        match_raw = re.search(r"₹?\s*(\d{1,3}(?:,\d{2,3})+|\d{5,8})", query)
        if match_raw:
            raw_str = match_raw.group(1).replace(",", "")
            return Decimal(raw_str)

        return None

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
            sources = self._build_sources(retrieved_chunks)

            explanation = self.llm_service.generate_explanation(
                query=query,
                context_chunks=retrieved_chunks,
                calculation_result=calc_resp.model_dump(),
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
        sources = self._build_sources(retrieved_chunks)
        insufficient = self._check_insufficient_grounding(retrieved_chunks)

        stock_query_keywords = [
            "stock", "ticker", "reliance", "tcs", "infosys", "hdfc", "icici", "wipro",
            "mutual fund", "suggest a fund", "crypto", "bitcoin", "ethereum", "buy right now",
            "should i buy", "should i invest", "good stock", "best stock", "which stock",
            "stock to buy", "what will stock do", "timing", "market prediction", "price target",
            "stock recommendation", "invest in crypto", "fund for me"
        ]

        is_stock_recommendation_query = any(kw in query.lower() for kw in stock_query_keywords)

        if is_stock_recommendation_query:
            answer = self.llm_service.generate_explanation(
                query=query,
                context_chunks=retrieved_chunks,
                calculation_result=None,
            )
            processing_time = round((time.perf_counter() - start_time) * 1000.0, 2)
            audit_trail = AuditTrail(
                intent="investment_guidance",
                tax_engine_invoked=False,
                tax_engine_summary=None,
                rag_invoked=True,
                retrieved_sources_count=len(sources),
                guardrail_triggered=True,
                processing_time_ms=processing_time,
            )
            return AssistantChatResponse(
                answer=answer,
                intent="investment_guidance",
                sources=sources,
                used_rag=True,
                used_tax_engine=False,
                insufficient_grounding=False,
                audit_trail=audit_trail,
            )

        if insufficient:
            answer = (
                "I couldn't find sufficient authoritative information in the Audit V knowledge base "
                "to answer this query reliably with high confidence. Please verify your query or consult "
                "official Indian tax documentation."
            )
        else:
            answer = self.llm_service.generate_explanation(
                query=query,
                context_chunks=retrieved_chunks,
                calculation_result=None,
            )

        processing_time = round((time.perf_counter() - start_time) * 1000.0, 2)
        audit_trail = AuditTrail(
            intent=intent,
            tax_engine_invoked=False,
            tax_engine_summary=None,
            rag_invoked=True,
            retrieved_sources_count=len(sources),
            guardrail_triggered=False,
            processing_time_ms=processing_time,
        )

        return AssistantChatResponse(
            answer=answer,
            intent=intent,
            sources=sources,
            used_rag=True,
            used_tax_engine=False,
            calculation=None,
            insufficient_grounding=insufficient,
            audit_trail=audit_trail,
        )

    def process_chat_stream_events(self, request: AssistantChatRequest) -> Generator[str, None, None]:
        """Yield Server-Sent Events (SSE) for token streaming with initial metadata payload."""
        start_time = time.perf_counter()
        query = request.message.strip()
        intent = self._detect_intent(query)
        logger.info(f"Processing chat query stream (Detected Intent: '{intent}')")

        stock_query_keywords = [
            "stock", "ticker", "reliance", "tcs", "infosys", "hdfc", "icici", "wipro",
            "mutual fund", "suggest a fund", "crypto", "bitcoin", "ethereum", "buy right now",
            "should i buy", "should i invest", "good stock", "best stock", "which stock",
            "stock to buy", "what will stock do", "timing", "market prediction", "price target",
            "stock recommendation", "invest in crypto", "fund for me"
        ]
        is_stock_query = any(kw in query.lower() for kw in stock_query_keywords)

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
            sources = [s.model_dump() for s in self._build_sources(retrieved_chunks)]

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
                context_chunks=retrieved_chunks,
                calculation_result=calc_resp.model_dump(),
            ):
                yield f"event: token\ndata: {json.dumps({'content': token})}\n\n"

            yield "event: done\ndata: {}\n\n"
            return

        retrieved_chunks = self.retriever.retrieve(query=query, top_k=5)
        sources = [s.model_dump() for s in self._build_sources(retrieved_chunks)]
        insufficient = self._check_insufficient_grounding(retrieved_chunks)

        effective_intent = "investment_guidance" if is_stock_query else intent
        processing_time = round((time.perf_counter() - start_time) * 1000.0, 2)
        audit_trail_dict = {
            "intent": effective_intent,
            "tax_engine_invoked": False,
            "tax_engine_summary": None,
            "rag_invoked": True,
            "retrieved_sources_count": len(sources),
            "guardrail_triggered": is_stock_query,
            "processing_time_ms": processing_time,
        }

        # Emit Metadata event
        meta_payload = {
            "intent": effective_intent,
            "sources": sources,
            "used_rag": True,
            "used_tax_engine": False,
            "calculation": None,
            "insufficient_grounding": insufficient and not is_stock_query,
            "audit_trail": audit_trail_dict,
        }
        yield f"event: metadata\ndata: {json.dumps(meta_payload, default=str)}\n\n"

        if insufficient and not is_stock_query:
            warning_msg = (
                "I couldn't find sufficient authoritative information in the Audit V knowledge base "
                "to answer this query reliably with high confidence. Please verify your query or consult "
                "official Indian tax documentation."
            )
            yield f"event: token\ndata: {json.dumps({'content': warning_msg})}\n\n"
        else:
            for token in self.llm_service.generate_explanation_stream(
                query=query,
                context_chunks=retrieved_chunks,
                calculation_result=None,
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
