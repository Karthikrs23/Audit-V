from __future__ import annotations

from decimal import Decimal
from typing import Any, Dict, List, Literal, Optional
from pydantic import BaseModel, Field, field_validator, model_validator


class GSTRateRule(BaseModel):
    """Authoritative GST rate specification for a goods/services category or HSN/SAC."""
    hsn_sac: str
    description: str
    category: str
    standard_rate: Decimal
    rule_source: str
    assumptions: List[str] = Field(default_factory=list)


class GSTCalculationRequest(BaseModel):
    """Structured, input-driven request payload for GST calculation."""
    amount: Decimal = Field(
        ...,
        gt=Decimal("0"),
        description="Transaction amount in INR. Must be greater than zero.",
    )
    calculation_type: Literal["exclusive", "inclusive"] = Field(
        default="exclusive",
        description="'exclusive' adds GST on top of base amount; 'inclusive' extracts GST from the gross amount.",
    )
    supply_type: Literal["auto", "intra_state", "inter_state"] = Field(
        default="auto",
        description="'intra_state' splits into CGST + SGST; 'inter_state' applies IGST. 'auto' determines based on states.",
    )
    source_state: Optional[str] = Field(
        default=None,
        description="State of supplier (e.g. 'Maharashtra', 'Karnataka', 'Delhi').",
    )
    destination_state: Optional[str] = Field(
        default=None,
        description="Place of supply / state of recipient.",
    )
    hsn_sac: Optional[str] = Field(
        default=None,
        description="HSN (Goods) or SAC (Services) classification code (e.g., '9983', '998314', '8471').",
    )
    category: Optional[str] = Field(
        default="Services - IT & Professional",
        description="Business or product category.",
    )
    rate: Optional[Decimal] = Field(
        default=None,
        ge=Decimal("0"),
        le=Decimal("100"),
        description="Explicit GST rate percentage (0, 5, 12, 18, 28) or custom rate.",
    )

    goods_or_services: Optional[str] = Field(default=None, description="Supply classification: 'goods' or 'services'.")
    transaction_type: Optional[str] = Field(default="b2b", description="Transaction type: 'b2b', 'b2c', 'sez', 'export'.")

    @model_validator(mode="before")
    @classmethod
    def map_aliases(cls, data: Any) -> Any:
        if isinstance(data, dict):
            # Map calculation_mode to calculation_type if provided
            if "calculation_mode" in data and "calculation_type" not in data:
                data["calculation_type"] = data["calculation_mode"]
            # Map hsn_sac_code to hsn_sac if provided
            if "hsn_sac_code" in data and "hsn_sac" not in data:
                data["hsn_sac"] = data["hsn_sac_code"]
            # Map rate_percentage to rate if provided
            if "rate_percentage" in data and "rate" not in data:
                data["rate"] = data["rate_percentage"]
            # If SEZ or export, zero-rate
            tx_type = str(data.get("transaction_type", "")).lower()
            if tx_type in ("sez", "export"):
                data["rate"] = Decimal("0.0")
        return data

    @field_validator("amount")
    @classmethod
    def validate_amount(cls, v: Decimal) -> Decimal:
        if v <= Decimal("0"):
            raise ValueError("Amount must be greater than zero.")
        # Guard against excessively large/overflow inputs (cap at ₹1,000 Crore = 10,000,000,000)
        if v > Decimal("10000000000"):
            raise ValueError("Amount exceeds maximum supported limit (₹1,000 Crore).")
        return v

    @field_validator("rate")
    @classmethod
    def validate_rate(cls, v: Optional[Decimal]) -> Optional[Decimal]:
        if v is not None:
            if v < Decimal("0") or v > Decimal("100"):
                raise ValueError("GST rate must be between 0% and 100%.")
        return v


class GSTCalculationResponse(BaseModel):
    """Validated, decimal-safe GST calculation result with breakdown and statutory sources."""
    base_amount: Decimal
    gst_rate: Decimal
    calculation_type: Literal["exclusive", "inclusive"]
    calculation_mode: Optional[Literal["exclusive", "inclusive"]] = None
    supply_type: Literal["intra_state", "inter_state"]
    is_inter_state: bool
    source_state: Optional[str] = None
    destination_state: Optional[str] = None
    goods_or_services: Optional[str] = "services"
    transaction_type: Optional[str] = "b2b"

    # Tax Split
    cgst_rate: Decimal
    cgst_amount: Decimal
    sgst_rate: Decimal
    sgst_amount: Decimal
    igst_rate: Decimal
    igst_amount: Decimal
    total_tax: Decimal
    total_payable: Decimal

    # Classification & Verification Metadata
    hsn_sac: Optional[str] = None
    category: str
    is_verified_rate: bool
    rule_source: str
    assumptions: List[str] = Field(default_factory=list)
    rounding_adjustment: Decimal = Decimal("0.00")
    calculation_breakdown: Dict[str, Any] = Field(default_factory=dict)
