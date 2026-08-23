from __future__ import annotations

from unittest.mock import patch
from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_api_assistant_chat_information_query_non_streaming():
    """API Test 1: POST /api/v1/assistant/chat for non-streaming tax information query."""
    payload = {
        "message": "What is the standard deduction for salaried employees?",
        "stream": False,
    }

    with patch("app.services.llm_service.load_finetuned_model", return_value=(None, None)):
        response = client.post("/api/v1/assistant/chat", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert "answer" in data
        assert "intent" in data
        assert data["used_rag"] is True
        assert len(data["sources"]) > 0
        assert "similarity_score" in data["sources"][0]


def test_api_assistant_chat_calculation_query_non_streaming():
    """API Test 2: POST /api/v1/assistant/chat for calculation query non-streaming."""
    payload = {
        "message": "Calculate tax for 15 lakh salary",
        "stream": False,
    }

    with patch("app.services.llm_service.load_finetuned_model", return_value=(None, None)):
        response = client.post("/api/v1/assistant/chat", json=payload)
        assert response.status_code == 200

        data = response.json()
        assert data["intent"] == "tax_calculation"
        assert data["used_tax_engine"] is True
        assert "calculation" in data
        assert data["calculation"] is not None


def test_api_assistant_chat_sse_streaming():
    """API Test 3: POST /api/v1/assistant/chat streaming SSE event stream."""
    payload = {
        "message": "What is Section 80C?",
        "stream": True,
    }

    with patch("app.services.llm_service.load_finetuned_model", return_value=(None, None)):
        response = client.post("/api/v1/assistant/chat", json=payload)
        assert response.status_code == 200
        assert "text/event-stream" in response.headers["content-type"]

        content = response.text
        assert "event: metadata" in content
        assert "event: token" in content
        assert "event: done" in content


def test_api_assistant_chat_empty_query_validation():
    """API Test 4: Rejects empty query message with HTTP 400 Bad Request."""
    payload = {"message": "   "}

    response = client.post("/api/v1/assistant/chat", json=payload)
    assert response.status_code == 400

    data = response.json()
    assert data["status_code"] == 400
    assert "cannot be empty" in data["detail"]
    assert data["errors"][0]["field"] == "message"


def test_api_assistant_chat_declines_specific_stock_recommendation():
    """API Test 5: Verify assistant declines to recommend specific stocks and provides SEBI adviser disclaimer."""
    payload = {
        "message": "which stock should I buy right now",
        "stream": False,
    }

    with patch("app.services.llm_service.load_finetuned_model", return_value=(None, None)):
        response = client.post("/api/v1/assistant/chat", json=payload)
        assert response.status_code == 200

        data = response.json()
        answer = data["answer"].lower()

        # Must decline to recommend specific stocks/tickers
        assert "does not recommend specific stock" in answer or "does not provide personalized" in answer

        # Must mention broad asset classes instead
        assert "asset class" in answer or "equity index" in answer

        # Must include SEBI adviser disclaimer
        assert "sebi-registered" in answer or "educational" in answer


def test_api_assistant_chat_audit_trail_populated():
    """API Test 6: Verify audit_trail object is present and correctly populated for tax, investment, and general queries."""
    with patch("app.services.llm_service.load_finetuned_model", return_value=(None, None)):
        # 1. Tax Calculation Query
        resp_tax = client.post("/api/v1/assistant/chat", json={"message": "Calculate tax for 15 lakh salary", "stream": False})
        assert resp_tax.status_code == 200
        data_tax = resp_tax.json()
        assert "audit_trail" in data_tax
        at_tax = data_tax["audit_trail"]
        assert at_tax is not None
        assert at_tax["intent"] == "tax_calculation"
        assert at_tax["tax_engine_invoked"] is True
        assert at_tax["tax_engine_summary"] is not None
        assert "gross_income" in at_tax["tax_engine_summary"]
        assert "total_tax" in at_tax["tax_engine_summary"]
        assert at_tax["guardrail_triggered"] is False
        assert at_tax["processing_time_ms"] > 0

        # 2. Investment Query (Guardrail Triggered)
        resp_inv = client.post("/api/v1/assistant/chat", json={"message": "which stock should I buy right now", "stream": False})
        assert resp_inv.status_code == 200
        data_inv = resp_inv.json()
        at_inv = data_inv["audit_trail"]
        assert at_inv is not None
        assert at_inv["intent"] == "investment_guidance"
        assert at_inv["tax_engine_invoked"] is False
        assert at_inv["guardrail_triggered"] is True
        assert at_inv["rag_invoked"] is True

        # 3. General Information Query
        resp_gen = client.post("/api/v1/assistant/chat", json={"message": "What is Section 80C?", "stream": False})
        assert resp_gen.status_code == 200
        data_gen = resp_gen.json()
        at_gen = data_gen["audit_trail"]
        assert at_gen is not None
        assert at_gen["intent"] == "tax_information"
        assert at_gen["tax_engine_invoked"] is False
        assert at_gen["guardrail_triggered"] is False
        assert at_gen["rag_invoked"] is True
        assert at_gen["retrieved_sources_count"] > 0

