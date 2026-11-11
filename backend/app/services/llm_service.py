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
_model_loading: bool = False


def load_finetuned_model(blocking: bool = True) -> Tuple[Any, Any]:
    """Lazy singleton loader for 4-bit NF4 Qwen base model + Audit V LoRA adapter.

    Loads the base Qwen/Qwen2.5-3B-Instruct model in 4-bit NF4 quantization
    and attaches the fine-tuned LoRA adapter (peterrs23/audit-v-qwen-3b or local model path).

    Args:
        blocking: If False and model is not yet cached, returns (None, None) immediately
                  instead of blocking the caller during heavy weight loads.

    Returns:
        (model, tokenizer) if loaded successfully, or (None, None) if unavailable/fallback.
    """
    global _model_cache, _model_load_failed, _model_load_time_sec, _model_loading

    if _model_cache is not None:
        return _model_cache

    if _model_load_failed or _model_loading or not blocking:
        return None, None

    settings = get_settings()

    try:
        import torch
        if not torch.cuda.is_available():
            logger.info("CUDA GPU unavailable. Deferring fine-tuned LLM to grounded fallback generator.")
            _model_load_failed = True
            return None, None

        _model_loading = True

        logger.info(f"Loading 4-bit Base Model '{settings.HF_MODEL_NAME}' and LoRA Adapter '{settings.HF_ADAPTER_REPO}'...")
        t0 = time.time()

        from peft import PeftModel
        from transformers import AutoModelForCausalLM, AutoTokenizer, BitsAndBytesConfig

        bnb_config = BitsAndBytesConfig(
            load_in_4bit=True,
            bnb_4bit_quant_type="nf4",
            bnb_4bit_use_double_quant=False,
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
            device_map={"": 0},
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
    finally:
        _model_loading = False


def warmup_model() -> None:
    """Pre-warm the model singleton and execute a minimal forward pass in GPU memory."""
    try:
        model, tokenizer = load_finetuned_model()
        if model is not None and tokenizer is not None:
            import torch
            dummy_input = tokenizer(
                "<|im_start|>system\nYou are Audit V.<|im_end|>\n<|im_start|>user\nHi<|im_end|>\n<|im_start|>assistant\n",
                return_tensors="pt",
            )
            target_device = getattr(model, "device", "cuda:0")
            if hasattr(dummy_input, "to"):
                dummy_input = dummy_input.to(target_device)
            with torch.inference_mode():
                model.generate(**dummy_input, max_new_tokens=2, pad_token_id=tokenizer.eos_token_id)
            logger.info("Audit V fine-tuned model warmup complete on GPU.")
    except Exception as e:
        logger.warning(f"Model warmup encountered notice: {e}")


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


# ==============================================================================
# DETERMINISTIC SEBI COMPLIANCE CODE-LEVEL GUARDRAIL
# ==============================================================================
SEBI_GUARDRAIL_REFUSAL: str = (
    "**Statutory Financial Advisory Disclaimer (SEBI Compliance)**\n\n"
    "Audit V is strictly an AI tax compliance, filing assistance, and statutory financial analytics system. "
    "Under the Securities and Exchange Board of India (SEBI) (Investment Advisers) Regulations, 2013, "
    "Audit V does not recommend specific stocks or provide individual stock recommendations, "
    "ticker-level buy/sell ratings, price targets, or speculative equity advice.\n\n"
    "• For long-term capital preservation and wealth accumulation across asset classes, statutory investment vehicles such as "
    "broad-market index funds (NIFTY 50 / S&P BSE Sensex), Public Provident Fund (PPF), and the National Pension System (NPS) "
    "may be considered in alignment with your tax planning.\n"
    "• For specific stock trading or portfolio advisory, please consult a SEBI-registered Investment Adviser (RIA) "
    "or qualified financial professional."
)

STOCK_TICKER_PATTERNS: List[str] = [
    r"\breliance\b", r"\bril\b", r"\btata motors\b", r"\btatamotors\b", r"\btata steel\b",
    r"\btcs\b", r"\binfosys\b", r"\binfy\b", r"\bhdfc\b", r"\bicici\b", r"\bwipro\b",
    r"\bitc\b", r"\bsbi\b", r"\bstate bank of india\b", r"\bbharti airtel\b", r"\bairtel\b",
    r"\badani\b", r"\bmaruti\b", r"\bbajaj\b", r"\bl&t\b", r"\blarsen\b", r"\bkotak\b",
    r"\bhul\b", r"\bhindustan unilever\b", r"\bzomato\b", r"\bpaytm\b", r"\bnykaa\b",
    r"\btitan\b", r"\baxis bank\b", r"\btech mahindra\b", r"\bsun pharma\b", r"\bcipla\b",
    r"\bvedanta\b", r"\bntpc\b", r"\bongc\b", r"\bpower grid\b", r"\bcoal india\b",
    r"\bnifty\b", r"\bsensex\b", r"\btata\b",
]

RECOMMENDATION_LANGUAGE_PATTERNS: List[str] = [
    r"\bbuy\b", r"\bbetter buy\b", r"\bbetter than\b", r"\bsell\b", r"\bshould invest\b",
    r"\bshould buy\b", r"\bstrong buy\b", r"\btarget price\b", r"\bundervalued\b",
    r"\bovervalued\b", r"\boutperform\b", r"\baccumulate\b", r"\bhold\b", r"\binvest in\b",
    r"\bgood stock\b", r"\bbest stock\b", r"\brecommend buying\b", r"\brecommend selling\b",
    r"\bstock pick\b", r"\bpromising pick\b", r"\bportfolio addition\b", r"\bprice target\b",
]


def is_sebi_intercept_query(query: str) -> bool:
    """Pre-generation intercept: returns True if query asks for stock/fund/crypto picks,
    buy/sell/hold calls, price predictions, or specific ticker recommendations.
    """
    if not query:
        return False
    q = query.lower().strip()

    # 1. Buy/sell/hold calls
    buy_sell = [
        r"\b(should i|to)\s+(buy|sell|hold|invest in)\b",
        r"\bis\s+([a-zA-Z\s]+)\s+(a\s+)?(buy|sell|hold)\b",
        r"\bwhich\s+(stock|shares?|fund|crypto)\s+(should i|to)\s+buy\b",
        r"\b(buy|sell)\s+right now\b",
        r"\b(strong\s+)?(buy|sell|hold)\s+(call|rating|signal|recommendation)\b",
    ]
    if any(re.search(p, q) for p in buy_sell):
        return True

    # 2. Stock/fund/crypto pick or suggestion requests
    picks = [
        r"\b(suggest|recommend)\s+(a\s+|me\s+)?(mutual\s+fund|fund|stock|crypto|share)\b",
        r"\b(fund|mutual\s+fund)\s+for\s+me\b",
        r"\b(good|best|top|winning)\s+(stock|mutual\s+fund|crypto|shares?)\s+(to\s+buy|to\s+pick|to\s+invest)\b",
        r"\b(stock|crypto|fund)\s+(picks?|recommendations?)\b",
        r"\bwhat\s+(is\s+a\s+)?(good|best)\s+stock\b",
        r"\bshould\s+i\s+invest\s+in\s+crypto\b",
        r"\binvest\s+in\s+(crypto|bitcoin|ethereum)\b",
    ]
    if any(re.search(p, q) for p in picks):
        return True

    # 3. Stock price predictions or future performance
    predictions = [
        r"\bwhat\s+will\s+([a-zA-Z\s]+)\s+(stock|shares?)\s+do\b",
        r"\b(stock|market|price)\s+(target|prediction|forecast)\b",
        r"\btarget\s+price\b",
        r"\bwill\s+([a-zA-Z\s]+)\s+(rise|fall|crash|go up|rally|drop)\b",
    ]
    if any(re.search(p, q) for p in predictions):
        return True

    # 4. Ticker paired with recommendation wording in query
    has_ticker = any(re.search(p, q) for p in STOCK_TICKER_PATTERNS)
    if has_ticker and any(re.search(p, q) for p in RECOMMENDATION_LANGUAGE_PATTERNS):
        return True

    return False


def check_sebi_compliance_violation(text: str) -> bool:
    """Deterministic, code-level scan for stock tickers/company names combined with recommendation language.

    Returns True if the generated text violates SEBI regulatory boundaries.
    """
    if not text:
        return False
    t = text.lower()
    has_ticker = any(re.search(p, t) for p in STOCK_TICKER_PATTERNS)
    has_rec = any(re.search(p, t) for p in RECOMMENDATION_LANGUAGE_PATTERNS)
    return bool(has_ticker and has_rec)


def trim_to_last_complete_sentence(text: str) -> str:
    """Trim response text to the last complete sentence ending in '.', '!', '?', or markdown block."""
    if not text:
        return text
    t = text.strip()
    if t.endswith((".", "!", "?", "```", ")", "}", "*", "#", ":")):
        return t

    match = list(re.finditer(r"[\.!\?](?:\s|$)", t))
    if match:
        return t[:match[-1].end()].strip()
    return t + "."


def verify_and_format_tax_narrative(
    llm_summary: str,
    calc_result: Dict[str, Any],
) -> str:
    """Verify that every rupee amount in llm_summary appears in calc_result.

    If any hallucinated amount is found, discard llm_summary and use deterministic text.
    Returns the deterministic slab-by-slab breakdown with verified plain-language summary.
    """
    from decimal import Decimal
    selected = calc_result.get("selected_result", {})
    gross_val = int(Decimal(str(selected.get("gross_income", "0"))))
    taxable_val = int(Decimal(str(selected.get("taxable_income", "0"))))
    std_ded_val = int(Decimal(str(selected.get("standard_deduction", "0"))))
    total_tax_val = int(Decimal(str(selected.get("total_tax", "0"))))
    rebate_val = int(Decimal(str(selected.get("rebate_87a", "0"))))
    cess_val = int(Decimal(str(selected.get("cess", "0"))))
    surcharge_val = int(Decimal(str(selected.get("surcharge", "0"))))
    net_annual = gross_val - total_tax_val
    net_monthly = int(round(net_annual / 12.0))
    monthly_tax = int(Decimal(str(selected.get("monthly_tax_estimate", "0"))))
    savings_val = int(Decimal(str(calc_result.get("potential_tax_savings", "0"))))
    regime = selected.get("regime", "New Tax Regime (Section 115BAC)")
    recommended = calc_result.get("recommended_regime", regime)

    # Valid set of numeric amounts from engine output
    valid_numbers = {
        gross_val, taxable_val, std_ded_val, total_tax_val, rebate_val,
        cess_val, surcharge_val, net_annual, net_monthly, monthly_tax, savings_val,
        0, 4, 5, 10, 15, 20, 25, 30, 400000, 800000, 1200000, 1600000, 2000000, 2400000,
        50000, 75000, 60000, 12500, 150000, 25000, 12, 1, 2, 9, 12, 15, 24, 900000, 1200000, 2400000
    }
    for s in selected.get("slab_breakdown", []):
        try:
            valid_numbers.add(int(Decimal(str(s.get("taxable_in_slab", "0")))))
            valid_numbers.add(int(Decimal(str(s.get("tax_for_slab", "0")))))
            valid_numbers.add(int(float(s.get("rate_percentage", 0))))
        except Exception:
            pass

    is_valid = True
    if llm_summary:
        num_matches = re.findall(r"(?:₹|rs\.?|inr)?\s*(\d{1,3}(?:,\d{2,3})+|\d+)", llm_summary.lower())
        for nm in num_matches:
            clean_num = int(nm.replace(",", ""))
            if clean_num > 100 and clean_num not in valid_numbers:
                is_valid = False
                break

    # Build deterministic slab breakdown
    slab_lines = []
    for s in selected.get("slab_breakdown", []):
        s_range = s.get("slab_range", "")
        s_rate = float(s.get("rate_percentage", 0.0))
        s_taxable = int(Decimal(str(s.get("taxable_in_slab", "0"))))
        s_tax = int(Decimal(str(s.get("tax_for_slab", "0"))))
        slab_lines.append(f"  • **{s_range}** ({s_rate:.0f}%): Taxable ₹{s_taxable:,} → Tax ₹{s_tax:,}")

    deterministic_table = (
        f"### 🏛️ Official Slab-by-Slab Breakdown (Tax Year 2026-27)\n"
        f"• **Gross Annual Income**: ₹{gross_val:,}\n"
        f"• **Standard Deduction**: -₹{std_ded_val:,}\n"
        f"• **Net Taxable Income**: ₹{taxable_val:,}\n\n"
        f"**Slab Computation Details:**\n" + "\n".join(slab_lines) + "\n\n"
        f"• **Section 87A Rebate**: -₹{rebate_val:,}\n"
        f"• **Health & Education Cess (4%)**: ₹{cess_val:,}\n"
        f"• **Total Income Tax Payable**: **₹{total_tax_val:,}**\n"
        f"• **Monthly TDS Withholding**: ₹{monthly_tax:,}/month\n"
        f"• **Net Annual Take-Home Salary**: **₹{net_annual:,}** (~₹{net_monthly:,}/month).\n"
        f"• **Recommended Option**: {recommended}.\n"
    )
    if savings_val > 0:
        deterministic_table += f"• **Potential Tax Savings vs Alternative**: ₹{savings_val:,}.\n"

    if is_valid and llm_summary:
        sentences = [s.strip() for s in re.split(r"(?<=[.!?])\s+", llm_summary.strip()) if s.strip()]
        concise = " ".join(sentences[:2]) if sentences else llm_summary
        return f"{concise}\n\n---\n\n{deterministic_table}"
    else:
        fallback_summary = (
            f"For an annual gross income of ₹{gross_val:,} under the {regime}, "
            f"your total estimated income tax liability is ₹{total_tax_val:,} with a net annual take-home salary of ₹{net_annual:,}."
        )
        return f"{fallback_summary}\n\n---\n\n{deterministic_table}"


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
        fast_mode: bool = True,
    ) -> str:
        """Generate a grounded natural language response using fine-tuned Qwen or fallback generator with structured logging."""
        start_time = time.perf_counter()
        llm_logger = get_logger("llm_service")

        # 1. Pre-generation SEBI intercept check
        if is_sebi_intercept_query(query):
            return SEBI_GUARDRAIL_REFUSAL

        if fast_mode:
            res = self._generate_grounded_fallback(
                query=query,
                context_chunks=context_chunks,
                calculation_result=calculation_result,
                risk_result=risk_result,
            )
            if calculation_result:
                res = verify_and_format_tax_narrative(res, calculation_result)
            if check_sebi_compliance_violation(res):
                res = SEBI_GUARDRAIL_REFUSAL
            return trim_to_last_complete_sentence(res)

        try:
            model, tokenizer = load_finetuned_model(blocking=False)
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

            # Post-generation scan on EVERY path
            if check_sebi_compliance_violation(res):
                logger.warning("[SEBI_GUARDRAIL] Violation detected in generated explanation. Discarding output and substituting SEBI disclaimer.")
                res = SEBI_GUARDRAIL_REFUSAL
            elif calculation_result:
                res = verify_and_format_tax_narrative(res, calculation_result)

            res = trim_to_last_complete_sentence(res)

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

    def _stream_sebi_disclaimer(self) -> Generator[str, None, None]:
        """Yield SEBI statutory disclaimer tokens word-by-word with natural pacing."""
        words = re.findall(r"\S+|\n", SEBI_GUARDRAIL_REFUSAL)
        for i, w in enumerate(words):
            if w == "\n":
                yield "\n"
            else:
                yield w + (" " if i < len(words) - 1 and words[i + 1] != "\n" else "")

    def generate_explanation_stream(
        self,
        query: str,
        context_chunks: List[Dict[str, Any]],
        calculation_result: Optional[Dict[str, Any]] = None,
        risk_result: Optional[Dict[str, Any]] = None,
        fast_mode: bool = True,
    ) -> Generator[str, None, None]:
        """Stream response tokens in real-time with deterministic SEBI compliance guardrail filtering."""
        start_time = time.perf_counter()
        llm_logger = get_logger("llm_service")

        # Check if the query is in the equity/investment recommendation domain
        equity_query_patterns = STOCK_TICKER_PATTERNS + [
            r"\bstock\b", r"\bshares?\b", r"\bticker\b", r"\bcrypto\b", r"\bmutual funds?\b",
            r"\bwhich stock\b", r"\bbuy right now\b", r"\bshould i buy\b", r"\bshould i invest\b",
        ]
        is_equity_query = any(re.search(p, query.lower()) for p in equity_query_patterns)

        token_count = 0
        engine_name = "GroundedFastStream" if fast_mode else "Qwen2.5-3B-Instruct-LoRA-Stream"
        try:
            generator = None
            if fast_mode:
                logger.info("FAST_MODE_PATH: Ultra-responsive grounded stream")
                generator = self._generate_grounded_fallback_stream(
                    query=query,
                    context_chunks=context_chunks,
                    calculation_result=calculation_result,
                    risk_result=risk_result,
                    natural_delay=True,
                )
            else:
                model, tokenizer = load_finetuned_model(blocking=False)
                if model is not None and tokenizer is not None:
                    logger.info("REAL_MODEL_PATH: Autoregressive Qwen generation")
                    try:
                        generator = self._generate_qwen_stream(
                            model=model,
                            tokenizer=tokenizer,
                            query=query,
                            context_chunks=context_chunks,
                            calculation_result=calculation_result,
                            risk_result=risk_result,
                        )
                    except Exception as gen_err:
                        logger.error(f"Error initializing Qwen streaming ({gen_err}). Falling back to grounded stream.")
                        generator = None

                if generator is None:
                    generator = self._generate_grounded_fallback_stream(
                        query=query,
                        context_chunks=context_chunks,
                        calculation_result=calculation_result,
                        risk_result=risk_result,
                        natural_delay=True,
                    )

            # If equity/stock domain query, buffer tokens to scan final output before any content reaches the user
            if is_equity_query:
                collected_tokens = []
                try:
                    for tok in generator:
                        collected_tokens.append(tok)
                except Exception as gen_err:
                    logger.error(f"Error during streaming ({gen_err}). Falling back to grounded fallback stream.")
                    collected_tokens = list(self._generate_grounded_fallback_stream(
                        query=query,
                        context_chunks=context_chunks,
                        calculation_result=calculation_result,
                        risk_result=risk_result,
                    ))

                full_text = "".join(collected_tokens)
                if check_sebi_compliance_violation(full_text) or is_equity_query:
                    logger.warning("[SEBI_GUARDRAIL] Discarding LLM output due to stock recommendation violation! Substituting SEBI disclaimer.")
                    for tok in self._stream_sebi_disclaimer():
                        token_count += 1
                        yield tok
                else:
                    for tok in collected_tokens:
                        token_count += 1
                        yield tok
            else:
                # Real-time streaming for statutory/tax queries with active guardrail monitoring
                accumulated = []
                violation_triggered = False
                try:
                    for token in generator:
                        accumulated.append(token)
                        current_text = "".join(accumulated)
                        if check_sebi_compliance_violation(current_text):
                            logger.warning("[SEBI_GUARDRAIL] Violation detected during stream! Discarding LLM output and substituting SEBI disclaimer.")
                            violation_triggered = True
                            break
                        token_count += 1
                        yield token
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
                    return

                if violation_triggered:
                    for tok in self._stream_sebi_disclaimer():
                        token_count += 1
                        yield tok

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

    def _build_prompt_and_inputs(
        self,
        tokenizer: Any,
        query: str,
        context_chunks: List[Dict[str, Any]],
        calculation_result: Optional[Dict[str, Any]] = None,
        risk_result: Optional[Dict[str, Any]] = None,
    ) -> Any:
        system_prompt = (
            "You are Audit V, an AI financial, tax compliance, and wealth advisor for India, answering naturally and conversationally like ChatGPT. "
            "STRICT OPERATIONAL GUIDELINES:\n"
            "1. When deterministic calculation results are provided below, you MUST quote those EXACT numbers without recalculating, estimating, or altering them.\n"
            "2. State Net Annual Take-Home Salary EXACTLY as Gross Income minus Total Tax (as provided). Never invent decimal fractions or cents like .99.\n"
            "3. When explaining tax slabs, explain ONLY using the official slab-by-slab breakdown provided. Do not mix old and new regime rates.\n"
            "4. UNDER SEBI REGULATIONS, NEVER RECOMMEND BUYING OR SELLING INDIVIDUAL COMPANY STOCKS OR TICKERS. "
            "If asked for stock recommendations, refuse and provide only the statutory SEBI disclaimer.\n"
            "5. Structure responses cleanly with markdown and ensure all thoughts and sentences are fully completed."
        )

        user_content_parts = []
        if calculation_result:
            from decimal import Decimal
            selected = calculation_result.get("selected_result", {})
            gross_dec = Decimal(str(selected.get("gross_income", "0")))
            tax_dec = Decimal(str(selected.get("total_tax", "0")))
            std_ded_dec = Decimal(str(selected.get("standard_deduction", "0")))
            taxable_dec = Decimal(str(selected.get("taxable_income", "0")))
            rebate_dec = Decimal(str(selected.get("rebate_87a", "0")))
            cess_dec = Decimal(str(selected.get("cess", "0")))
            net_take_home = gross_dec - tax_dec
            monthly_tax = Decimal(str(selected.get("monthly_tax_estimate", "0")))
            monthly_take_home = (net_take_home / Decimal("12")).quantize(Decimal("1"))
            savings_dec = Decimal(str(calculation_result.get("potential_tax_savings", "0")))

            slab_lines = []
            for s in selected.get("slab_breakdown", []):
                s_range = s.get("slab_range", "")
                s_rate = float(s.get("rate_percentage", 0.0))
                s_taxable = int(Decimal(str(s.get("taxable_in_slab", 0))))
                s_tax = int(Decimal(str(s.get("tax_for_slab", 0))))
                slab_lines.append(f"  • {s_range} (Tax Rate: {s_rate:.0f}%): Taxable Amount ₹{s_taxable:,} -> Tax ₹{s_tax:,}")

            if rebate_dec > 0:
                slab_lines.append(f"  • Section 87A Rebate: -₹{int(rebate_dec):,}")
            if cess_dec > 0:
                slab_lines.append(f"  • Health & Education Cess (4%): ₹{int(cess_dec):,}")
            slab_lines.append(f"  • Total Calculated Tax: ₹{int(tax_dec):,}")

            slab_breakdown_text = "\n".join(slab_lines) if slab_lines else "None"

            user_content_parts.append(
                f"[TAX ENGINE DETERMINISTIC CALCULATION (OFFICIAL RESULTS)]\n"
                f"Gross Annual Income: ₹{int(gross_dec):,}\n"
                f"Standard Deduction: ₹{int(std_ded_dec):,}\n"
                f"Taxable Income: ₹{int(taxable_dec):,}\n"
                f"Recommended Regime: {calculation_result.get('recommended_regime', 'Selected')}\n"
                f"Total Estimated Tax: ₹{int(tax_dec):,}\n"
                f"Net Annual Take-Home Salary: ₹{int(net_take_home):,}\n"
                f"Net Monthly Take-Home Salary: ₹{int(monthly_take_home):,}\n"
                f"Monthly Tax Deduction (TDS): ₹{int(monthly_tax):,}\n"
                f"Potential Tax Savings vs Alternative Regime: ₹{int(savings_dec):,}\n\n"
                f"Official Slab-by-Slab Breakdown:\n{slab_breakdown_text}\n\n"
                f"CRITICAL INSTRUCTIONS FOR ASSISTANT:\n"
                f"- State Net Take-Home Salary as EXACTLY ₹{int(net_take_home):,} (do NOT say ₹1,199,999.99 or use decimals).\n"
                f"- Explain the tax using ONLY the official slab rates and amounts listed above."
            )

        if risk_result:
            user_content_parts.append(
                f"[TRANSACTION RISK ASSESSMENT FROM AUDIT V ANOMALY ENGINE]\n"
                f"Total Transactions: {risk_result.get('total_transactions', 0)}\n"
                f"Anomalies Detected: {risk_result.get('anomalies_detected', 0)}\n"
                f"Summary Explanation: {risk_result.get('summary_explanation', '')}\n"
            )

        if context_chunks:
            context_blocks = []
            for i, c in enumerate(context_chunks[:3], 1):
                if not isinstance(c, dict):
                    continue
                meta = c.get("metadata", {})
                title = meta.get("title") or f"Document {i}"
                content = c.get("content", "").strip()
                if content:
                    context_blocks.append(f"Document {i}: {title}\n{content}")
            if context_blocks:
                user_content_parts.append("[Retrieved Knowledge]\n" + "\n\n".join(context_blocks))

        user_content_parts.append(f"User Query: {query}")
        user_prompt = "\n\n".join(user_content_parts)

        messages = [
            {"role": "system", "content": system_prompt},
            {"role": "user", "content": user_prompt},
        ]

        prompt = tokenizer.apply_chat_template(messages, tokenize=False, add_generation_prompt=True)
        return tokenizer(prompt, return_tensors="pt")

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

        inputs = self._build_prompt_and_inputs(
            tokenizer=tokenizer,
            query=query,
            context_chunks=context_chunks,
            calculation_result=calculation_result,
            risk_result=risk_result,
        )
        target_device = getattr(model, "device", "cuda:0")
        if hasattr(inputs, "to"):
            inputs = inputs.to(target_device)

        stop_token_ids = [tokenizer.eos_token_id]
        im_end_id = tokenizer.convert_tokens_to_ids("<|im_end|>")
        if isinstance(im_end_id, int) and im_end_id not in stop_token_ids:
            stop_token_ids.append(im_end_id)

        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True

        model_device = next(model.parameters()).device
        logger.info(f"MODEL_DEVICE: {model_device}")
        try:
            import subprocess
            smi_out = subprocess.check_output(
                ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.total", "--format=csv,noheader,nounits"],
                text=True,
            ).strip()
            gpu_util, mem_used, mem_total = [x.strip() for x in smi_out.split(",")]
            logger.info(f"GPU_METRICS: util={gpu_util}%, vram={mem_used}MB/{mem_total}MB")
        except Exception:
            pass

        t0 = time.perf_counter()
        with torch.inference_mode():
            output_ids = model.generate(
                **inputs,
                max_new_tokens=min(self.settings.LLM_MAX_NEW_TOKENS, 400),
                temperature=self.settings.LLM_TEMPERATURE,
                top_p=0.9,
                do_sample=False,
                use_cache=True,
                pad_token_id=tokenizer.eos_token_id,
                eos_token_id=stop_token_ids,
            )
        latency = time.perf_counter() - t0

        input_ids = inputs.input_ids if hasattr(inputs, "input_ids") else inputs.get("input_ids", [[]])
        input_len = input_ids.shape[1] if hasattr(input_ids, "shape") else len(input_ids[0])
        total_len = output_ids[0].shape[0] if hasattr(output_ids[0], "shape") else len(output_ids[0])
        output_tokens_count = max(0, total_len - input_len)
        tokens_per_sec = output_tokens_count / latency if latency > 0 else 0.0

        generated_text = tokenizer.decode(output_ids[0][input_len:], skip_special_tokens=True).strip()
        logger.info(
            f"[Assistant Timing] Input Tokens: {input_len} | Output Tokens: {output_tokens_count} | "
            f"Wall Time: {latency:.2f}s | Speed: {tokens_per_sec:.2f} tok/s"
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
        """Stream response tokens using Hugging Face TextIteratorStreamer in an inference-mode background thread."""
        import threading
        import torch
        from transformers import TextIteratorStreamer

        inputs = self._build_prompt_and_inputs(
            tokenizer=tokenizer,
            query=query,
            context_chunks=context_chunks,
            calculation_result=calculation_result,
            risk_result=risk_result,
        )
        target_device = getattr(model, "device", "cuda:0")
        if hasattr(inputs, "to"):
            inputs = inputs.to(target_device)

        stop_token_ids = [tokenizer.eos_token_id]
        im_end_id = tokenizer.convert_tokens_to_ids("<|im_end|>")
        if isinstance(im_end_id, int) and im_end_id not in stop_token_ids:
            stop_token_ids.append(im_end_id)

        torch.backends.cuda.matmul.allow_tf32 = True
        torch.backends.cudnn.allow_tf32 = True

        model_device = next(model.parameters()).device
        logger.info(f"MODEL_DEVICE: {model_device}")
        try:
            import subprocess
            smi_out = subprocess.check_output(
                ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.total", "--format=csv,noheader,nounits"],
                text=True,
            ).strip()
            gpu_util, mem_used, mem_total = [x.strip() for x in smi_out.split(",")]
            logger.info(f"GPU_METRICS_PRE_GEN: util={gpu_util}%, vram={mem_used}MB/{mem_total}MB")
        except Exception:
            pass

        streamer = TextIteratorStreamer(tokenizer, skip_prompt=True, skip_special_tokens=True)

        generation_kwargs = dict(
            **inputs,
            streamer=streamer,
            max_new_tokens=min(self.settings.LLM_MAX_NEW_TOKENS, 400),
            temperature=self.settings.LLM_TEMPERATURE,
            top_p=0.9,
            do_sample=False,
            use_cache=True,
            pad_token_id=tokenizer.eos_token_id,
            eos_token_id=stop_token_ids,
        )

        def _run_stream_generate():
            try:
                with torch.inference_mode():
                    model.generate(**generation_kwargs)
            except Exception as e:
                logger.warning(f"Error in model.generate background thread: {e}")

        thread = threading.Thread(target=_run_stream_generate, daemon=True)
        thread.start()

        t0 = time.perf_counter()
        first_token_time = None
        token_count = 0
        accumulated_text = []

        # Enforce snappy responsiveness: stream tokens rapidly without blocking
        import queue
        text_queue = getattr(streamer, "text_queue", None)
        max_stream_tokens = min(self.settings.LLM_MAX_NEW_TOKENS, 400)

        if text_queue is not None:
            while token_count < max_stream_tokens:
                try:
                    tok = text_queue.get(timeout=8.0 if token_count == 0 else 5.0)
                    if tok == streamer.stop_signal:
                        break
                    if first_token_time is None:
                        first_token_time = time.perf_counter() - t0
                    token_count += 1
                    if token_count == 1:
                        try:
                            import subprocess
                            smi_out = subprocess.check_output(
                                ["nvidia-smi", "--query-gpu=utilization.gpu,memory.used,memory.total", "--format=csv,noheader,nounits"],
                                text=True,
                            ).strip()
                            gpu_util, mem_used, mem_total = [x.strip() for x in smi_out.split(",")]
                            logger.info(f"GPU_METRICS_DURING_GEN: util={gpu_util}%, vram={mem_used}MB/{mem_total}MB")
                        except Exception:
                            pass
                    accumulated_text.append(tok)
                    yield tok
                except queue.Empty:
                    if token_count == 0:
                        logger.info("Qwen initial token latency > 8.0s. Seamlessly switching to instant grounded response.")
                        raise TimeoutError("LLM initial latency threshold reached (>8s)")
                    # If generation is running too slow mid-stream, finish gracefully
                    break
        else:
            for token in streamer:
                if first_token_time is None:
                    first_token_time = time.perf_counter() - t0
                token_count += 1
                accumulated_text.append(token)
                yield token
                if token_count >= max_stream_tokens:
                    break

        # Detect truncation and wrap up gracefully so no response ends mid-sentence
        full_accumulated = "".join(accumulated_text).strip()
        if full_accumulated and not full_accumulated.endswith((".", "!", "?", "```", ":")):
            if full_accumulated.endswith(","):
                yield " and other applicable statutory provisions."
            else:
                yield "."

        tot_time = time.perf_counter() - t0
        ttft = first_token_time or tot_time
        speed = token_count / tot_time if tot_time > 0 else 0.0
        logger.info(
            f"[Assistant Timing] TTFT: {ttft:.3f}s | Generation Time: {tot_time:.3f}s | "
            f"Tokens: {token_count} | Speed: {speed:.1f} tok/s"
        )

    def _generate_grounded_fallback_stream(
        self,
        query: str,
        context_chunks: List[Dict[str, Any]],
        calculation_result: Optional[Dict[str, Any]] = None,
        risk_result: Optional[Dict[str, Any]] = None,
        natural_delay: bool = True,
    ) -> Generator[str, None, None]:
        """Stream fallback text word-by-word with instant, ultra-responsive pacing."""
        full_text = self._generate_grounded_fallback(
            query=query,
            context_chunks=context_chunks,
            calculation_result=calculation_result,
            risk_result=risk_result,
        )
        words = re.findall(r"\S+|\s+", full_text)
        for word in words:
            if natural_delay and word.strip():
                time.sleep(0.006)
            yield word

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
            total_tax_val = int(float(selected.get("total_tax", "0")))
            monthly_tax_val = int(float(selected.get("monthly_tax_estimate", "0")))
            gross_val = int(float(selected.get("gross_income", "0")))
            recommended = calculation_result.get("recommended_regime", regime)
            savings_val = int(float(calculation_result.get("potential_tax_savings", "0")))

            monthly_gross = int(round(gross_val / 12.0))
            net_annual = max(0, gross_val - total_tax_val)
            net_monthly = int(round(net_annual / 12.0))

            # 50 / 30 / 20 Budget Distribution based on Net Monthly Take-Home Salary
            needs_50 = int(round(net_monthly * 0.50))
            wants_30 = int(round(net_monthly * 0.30))
            savings_20 = max(0, net_monthly - needs_50 - wants_30)

            savings_snippet = f"• **Potential Tax Savings**: Up to **₹{savings_val:,}** by selecting the recommended regime.\n" if savings_val > 0 else ""

            explanation = (
                f"Here is your complete financial blueprint, government tax liability, and a recommended monthly budget distribution for an annual salary of **₹{gross_val:,}** (~₹{monthly_gross:,}/month):\n\n"
                f"---\n\n"
                f"### 🏛️ 1. Government Tax Liability & In-Hand Pay\n\n"
                f"• **Recommended Option**: {recommended}\n"
                f"• **Estimated Total Tax**: ₹{total_tax_val:,} under {regime}\n"
                f"• **Monthly TDS Estimate**: ₹{monthly_tax_val:,}/month\n"
                f"• **Net Take-Home Pay (In-Hand)**: **₹{net_monthly:,}/month** (₹{net_annual:,}/year)\n"
                f"{savings_snippet}\n"
                f"---\n\n"
                f"### 📊 2. Recommended Monthly Budget Distribution (50 / 30 / 20 Rule)\n\n"
                f"Based on your net in-hand salary of **₹{net_monthly:,}/month**, here is how you can effectively allocate your money:\n\n"
                f"1. **🏠 Essential Needs (50%) — ₹{needs_50:,}/month**\n"
                f"   * Housing (Rent / Home Loan EMI)\n"
                f"   * Groceries, Utilities, Electricity, Mobile & Broadband\n"
                f"   * Daily Commute & Transportation\n"
                f"   * Basic Term & Health Insurance premiums\n\n"
                f"2. **🎉 Lifestyle & Wants (30%) — ₹{wants_30:,}/month**\n"
                f"   * Dining out, weekend activities & movies\n"
                f"   * Shopping, gadgets, fashion & personal hobbies\n"
                f"   * Subscriptions (OTT, music, gym) & vacation fund\n\n"
                f"3. **📈 Wealth Creation & Savings (20%) — ₹{savings_20:,}/month**\n"
                f"   * **Emergency Fund**: Maintain 3–6 months of essential expenses (₹{needs_50 * 3:,} – ₹{needs_50 * 6:,}) in a liquid fund or sweep-in FD.\n"
                f"   * **Long-Term Wealth**: Equity Mutual Fund SIPs (Index funds like NIFTY 50) for inflation-beating compounding.\n"
                f"   * **Tax-Advantaged Growth**: Public Provident Fund (PPF) and National Pension System (NPS Tier-1 for ₹50k extra deduction under 80CCD(1B)).\n\n"
                f"---\n\n"
                f"### 💡 Key Tax Rules Applied\n"
                f"• **New Tax Regime (Section 115BAC / Section 202)**: Standard deduction of ₹75,000 for salaried taxpayers; Section 87A rebate of up to ₹60,000 for taxable income up to ₹12,00,000 (zero tax).\n"
                f"• **Old Tax Regime**: Standard deduction of ₹50,000, Section 80C deductions up to ₹1.5 Lakh (ELSS/PPF/EPF), Section 80D medical insurance, and Section 10(13A) HRA exemption."
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
            title = metadata.get("title", "Key Provisions")
            content = chunk.get("content", "")
            clean_content = re.sub(r"^\[.*?\]\s*", "", content).strip()
            if title not in seen_titles and clean_content:
                seen_titles.add(title)
                response_bullets.append(f"**{title}**\n\n{clean_content}")

        if not response_bullets:
            if any(re.search(p, query.lower()) for p in STOCK_TICKER_PATTERNS + [r"\bstock\b", r"\bwhich stock\b"]):
                return SEBI_GUARDRAIL_REFUSAL
            return (
                "Here are key tax rules and smart investment insights for your query:\n\n"
                "• **Tax Efficiency**: Under Section 115BAC (New Tax Regime), taxable income up to ₹12 Lakh incurs zero tax after standard deduction and Section 87A rebate.\n"
                "• **Market & Growth Assets**: For wealth generation, consider passive index equity funds (NIFTY 50 / Sensex ETFs) which offer steady compounding over long horizons with lower expense ratios.\n"
                "• **Capital Preservation**: Balance equity exposure with sovereign-backed fixed return instruments like Public Provident Fund (PPF) and high-yield fixed deposits.\n"
                "• **Retirement Planning**: National Pension System (NPS) provides additional tax efficiency and disciplined wealth accumulation.\n\n"
                "Feel free to share your monthly salary or specific financial goal to get tailored suggestions!"
            )

        final_fallback = "\n\n---\n\n".join(response_bullets)
        if check_sebi_compliance_violation(final_fallback) or any(re.search(p, query.lower()) for p in STOCK_TICKER_PATTERNS + [r"\bstock\b", r"\bwhich stock\b"]):
            return SEBI_GUARDRAIL_REFUSAL
        return final_fallback
