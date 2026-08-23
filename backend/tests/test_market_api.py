from __future__ import annotations

import pytest
from fastapi.testclient import TestClient
from app.main import app
from app.services.market_data import fetch_market_quotes

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

    assert len(data["indices"]) >= 3
    assert len(data["stocks"]) >= 4

    nifty = next((item for item in data["indices"] if item["symbol"] == "^NSEI"), None)
    assert nifty is not None
    assert nifty["name"] == "NIFTY 50"
    assert nifty["price"] > 0
    assert "change" in nifty
    assert "change_percent" in nifty


def test_market_quotes_service_caching():
    """Test that 5-minute caching returns identical timestamp on consecutive calls."""
    res1 = fetch_market_quotes(force_refresh=True)
    res2 = fetch_market_quotes(force_refresh=False)

    assert res1.last_updated == res2.last_updated
    assert res1.disclaimer == res2.disclaimer
