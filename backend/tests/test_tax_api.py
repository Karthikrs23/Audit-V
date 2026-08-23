from __future__ import annotations

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_api_tax_calculate_success():
    """API Test 1: POST /api/v1/tax/calculate returning 200 OK and valid response."""
    payload = {
        "annual_income": 1200000,
        "age": 30,
        "regime": "compare",
        "is_salaried": True,
        "deductions": {
            "section_80c": 150000,
            "section_80d": 25000,
            "section_80ccd_1b": 0,
            "hra_exemption": 100000,
            "other_deductions": 0,
        },
    }

    response = client.post("/api/v1/tax/calculate", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert "disclaimer" in data
    assert "selected_result" in data
    assert "old_regime_result" in data
    assert "new_regime_result" in data
    assert "recommended_regime" in data
    assert "potential_tax_savings" in data

    selected = data["selected_result"]
    assert selected["gross_income"] == "1200000"
    assert selected["financial_year"] == "Tax Year 2026-27"


def test_api_tax_calculate_negative_income_validation():
    """API Test 2: Reject negative annual income with structured HTTP 400 error."""
    payload = {
        "annual_income": -50000,
        "age": 30,
        "regime": "new",
    }

    response = client.post("/api/v1/tax/calculate", json=payload)
    assert response.status_code == 400

    data = response.json()
    assert data["status_code"] == 400
    assert "Input validation failed" in data["detail"]
    assert len(data["errors"]) > 0
    assert data["errors"][0]["field"] == "annual_income"


def test_api_tax_calculate_zero_income_validation():
    """API Test 3: Reject zero annual income with structured HTTP 400 error."""
    payload = {
        "annual_income": 0,
        "age": 30,
        "regime": "new",
    }

    response = client.post("/api/v1/tax/calculate", json=payload)
    assert response.status_code == 400

    data = response.json()
    assert data["status_code"] == 400
    assert "greater than 0" in data["detail"].lower() or "greater than zero" in data["detail"].lower()
