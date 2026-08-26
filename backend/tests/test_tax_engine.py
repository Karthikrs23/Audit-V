from __future__ import annotations

from decimal import Decimal
import pytest

from app.schemas.tax import TaxCalculationRequest, TaxDeductionsInput
from app.services.tax_engine import (
    calculate_new_regime,
    calculate_old_regime,
    compute_tax,
)


def test_basic_salary_new_regime():
    """Test 1: Basic salary calculation under New Regime for Tax Year 2026-27 (CTC ₹12L).

    Gross: 12,00,000
    Std Deduction: 75,000
    Taxable: 11,25,000

    Slabs (Tax Year 2026-27):
    0 - 4L: 0
    4L - 8L (4L @ 5%): 20,000
    8L - 11.25L (3.25L @ 10%): 32,500
    Base Tax: 52,500
    Section 87A Rebate (Taxable <= ₹12L): 52,500
    Total Tax: 0
    """
    res = calculate_new_regime(gross_income=Decimal("1200000"), is_salaried=True)

    assert res.gross_income == Decimal("1200000")
    assert res.standard_deduction == Decimal("75000")
    assert res.taxable_income == Decimal("1125000")
    assert res.base_tax == Decimal("52500")
    assert res.rebate_87a == Decimal("52500")
    assert res.cess == Decimal("0")
    assert res.total_tax == Decimal("0")
    assert res.effective_tax_rate == 0.0
    assert res.monthly_tax_estimate == Decimal("0")


def test_zero_income():
    """Test 2: Zero income taxpayer."""
    res = calculate_new_regime(gross_income=Decimal("0"), is_salaried=True)

    assert res.gross_income == Decimal("0")
    assert res.taxable_income == Decimal("0")
    assert res.base_tax == Decimal("0")
    assert res.total_tax == Decimal("0")
    assert res.effective_tax_rate == 0.0
    assert res.monthly_tax_estimate == Decimal("0")


def test_high_income_surcharge():
    """Test 3: High income taxpayer triggering surcharge (> ₹50L).

    Gross: 60,00,000
    Std Deduction: 75,000
    Taxable: 59,25,000

    Surcharge rate: 10% on tax after rebate.
    Cess: 4% on (Base Tax + Surcharge).
    """
    res = calculate_new_regime(gross_income=Decimal("6000000"), is_salaried=True)

    assert res.gross_income == Decimal("6000000")
    assert res.taxable_income == Decimal("5925000")
    assert res.surcharge > Decimal("0")
    assert res.total_tax > Decimal("0")


def test_old_regime_with_deductions():
    """Test 4: Old regime calculation with Chapter VI-A deductions.

    Gross: 15,00,000
    Std Deduction: 50,000
    80C: 1,50,000
    80D: 25,000
    HRA: 1,00,000
    Total Deductions: 3,25,000
    Taxable: 11,75,000
    """
    deductions = TaxDeductionsInput(
        section_80c=Decimal("150000"),
        section_80d=Decimal("25000"),
        hra_exemption=Decimal("100000"),
    )

    res = calculate_old_regime(
        gross_income=Decimal("1500000"),
        age=30,
        is_salaried=True,
        deductions=deductions,
    )

    assert res.gross_income == Decimal("1500000")
    assert res.standard_deduction == Decimal("50000")
    assert res.eligible_deductions == Decimal("275000")
    assert res.total_deductions == Decimal("325000")
    assert res.taxable_income == Decimal("1175000")


def test_deductions_capping():
    """Test 5: Verify Section 80C cap of ₹1.5L is enforced even if input is higher."""
    deductions = TaxDeductionsInput(
        section_80c=Decimal("250000"),  # Exceeds ₹1.5L cap
    )

    res = calculate_old_regime(
        gross_income=Decimal("1000000"),
        age=30,
        is_salaried=True,
        deductions=deductions,
    )

    assert res.eligible_deductions == Decimal("150000")


def test_invalid_negative_income_validation():
    """Test 6: Verify Pydantic rejects negative income."""
    with pytest.raises(ValueError):
        TaxCalculationRequest(annual_income=Decimal("-50000"))


def test_invalid_negative_deduction_validation():
    """Test 7: Verify Pydantic rejects negative deductions."""
    with pytest.raises(ValueError):
        TaxDeductionsInput(section_80c=Decimal("-10000"))


