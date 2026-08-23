from __future__ import annotations

import logging
import re
import time
from pathlib import Path
from typing import Any, Dict, Generator, List, Optional, Tuple

from app.core.config import get_settings
from app.core.logging import configure_logging, get_logger, log_structured_event

logger = configure_logging()

# Module-level Singleton Model Cache
_model_cache: Optional[Tuple[Any, Any]] = None
_model_load_failed: bool = False
_model_load_time_sec: float = 0.0


def load_finetuned_model() -> Tuple[Any, Any]:
    """Lazy singleton loader for 4-bit NF4 Qwen base model + Audit V LoRA adapter.

    Loads the base Qwen/Qwen2.5-3B-Instruct model in 4-bit NF4 quantization
    and attaches the fine-tuned LoRA adapter (peterrs23/audit-v-qwen-3b or local model path).

    Returns:
        (model, tokenizer) if loaded successfully, or (None, None) if unavailable/fallback.
    """
    global _model_cache, _model_load_failed, _model_load_time_sec

    if _model_cache is not None:
        return _model_cache

    if _model_load_failed:
        return None, None

    settings = get_settings()

    try:
        import torch
        if not torch.cuda.is_available():
            logger.info("CUDA GPU unavailable. Deferring fine-tuned LLM to grounded fallback generator.")
            _model_load_failed = True
            return None, None

        logger.info(f"Loading 4-bit Base Model '{settings.HF_MODEL_NAME}' and LoRA Adapter '{settings.HF_ADAPTER_REPO}'...")
        t0 = time.time()

        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=True,
            bnb_4bit_compute_dtype=torch.float16,
        )

        # Check local model path fallback first
        local_adapter_path = Path(__file__).resolve().parents[2] / "models" / "audit_v_qwen_lora"
        adapter_source = str(local_adapter_path) if local_adapter_path.exists() else settings.HF_ADAPTER_REPO

        tokenizer = AutoTokenizer.from_pretrained(adapter_source, trust_remote_code=True)
        if tokenizer.pad_token is None:
            tokenizer.pad_token = tokenizer.eos_token
        tokenizer.padding_side = "right"

        base_model = AutoModelForCausalLM.from_pretrained(
            settings.HF_MODEL_NAME,
            quantization_config=bnb_config,
            device_map="auto",
            attn_implementation="sdpa",
            trust_remote_code=True,
        )

        model = PeftModel.from_pretrained(base_model, adapter_source)
        model.eval()

        _model_load_time_sec = time.time() - t0
        allocated_gb = torch.cuda.memory_allocated(0) / (1024**3)
        logger.info(
            f"Successfully loaded Audit V Qwen LoRA adapter in {_model_load_time_sec:.2f}s! "
            f"GPU VRAM Allocated: {allocated_gb:.2f} GB."
        )

        _model_cache = (model, tokenizer)
        return _model_cache

    except Exception as err:
        logger.warning(f"Failed to load fine-tuned LLM adapter ({err}). Falling back to grounded template generator.")
        _model_load_failed = True
        return None, None


def get_model_metrics() -> Dict[str, Any]:
    """Return runtime metadata regarding the fine-tuned model status."""
    settings = get_settings()
    is_loaded = _model_cache is not None

    vram_gb = 0.0
    try:
        import torch
        if torch.cuda.is_available() and is_loaded:
            vram_gb = round(torch.cuda.memory_allocated(0) / (1024**3), 2)
    except Exception:
        pass

    return {
        "is_loaded": is_loaded,
        "base_model": settings.HF_MODEL_NAME,
        "adapter_repo": settings.HF_ADAPTER_REPO,
        "load_time_seconds": round(_model_load_time_sec, 2),
        "vram_allocated_gb": vram_gb,
        "fallback_active": _model_load_failed or not is_loaded,
    }


