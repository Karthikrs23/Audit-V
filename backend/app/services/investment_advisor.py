from __future__ import annotations

import logging
from decimal import Decimal
from typing import Any, Dict, List

from app.core.logging import get_logger, log_structured_event
from app.schemas.investment import (
    AssetAllocationItem,
    InvestmentGuidanceRequest,
    InvestmentGuidanceResponse,
    TaxSavingInstrumentInfo,
)
from app.schemas.tax import TaxCalculationRequest, TaxDeductionsInput
from app.services.tax_engine import compute_tax

logger = get_logger("investment_advisor")

MAX_80C_CAP = Decimal("150000")
NPS_80CCD1B_CAP = Decimal("50000")


def generate_investment_guidance(req: InvestmentGuidanceRequest) -> InvestmentGuidanceResponse:
    """Generate rule-based asset allocation and tax-saving instrument guidance."""
    logger.info(
        f"Generating rule-based investment guidance for income ₹{req.annual_income:,}, "
        f"risk profile: {req.risk_profile}, regime: {req.regime}"
    )

    # 1. Tax calculation using TaxEngine
    tax_req = TaxCalculationRequest(
        annual_income=req.annual_income,
        age=req.age,
        regime=req.regime,
        is_salaried=True,
        deductions=TaxDeductionsInput(section_80c=req.existing_80c_deductions),
    )
    tax_resp = compute_tax(tax_req)

    selected_tax_res = tax_resp.selected_result
    estimated_tax = selected_tax_res.total_tax
    post_tax_surplus = max(Decimal("0"), req.annual_income - estimated_tax)

    # Assume investable savings rate is ~40% of post-tax surplus, or (Surplus / 12) * 0.40
    suggested_monthly_investable = round((post_tax_surplus / Decimal("12")) * Decimal("0.40"), 2)

    # 2. Unused Section 80C Headroom (Strictly capped at max ₹1,50,000 - declared)
    unused_80c = max(Decimal("0"), MAX_80C_CAP - req.existing_80c_deductions)

    # 3. Rule-based asset allocation percentage breakdown (Always sums to exactly 100%)
    profile = req.risk_profile.lower()
    if profile == "conservative":
        equity_pct = 25.0
        debt_pct = 55.0
        gold_pct = 10.0
        tax_saving_pct = 10.0
    elif profile == "aggressive":
        equity_pct = 70.0
        debt_pct = 15.0
        gold_pct = 5.0
        tax_saving_pct = 10.0
    else:  # moderate default
        equity_pct = 50.0
        debt_pct = 30.0
        gold_pct = 10.0
        tax_saving_pct = 10.0

    # Ensure allocations sum to 100.0%
    total_pct = equity_pct + debt_pct + gold_pct + tax_saving_pct
    assert abs(total_pct - 100.0) < 0.001, f"Allocation percentages sum to {total_pct}%, expected 100%"

    allocations: List[AssetAllocationItem] = [
        AssetAllocationItem(
            asset_class="Equity Index Funds & Broad Market ETFs",
            percentage=equity_pct,
            suggested_monthly_amount=round((suggested_monthly_investable * Decimal(str(equity_pct))) / Decimal("100"), 2),
            description="Broad market index funds (e.g. NIFTY 50, NIFTY Next 50) for long-term wealth compounding and inflation hedging.",
        ),
        AssetAllocationItem(
            asset_class="Debt & Fixed Income Instruments",
            percentage=debt_pct,
            suggested_monthly_amount=round((suggested_monthly_investable * Decimal(str(debt_pct))) / Decimal("100"), 2),
            description="High-quality corporate bond funds, target maturity debt funds, and bank deposits providing portfolio stability and capital preservation.",
        ),
        AssetAllocationItem(
            asset_class="Sovereign Gold & Gold ETFs",
            percentage=gold_pct,
            suggested_monthly_amount=round((suggested_monthly_investable * Decimal(str(gold_pct))) / Decimal("100"), 2),
            description="Strategic portfolio hedge against currency depreciation, geopolitical uncertainty, and systemic market volatility.",
        ),
        AssetAllocationItem(
            asset_class="Tax-Saving Instruments (Section 80C / 80CCD)",
            percentage=tax_saving_pct,
            suggested_monthly_amount=round((suggested_monthly_investable * Decimal(str(tax_saving_pct))) / Decimal("100"), 2),
            description="Tax-efficient investment vehicles to utilize remaining Section 80C headroom and additional Section 80CCD(1B) pension limits.",
        ),
    ]

    # 4. Eligible Instrument Types for Section 80C / 80CCD(1B)
    eligible_instruments: List[TaxSavingInstrumentInfo] = [
        TaxSavingInstrumentInfo(
            name="Equity Linked Savings Scheme (ELSS) Mutual Funds",
            section="Section 80C",
            lock_in_period="3 Years (Shortest among Section 80C options)",
            tax_treatment="Long Term Capital Gains (LTCG) above ₹1.25 Lakh taxed at 12.5%. Dividends taxed at slab rate.",
            risk_level="High (Market-linked equity portfolio)",
            expected_returns_range="12% - 15% CAGR (Historical long-term market average)",
            key_benefits=[
                "Shortest lock-in period (3 years) among all Section 80C tax-saving options",
                "High long-term inflation-beating capital appreciation potential",
                "SIP (Systematic Investment Plan) route supported",
            ],
        ),
        TaxSavingInstrumentInfo(
            name="Public Provident Fund (PPF)",
            section="Section 80C",
            lock_in_period="15 Years (Partial withdrawals permitted from Year 7 onwards)",
            tax_treatment="Exempt-Exempt-Exempt (EEE) status — Contribution, interest earned, and maturity proceeds are 100% tax-free.",
            risk_level="Very Low (Sovereign guarantee backed by Govt of India)",
            expected_returns_range="7.1% p.a. (Government quarterly fixed interest rate)",
            key_benefits=[
                "100% tax-free interest and maturity proceeds under EEE tax regime",
                "Absolute sovereign capital safety backed by Government of India",
                "Long-term disciplined compounding vehicle",
            ],
        ),
        TaxSavingInstrumentInfo(
            name="National Pension System (NPS)",
            section="Section 80C & Section 80CCD(1B)",
            lock_in_period="Till Age 60 (Mandatory 60% lump sum + 40% annuity purchase)",
            tax_treatment="60% lump sum at age 60 is 100% tax-free. 40% annuity payout taxable at slab rate. Extra ₹50k deduction under 80CCD(1B).",
            risk_level="Moderate to Low (Configurable asset mix across Equity, Corporate Debt, Govt Bonds)",
            expected_returns_range="9% - 11% CAGR (Market-linked pension fund managers)",
            key_benefits=[
                "Exclusive additional tax deduction of ₹50,000 under Section 80CCD(1B) beyond Section 80C limit",
                "Extremely low fund management expense ratio (0.09%)",
                "Auto-choice lifecycle asset allocation mode available",
            ],
        ),
        TaxSavingInstrumentInfo(
            name="5-Year Tax-Saving Bank Fixed Deposit",
            section="Section 80C",
            lock_in_period="5 Years (No premature withdrawal or loan facility allowed)",
            tax_treatment="Principal qualifies for Section 80C deduction. Interest earned is fully taxable at applicable income tax slab rate.",
            risk_level="Very Low (DICGC insured up to ₹5 Lakhs per bank)",
            expected_returns_range="6.5% - 7.5% p.a. (Fixed bank interest rate)",
            key_benefits=[
                "Guaranteed fixed interest returns unaffected by market fluctuations",
                "Convenient instant setup via net banking",
            ],
        ),
    ]

    # 5. Emergency Fund Recommendation
    estimated_monthly_exp = req.monthly_expenses or (req.annual_income / Decimal("24"))  # Default estimate
    emergency_target_min = round(estimated_monthly_exp * Decimal("3"), 2)
    emergency_target_max = round(estimated_monthly_exp * Decimal("6"), 2)

    emergency_fund_info = {
        "recommended_months": "3 to 6 months of living expenses",
        "estimated_monthly_expenses": estimated_monthly_exp,
        "target_emergency_fund_range": f"₹{emergency_target_min:,} - ₹{emergency_target_max:,}",
        "suggested_instruments": [
            "High-Yield Bank Savings Account",
            "Liquid Debt Mutual Funds",
            "Instant-Access Short-Term Bank Fixed Deposits",
        ],
    }

    return InvestmentGuidanceResponse(
        risk_profile=req.risk_profile,
        annual_gross_income=req.annual_income,
        estimated_annual_tax=estimated_tax,
        estimated_post_tax_surplus=post_tax_surplus,
        suggested_monthly_investable_surplus=suggested_monthly_investable,
        unused_80c_headroom=unused_80c,
        nps_80ccd1b_headroom=NPS_80CCD1B_CAP,
        allocations=allocations,
        eligible_tax_saving_instruments=eligible_instruments,
        emergency_fund_recommendation=emergency_fund_info,
    )
