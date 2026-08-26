from __future__ import annotations

import logging
import time
from decimal import Decimal, ROUND_HALF_UP
from typing import List, Tuple
from app.core.logging import get_logger, log_structured_event
from app.schemas.tax import (
    SlabTaxBreakdown,
    TaxCalculationRequest,
    TaxCalculationResponse,
    TaxCalculationResult,
    TaxDeductionsInput,
)


class TaxRulesConfig:
    """Indian Income Tax rules, limits, and slab parameters for Tax Year 2026-27.

    Separated cleanly from calculation logic to allow simple updating for future tax years.
    """

    FINANCIAL_YEAR: str = "Tax Year 2026-27"

    # Standard Deductions
    STD_DEDUCTION_NEW: Decimal = Decimal("75000")  # Standard deduction for salaried
    STD_DEDUCTION_OLD: Decimal = Decimal("50000")

    # Deduction Caps (Old Regime)
    CAP_80C: Decimal = Decimal("150000")
    CAP_80CCD_1B: Decimal = Decimal("50000")
    CAP_80D_NORMAL: Decimal = Decimal("25000")
    CAP_80D_SENIOR: Decimal = Decimal("50000")

    # Cess & Rebate Rates
    CESS_RATE: Decimal = Decimal("0.04")  # 4% Health & Education Cess

    REBATE_87A_LIMIT_NEW: Decimal = Decimal("1200000")  # Tax Year 2026-27 Section 87A Limit
    REBATE_87A_MAX_NEW: Decimal = Decimal("60000")       # Max rebate ₹60,000

    REBATE_87A_LIMIT_OLD: Decimal = Decimal("500000")
    REBATE_87A_MAX_OLD: Decimal = Decimal("12500")

    # Slabs for New Tax Regime (Section 115BAC) - Tax Year 2026-27
    NEW_REGIME_SLABS: List[Tuple[Decimal, Decimal, Decimal]] = [
        (Decimal("0"), Decimal("400000"), Decimal("0.00")),
        (Decimal("400000"), Decimal("800000"), Decimal("0.05")),
        (Decimal("800000"), Decimal("1200000"), Decimal("0.10")),
        (Decimal("1200000"), Decimal("1600000"), Decimal("0.15")),
        (Decimal("1600000"), Decimal("2000000"), Decimal("0.20")),
        (Decimal("2000000"), Decimal("2400000"), Decimal("0.25")),
        (Decimal("2400000"), Decimal("Infinity"), Decimal("0.30")),
    ]

    # Slabs for Old Tax Regime (Unchanged)
    OLD_REGIME_SLABS_NORMAL: List[Tuple[Decimal, Decimal, Decimal]] = [
        (Decimal("0"), Decimal("250000"), Decimal("0.00")),
        (Decimal("250000"), Decimal("500000"), Decimal("0.05")),
        (Decimal("500000"), Decimal("1000000"), Decimal("0.20")),
        (Decimal("1000000"), Decimal("Infinity"), Decimal("0.30")),
    ]

    OLD_REGIME_SLABS_SENIOR: List[Tuple[Decimal, Decimal, Decimal]] = [  # Age 60-79
        (Decimal("0"), Decimal("300000"), Decimal("0.00")),
        (Decimal("300000"), Decimal("500000"), Decimal("0.05")),
        (Decimal("500000"), Decimal("1000000"), Decimal("0.20")),
        (Decimal("1000000"), Decimal("Infinity"), Decimal("0.30")),
    ]

    OLD_REGIME_SLABS_SUPER_SENIOR: List[Tuple[Decimal, Decimal, Decimal]] = [  # Age 80+
        (Decimal("0"), Decimal("500000"), Decimal("0.00")),
        (Decimal("500000"), Decimal("1000000"), Decimal("0.20")),
        (Decimal("1000000"), Decimal("Infinity"), Decimal("0.30")),
    ]


def _quantize_currency(amount: Decimal) -> Decimal:
    """Round currency amount to nearest integer as per Income Tax Act section 288B."""
    return amount.quantize(Decimal("1"), rounding=ROUND_HALF_UP)


def _compute_slab_tax(
    taxable_income: Decimal, slabs: List[Tuple[Decimal, Decimal, Decimal]]
) -> Tuple[Decimal, List[SlabTaxBreakdown]]:
    """Compute base tax slab by slab and return total base tax and breakdown."""
    total_base_tax = Decimal("0")
    breakdown: List[SlabTaxBreakdown] = []

    for lower, upper, rate in slabs:
        if taxable_income > lower:
            slab_income = min(taxable_income, upper) - lower
            slab_tax = slab_income * rate

            range_str = (
                f"₹{lower:,.0f} - ₹{upper:,.0f}"
                if upper != Decimal("Infinity")
                else f"Above ₹{lower:,.0f}"
            )

            breakdown.append(
                SlabTaxBreakdown(
                    slab_range=range_str,
                    rate_percentage=float(rate * 100),
                    taxable_in_slab=_quantize_currency(slab_income),
                    tax_for_slab=_quantize_currency(slab_tax),
                )
            )

            total_base_tax += slab_tax
        else:
            break

    return _quantize_currency(total_base_tax), breakdown


