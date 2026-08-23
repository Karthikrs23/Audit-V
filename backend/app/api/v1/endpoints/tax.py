from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from app.schemas.tax import TaxCalculationRequest, TaxCalculationResponse
from app.services.tax_engine import compute_tax

router = APIRouter(prefix="/tax", tags=["Tax Compliance"])


@router.post(
    "/calculate",
    response_model=TaxCalculationResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate Indian Income Tax & Compare Regimes",
    description=(
        "Deterministic calculation engine for Indian Income Tax under New (Section 115BAC) "
        "and Old Tax Regimes for Tax Year 2026-27. Computes taxable income, slab tax, "
        "Section 87A rebate, surcharge, and 4% Cess."
    ),
)
def calculate_tax(request: TaxCalculationRequest) -> TaxCalculationResponse:
    """Execute income tax calculation and regime comparison."""
    try:
        return compute_tax(request)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        ) from val_err
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while calculating tax. Please verify inputs.",
        ) from err
