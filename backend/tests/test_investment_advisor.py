from __future__ import annotations

from decimal import Decimal
import pytest
from app.schemas.investment import InvestmentGuidanceRequest
from app.services.investment_advisor import generate_investment_guidance


def test_allocation_percentages_sum_to_100():
    """Verify that allocation percentages sum to exactly 100% across all risk profiles."""
    profiles = ["conservative", "moderate", "aggressive"]

    for prof in profiles:
        req = InvestmentGuidanceRequest(
            annual_income=Decimal("1200000"),
            risk_profile=prof,
            existing_80c_deductions=Decimal("50000"),
        )
        resp = generate_investment_guidance(req)

        total_pct = sum(item.percentage for item in resp.allocations)
        assert abs(total_pct - 100.0) < 0.0001, f"Profile {prof} total percentage {total_pct}% != 100%"


def test_80c_headroom_never_exceeds_cap_minus_declared():
    """Verify that unused 80C headroom equals max(0, 150000 - declared) and never exceeds cap."""
    test_cases = [
        (Decimal("0"), Decimal("150000")),
        (Decimal("50000"), Decimal("100000")),
        (Decimal("100000"), Decimal("50000")),
        (Decimal("150000"), Decimal("0")),
    ]

    for declared, expected_unused in test_cases:
        req = InvestmentGuidanceRequest(
            annual_income=Decimal("1500000"),
            risk_profile="moderate",
            existing_80c_deductions=declared,
        )
        resp = generate_investment_guidance(req)

        assert resp.unused_80c_headroom == expected_unused
        assert resp.unused_80c_headroom <= Decimal("150000")


def test_invalid_risk_profile_validation():
    """Verify Pydantic validation rejects invalid risk profile strings."""
    with pytest.raises(ValueError):
        InvestmentGuidanceRequest(
            annual_income=Decimal("1000000"),
            risk_profile="extreme_gambler",
        )


def test_negative_income_validation():
    """Verify Pydantic validation rejects negative or zero annual income."""
    with pytest.raises(ValueError):
        InvestmentGuidanceRequest(annual_income=Decimal("-10000"))

    with pytest.raises(ValueError):
        InvestmentGuidanceRequest(annual_income=Decimal("0"))


def test_eligible_instruments_details():
    """Verify eligible tax-saving instruments contain lock-in, tax treatment, and features."""
    req = InvestmentGuidanceRequest(
        annual_income=Decimal("1000000"),
        risk_profile="moderate",
    )
    resp = generate_investment_guidance(req)

    assert len(resp.eligible_tax_saving_instruments) >= 4
    names = [inst.name for inst in resp.eligible_tax_saving_instruments]
    assert any("ELSS" in name for name in names)
    assert any("PPF" in name for name in names)
    assert any("NPS" in name for name in names)
    assert any("Fixed Deposit" in name for name in names)

    elss = next(inst for inst in resp.eligible_tax_saving_instruments if "ELSS" in inst.name)
    assert "3 Years" in elss.lock_in_period
    assert "12.5%" in elss.tax_treatment
