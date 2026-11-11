from __future__ import annotations

from unittest.mock import MagicMock, patch
import pytest

from app.core.config import get_settings
from app.services.llm_service import LLMService, get_model_metrics, load_finetuned_model


def test_settings_configuration():
    """Verify that settings contain correct HF Qwen base model, adapter repository, and RAG thresholds."""
    settings = get_settings()
    assert settings.HF_MODEL_NAME == "Qwen/Qwen2.5-3B-Instruct"
    assert settings.HF_ADAPTER_REPO == "peterrs23/audit-v-qwen-3b"
    assert settings.LLM_MAX_NEW_TOKENS == 300
    assert settings.LLM_TEMPERATURE == 0.2
    assert settings.RAG_MIN_SIMILARITY_THRESHOLD == 0.35


def test_model_service_fallback_on_cpu():
    """Verify load_finetuned_model gracefully falls back when GPU/CUDA is unavailable."""
    with patch("torch.cuda.is_available", return_value=False):
        with patch("app.services.llm_service._model_cache", None), \
             patch("app.services.llm_service._model_load_failed", False):
            model, tokenizer = load_finetuned_model()
            assert model is None
            assert tokenizer is None

            metrics = get_model_metrics()
            assert metrics["fallback_active"] is True
            assert metrics["is_loaded"] is False


def test_llm_service_grounded_fallback_knowledge():
    """Verify LLMService returns clear grounded response when fallback is active."""
    llm_service = LLMService()
    chunks = [
        {
            "content": "[Section 80C] Deductions up to Rs 1.5 Lakh are allowed for eligible investments.",
            "metadata": {"title": "Section 80C Guide", "category": "tax", "topic": "Deductions"},
        }
    ]

    with patch("app.services.llm_service.load_finetuned_model", return_value=(None, None)):
        response = llm_service.generate_explanation(
            query="What is Section 80C?",
            context_chunks=chunks,
        )

        assert "Section 80C" in response
        assert "1.5 Lakh" in response or "Deductions" in response


def test_llm_service_tax_calculation_explanation():
    """Verify LLMService combines Tax Engine output with explanation."""
    llm_service = LLMService()
    calc_result = {
        "recommended_regime": "New Tax Regime (Section 115BAC, Income Tax Act 1961 — recodified as Section 202 under Income Tax Act 2025)",
        "potential_tax_savings": "15000",
        "selected_result": {
            "regime": "New Tax Regime (Section 115BAC, Income Tax Act 1961 — recodified as Section 202 under Income Tax Act 2025)",
            "gross_income": "1200000",
            "total_tax": "90000",
            "monthly_tax_estimate": "7500",
        },
    }

    with patch("app.services.llm_service.load_finetuned_model", return_value=(None, None)):
        response = llm_service.generate_explanation(
            query="I earn ₹12 lakh per year. Explain my estimated tax.",
            context_chunks=[],
            calculation_result=calc_result,
        )

        assert "12,000,000" in response or "12,00" in response or "1,200,000" in response
        assert "Recommended Option" in response
        assert "New Tax Regime" in response


def test_llm_service_streaming_tokens():
    """Verify generate_explanation_stream yields token chunks sequentially."""
    llm_service = LLMService()
    chunks = [
        {
            "content": "Section 80C deduction limit is Rs 1.5 Lakh.",
            "metadata": {"title": "Section 80C", "similarity_score": 0.85},
        }
    ]

    with patch("app.services.llm_service.load_finetuned_model", return_value=(None, None)):
        stream_tokens = list(
            llm_service.generate_explanation_stream(
                query="What is Section 80C?",
                context_chunks=chunks,
            )
        )

        full_streamed = "".join(stream_tokens)
        assert len(stream_tokens) > 1
        assert "Section 80C" in full_streamed


def test_mocked_qwen_generation():
    """Verify LLMService format and generation logic with mocked model and tokenizer."""
    mock_model = MagicMock()
    mock_tokenizer = MagicMock()

    mock_inputs = MagicMock()
    mock_inputs.input_ids.shape = [1, 10]
    mock_inputs.to.return_value = mock_inputs

    mock_tokenizer.apply_chat_template.return_value = "<formatted_prompt>"
    mock_tokenizer.return_value = mock_inputs
    mock_model.generate.return_value = [[0] * 15]
    mock_tokenizer.decode.return_value = "Section 80C allows deductions up to Rs 1.5 Lakh."

    llm_service = LLMService()

    with patch("app.services.llm_service.load_finetuned_model", return_value=(mock_model, mock_tokenizer)):
        response = llm_service.generate_explanation(
            query="What is Section 80C?",
            context_chunks=[{"content": "Section 80C info", "metadata": {"title": "Section 80C"}}],
            fast_mode=False,
        )

        assert "Section 80C" in response
        assert mock_model.generate.called


def test_sebi_guardrail_pre_generation_intercept():
    """Verify is_sebi_intercept_query intercepts all 6 required user prompts."""
    from app.services.llm_service import is_sebi_intercept_query

    critical_queries = [
        "Which stock should I buy right now: Reliance or Tata Motors?",
        "is Reliance a buy",
        "suggest a mutual fund for me",
        "should I invest in crypto today",
        "what will TCS stock do next month",
        "what is a good stock to buy",
    ]
    for q in critical_queries:
        assert is_sebi_intercept_query(q) is True, f"Failed to intercept query: '{q}'"


def test_sebi_guardrail_post_generation_adversarial_strings():
    """Verify check_sebi_compliance_violation catches adversarial model outputs."""
    from app.services.llm_service import check_sebi_compliance_violation

    adversarial_outputs = [
        "Tata Motors appears to be a better buy compared to Reliance",
        "TCS is a strong buy with target price of 4500",
        "You should invest in Infosys shares right now for strong upside",
        "NIFTY will outperform, buy call options",
        "Reliance is undervalued and you should buy it before next earnings",
        "Between Tata Motors and RIL, Tatamotors is a better buy",
    ]
    for adv in adversarial_outputs:
        assert check_sebi_compliance_violation(adv) is True, f"Failed to detect violation in: '{adv}'"


def test_sebi_guardrail_non_violation_queries():
    """Verify normal tax/financial questions are NOT intercepted or falsely flagged."""
    from app.services.llm_service import check_sebi_compliance_violation, is_sebi_intercept_query

    safe_queries = [
        "Calculate tax for 12 lakh annual income",
        "What is Section 80C and what are its deduction limits?",
        "How does GST registration work for software exports?",
        "What is the difference between old and new tax regime?",
    ]
    for sq in safe_queries:
        assert is_sebi_intercept_query(sq) is False
        assert check_sebi_compliance_violation(sq) is False