def _compute_surcharge(
    taxable_income: Decimal,
    base_tax: Decimal,
    regime: str,
    slabs: List[Tuple[Decimal, Decimal, Decimal]] | None = None,
) -> Decimal:
    """Compute surcharge based on taxable income thresholds with marginal relief protection."""
    if taxable_income <= Decimal("5000000"):
        return Decimal("0")

    if Decimal("5000000") < taxable_income <= Decimal("10000000"):
        rate = Decimal("0.10")
        threshold = Decimal("5000000")
        prev_rate = Decimal("0.00")
    elif Decimal("10000000") < taxable_income <= Decimal("20000000"):
        rate = Decimal("0.15")
        threshold = Decimal("10000000")
        prev_rate = Decimal("0.10")
    elif Decimal("20000000") < taxable_income <= Decimal("50000000"):
        rate = Decimal("0.25")
        threshold = Decimal("20000000")
        prev_rate = Decimal("0.15")
    else:  # Above ₹5Cr
        rate = Decimal("0.25") if regime == "new" else Decimal("0.37")
        threshold = Decimal("50000000")
        prev_rate = Decimal("0.25")

    raw_surcharge = base_tax * rate

    if slabs:
        base_tax_at_threshold, _ = _compute_slab_tax(threshold, slabs)
        tax_plus_surcharge_at_threshold = base_tax_at_threshold + (base_tax_at_threshold * prev_rate)
        max_permissible_tax = tax_plus_surcharge_at_threshold + (taxable_income - threshold)

        actual_tax_plus_surcharge = base_tax + raw_surcharge

        if actual_tax_plus_surcharge > max_permissible_tax:
            marginal_relief = actual_tax_plus_surcharge - max_permissible_tax
            final_surcharge = max(Decimal("0"), raw_surcharge - marginal_relief)
            return _quantize_currency(final_surcharge)

    return _quantize_currency(raw_surcharge)


def calculate_new_regime(
    gross_income: Decimal, is_salaried: bool = True
) -> TaxCalculationResult:
    """Calculate Indian Income Tax under the New Tax Regime (Section 115BAC) for Tax Year 2026-27."""
    std_deduction = TaxRulesConfig.STD_DEDUCTION_NEW if is_salaried else Decimal("0")
    total_deductions = std_deduction
    taxable_income = max(Decimal("0"), gross_income - total_deductions)

    base_tax, breakdown = _compute_slab_tax(taxable_income, TaxRulesConfig.NEW_REGIME_SLABS)

    # Section 87A Rebate for New Regime (Taxable Income <= ₹12,00,000 for Tax Year 2026-27)
    rebate_87a = Decimal("0")
    if taxable_income <= TaxRulesConfig.REBATE_87A_LIMIT_NEW:
        rebate_87a = min(base_tax, TaxRulesConfig.REBATE_87A_MAX_NEW)

    tax_after_rebate = max(Decimal("0"), base_tax - rebate_87a)
    surcharge = _compute_surcharge(taxable_income, tax_after_rebate, regime="new", slabs=TaxRulesConfig.NEW_REGIME_SLABS)
    cess = _quantize_currency((tax_after_rebate + surcharge) * TaxRulesConfig.CESS_RATE)

    total_tax = _quantize_currency(tax_after_rebate + surcharge + cess)
    effective_rate = float(round((total_tax / gross_income * 100), 2)) if gross_income > 0 else 0.0
    monthly_tax = _quantize_currency(total_tax / Decimal("12"))

    return TaxCalculationResult(
        financial_year=TaxRulesConfig.FINANCIAL_YEAR,
        regime="New Tax Regime (Section 115BAC, Income Tax Act 1961 — recodified as Section 202 under Income Tax Act 2025)",
        gross_income=_quantize_currency(gross_income),
        standard_deduction=_quantize_currency(std_deduction),
        eligible_deductions=Decimal("0"),
        total_deductions=_quantize_currency(total_deductions),
        taxable_income=_quantize_currency(taxable_income),
        base_tax=base_tax,
        rebate_87a=rebate_87a,
        surcharge=surcharge,
        cess=cess,
        total_tax=total_tax,
        effective_tax_rate=effective_rate,
        monthly_tax_estimate=monthly_tax,
        slab_breakdown=breakdown,
    )


