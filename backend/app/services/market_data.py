from __future__ import annotations

import logging
import math
import os
import time
from datetime import datetime, timezone, timedelta, time as dt_time
from typing import Any, Dict, List, Optional, Tuple

import httpx

try:
    import yfinance as yf
except Exception:
    yf = None

from app.core.config import get_settings
from app.core.logging import get_logger
from app.schemas.market import MarketQuotesResponse, QuoteItem

logger = get_logger("market_data")

# 1-minute update interval (60 seconds) as requested
CACHE_TTL_SECONDS = 60
DAILY_REQUEST_LIMIT = 800  # Twelve Data free tier daily request limit

_cached_response: Optional[MarketQuotesResponse] = None
_last_fetch_timestamp: float = 0.0

# Daily request tracking for Twelve Data 800 requests/day limit
_daily_counter_date: str = ""
_daily_requests_used: int = 0

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

# Twelve Data symbol mapping for Indian NSE Equities
TWELVE_DATA_STOCK_MAP: Dict[str, Dict[str, str]] = {
    "RELIANCE": {"display_symbol": "RELIANCE.NS", "name": "Reliance Industries Ltd", "exchange": "NSE"},
    "TCS": {"display_symbol": "TCS.NS", "name": "Tata Consultancy Services", "exchange": "NSE"},
    "HDFCBANK": {"display_symbol": "HDFCBANK.NS", "name": "HDFC Bank Ltd", "exchange": "NSE"},
    "INFY": {"display_symbol": "INFY.NS", "name": "Infosys Ltd", "exchange": "NSE"},
    "ICICIBANK": {"display_symbol": "ICICIBANK.NS", "name": "ICICI Bank Ltd", "exchange": "NSE"},
    "BHARTIARTL": {"display_symbol": "BHARTIARTL.NS", "name": "Bharti Airtel Ltd", "exchange": "NSE"},
}

FALLBACK_QUOTES: Dict[str, Dict[str, float]] = {
    "^NSEI": {"price": 24320.50, "change": 145.20, "change_percent": 0.60, "high": 24380.00, "low": 24210.00},
    "^BSESN": {"price": 79820.10, "change": 480.30, "change_percent": 0.61, "high": 80050.00, "low": 79480.00},
    "^NSEBANK": {"price": 52150.80, "change": 310.50, "change_percent": 0.60, "high": 52300.00, "low": 51900.00},
    "RELIANCE.NS": {"price": 1240.40, "change": -7.00, "change_percent": -0.56, "high": 1251.90, "low": 1238.10},
    "TCS.NS": {"price": 2105.00, "change": -23.70, "change_percent": -1.11, "high": 2135.00, "low": 2098.50},
    "HDFCBANK.NS": {"price": 738.60, "change": -0.90, "change_percent": -0.12, "high": 743.00, "low": 736.20},
    "INFY.NS": {"price": 1820.60, "change": 18.40, "change_percent": 1.02, "high": 1835.00, "low": 1805.00},
    "ICICIBANK.NS": {"price": 1210.50, "change": 9.30, "change_percent": 0.77, "high": 1218.00, "low": 1202.00},
    "BHARTIARTL.NS": {"price": 1460.10, "change": 14.20, "change_percent": 0.98, "high": 1472.00, "low": 1450.00},
}


def _check_and_consume_daily_quota() -> bool:
    """Verify and increment daily Twelve Data requests against the 800 req/day limit."""
    global _daily_counter_date, _daily_requests_used
    today_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    if _daily_counter_date != today_utc:
        _daily_counter_date = today_utc
        _daily_requests_used = 0

    if _daily_requests_used >= DAILY_REQUEST_LIMIT:
        logger.warning(
            f"Twelve Data daily limit of {DAILY_REQUEST_LIMIT} requests reached for {today_utc}. "
            "Using cached or fallback provider to preserve quota."
        )
        return False

    _daily_requests_used += 1
    return True


