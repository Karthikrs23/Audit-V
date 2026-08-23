from __future__ import annotations

from fastapi import APIRouter
from app.api.v1.endpoints.tax import router as tax_router
from app.api.v1.endpoints.assistant import router as assistant_router
from app.api.v1.endpoints.risk import router as risk_router
from app.api.v1.endpoints.market import router as market_router
from app.api.v1.endpoints.investment import router as investment_router

router = APIRouter(prefix="/api/v1")

# Include routers
router.include_router(tax_router)
router.include_router(assistant_router)
router.include_router(risk_router)
router.include_router(market_router)
router.include_router(investment_router)


@router.get("/health", tags=["system"])
def health() -> dict[str, str]:
    """Health check endpoint for infrastructure and deployment validation."""

    return {
        "status": "healthy",
        "service": "audit_v",
    }