def calculate_old_regime(
    gross_income: Decimal,
    age: int = 30,
    is_salaried: bool = True,
    deductions: TaxDeductionsInput | None = None,
) -> TaxCalculationResult:
    """Calculate Indian Income Tax under the Old Tax Regime for Tax Year 2026-27."""
    if deductions is None:
        deductions = TaxDeductionsInput()

    std_deduction = TaxRulesConfig.STD_DEDUCTION_OLD if is_salaried else Decimal("0")

    # Apply statutory limits for deductions
    eligible_80c = min(deductions.section_80c, TaxRulesConfig.CAP_80C)
    eligible_80ccd_1b = min(deductions.section_80ccd_1b, TaxRulesConfig.CAP_80CCD_1B)

    cap_80d = (
        TaxRulesConfig.CAP_80D_SENIOR if age >= 60 else TaxRulesConfig.CAP_80D_NORMAL
    )
    eligible_80d = min(deductions.section_80d, cap_80d)

    eligible_chapter_vi_a = (
        eligible_80c
        + eligible_80d
        + eligible_80ccd_1b
        + deductions.hra_exemption
        + deductions.other_deductions
    )

    total_deductions = std_deduction + eligible_chapter_vi_a
    taxable_income = max(Decimal("0"), gross_income - total_deductions)

    # Determine slabs by age bracket
    if age >= 80:
        slabs = TaxRulesConfig.OLD_REGIME_SLABS_SUPER_SENIOR
    elif age >= 60:
        slabs = TaxRulesConfig.OLD_REGIME_SLABS_SENIOR
    else:
        slabs = TaxRulesConfig.OLD_REGIME_SLABS_NORMAL

    base_tax, breakdown = _compute_slab_tax(taxable_income, slabs)

    # Section 87A Rebate for Old Regime (Taxable Income <= ₹5,00,000)
    rebate_87a = Decimal("0")
    if taxable_income <= TaxRulesConfig.REBATE_87A_LIMIT_OLD:
        rebate_87a = min(base_tax, TaxRulesConfig.REBATE_87A_MAX_OLD)

    tax_after_rebate = max(Decimal("0"), base_tax - rebate_87a)
    surcharge = _compute_surcharge(taxable_income, tax_after_rebate, regime="old", slabs=slabs)
    cess = _quantize_currency((tax_after_rebate + surcharge) * TaxRulesConfig.CESS_RATE)

    total_tax = _quantize_currency(tax_after_rebate + surcharge + cess)
    effective_rate = float(round((total_tax / gross_income * 100), 2)) if gross_income > 0 else 0.0
    monthly_tax = _quantize_currency(total_tax / Decimal("12"))

    return TaxCalculationResult(
        financial_year=TaxRulesConfig.FINANCIAL_YEAR,
        regime="Old Tax Regime",
        gross_income=_quantize_currency(gross_income),
        standard_deduction=_quantize_currency(std_deduction),
        eligible_deductions=_quantize_currency(eligible_chapter_vi_a),
        total_deductions=_quantize_currency(total_deductions),
        taxable_income=_quantize_currency(taxable_income),
        base_tax=base_tax,
        rebate_87a=rebate_87a,
        surcharge=surcharge,
        cess=cess,
        total_tax=total_tax,
        effective_tax_rate=effective_rate,
        monthly_tax_estimate=monthly_tax,
        slab_breakdown=breakdown,
    )


def compute_tax(request: TaxCalculationRequest) -> TaxCalculationResponse:
    """Execute tax engine pipeline based on structured request inputs with structured logging."""
    start_time = time.perf_counter()
    logger = get_logger("tax_engine")

    try:
        gross = request.annual_income

        new_res = calculate_new_regime(gross_income=gross, is_salaried=request.is_salaried)
        old_res = calculate_old_regime(
            gross_income=gross,
            age=request.age,
            is_salaried=request.is_salaried,
            deductions=request.deductions,
        )

        if request.regime == "new":
            selected_res = new_res
        elif request.regime == "old":
            selected_res = old_res
        else:  # compare
            selected_res = new_res if new_res.total_tax <= old_res.total_tax else old_res

        recommended = (
            "New Tax Regime (Section 115BAC, Income Tax Act 1961 — recodified as Section 202 under Income Tax Act 2025)"
            if new_res.total_tax <= old_res.total_tax
            else "Old Tax Regime"
        )
        savings = abs(new_res.total_tax - old_res.total_tax)

        response = TaxCalculationResponse(
            request_regime=request.regime,
            selected_result=selected_res,
            old_regime_result=old_res,
            new_regime_result=new_res,
            recommended_regime=recommended,
            potential_tax_savings=savings,
        )

        duration_ms = (time.perf_counter() - start_time) * 1000.0
        log_structured_event(
            logger=logger,
            engine="IndianTaxEngine",
            processing_time_ms=duration_ms,
            status="SUCCESS",
            metadata={
                "requested_regime": request.regime,
                "age": request.age,
                "is_salaried": request.is_salaried,
                "recommended_regime": recommended,
            },
        )

        return response
    except Exception as err:
        duration_ms = (time.perf_counter() - start_time) * 1000.0
        log_structured_event(
            logger=logger,
            engine="IndianTaxEngine",
            processing_time_ms=duration_ms,
            status="FAILURE",
            metadata={"error": str(err)},
            level=logging.ERROR,  # ERROR level
        )
        raise
