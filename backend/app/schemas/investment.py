from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class AssetAllocationItem(BaseModel):
    """Broad asset class allocation breakdown item."""

    asset_class: str = Field(..., description="Name of asset class e.g. Equity Index Funds")
    percentage: float = Field(..., description="Suggested allocation percentage (0 to 100)")
    suggested_monthly_amount: Decimal = Field(..., description="Suggested monthly investment amount based on post-tax surplus")
    description: str = Field(..., description="Strategic purpose and risk-return characteristics")


class TaxSavingInstrumentInfo(BaseModel):
    """Details of eligible tax-saving instrument under Section 80C / 80CCD(1B)."""

    name: str = Field(..., description="Instrument type e.g. ELSS Mutual Funds")
    section: str = Field(..., description="Applicable Income Tax Act section e.g. 80C, 80CCD(1B)")
    lock_in_period: str = Field(..., description="Mandatory lock-in duration e.g. 3 years")
    tax_treatment: str = Field(..., description="Taxability of returns/maturity e.g. Exempt-Exempt-Exempt (EEE)")
    risk_level: str = Field(..., description="Risk profile of instrument e.g. High / Moderate / Low")
    expected_returns_range: str = Field(..., description="Indicative historical annual return range")
    key_benefits: List[str] = Field(default_factory=list, description="Primary features and advantages")


class InvestmentGuidanceRequest(BaseModel):
    """Request payload for rule-based investment & asset allocation guidance."""

    annual_income: Decimal = Field(..., gt=0, description="Annual gross CTC/income in INR (> 0)")
    age: int = Field(default=30, ge=18, le=100, description="Taxpayer age (18 to 100)")
    risk_profile: str = Field(
        default="moderate",
        description="Risk tolerance profile: 'conservative', 'moderate', or 'aggressive'",
    )
    regime: str = Field(default="new", description="Tax regime choice: 'new' or 'old'")
    existing_80c_deductions: Decimal = Field(
        default=Decimal("0"),
        ge=0,
        le=150000,
        description="Already declared Section 80C deductions in INR (0 to 1,50,000)",
    )
    monthly_expenses: Optional[Decimal] = Field(
        default=None,
        ge=0,
        description="Optional estimated monthly living expenses for emergency fund calculation",
    )

    @field_validator("risk_profile")
    @classmethod
    def validate_risk_profile(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if cleaned not in ("conservative", "moderate", "aggressive"):
            raise ValueError("risk_profile must be one of: 'conservative', 'moderate', or 'aggressive'.")
        return cleaned

    @field_validator("regime")
    @classmethod
    def validate_regime(cls, v: str) -> str:
        cleaned = v.strip().lower()
        if cleaned not in ("new", "old"):
            raise ValueError("regime must be 'new' or 'old'.")
        return cleaned


class InvestmentGuidanceResponse(BaseModel):
    """Structured response from rule-based investment allocation advisor."""

    risk_profile: str
    annual_gross_income: Decimal
    estimated_annual_tax: Decimal
    estimated_post_tax_surplus: Decimal
    suggested_monthly_investable_surplus: Decimal
    unused_80c_headroom: Decimal = Field(..., description="Remaining unused Section 80C limit (max ₹1,50,000 - declared)")
    nps_80ccd1b_headroom: Decimal = Field(default=Decimal("50000"), description="Additional Section 80CCD(1B) NPS headroom (₹50,000)")
    allocations: List[AssetAllocationItem] = Field(..., description="Broad asset class percentage breakdown (sums to 100%)")
    eligible_tax_saving_instruments: List[TaxSavingInstrumentInfo] = Field(
        ..., description="Generic tax-saving instrument types with lock-in and tax treatment"
    )
    emergency_fund_recommendation: Dict[str, Any] = Field(..., description="Emergency fund liquidity guidance")
    disclaimer: str = Field(
        default=(
            "General asset allocation model provided for educational and tax planning purposes. "
            "Audit V does NOT recommend specific stocks, fund names, or market timing. "
            "Consult a SEBI-registered financial advisor before investing."
        ),
        description="Statutory advisory disclaimer.",
    )
