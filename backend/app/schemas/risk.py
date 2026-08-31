from __future__ import annotations

from typing import Any, Dict, List, Optional
from pydantic import BaseModel, Field, field_validator


class TransactionInput(BaseModel):
    """Input payload for a single transaction."""

    transaction_id: str
    date: str
    time: str
    amount: float = Field(..., gt=0, description="Transaction amount in INR. Must be greater than zero.")
    transaction_type: str = "debit"
    category: str = "General"
    merchant: str = "Unknown"
    account_type: str = "checking"
    location: str = "India"
    payment_method: str = "UPI"

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: float) -> float:
        if v <= 0:
            raise ValueError("Transaction amount must be greater than zero.")
        return v


class AnalyzedTransaction(BaseModel):
    """Analyzed transaction output with anomaly score and risk findings."""

    transaction_id: str
    date: str
    time: str
    amount: float
    category: str
    merchant: str
    payment_method: str
    anomaly_score: float
    is_anomaly: bool
    risk_level: str
    reasons: List[str] = Field(default_factory=list)
    primary_reason: str
    contributing_features: List[str] = Field(default_factory=list)
    is_known_anomaly: Optional[bool] = None
    anomaly_type: Optional[str] = None


class RiskSummary(BaseModel):
    """Summary counts by risk level."""

    low: int = 0
    medium: int = 0
    high: int = 0
    critical: int = 0


class RiskAnalysisRequest(BaseModel):
    """Request payload for POST /api/v1/risk/analyze."""

    transactions: Optional[List[TransactionInput]] = Field(
        default=None,
        description="Optional list of transactions to analyze. If omitted, default 300-transaction synthetic dataset is evaluated.",
    )

    @field_validator("transactions")
    @classmethod
    def validate_transactions(cls, v: Optional[List[TransactionInput]]) -> Optional[List[TransactionInput]]:
        if v is not None and len(v) == 0:
            raise ValueError("Transaction list cannot be empty when provided.")
        return v


class RiskAnalysisResponse(BaseModel):
    """Structured response from Risk & Fraud Detection Engine."""

    total_transactions: int
    anomalies_detected: int
    risk_summary: RiskSummary
    summary_explanation: str
    transactions: List[AnalyzedTransaction]
    model_metadata: Dict[str, Any]
    disclaimer: str = (
        "Audit V Anomaly Detection Engine identifies statistical outliers and pattern flags. "
        "Flags indicate potential risk for investigation and do not automatically constitute confirmed fraud."
    )


class TaxpayerRiskInput(BaseModel):
    """Input payload for single taxpayer risk analysis."""

    taxpayer_id: Optional[str] = "TAX-001"
    revenue: float = Field(..., gt=0, description="Annual Revenue in INR")
    expenses: float = Field(..., ge=0, description="Annual Expenses in INR")
    tax_liability: float = Field(..., ge=0, description="Calculated Tax Liability in INR")
    tax_paid: float = Field(..., ge=0, description="Actual Tax Paid in INR")
    late_filings: int = Field(default=0, ge=0, description="Number of late filing occurrences")
    compliance_violations: int = Field(default=0, ge=0, description="Number of compliance violations")
    industry: str = Field(default="Finance", description="Industry classification (Finance, Retail, Manufacturing, Healthcare, Tech)")
    audit_findings: int = Field(default=0, ge=0, description="Number of audit findings")


class TaxpayerRiskResponse(BaseModel):
    """Structured risk classification response for taxpayer."""

    taxpayer_id: str
    predicted_risk_level: str = Field(..., description="Risk Level (Low, Medium, High)")
    risk_probabilities: Dict[str, float] = Field(default_factory=dict)
    risk_flags: List[str] = Field(default_factory=list)
    taxpayer_summary: Dict[str, Any] = Field(default_factory=dict)
    model_info: Dict[str, Any] = Field(
        default_factory=lambda: {
            "model": "Random Forest Taxpayer Compliance Classifier",
            "trained_on": "Indian Income Tax & Compliance Dataset",
        }
    )
