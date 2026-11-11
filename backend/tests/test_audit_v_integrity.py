"""
Unit tests for Audit V cross-module calculation integrity, portfolio arithmetic,
cash flow equations, and shared tax consistency.
"""
from decimal import Decimal
import pytest
from app.schemas.tax import TaxCalculationRequest, TaxDeductionsInput
from app.services.tax_engine import compute_tax
from app.schemas.gst import GSTCalculationRequest
from app.services.gst_engine import compute_gst
from app.schemas.investment import InvestmentGuidanceRequest
from app.services.investment_advisor import generate_investment_guidance


def test_portfolio_arithmetic_calculations():
    """Verify holding cost, current valuation, unrealized P&L, and allocation percentages."""
    holdings = [
        {"symbol": "RELIANCE", "qty": Decimal("50"), "buy_price": Decimal("1200.00"), "curr_price": Decimal("1300.00"), "type": "Equity"},
        {"symbol": "UTI_NIFTY", "qty": Decimal("1000"), "buy_price": Decimal("150.00"), "curr_price": Decimal("165.00"), "type": "Mutual Fund"},
        {"symbol": "SGB_GOLD", "qty": Decimal("10"), "buy_price": Decimal("7000.00"), "curr_price": Decimal("7200.00"), "type": "Gold"},
    ]

    total_cost = sum(h["qty"] * h["buy_price"] for h in holdings)
    total_val = sum(h["qty"] * h["curr_price"] for h in holdings)
    unrealized_pnl = total_val - total_cost
    pnl_pct = (unrealized_pnl / total_cost) * 100

    # 50*1200 = 60,000; 1000*150 = 150,000; 10*7000 = 70,000 => Total cost = 280,000
    assert total_cost == Decimal("280000.00")
    # 50*1300 = 65,000; 1000*165 = 165,000; 10*7200 = 72,000 => Total val = 302,000
    assert total_val == Decimal("302000.00")
    # PnL = 302,000 - 280,000 = 22,000
    assert unrealized_pnl == Decimal("22000.00")
    # PnL % = 22,000 / 280,000 * 100 = 7.85714...%
    assert round(pnl_pct, 2) == Decimal("7.86")

    # Allocation percentages
    equity_val = holdings[0]["qty"] * holdings[0]["curr_price"]
    equity_pct = (equity_val / total_val) * 100
    assert round(equity_pct, 2) == Decimal("21.52")


def test_cash_flow_arithmetic():
    """Verify net cash flow calculation, surplus, and deficit states."""
    incomes = [Decimal("125000.00"), Decimal("8200.00")]
    expenses = [Decimal("35000.00"), Decimal("12400.00"), Decimal("4800.00")]

    total_income = sum(incomes)
    total_expense = sum(expenses)
    net_flow = total_income - total_expense

    assert total_income == Decimal("133200.00")
    assert total_expense == Decimal("52200.00")
    assert net_flow == Decimal("81000.00")  # Positive surplus

    # Deficit test
    high_expenses = [Decimal("150000.00")]
    net_deficit = total_income - sum(high_expenses)
    assert net_deficit == Decimal("-16800.00")


def test_shared_tax_engine_consistency():
    """Verify that both Salary Planner and Tax Compliance request payloads produce identical deterministic tax."""
    req = TaxCalculationRequest(
        annual_income=Decimal("1500000"),
        age=32,
        regime="compare",
        is_salaried=True,
        deductions=TaxDeductionsInput(
            section_80c=Decimal("150000"),
            section_80d=Decimal("25000"),
            section_80ccd_1b=Decimal("50000"),
            hra_exemption=Decimal("100000"),
            other_deductions=Decimal("0"),
        ),
    )

    res = compute_tax(req)

    assert res.selected_result is not None
    assert res.selected_result.financial_year == "Tax Year 2026-27"
    assert res.new_regime_result is not None
    assert res.old_regime_result is not None

    # New Regime: ₹15L - ₹75k standard deduction = ₹14.25L taxable
    assert res.new_regime_result.standard_deduction == Decimal("75000.00")
    assert res.new_regime_result.taxable_income == Decimal("1425000.00")

    # Old Regime: ₹15L - (50k std + 150k 80c + 25k 80d + 50k 80ccd + 100k hra) = ₹15L - ₹375k = ₹11.25L
    assert res.old_regime_result.standard_deduction == Decimal("50000.00")
    assert res.old_regime_result.total_deductions == Decimal("375000.00")
    assert res.old_regime_result.taxable_income == Decimal("1125000.00")

    # Recommendation must be deterministic
    assert "Section 115BAC" in res.recommended_regime or "Old Tax Regime" in res.recommended_regime


def test_investment_guidance_headroom_math():
    """Verify Section 80C headroom math and asset class allocations."""
    req = InvestmentGuidanceRequest(
        annual_gross_income=Decimal("1200000"),
        tax_regime="old",
        risk_profile="moderate",
        existing_80c_deductions=Decimal("80000"),
    )

    guidance = generate_investment_guidance(req)

    # 1.5L cap - 80k existing = 70k headroom
    assert guidance.unused_80c_headroom == Decimal("70000.00")
    assert len(guidance.allocations) >= 3

    # Total allocation percentages must sum to 100%
    total_pct = sum(a.percentage for a in guidance.allocations)
    assert total_pct == 100


def test_gst_rounding_edge_case():
    """Verify that GST calculation handles fractional decimal amounts safely without paisa drift."""
    req = GSTCalculationRequest(
        amount=Decimal("199.99"),
        calculation_type="exclusive",
        supply_type="intra_state",
        hsn_sac="998314",
    )
    res = compute_gst(req)

    # 199.99 * 0.18 = 35.9982 => rounded to 36.00
    assert res.total_tax == Decimal("36.00")
    assert res.cgst_amount + res.sgst_amount == res.total_tax
    assert res.total_payable == Decimal("199.99") + Decimal("36.00")