def test_rebate_87a_new_regime_under_7l():
    """Test 8: Section 87A rebate for New Regime (Gross ₹7.5L, Taxable ₹6.75L).

    Gross: 7,50,000
    Std Deduction: 75,000
    Taxable: 6,75,000 (<= 12,00,000)

    Base Tax:
    0 - 4L: 0
    4L - 6.75L (2.75L @ 5%): 13,750
    Rebate 87A: 13,750
    Total Tax: 0
    """
    res = calculate_new_regime(gross_income=Decimal("750000"), is_salaried=True)

    assert res.taxable_income == Decimal("675000")
    assert res.base_tax == Decimal("13750")
    assert res.rebate_87a == Decimal("13750")
    assert res.total_tax == Decimal("0")


def test_rebate_87a_new_regime_9_lakh_example():
    """Test 9: Section 87A rebate for ₹9,00,000 annual gross income under New Regime.

    Gross: 9,00,000
    Std Deduction: 75,000
    Taxable: 8,25,000 (<= 12,00,000)

    Base Tax:
    0 - 4L: 0
    4L - 8L (4L @ 5%): 20,000
    8L - 8.25L (25k @ 10%): 2,500
    Base Tax: 22,500
    Rebate 87A: 22,500
    Total Tax: 0
    """
    res = calculate_new_regime(gross_income=Decimal("900000"), is_salaried=True)

    assert res.gross_income == Decimal("900000")
    assert res.standard_deduction == Decimal("75000")
    assert res.taxable_income == Decimal("825000")
    assert res.base_tax == Decimal("22500")
    assert res.rebate_87a == Decimal("22500")
    assert res.cess == Decimal("0")
    assert res.total_tax == Decimal("0")
    assert res.effective_tax_rate == 0.0


def test_rebate_87a_new_regime_range_7l_to_12l():
    """Test 10: Section 87A rebate for New Regime covering ₹7L-₹12L taxable range (Gross ₹12.75L).

    Gross: 12,75,000
    Std Deduction: 75,000
    Taxable: 12,00,000 (Exactly at Section 87A limit ₹12,00,000)

    Base Tax:
    0 - 4L: 0
    4L - 8L (4L @ 5%): 20,000
    8L - 12L (4L @ 10%): 40,000
    Base Tax: 60,000
    Rebate 87A (max ₹60,000): 60,000
    Total Tax: 0
    """
    res = calculate_new_regime(gross_income=Decimal("1275000"), is_salaried=True)

    assert res.taxable_income == Decimal("1200000")
    assert res.base_tax == Decimal("60000")
    assert res.rebate_87a == Decimal("60000")
    assert res.total_tax == Decimal("0")
    assert res.effective_tax_rate == 0.0


def test_new_regime_above_12l_taxable():
    """Test 11: New Regime calculation for Gross ₹15L (Taxable ₹14.25L > ₹12L limit, no rebate).

    Gross: 15,00,000
    Std Deduction: 75,000
    Taxable: 14,25,000

    Slabs:
    0 - 4L: 0
    4L - 8L (4L @ 5%): 20,000
    8L - 12L (4L @ 10%): 40,000
    12L - 14.25L (2.25L @ 15%): 33,750
    Base Tax: 93,750
    Rebate 87A: 0
    Cess (4%): 3,750
    Total Tax: 97,500
    Monthly Tax: 8,125
    """
    res = calculate_new_regime(gross_income=Decimal("1500000"), is_salaried=True)

    assert res.taxable_income == Decimal("1425000")
    assert res.base_tax == Decimal("93750")
    assert res.rebate_87a == Decimal("0")
    assert res.cess == Decimal("3750")
    assert res.total_tax == Decimal("97500")
    assert res.monthly_tax_estimate == Decimal("8125")


def test_cess_calculation():
    """Test 12: Verify Health & Education Cess is exactly 4% of (Tax + Surcharge)."""
    res = calculate_new_regime(gross_income=Decimal("1500000"), is_salaried=True)

    expected_cess = (res.base_tax - res.rebate_87a + res.surcharge) * Decimal("0.04")
    assert res.cess == round(expected_cess)


def test_regime_comparison_pipeline():
    """Test 13: Regime comparison pipeline returns recommendations for Tax Year 2026-27."""
    req = TaxCalculationRequest(
        annual_income=Decimal("1500000"),
        age=30,
        regime="compare",
        deductions=TaxDeductionsInput(section_80c=Decimal("150000")),
    )

    resp = compute_tax(req)

    assert resp.old_regime_result is not None
    assert resp.new_regime_result is not None
    assert resp.recommended_regime.startswith("New Tax Regime") or resp.recommended_regime.startswith("Old Tax Regime")
    assert resp.potential_tax_savings >= Decimal("0")