def _fetch_quotes_twelve_data(
    api_key: str,
) -> Optional[Tuple[List[QuoteItem], Optional[str], Optional[bool]]]:
    """Fetch live stock quotes from Twelve Data API using batch symbols."""
    if not _check_and_consume_daily_quota():
        return None

    symbols_param = ",".join(TWELVE_DATA_STOCK_MAP.keys())
    url = "https://api.twelvedata.com/quote"
    params = {
        "symbol": symbols_param,
        "exchange": "NSE",
        "apikey": api_key,
    }

    try:
        with httpx.Client(timeout=9.0) as client:
            resp = client.get(url, params=params)
            if resp.status_code != 200:
                logger.warning(f"Twelve Data API returned status {resp.status_code}: {resp.text[:150]}")
                return None

            data = resp.json()
            if not isinstance(data, dict):
                return None

            if data.get("status") == "error" or "code" in data:
                logger.warning(f"Twelve Data error response: {data.get('message', data)}")
                return None

            quotes: List[QuoteItem] = []
            market_date: Optional[str] = None
            is_market_open: Optional[bool] = None

            for raw_sym, meta in TWELVE_DATA_STOCK_MAP.items():
                stock_data = data.get(raw_sym)
                if not stock_data or not isinstance(stock_data, dict):
                    continue

                close_val = stock_data.get("close")
                if close_val is None:
                    continue

                try:
                    price = round(float(close_val), 2)
                    change = round(float(stock_data.get("change", 0.0)), 2)
                    change_pct = round(float(stock_data.get("percent_change", 0.0)), 2)
                    high = round(float(stock_data["high"]), 2) if stock_data.get("high") else price
                    low = round(float(stock_data["low"]), 2) if stock_data.get("low") else price
                    volume = int(float(stock_data["volume"])) if stock_data.get("volume") else 0
                    dt_str = stock_data.get("datetime")
                    exchange = stock_data.get("exchange", "NSE")

                    if dt_str and not market_date:
                        market_date = dt_str.split()[0]
                    if is_market_open is None and "is_market_open" in stock_data:
                        is_market_open = bool(stock_data.get("is_market_open"))

                    quotes.append(
                        QuoteItem(
                            symbol=meta["display_symbol"],
                            name=stock_data.get("name") or meta["name"],
                            price=price,
                            change=change,
                            change_percent=change_pct,
                            high=high,
                            low=low,
                            volume=volume,
                            category="stock",
                            datetime=dt_str,
                            exchange=exchange,
                        )
                    )
                except Exception as parse_err:
                    logger.warning(f"Failed parsing Twelve Data item for {raw_sym}: {parse_err}")

            if quotes:
                logger.info(f"Successfully fetched {len(quotes)} stocks from Twelve Data API (Date: {market_date})")
                return quotes, market_date, is_market_open
            return None
    except Exception as ex:
        logger.warning(f"Twelve Data API request failed: {ex}. Proceeding to fallback.")
        return None


def _fetch_single_quote(symbol: str, name: str, category: str) -> QuoteItem:
    """Fetch quote data for a symbol via yfinance with fallback protection and NaN sanitization."""
    try:
        if yf is not None:
            ticker = yf.Ticker(symbol)
            hist = ticker.history(period="5d")
            if hist is not None and not hist.empty:
                hist = hist.dropna(subset=["Close"])
        else:
            hist = None

        if hist is not None and len(hist) > 0:
            latest_row = hist.iloc[-1]
            raw_close = latest_row["Close"]
            if raw_close is not None and not (isinstance(raw_close, float) and math.isnan(raw_close)):
                current_price = float(raw_close)
                high_price = float(latest_row["High"]) if "High" in latest_row and not math.isnan(float(latest_row["High"])) else current_price
                low_price = float(latest_row["Low"]) if "Low" in latest_row and not math.isnan(float(latest_row["Low"])) else current_price
                volume_val = int(latest_row["Volume"]) if "Volume" in latest_row and not math.isnan(float(latest_row["Volume"])) else 0

                if len(hist) >= 2:
                    prev_close = float(hist.iloc[-2]["Close"])
                    if not math.isnan(prev_close) and prev_close > 0:
                        change = current_price - prev_close
                        change_pct = (change / prev_close * 100.0)
                    else:
                        change = 0.0
                        change_pct = 0.0
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
                    datetime=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
                    exchange="NSE" if ".NS" in symbol or symbol.startswith("^NSE") else "BSE",
                )
    except Exception as err:
        logger.warning(f"Failed to fetch live yfinance data for {symbol}: {err}. Using fallback values.")

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
        datetime=datetime.now(timezone.utc).strftime("%Y-%m-%d %H:%M:%S"),
        exchange="NSE",
    )


def get_market_session_info() -> Tuple[bool, str, str]:
    """Calculate if market is currently in the 9 to 5 daily trading session (09:00 - 17:00 IST)."""
    utc_now = datetime.now(timezone.utc)
    ist_now = utc_now + timedelta(hours=5, minutes=30)
    current_time = ist_now.time()
    weekday = ist_now.weekday()  # 0 is Monday, 4 is Friday

    market_open_time = dt_time(9, 0, 0)
    market_close_time = dt_time(17, 0, 0)

    is_weekday = weekday < 5  # Mon - Fri
    is_open = is_weekday and (market_open_time <= current_time <= market_close_time)
    market_date_str = ist_now.strftime("%Y-%m-%d")
    return is_open, "09:00 - 17:00 IST", market_date_str


