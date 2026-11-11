from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.market_data import (
    fetch_market_quotes,
    get_market_telemetry_status,
    DAILY_REQUEST_LIMIT,
    CACHE_TTL_SECONDS,
)

client = TestClient(app)


def test_get_market_quotes_endpoint():
    """Test GET /api/v1/market/quotes endpoint returns 200 OK and valid schema."""
    response = client.get("/api/v1/market/quotes")
    assert response.status_code == 200
    data = response.json()

    assert "disclaimer" in data
    assert "~15 min delay" in data["disclaimer"]
    assert data["data_delayed"] is True
    assert "last_updated" in data
    assert "indices" in data
    assert "stocks" in data

    # Verify Twelve Data integration metadata
    assert "market_date" in data
    assert "provider" in data
    assert data["update_interval_seconds"] == 60
    assert data["daily_request_limit"] == 800
    assert "requests_used_today" in data

    assert len(data["indices"]) >= 3
    assert len(data["stocks"]) >= 4

    nifty = next((item for item in data["indices"] if item["symbol"] == "^NSEI"), None)
    assert nifty is not None
    assert nifty["name"] == "NIFTY 50"
    assert nifty["price"] > 0
    assert "change" in nifty
    assert "change_percent" in nifty


def test_market_quotes_service_caching():
    """Test that 1-minute caching returns identical timestamp on consecutive calls."""
    res1 = fetch_market_quotes(force_refresh=True)
    res2 = fetch_market_quotes(force_refresh=False)

    assert res1.last_updated == res2.last_updated
    assert res1.disclaimer == res2.disclaimer
    assert res1.update_interval_seconds == 60
    assert res1.daily_request_limit == 800


def test_get_market_telemetry_endpoint():
    """Test GET /api/v1/market/telemetry returns Twelve Data quota status."""
    response = client.get("/api/v1/market/telemetry")
    assert response.status_code == 200
    telemetry = response.json()

    assert telemetry["provider"] == "Twelve Data"
    assert telemetry["daily_request_limit"] == 800
    assert telemetry["update_interval_seconds"] == 60
    assert "requests_used_today" in telemetry
    assert "requests_remaining_today" in telemetry
    assert telemetry["requests_remaining_today"] >= 0
    assert "cached_data_available" in telemetry
