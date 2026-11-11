from typing import Any, Dict
from fastapi import APIRouter, HTTPException, Query, status
from app.schemas.market import MarketQuotesResponse
from app.services.market_data import fetch_market_quotes, get_market_telemetry_status

router = APIRouter(prefix="/market", tags=["Market Intelligence"])


@router.get(
    "/quotes",
    response_model=MarketQuotesResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Live/Delayed Market Quotes & Watchlist Tickers",
    description=(
        "Fetch current prices, day changes, and market dates for NIFTY 50 (^NSEI), SENSEX (^BSESN), "
        "BANK NIFTY (^NSEBANK), and major stock watchlist tickers via Twelve Data API with fallback. "
        "Results are updated every 1 minute with strict 800 req/day quota guard and ~15 min statutory delay."
    ),
)
def get_market_quotes(
    force_refresh: bool = Query(False, description="Bypass 1-minute in-memory cache and fetch fresh quotes"),
) -> MarketQuotesResponse:
    """Retrieve market index and stock quotes with 1-minute Twelve Data caching."""
    try:
        return fetch_market_quotes(force_refresh=force_refresh)
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching market quotes.",
        ) from err


@router.get(
    "/telemetry",
    status_code=status.HTTP_200_OK,
    summary="Get Twelve Data Market Telemetry & Quota Status",
    description="Inspect Twelve Data API configuration, 1-minute refresh cycle, and daily 800-request quota usage.",
)
def get_market_telemetry() -> Dict[str, Any]:
    """Retrieve current Twelve Data daily quota usage and cache metrics."""
    return get_market_telemetry_status()
