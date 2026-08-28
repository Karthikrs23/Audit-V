from __future__ import annotations

import logging
import time
from datetime import datetime, timezone
from typing import Dict, List, Optional
try:
    import yfinance as yf
except Exception:
    yf = None

from app.core.logging import get_logger
from app.schemas.market import MarketQuotesResponse, QuoteItem

logger = get_logger("market_data")

CACHE_TTL_SECONDS = 300  # 5 minutes in-memory cache TTL

_cached_response: Optional[MarketQuotesResponse] = None
_last_fetch_timestamp: float = 0.0

DEFAULT_INDEX_SYMBOLS: Dict[str, str] = {
    "^NSEI": "NIFTY 50",
    "^BSESN": "SENSEX",
    "^NSEBANK": "BANK NIFTY",
}

DEFAULT_WATCHLIST_STOCKS: Dict[str, str] = {
    "RELIANCE.NS": "Reliance Industries Ltd",
    "TCS.NS": "Tata Consultancy Services",
    "HDFCBANK.NS": "HDFC Bank Ltd",
    "INFY.NS": "Infosys Ltd",
    "ICICIBANK.NS": "ICICI Bank Ltd",
    "BHARTIARTL.NS": "Bharti Airtel Ltd",
}

# Fallback values if yfinance is offline or rate-limited
FALLBACK_QUOTES: Dict[str, Dict[str, float]] = {
    "^NSEI": {"price": 24320.50, "change": 145.20, "change_percent": 0.60, "high": 24380.00, "low": 24210.00},
    "^BSESN": {"price": 79820.10, "change": 480.30, "change_percent": 0.61, "high": 80050.00, "low": 79480.00},
    "^NSEBANK": {"price": 52150.80, "change": 310.50, "change_percent": 0.60, "high": 52300.00, "low": 51900.00},
    "RELIANCE.NS": {"price": 2980.40, "change": 22.10, "change_percent": 0.75, "high": 2995.00, "low": 2960.00},
    "TCS.NS": {"price": 4250.00, "change": -15.50, "change_percent": -0.36, "high": 4280.00, "low": 4230.00},
    "HDFCBANK.NS": {"price": 1640.25, "change": 12.80, "change_percent": 0.79, "high": 1652.00, "low": 1630.00},
    "INFY.NS": {"price": 1820.60, "change": 18.40, "change_percent": 1.02, "high": 1835.00, "low": 1805.00},
    "ICICIBANK.NS": {"price": 1210.50, "change": 9.30, "change_percent": 0.77, "high": 1218.00, "low": 1202.00},
    "BHARTIARTL.NS": {"price": 1460.10, "change": 14.20, "change_percent": 0.98, "high": 1472.00, "low": 1450.00},
}


def _fetch_single_quote(symbol: str, name: str, category: str) -> QuoteItem:
    """Fetch quote data for a symbol via yfinance with fallback protection."""
    try:
        if yf is not None:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="2d")
        else:
            hist = None

        if hist is not None and len(hist) > 0:
            latest_row = hist.iloc[-1]
            current_price = float(latest_row["Close"])
            high_price = float(latest_row["High"])
            low_price = float(latest_row["Low"])
            volume_val = int(latest_row["Volume"]) if "Volume" in latest_row else 0

            if len(hist) >= 2:
                prev_close = float(hist.iloc[-2]["Close"])
                change = current_price - prev_close
                change_pct = (change / prev_close * 100.0) if prev_close > 0 else 0.0
            else:
                change = 0.0
                change_pct = 0.0

            return QuoteItem(
                symbol=symbol,
                name=name,
                price=round(current_price, 2),
                change=round(change, 2),
                change_percent=round(change_pct, 2),
                high=round(high_price, 2),
                low=round(low_price, 2),
                volume=volume_val,
                category=category,
            )
    except Exception as err:
        logger.warning(f"Failed to fetch live yfinance data for {symbol}: {err}. Using fallback values.")

    # Fallback path if yfinance request fails or is rate limited
    fb = FALLBACK_QUOTES.get(symbol, {"price": 1000.0, "change": 0.0, "change_percent": 0.0, "high": 1010.0, "low": 990.0})
    return QuoteItem(
        symbol=symbol,
        name=name,
        price=fb["price"],
        change=fb["change"],
        change_percent=fb["change_percent"],
        high=fb.get("high"),
        low=fb.get("low"),
        volume=1500000,
        category=category,
    )


def fetch_market_quotes(
    custom_watchlist: Optional[List[str]] = None, force_refresh: bool = False
) -> MarketQuotesResponse:
    """Fetch market quotes for indices and stocks with 5-minute caching."""
    global _cached_response, _last_fetch_timestamp

    now = time.time()
    if not force_refresh and _cached_response is not None and (now - _last_fetch_timestamp) < CACHE_TTL_SECONDS:
        logger.info(f"Returning cached market quotes (Age: {round(now - _last_fetch_timestamp, 1)}s)")
        return _cached_response

    logger.info("Fetching fresh market quotes via yfinance...")
    index_quotes: List[QuoteItem] = []
    for sym, name in DEFAULT_INDEX_SYMBOLS.items():
        index_quotes.append(_fetch_single_quote(sym, name, category="index"))

    stock_symbols = DEFAULT_WATCHLIST_STOCKS
    if custom_watchlist:
        stock_symbols = {s: s for s in custom_watchlist}

    stock_quotes: List[QuoteItem] = []
    for sym, name in stock_symbols.items():
        stock_quotes.append(_fetch_single_quote(sym, name, category="stock"))

    response = MarketQuotesResponse(
        disclaimer="~15 min delay, for informational purposes only, not investment advice",
        data_delayed=True,
        last_updated=datetime.now(timezone.utc).isoformat(),
        indices=index_quotes,
        stocks=stock_quotes,
    )

    _cached_response = response
    _last_fetch_timestamp = now
    return response