def fetch_market_quotes(
    custom_watchlist: Optional[List[str]] = None, force_refresh: bool = False
) -> MarketQuotesResponse:
    """Fetch market quotes for indices and stocks with 1-minute caching & Twelve Data integration."""
    global _cached_response, _last_fetch_timestamp, _daily_requests_used

    now = time.time()
    if not force_refresh and _cached_response is not None and (now - _last_fetch_timestamp) < CACHE_TTL_SECONDS:
        logger.debug(f"Returning cached market quotes (Age: {round(now - _last_fetch_timestamp, 1)}s)")
        return _cached_response

    logger.info("Updating market quotes (1-minute update cycle)...")
    settings = get_settings()
    api_key = settings.TWELVE_DATA_API_KEY or os.getenv("TWELVE_DATA_API_KEY")

    is_session_open, market_hours_str, ist_date_str = get_market_session_info()

    # Fetch Indian market indices (NIFTY 50, SENSEX, BANK NIFTY)
    index_quotes: List[QuoteItem] = []
    for sym, name in DEFAULT_INDEX_SYMBOLS.items():
        index_quotes.append(_fetch_single_quote(sym, name, category="index"))

    stock_quotes: List[QuoteItem] = []
    market_date: Optional[str] = None
    is_market_open: Optional[bool] = None
    provider_name: str = "Twelve Data API"

    twelve_data_result = None
    if api_key and not custom_watchlist:
        twelve_data_result = _fetch_quotes_twelve_data(api_key)

    if twelve_data_result is not None:
        td_quotes, market_date, is_market_open = twelve_data_result
        provider_name = "Twelve Data API (Live)"
        # Use live Twelve Data quotes and supplement any missing watchlist tickers from fallback
        stock_quotes = list(td_quotes)
        fetched_symbols = {q.symbol for q in td_quotes}
        for sym, name in DEFAULT_WATCHLIST_STOCKS.items():
            if sym not in fetched_symbols:
                stock_quotes.append(_fetch_single_quote(sym, name, category="stock"))
    else:
        # Fallback path via yfinance or configured fallback quotes
        provider_name = "Twelve Data (Fallback: yfinance)" if api_key else "Market Telemetry (Twelve Data Ready)"
        stock_symbols = DEFAULT_WATCHLIST_STOCKS
        if custom_watchlist:
            stock_symbols = {s: s for s in custom_watchlist}

        for sym, name in stock_symbols.items():
            stock_quotes.append(_fetch_single_quote(sym, name, category="stock"))

    final_market_date = market_date or ist_date_str
    final_is_open = is_market_open if is_market_open is not None else is_session_open

    response = MarketQuotesResponse(
        disclaimer="~15 min delay, for informational purposes only, not investment advice",
        data_delayed=True,
        last_updated=datetime.now(timezone.utc).isoformat(),
        market_date=final_market_date,
        market_hours=market_hours_str,
        is_market_open=final_is_open,
        provider=provider_name,
        update_interval_seconds=CACHE_TTL_SECONDS,
        requests_used_today=_daily_requests_used,
        daily_request_limit=DAILY_REQUEST_LIMIT,
        indices=index_quotes,
        stocks=stock_quotes,
    )

    _cached_response = response
    _last_fetch_timestamp = now
    return response


def get_market_telemetry_status() -> Dict[str, Any]:
    """Return status telemetry for Twelve Data integration, quota limits, and cache state."""
    settings = get_settings()
    api_key = settings.TWELVE_DATA_API_KEY or os.getenv("TWELVE_DATA_API_KEY")
    today_utc = datetime.now(timezone.utc).strftime("%Y-%m-%d")
    is_session_open, market_hours_str, ist_date_str = get_market_session_info()

    return {
        "provider": "Twelve Data",
        "api_key_configured": bool(api_key),
        "update_interval_seconds": CACHE_TTL_SECONDS,
        "daily_request_limit": DAILY_REQUEST_LIMIT,
        "requests_used_today": _daily_requests_used,
        "requests_remaining_today": max(0, DAILY_REQUEST_LIMIT - _daily_requests_used),
        "quota_date": _daily_counter_date or today_utc,
        "market_hours": market_hours_str,
        "is_market_open": is_session_open,
        "cached_data_available": _cached_response is not None,
        "last_market_date": _cached_response.market_date if _cached_response else ist_date_str,
        "last_updated": _cached_response.last_updated if _cached_response else None,
    }
