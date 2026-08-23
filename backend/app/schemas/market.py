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


class MarketQuotesResponse(BaseModel):
    """Response wrapper for live market data endpoint."""

    disclaimer: str = Field(
        default="~15 min delay, for informational purposes only, not investment advice",
        description="Statutory market data disclaimer banner."
    )
    data_delayed: bool = Field(default=True, description="Flag indicating ~15 min delayed market feed.")
    last_updated: str = Field(..., description="ISO timestamp of data fetch.")
    indices: List[QuoteItem] = Field(default_factory=list, description="Major market index quotes.")
    stocks: List[QuoteItem] = Field(default_factory=list, description="Watchlist stock quotes.")
