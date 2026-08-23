from __future__ import annotations

from decimal import Decimal
from typing import List, Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class TaxDeductionsInput(BaseModel):
  """Deduction inputs for Indian Income Tax calculation."""

  section_80c: Decimal = Field(
      default=Decimal("0"),
      ge=Decimal("0"),
      description="Section 80C deductions (EPF, PPF, ELSS, tuition fees, principal repayment). Max cap ₹1.5L applied under Old Regime.",
  )
  section_80d: Decimal = Field(
      default=Decimal("0"),
      ge=Decimal("0"),
      description="Section 80D health insurance premium deduction.",
  )
  section_80ccd_1b: Decimal = Field(
      default=Decimal("0"),
      ge=Decimal("0"),
      description="Section 80CCD(1B) additional NPS investment deduction up to ₹50,000.",
  )
  hra_exemption: Decimal = Field(
      default=Decimal("0"),
      ge=Decimal("0"),
      description="House Rent Allowance (HRA) exemption under Section 10(13A).",
  )
  other_deductions: Decimal = Field(
      default=Decimal("0"),
      ge=Decimal("0"),
      description="Other eligible Chapter VI-A deductions (e.g., 80E, 80G, 80TTA/TTB).",
  )

  @field_validator(
      "section_80c", "section_80d", "section_80ccd_1b", "hra_exemption", "other_deductions"
  )
  @classmethod
  def check_non_negative(cls, v: Decimal) -> Decimal:
    if v < Decimal("0"):
      raise ValueError("Deduction amount cannot be negative")
    return v


class TaxCalculationRequest(BaseModel):
  """Structured request payload for Indian Income Tax calculation."""

  annual_income: Decimal = Field(
      ...,
      gt=Decimal("0"),
      description="Gross Annual Income from all sources (Salary, Business, Interest, etc.). Must be greater than zero.",
  )
  age: int = Field(
      default=30,
      ge=0,
      le=120,
      description="Age of taxpayer in years. Used to determine basic exemption limits under Old Regime.",
  )
  regime: Literal["new", "old", "compare"] = Field(
      default="compare",
      description="Tax Regime selection: 'new' (Section 115BAC), 'old', or 'compare' (both regimes).",
  )
  is_salaried: bool = Field(
      default=True,
      description="Whether taxpayer is a salaried employee eligible for Standard Deduction.",
  )
  deductions: TaxDeductionsInput = Field(
      default_factory=TaxDeductionsInput,
      description="Eligible tax deductions. (Primarily applicable under Old Regime).",
  )

  @field_validator("annual_income")
  @classmethod
  def validate_income(cls, v: Decimal) -> Decimal:
    if v <= Decimal("0"):
      raise ValueError("Annual income must be greater than zero.")
    return v


class SlabTaxBreakdown(BaseModel):
  """Breakdown of tax computed for a specific income slab."""

  slab_range: str
  rate_percentage: float
  taxable_in_slab: Decimal
  tax_for_slab: Decimal


class TaxCalculationResult(BaseModel):
  """Detailed calculation breakdown for a single tax regime."""

  financial_year: str = "Tax Year 2026-27"
  regime: str
  gross_income: Decimal
  standard_deduction: Decimal
  eligible_deductions: Decimal
  total_deductions: Decimal
  taxable_income: Decimal
  base_tax: Decimal
  rebate_87a: Decimal
  surcharge: Decimal
  cess: Decimal
  total_tax: Decimal
  effective_tax_rate: float
  monthly_tax_estimate: Decimal
  slab_breakdown: List[SlabTaxBreakdown]


class TaxCalculationResponse(BaseModel):
  """Response object containing calculation result and regime comparison."""

  disclaimer: str = (
      "Estimated calculation based on applicable Indian Income Tax rules (Tax Year 2026-27). "
      "Verify applicable rules before filing."
  )
  request_regime: str
  selected_result: TaxCalculationResult
  old_regime_result: Optional[TaxCalculationResult] = None
  new_regime_result: Optional[TaxCalculationResult] = None
  recommended_regime: Optional[str] = None
  potential_tax_savings: Optional[Decimal] = None
