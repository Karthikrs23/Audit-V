from __future__ import annotations

from unittest.mock import patch
from app.schemas.assistant import AssistantChatRequest
from app.services.assistant_service import AssistantService


def test_assistant_intent_detection():
    """Test intent detection logic in AssistantService."""
    service = AssistantService()

    assert service._detect_intent("Calculate tax for 12 lakh income") == "tax_calculation"
    assert service._detect_intent("What is my tax on 15 lakh salary?") == "tax_calculation"
    assert service._detect_intent("What is Section 80C?") == "tax_information"
    assert service._detect_intent("How does GST registration work?") == "gst_information"
    assert service._detect_intent("Tell me about fixed deposits and interest") == "financial_information"


def test_assistant_tax_information_query():
    """Test processing an information query through assistant service."""
    service = AssistantService()
    req = AssistantChatRequest(message="What is Section 80C deduction limit?")

    with patch("app.services.llm_service.load_finetuned_model", return_value=(None, None)):
        res = service.process_chat(req)

        assert res.intent == "tax_information"
        assert res.used_rag is True
        assert res.used_tax_engine is False
        assert len(res.sources) > 0
        assert len(res.answer) > 0


def test_assistant_tax_calculation_query():
    """Test processing a calculation query through assistant service."""
    service = AssistantService()
    req = AssistantChatRequest(message="Calculate my tax on ₹12 lakh annual income")

    with patch("app.services.llm_service.load_finetuned_model", return_value=(None, None)):
        res = service.process_chat(req)

        assert res.intent == "tax_calculation"
        assert res.used_rag is True
        assert res.used_tax_engine is True
        assert res.calculation is not None
        assert len(res.answer) > 0


def test_assistant_investment_stock_query_declines_specific_tickers():
    """Test that assistant declines to name specific stocks for 'which stock should I buy right now'."""
    service = AssistantService()
    req = AssistantChatRequest(message="which stock should I buy right now")

    with patch("app.services.llm_service.load_finetuned_model", return_value=(None, None)):
        res = service.process_chat(req)

        answer_lower = res.answer.lower()
        # Must refuse specific stock recommendations
        assert "does not recommend specific stock" in answer_lower or "does not provide" in answer_lower
        # Must mention broad asset classes
        assert "asset class" in answer_lower or "index fund" in answer_lower
        # Must include SEBI registered adviser disclaimer
        assert "sebi-registered" in answer_lower or "educational" in answer_lower
