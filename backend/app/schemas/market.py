from __future__ import annotations

from typing import List, Optional
from pydantic import BaseModel, Field


class QuoteItem(BaseModel):
    """Individual market index or stock ticker quote."""

    symbol: str = Field(..., description="Ticker symbol e.g. ^NSEI, TCS.NS")
    name: str = Field(..., description="Human-readable asset name e.g. NIFTY 50, Tata Consultancy Services")
    price: float = Field(..., description="Current/latest market price")
    change: float = Field(..., description="Absolute day price change")
    change_percent: float = Field(..., description="Percentage day price change")
    high: Optional[float] = Field(None, description="Day high price")
    low: Optional[float] = Field(None, description="Day low price")
    volume: Optional[int] = Field(None, description="Trading volume")
    category: str = Field(..., description="'index' or 'stock'")
    datetime: Optional[str] = Field(None, description="Market date and time of quote e.g. 2026-09-30 15:30:00")
    exchange: Optional[str] = Field(None, description="Market exchange name e.g. NSE, BSE")


class MarketQuotesResponse(BaseModel):
    """Response wrapper for live market data endpoint."""

    disclaimer: str = Field(
        default="~15 min delay, for informational purposes only, not investment advice",
        description="Statutory market data disclaimer banner."
    )
    data_delayed: bool = Field(default=True, description="Flag indicating ~15 min delayed market feed.")
    last_updated: str = Field(..., description="ISO timestamp of data fetch.")
    market_date: Optional[str] = Field(None, description="Market session date e.g. 2026-09-30")
    market_hours: str = Field(default="09:00 - 17:00 IST", description="Daily market opening and closing hours (9 to 5)")
    is_market_open: Optional[bool] = Field(None, description="Whether market is currently in open trading session (09:00 - 17:00 IST)")
    provider: str = Field(default="Twelve Data", description="Market data provider name")
    update_interval_seconds: int = Field(default=60, description="Auto-update interval in seconds (1 minute)")
    requests_used_today: int = Field(default=0, description="Count of Twelve Data requests executed today")
    daily_request_limit: int = Field(default=800, description="Daily limit of Twelve Data requests (800 req/day)")
    indices: List[QuoteItem] = Field(default_factory=list, description="Major market index quotes.")
    stocks: List[QuoteItem] = Field(default_factory=list, description="Watchlist stock quotes.")