class LLMService:
    """Production LLM Service integrating Audit V Fine-Tuned Qwen with RAG & Tax Engine."""

    def __init__(self) -> None:
        self.settings = get_settings()

    def generate_explanation(
        self,
        query: str,
        context_chunks: List[Dict[str, Any]],
        calculation_result: Optional[Dict[str, Any]] = None,
        risk_result: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Generate a grounded natural language response using fine-tuned Qwen or fallback generator with structured logging."""
        start_time = time.perf_counter()
        llm_logger = get_logger("llm_service")

        try:
            model, tokenizer = load_finetuned_model()
            engine_name = "Qwen2.5-3B-Instruct-LoRA" if model is not None else "GroundedTemplateFallback"

            if model is not None and tokenizer is not None:
                try:
                    res = self._generate_qwen_response(
                        model=model,
                        tokenizer=tokenizer,
                        query=query,
                        context_chunks=context_chunks,
                        calculation_result=calculation_result,
                        risk_result=risk_result,
                    )
                except Exception as gen_err:
                    logger.error(f"Error during Qwen generation ({gen_err}). Using grounded fallback.")
                    res = self._generate_grounded_fallback(
                        query=query,
                        context_chunks=context_chunks,
                        calculation_result=calculation_result,
                        risk_result=risk_result,
                    )
            else:
                res = self._generate_grounded_fallback(
                    query=query,
                    context_chunks=context_chunks,
                    calculation_result=calculation_result,
                    risk_result=risk_result,
                )

            duration_ms = (time.perf_counter() - start_time) * 1000.0
            log_structured_event(
                logger=llm_logger,
                engine=engine_name,
                processing_time_ms=duration_ms,
                status="SUCCESS",
                metadata={
                    "query_length": len(query),
                    "num_context_chunks": len(context_chunks),
                    "stream": False,
                    "has_calculation": calculation_result is not None,
                    "has_risk": risk_result is not None,
                },
            )
            return res
        except Exception as err:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            log_structured_event(
                logger=llm_logger,
                engine="LLMService",
                processing_time_ms=duration_ms,
                status="FAILURE",
                metadata={"error": str(err)},
                level=logging.ERROR,
            )
            raise

    def generate_explanation_stream(
        self,
        query: str,
        context_chunks: List[Dict[str, Any]],
        calculation_result: Optional[Dict[str, Any]] = None,
        risk_result: Optional[Dict[str, Any]] = None,
    ) -> Generator[str, None, None]:
        """Stream response tokens in real-time using TextIteratorStreamer or fallback generator with structured logging."""
        start_time = time.perf_counter()
        llm_logger = get_logger("llm_service")

        model, tokenizer = load_finetuned_model()
        engine_name = "Qwen2.5-3B-Instruct-LoRA-Stream" if model is not None else "GroundedTemplateFallback-Stream"

        token_count = 0
        try:
            if model is not None and tokenizer is not None:
                try:
                    for token in self._generate_qwen_stream(
                        model=model,
                        tokenizer=tokenizer,
                        query=query,
                        context_chunks=context_chunks,
                        calculation_result=calculation_result,
                        risk_result=risk_result,
                    ):
                        token_count += 1
                        yield token

                    duration_ms = (time.perf_counter() - start_time) * 1000.0
                    log_structured_event(
                        logger=llm_logger,
                        engine=engine_name,
                        processing_time_ms=duration_ms,
                        status="SUCCESS",
                        metadata={
                            "query_length": len(query),
                            "num_context_chunks": len(context_chunks),
                            "stream": True,
                            "tokens_yielded": token_count,
                            "has_calculation": calculation_result is not None,
                            "has_risk": risk_result is not None,
                        },
                    )
                    return
                except Exception as gen_err:
                    logger.error(f"Error during Qwen streaming ({gen_err}). Falling back to grounded stream.")

            for token in self._generate_grounded_fallback_stream(
                query=query,
                context_chunks=context_chunks,
                calculation_result=calculation_result,
                risk_result=risk_result,
            ):
                token_count += 1
                yield token

            duration_ms = (time.perf_counter() - start_time) * 1000.0
            log_structured_event(
                logger=llm_logger,
                engine=engine_name,
                processing_time_ms=duration_ms,
                status="SUCCESS",
                metadata={
                    "query_length": len(query),
                    "num_context_chunks": len(context_chunks),
                    "stream": True,
                    "tokens_yielded": token_count,
                    "has_calculation": calculation_result is not None,
                    "has_risk": risk_result is not None,
                },
            )
        except Exception as err:
            duration_ms = (time.perf_counter() - start_time) * 1000.0
            log_structured_event(
                logger=llm_logger,
                engine=engine_name,
                processing_time_ms=duration_ms,
                status="FAILURE",
                metadata={"error": str(err)},
                level=logging.ERROR,
            )
            raise

    def _generate_qwen_response(
        self,
        model: Any,
        tokenizer: Any,
        query: str,
        context_chunks: List[Dict[str, Any]],
        calculation_result: Optional[Dict[str, Any]] = None,
        risk_result: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Generate response via fine-tuned Qwen 4-bit model with ChatML prompt template."""
        import torch

        system_prompt = (
            "You are Audit V, an AI financial, tax, and compliance assistant. "
            "Provide accurate, professional, educational explanations grounded in official Indian tax law, "
            "GST rules, and financial best practices. "
            "CRITICAL COMPLIANCE DIRECTIVE FOR INVESTMENTS: Never recommend specific stock tickers, "
            "specific mutual fund scheme names, or buy/sell/hold timing calls. "
            "Only discuss broad asset classes (equity index funds, debt/fixed income, gold), instrument types (ELSS, PPF, NPS, FDs), "
            "and general risk-return characteristics grounded in the retrieved context. "
            "ALWAYS include a brief disclaimer that this is educational information, not personalized investment advice, "
            "and that the user should consult a SEBI-registered investment adviser for personalized recommendations."
        )

        user_content_parts = []

        if calculation_result:
            selected = calculation_result.get("selected_result", {})
            gross_val = int(float(selected.get("gross_income", 0)))
            tax_val = int(float(selected.get("total_tax", 0)))
            monthly_val = int(float(selected.get("monthly_tax_estimate", 0)))
            savings_val = int(float(calculation_result.get("potential_tax_savings", 0)))
            user_content_parts.append(
                f"[TAX CALCULATION RESULT FROM AUDIT V TAX ENGINE]\n"
                f"Gross Income: ₹{gross_val:,}\n"
                f"Recommended Regime: {calculation_result.get('recommended_regime', 'Selected')}\n"
                f"Total Estimated Tax: ₹{tax_val:,}\n"
                f"Monthly Tax Estimate: ₹{monthly_val:,}\n"
                f"Potential Tax Savings: ₹{savings_val:,}\n"
            )

        if risk_result:
            user_content_parts.append(
                f"[TRANSACTION RISK ASSESSMENT FROM AUDIT V ANOMALY ENGINE]\n"
                f"Total Transactions: {risk_result.get('total_transactions', 0)}\n"
                f"Anomalies Detected: {risk_result.get('anomalies_detected', 0)}\n"
                f"Summary Explanation: {risk_result.get('summary_explanation', '')}\n"
            )

        if context_chunks:
            context_text = "\n".join([f"- {c.get('content', '')}" for c in context_chunks[:3] if isinstance(c, dict)])
            user_content_parts.append(f"[AUTHORITATIVE KNOWLEDGE BASE CONTEXT]\n{context_text}\n")

        user_content_parts.append(f"User Query: {query}")
        user_prompt = "\n\n".join(user_content_parts)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(prompt, return_tensors="pt")
        target_device = getattr(model, "device", "cuda")
        if hasattr(inputs, "to"):
            inputs = inputs.to(target_device)

        t0 = time.time()
        with torch.no_grad():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=min(self.settings.LLM_MAX_NEW_TOKENS, 256),
                temperature=self.settings.LLM_TEMPERATURE,
                top_p=0.9,
                do_sample=True,
                use_cache=True,
                pad_token_id=tokenizer.eos_token_id,
            )
        latency = time.time() - t0

        input_ids = inputs.input_ids if hasattr(inputs, "input_ids") else inputs.get("input_ids", [[]])
        input_len = input_ids.shape[1] if hasattr(input_ids, "shape") else len(input_ids[0])
        total_len = output_ids[0].shape[0] if hasattr(output_ids[0], "shape") else len(output_ids[0])
        output_tokens_count = max(0, total_len - input_len)
        tokens_per_sec = output_tokens_count / latency if latency > 0 else 0.0

        generated_text = tokenizer.decode(output_ids[0][input_len:], skip_special_tokens=True).strip()
        logger.info(
            f"[LLM Latency Profile] Input Tokens: {input_len} | Output Tokens: {output_tokens_count} | "
            f"Wall Time: {latency:.2f}s | Speed: {tokens_per_sec:.2f} tokens/sec | Device: {target_device}"
        )
        return generated_text

    def _generate_qwen_stream(
        self,
        model: Any,
        tokenizer: Any,
        query: str,
        context_chunks: List[Dict[str, Any]],
        calculation_result: Optional[Dict[str, Any]] = None,
        risk_result: Optional[Dict[str, Any]] = None,
    ) -> Generator[str, None, None]:
        """Stream response tokens using Hugging Face TextIteratorStreamer in a background thread."""
        import threading
        import torch
        from transformers import TextIteratorStreamer

        system_prompt = (
            "You are Audit V, an AI financial, tax, and compliance assistant. "
            "Provide accurate, professional, educational explanations grounded in official Indian tax law, "
            "GST rules, and financial best practices. "
            "CRITICAL COMPLIANCE DIRECTIVE FOR INVESTMENTS: Never recommend specific stock tickers, "
            "specific mutual fund scheme names, or buy/sell/hold timing calls. "
            "Only discuss broad asset classes (equity index funds, debt/fixed income, gold), instrument types (ELSS, PPF, NPS, FDs), "
            "and general risk-return characteristics grounded in the retrieved context. "
            "ALWAYS include a brief disclaimer that this is educational information, not personalized investment advice, "
            "and that the user should consult a SEBI-registered investment adviser for personalized recommendations."
        )

        user_content_parts = []
        if calculation_result:
            selected = calculation_result.get("selected_result", {})
            gross_val = int(float(selected.get("gross_income", 0)))
            tax_val = int(float(selected.get("total_tax", 0)))
            monthly_val = int(float(selected.get("monthly_tax_estimate", 0)))
            savings_val = int(float(calculation_result.get("potential_tax_savings", 0)))
            user_content_parts.append(
                f"[TAX CALCULATION RESULT FROM AUDIT V TAX ENGINE]\n"
                f"Gross Income: ₹{gross_val:,}\n"
                f"Recommended Regime: {calculation_result.get('recommended_regime', 'Selected')}\n"
                f"Total Estimated Tax: ₹{tax_val:,}\n"
                f"Monthly Tax Estimate: ₹{monthly_val:,}\n"
                f"Potential Tax Savings: ₹{savings_val:,}\n"
            )

        if risk_result:
            user_content_parts.append(
                f"[TRANSACTION RISK ASSESSMENT FROM AUDIT V ANOMALY ENGINE]\n"
                f"Total Transactions: {risk_result.get('total_transactions', 0)}\n"
                f"Anomalies Detected: {risk_result.get('anomalies_detected', 0)}\n"
                f"Summary Explanation: {risk_result.get('summary_explanation', '')}\n"
            )

        if context_chunks:
            context_text = "\n".join([f"- {c.get('content', '')}" for c in context_chunks[:3] if isinstance(c, dict)])
            user_content_parts.append(f"[AUTHORITATIVE KNOWLEDGE BASE CONTEXT]\n{context_text}\n")

        user_content_parts.append(f"User Query: {query}")
        user_prompt = "\n\n".join(user_content_parts)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        inputs = tokenizer(prompt, return_tensors="pt")
        target_device = getattr(model, "device", "cuda")
        if hasattr(inputs, "to"):
            inputs = inputs.to(target_device)

        streamer = TextIteratorStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)

        generation_kwargs = dict(
            **inputs,
            streamer=streamer,
            max_new_tokens=min(self.settings.LLM_MAX_NEW_TOKENS, 256),
            temperature=self.settings.LLM_TEMPERATURE,
            top_p=0.9,
            do_sample=True,
            use_cache=True,
            pad_token_id=tokenizer.eos_token_id,
        )

        thread = threading.Thread(target=model.generate, kwargs=generation_kwargs)
        thread.start()

        for token in streamer:
            yield token

        thread.join()

    def _generate_grounded_fallback_stream(
        self,
        query: str,
        context_chunks: List[Dict[str, Any]],
        calculation_result: Optional[Dict[str, Any]] = None,
        risk_result: Optional[Dict[str, Any]] = None,
    ) -> Generator[str, None, None]:
        """Stream fallback text word-by-word with small interval delays."""
        full_text = self._generate_grounded_fallback(
            query=query,
            context_chunks=context_chunks,
            calculation_result=calculation_result,
            risk_result=risk_result,
        )
        words = re.findall(r"\S+|\s+", full_text)
        for word in words:
            yield word
            time.sleep(0.005)

    def _generate_grounded_fallback(
        self,
        query: str,
        context_chunks: List[Dict[str, Any]],
        calculation_result: Optional[Dict[str, Any]] = None,
        risk_result: Optional[Dict[str, Any]] = None,
    ) -> str:
        """Structured grounded response generator used when local/HF model is unavailable."""
        if calculation_result:
            selected = calculation_result.get("selected_result", {})
            regime = selected.get("regime", "selected tax regime")
            total_tax = selected.get("total_tax", "0")
            monthly = selected.get("monthly_tax_estimate", "0")
            gross = selected.get("gross_income", "0")
            recommended = calculation_result.get("recommended_regime", regime)
            savings = calculation_result.get("potential_tax_savings", "0")

            explanation = (
                f"Based on the deterministic Indian Income Tax engine calculation for an annual income of ₹{int(float(gross)):,}:\n\n"
                f"• **Recommended Option**: {recommended}\n"
                f"• **Estimated Total Tax**: ₹{int(float(total_tax)):,} under {regime}\n"
                f"• **Monthly TDS Estimate**: ₹{int(float(monthly)):,}/month\n"
            )

            if savings and float(savings) > 0:
                explanation += f"• **Potential Tax Savings**: Up to ₹{int(float(savings)):,} by choosing the recommended regime.\n\n"

            explanation += (
                "**Key Tax Rules Applied**:\n"
                "Under the New Tax Regime (Section 115BAC) for Tax Year 2026-27, a standard deduction of ₹75,000 is applied, and taxable income up to ₹12,00,000 receives a Section 87A rebate of up to ₹60,000 (zero tax). "
                "Under the Old Tax Regime, standard deduction is ₹50,000 and deductions under Section 80C (up to ₹1.5L), Section 80D (health insurance), and HRA are claimed."
            )
            return explanation

        if risk_result:
            return risk_result.get("summary_explanation", "Transaction risk assessment completed successfully.")

        # Check if query requests specific stock tickers, fund scheme names, or buy/sell calls
        stock_query_keywords = [
            "stock", "ticker", "reliance", "tcs", "infosys", "hdfc", "icici", "wipro",
            "mutual fund", "suggest a fund", "crypto", "bitcoin", "ethereum", "buy right now",
            "should i buy", "should i invest", "good stock", "best stock", "which stock",
            "stock to buy", "what will stock do", "timing", "market prediction", "price target",
            "stock recommendation", "invest in crypto", "fund for me"
        ]
        if any(kw in query.lower() for kw in stock_query_keywords):
            return (
                "Audit V does not recommend specific stock tickers, specific mutual fund scheme names, or buy/sell/hold timing calls.\n\n"
                "Sound financial planning focuses on broad asset class diversification based on your risk profile:\n"
                "• **Equity Index Funds & ETFs**: Broad market exposure (e.g., NIFTY 50) for long-term compounding.\n"
                "• **Debt & Fixed Income**: Public Provident Fund (PPF), Bank FDs, and debt funds for capital preservation.\n"
                "• **Gold**: Sovereign Gold Bonds & Gold ETFs as an inflation hedge.\n"
                "• **Tax-Saving Instruments**: ELSS Mutual Funds, PPF, and NPS under Section 80C & 80CCD(1B).\n\n"
                "**Disclaimer**: This information is for educational and tax planning purposes only and does not constitute personalized investment advice. "
                "Please consult a SEBI-registered investment adviser for personalized investment recommendations."
            )

        if not context_chunks:
            return (
                "I couldn't find sufficient information in the Audit V knowledge base to answer this query reliably. "
                "Please verify your query or consult official tax documentation."
            )

        response_bullets = []
        seen_titles = set()

        for chunk in context_chunks:
            if not isinstance(chunk, dict):
                continue
            metadata = chunk.get("metadata", {})
            title = metadata.get("title", "Knowledge Document")
            content = chunk.get("content", "")
            clean_content = re.sub(r"^\[.*?\]\s*", "", content).strip()
            if title not in seen_titles and clean_content:
                seen_titles.add(title)
                response_bullets.append(f"• **{title}**:\n  {clean_content}")

        answer = (
            f"Here is the relevant tax and financial compliance information retrieved from the Audit V Knowledge Base:\n\n"
            + "\n\n".join(response_bullets)
            + "\n\n*Note: Grounded in official Indian Tax & Financial guidelines.*"
        )
        return answer
