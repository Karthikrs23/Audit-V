from typing import Any, Dict, List
from fastapi import APIRouter, HTTPException, status
from app.schemas.tax import TaxCalculationRequest, TaxCalculationResponse
from app.schemas.gst import GSTCalculationRequest, GSTCalculationResponse
from app.services.tax_engine import compute_tax
from app.services.gst_engine import compute_gst, get_verified_rules, INDIAN_STATES

router = APIRouter(prefix="/tax", tags=["Tax Compliance"])


@router.post(
    "/calculate",
    response_model=TaxCalculationResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate Indian Income Tax & Compare Regimes",
    description=(
        "Deterministic calculation engine for Indian Income Tax under New (Section 115BAC, Income Tax Act 1961 — "
        "recodified as Section 202 under Income Tax Act 2025) and Old Tax Regimes for Tax Year 2026-27. "
        "Computes taxable income, slab tax, Section 87A (recodified as Section 157) rebate, surcharge, and 4% Cess."
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


@router.post(
    "/gst/calculate",
    response_model=GSTCalculationResponse,
    status_code=status.HTTP_200_OK,
    summary="Calculate Goods and Services Tax (GST)",
    description=(
        "Computes GST with decimal-safe arithmetic, supporting exclusive and inclusive modes, "
        "intra-state (CGST + SGST) vs inter-state (IGST) split, and verified CBIC HSN/SAC tariff rules."
    ),
)
def calculate_gst(request: GSTCalculationRequest) -> GSTCalculationResponse:
    """Execute deterministic GST liability calculation."""
    try:
        return compute_gst(request)
    except ValueError as val_err:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=str(val_err),
        ) from val_err
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail=f"An error occurred while calculating GST: {str(err)}",
        ) from err


@router.get(
    "/gst/rules",
    status_code=status.HTTP_200_OK,
    summary="Get Verified GST Tariff Rules & States List",
    description="Retrieve authoritative CBIC HSN/SAC rate schedule and Indian states list.",
)
def get_gst_rules_and_metadata() -> Dict[str, Any]:
    """Return verified HSN/SAC rules and Indian state jurisdictions."""
    return {
        "rules": get_verified_rules(),
        "states": INDIAN_STATES,
        "standard_slabs": [0, 5, 12, 18, 28],
    }

