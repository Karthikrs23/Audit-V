from decimal import Decimal
import pytest
from fastapi.testclient import TestClient

from app.main import app
from app.schemas.gst import GSTCalculationRequest
from app.services.gst_engine import compute_gst, resolve_gst_rule

client = TestClient(app)


def test_gst_exclusive_intra_state_18():
    """Verify 18% exclusive intra-state calculation with exact CGST/SGST split."""
    req = GSTCalculationRequest(
        amount=Decimal("100000.00"),
        calculation_type="exclusive",
        supply_type="intra_state",
        rate=Decimal("18.0"),
    )
    res = compute_gst(req)
    assert res.base_amount == Decimal("100000.00")
    assert res.total_tax == Decimal("18000.00")
    assert res.cgst_amount == Decimal("9000.00")
    assert res.sgst_amount == Decimal("9000.00")
    assert res.igst_amount == Decimal("0.00")
    assert res.total_payable == Decimal("118000.00")
    assert res.is_inter_state is False
    assert res.is_verified_rate is True


def test_gst_exclusive_inter_state_18():
    """Verify 18% exclusive inter-state calculation with full IGST allocation."""
    req = GSTCalculationRequest(
        amount=Decimal("100000.00"),
        calculation_type="exclusive",
        supply_type="inter_state",
        rate=Decimal("18.0"),
    )
    res = compute_gst(req)
    assert res.base_amount == Decimal("100000.00")
    assert res.total_tax == Decimal("18000.00")
    assert res.cgst_amount == Decimal("0.00")
    assert res.sgst_amount == Decimal("0.00")
    assert res.igst_amount == Decimal("18000.00")
    assert res.total_payable == Decimal("118000.00")
    assert res.is_inter_state is True


def test_gst_inclusive_extraction():
    """Verify GST extraction from gross inclusive amount."""
    req = GSTCalculationRequest(
        amount=Decimal("118000.00"),
        calculation_type="inclusive",
        supply_type="intra_state",
        rate=Decimal("18.0"),
    )
    res = compute_gst(req)
    assert res.base_amount == Decimal("100000.00")
    assert res.total_tax == Decimal("18000.00")
    assert res.cgst_amount == Decimal("9000.00")
    assert res.sgst_amount == Decimal("9000.00")
    assert res.total_payable == Decimal("118000.00")


def test_gst_auto_place_of_supply():
    """Verify place of supply automatically resolves inter vs intra state."""
    # Inter-state
    req_inter = GSTCalculationRequest(
        amount=Decimal("50000.00"),
        calculation_type="exclusive",
        supply_type="auto",
        source_state="Maharashtra",
        destination_state="Karnataka",
        rate=Decimal("18.0"),
    )
    res_inter = compute_gst(req_inter)
    assert res_inter.is_inter_state is True
    assert res_inter.igst_amount == Decimal("9000.00")
    assert res_inter.cgst_amount == Decimal("0.00")

    # Intra-state
    req_intra = GSTCalculationRequest(
        amount=Decimal("50000.00"),
        calculation_type="exclusive",
        supply_type="auto",
        source_state="Delhi",
        destination_state="Delhi",
        rate=Decimal("18.0"),
    )
    res_intra = compute_gst(req_intra)
    assert res_intra.is_inter_state is False
    assert res_intra.cgst_amount == Decimal("4500.00")
    assert res_intra.sgst_amount == Decimal("4500.00")


def test_gst_rounding_and_odd_apportioning():
    """Verify exact decimal apportioning prevents 1-paisa rounding mismatch."""
    req = GSTCalculationRequest(
        amount=Decimal("105.55"),
        calculation_type="exclusive",
        supply_type="intra_state",
        rate=Decimal("5.0"),
    )
    res = compute_gst(req)
    # Total tax = round(105.55 * 0.05) = round(5.2775) = 5.28
    assert res.total_tax == Decimal("5.28")
    assert res.cgst_amount + res.sgst_amount == res.total_tax
    assert res.total_payable == res.base_amount + res.total_tax


def test_gst_zero_rate_exempt():
    """Verify Nil/0% exempt commodity calculation."""
    req = GSTCalculationRequest(
        amount=Decimal("5000.00"),
        calculation_type="exclusive",
        hsn_sac="1006",
        rate=Decimal("0.0"),
    )
    res = compute_gst(req)
    assert res.total_tax == Decimal("0.00")
    assert res.total_payable == Decimal("5000.00")
    assert res.is_verified_rate is True


def test_gst_validation_negative_and_zero():
    """Ensure invalid amounts are strictly rejected by Pydantic validators."""
    with pytest.raises(ValueError):
        GSTCalculationRequest(amount=Decimal("0.00"))

    with pytest.raises(ValueError):
        GSTCalculationRequest(amount=Decimal("-500.00"))

    with pytest.raises(ValueError):
        GSTCalculationRequest(amount=Decimal("50000000000.00"))  # Exceeds ₹1,000 Cr cap


def test_gst_api_endpoints():
    """Test full HTTP API endpoint workflow for GST calculation and rules."""
    # Test Calculate POST
    payload = {
        "amount": 250000.0,
        "calculation_type": "exclusive",
        "supply_type": "intra_state",
        "hsn_sac": "998314",
        "category": "Services - IT & Software",
        "rate": 18.0,
    }
    resp = client.post("/api/v1/tax/gst/calculate", json=payload)
    assert resp.status_code == 200
    data = resp.json()
    assert float(data["base_amount"]) == 250000.0
    assert float(data["total_tax"]) == 45000.0
    assert float(data["cgst_amount"]) == 22500.0
    assert float(data["sgst_amount"]) == 22500.0
    assert float(data["total_payable"]) == 295000.0
    assert data["is_verified_rate"] is True

    # Test Rules GET
    rules_resp = client.get("/api/v1/tax/gst/rules")
    assert rules_resp.status_code == 200
    rules_data = rules_resp.json()
    assert "rules" in rules_data
    assert len(rules_data["rules"]) > 0
    assert "states" in rules_data
    assert "Maharashtra" in rules_data["states"]

