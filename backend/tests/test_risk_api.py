from __future__ import annotations

from fastapi.testclient import TestClient
from app.main import app

client = TestClient(app)


def test_risk_analysis_endpoint_default_dataset():
    """API Test 1: POST /api/v1/risk/analyze on default 300 synthetic dataset."""
    response = client.post("/api/v1/risk/analyze", json={})
    assert response.status_code == 200

    data = response.json()
    assert data["total_transactions"] == 300
    assert data["anomalies_detected"] > 0
    assert "risk_summary" in data
    assert "critical" in data["risk_summary"]
    assert "transactions" in data
    assert len(data["transactions"]) == 300


def test_risk_analysis_endpoint_custom_payload():
    """API Test 2: POST /api/v1/risk/analyze with custom transaction array."""
    payload = {
        "transactions": [
            {
                "transaction_id": "TEST-01",
                "date": "2024-03-01",
                "time": "14:00:00",
                "amount": 500.0,
                "category": "Dining",
                "merchant": "Cafe",
                "account_type": "checking",
                "location": "Mumbai",
                "payment_method": "UPI",
            },
            {
                "transaction_id": "TEST-02",
                "date": "2024-03-01",
                "time": "03:15:00",
                "amount": 950000.0,
                "category": "Dining",
                "merchant": "Cafe",
                "account_type": "checking",
                "location": "Mumbai",
                "payment_method": "UPI",
            },
        ]
    }

    response = client.post("/api/v1/risk/analyze", json=payload)
    assert response.status_code == 200

    data = response.json()
    assert data["total_transactions"] == 2
    assert len(data["transactions"]) == 2
    assert data["transactions"][1]["risk_level"] in ["HIGH", "CRITICAL"]


def test_risk_analysis_empty_transaction_list_validation():
    """API Test 3: Reject empty transaction array with structured HTTP 400 error."""
    payload = {"transactions": []}

    response = client.post("/api/v1/risk/analyze", json=payload)
    assert response.status_code == 400

    data = response.json()
    assert data["status_code"] == 400
    assert "cannot be empty" in data["detail"]
    assert data["errors"][0]["field"] == "transactions"


def test_risk_analysis_invalid_amount_validation():
    """API Test 4: Reject zero or negative transaction amount with structured HTTP 400 error."""
    payload = {
        "transactions": [
            {
                "transaction_id": "TEST-03",
                "date": "2024-03-01",
                "time": "12:00:00",
                "amount": 0.0,
            }
        ]
    }

    response = client.post("/api/v1/risk/analyze", json=payload)
    assert response.status_code == 400

    data = response.json()
    assert data["status_code"] == 400
    assert "greater than 0" in data["detail"].lower() or "greater than zero" in data["detail"].lower()