def test_senior_citizen_exemption_old_regime():
    """Test 14: Senior Citizen (Age 65) basic exemption limit of ₹3L under Old Regime."""
    res = calculate_old_regime(
        gross_income=Decimal("300000"),
        age=65,
        is_salaried=False,
    )

    assert res.taxable_income == Decimal("300000")
    assert res.base_tax == Decimal("0")


def test_high_income_surcharge_55_lakh():
    """Test 15: Surcharge calculation at ₹55,00,000 CTC under New Regime (10% Surcharge Rate).

    Gross: 55,00,000
    Std Deduction: 75,000
    Taxable Income: 54,25,000 (> ₹50L threshold)

    Base Tax:
    0-4L: 0
    4-8L (4L @ 5%): 20,000
    8-12L (4L @ 10%): 40,000
    12-16L (4L @ 15%): 60,000
    16-20L (4L @ 20%): 80,000
    20-24L (4L @ 25%): 1,00,000
    Above 24L (30.25L @ 30%): 9,07,500
    Base Tax: 12,07,500

    Surcharge (10% of ₹12,07,500): 1,20,750
    Cess (4% of ₹13,28,250): 53,130
    Total Tax: 13,81,380
    """
    res = calculate_new_regime(gross_income=Decimal("5500000"), is_salaried=True)

    assert res.taxable_income == Decimal("5425000")
    assert res.base_tax == Decimal("1207500")
    assert res.surcharge == Decimal("120750")
    assert res.cess == Decimal("53130")
    assert res.total_tax == Decimal("1381380")


def test_high_income_surcharge_1_1_crore():
    """Test 16: Surcharge calculation at ₹1.1 Crore (₹1,10,00,000) under New Regime (15% Surcharge Rate).

    Gross: 1,10,00,000
    Std Deduction: 75,000
    Taxable Income: 1,09,25,000 (> ₹1Cr threshold)

    Base Tax:
    Slabs up to 24L: 3,00,000
    24L to 109.25L (85.25L @ 30%): 25,57,500
    Base Tax: 28,57,500

    Surcharge (15% of ₹28,57,500): 4,28,625
    Cess (4% of ₹32,86,125): 1,31,445
    Total Tax: 34,17,570
    """
    res = calculate_new_regime(gross_income=Decimal("11000000"), is_salaried=True)

    assert res.taxable_income == Decimal("10925000")
    assert res.base_tax == Decimal("2857500")
    assert res.surcharge == Decimal("428625")
    assert res.cess == Decimal("131445")
    assert res.total_tax == Decimal("3417570")


def test_high_income_surcharge_2_crore():
    """Test 17: Surcharge calculation at ₹2 Crore (₹2,00,00,000) under New Regime (15% Surcharge Rate).

    Gross: 2,00,00,000
    Std Deduction: 75,000
    Taxable Income: 1,99,25,000 (<= ₹2Cr threshold, 15% rate)

    Base Tax:
    Slabs up to 24L: 3,00,000
    24L to 199.25L (175.25L @ 30%): 52,57,500
    Base Tax: 55,57,500

    Surcharge (15% of ₹55,57,500): 8,33,625
    Cess (4% of ₹63,91,125): 2,55,645
    Total Tax: 66,46,770
    """
    res = calculate_new_regime(gross_income=Decimal("20000000"), is_salaried=True)

    assert res.taxable_income == Decimal("19925000")
    assert res.base_tax == Decimal("5557500")
    assert res.surcharge == Decimal("833625")
    assert res.cess == Decimal("255645")
    assert res.total_tax == Decimal("6646770")


def test_marginal_relief_51_lakh():
    """Test 18: Verify Marginal Relief is applied when taxable income slightly exceeds ₹50L.

    Gross: 51,00,000
    Std Deduction: 75,000
    Taxable Income: 50,25,000 (> ₹50L by ₹25,000)

    Base Tax on 50.25L: 10,80,000 + (25k @ 30% = 7,500) = 10,87,500
    Raw Surcharge (10%): 1,08,750
    Tax + Raw Surcharge: 11,96,250

    Tax on threshold 50L: 10,80,000
    Max Permissible Tax: 10,80,000 + 25,000 = 11,05,000
    Marginal Relief: 11,96,250 - 11,05,000 = 91,250
    Final Surcharge: 1,08,750 - 91,250 = 17,500
    Tax + Surcharge after relief: 11,05,000
    Cess (4%): 44,200
    Total Tax: 11,49,200
    """
    res = calculate_new_regime(gross_income=Decimal("5100000"), is_salaried=True)

    assert res.taxable_income == Decimal("5025000")
    assert res.base_tax == Decimal("1087500")
    assert res.surcharge == Decimal("17500")
    assert res.cess == Decimal("44200")
    assert res.total_tax == Decimal("1149200")


