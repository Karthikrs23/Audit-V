from fastapi.testclient import TestClient
from app.main import app
from app.ml.taxpayer_risk_model import TaxpayerRiskModel

client = TestClient(app)


def test_taxpayer_risk_model_training():
    model = TaxpayerRiskModel()
    res = model.train_from_csv()
    assert res["records_trained"] > 0
    assert res["accuracy"] >= 0.70


def test_taxpayer_risk_model_prediction():
    model = TaxpayerRiskModel()
    sample = {
        "Revenue": 1149014.25,
        "Expenses": 979871.09,
        "Tax_Liability": 39872.33,
        "Tax_Paid": 28921.92,
        "Late_Filings": 2,
        "Compliance_Violations": 1,
        "Industry": "Finance",
        "Audit_Findings": 0,
    }
    res = model.predict_taxpayer(sample)
    assert res["predicted_risk_level"] in ["Low", "Medium", "High"]
    assert "risk_probabilities" in res
    assert "risk_flags" in res


def test_taxpayer_risk_api_endpoint():
    payload = {
        "taxpayer_id": "TAX-101",
        "revenue": 1000000.0,
        "expenses": 600000.0,
        "tax_liability": 50000.0,
        "tax_paid": 45000.0,
        "late_filings": 0,
        "compliance_violations": 0,
        "industry": "Tech",
        "audit_findings": 0,
    }
    response = client.post("/api/v1/risk/taxpayer", json=payload)
    assert response.status_code == 200
    data = response.json()
    assert data["taxpayer_id"] == "TAX-101"
    assert data["predicted_risk_level"] in ["Low", "Medium", "High"]
