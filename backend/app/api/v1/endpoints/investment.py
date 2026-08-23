from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from app.schemas.investment import InvestmentGuidanceRequest, InvestmentGuidanceResponse
from app.services.investment_advisor import generate_investment_guidance

router = APIRouter(prefix="/investments", tags=["Investment Guidance"])


@router.post(
    "/guidance",
    response_model=InvestmentGuidanceResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Rule-Based Asset Allocation & Tax-Saving Guidance",
    description=(
        "Compute deterministic, rule-based asset allocation guidance across broad asset classes "
        "(equity index funds, debt/fixed income, gold, tax-saving instruments) based on annual income, "
        "tax regime calculation, and user risk profile. Calculates unused Section 80C headroom "
        "and outlines eligible tax-saving instrument types with lock-in and tax treatment rules."
    ),
)
def get_investment_guidance(request: InvestmentGuidanceRequest) -> InvestmentGuidanceResponse:
    """Generate rule-based investment and tax-saving guidance."""
    try:
        return generate_investment_guidance(request)
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while generating investment guidance: {str(err)}",
        ) from err
