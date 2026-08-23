from __future__ import annotations

from fastapi import APIRouter, HTTPException, status
from app.schemas.market import MarketQuotesResponse
from app.services.market_data import fetch_market_quotes

router = APIRouter(prefix="/market", tags=["Market Intelligence"])


@router.get(
    "/quotes",
    response_model=MarketQuotesResponse,
    status_code=status.HTTP_200_OK,
    summary="Get Live/Delayed Market Quotes & Watchlist Tickers",
    description=(
        "Fetch current prices and day changes for NIFTY 50 (^NSEI), SENSEX (^BSESN), "
        "BANK NIFTY (^NSEBANK), and major stock watchlist tickers via yfinance. "
        "Results are cached for 5 minutes. Includes a statutory ~15 min delay disclaimer."
    ),
)
def get_market_quotes() -> MarketQuotesResponse:
    """Retrieve market index and stock quotes with 5-minute caching."""
    try:
        return fetch_market_quotes()
    except Exception as err:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="An error occurred while fetching market quotes.",
        ) from err
