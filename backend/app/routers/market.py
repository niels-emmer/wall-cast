import asyncio
import logging
import time
import urllib.parse

import httpx
from fastapi import APIRouter

from app import cache_registry

logger = logging.getLogger(__name__)
router = APIRouter(tags=["market"])

_CACHE_TTL   = 5 * 60  # 5 minutes
_CRYPTO_COUNT = 10

# Yahoo Finance symbol → (canonical symbol, display name, type)
_QUOTES = [
    ("^GSPC", "^GSPC", "S&P 500",   "index"),
    ("^DJI",  "^DJI",  "Dow Jones", "index"),
    ("^AEX",  "^AEX",  "AEX",       "index"),
    ("^FTSE", "^FTSE", "FTSE 100",  "index"),
    ("AAPL",  "AAPL",  "Apple",     "stock"),
    ("MSFT",  "MSFT",  "Microsoft", "stock"),
    ("NVDA",  "NVDA",  "NVIDIA",    "stock"),
    ("TSLA",  "TSLA",  "Tesla",     "stock"),
    ("AMZN",  "AMZN",  "Amazon",    "stock"),
]

_YF_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36",
}

_cache: dict | None = None
_cache_ts: float = 0.0


# ── Data fetchers ─────────────────────────────────────────────────────────────

async def _fetch_fear_greed() -> dict | None:
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get("https://api.alternative.me/fng/?limit=1")
            r.raise_for_status()
            entry = r.json()["data"][0]
            return {
                "value":          int(entry["value"]),
                "classification": entry["value_classification"],
                "updated":        entry["timestamp"],
            }
    except Exception as exc:
        logger.warning("Fear & Greed fetch failed: %s", exc)
        return None


async def _fetch_one_quote(
    client: httpx.AsyncClient,
    yf_sym: str, orig_sym: str, name: str, sym_type: str,
) -> dict | None:
    """Fetch 5-day daily history from Yahoo Finance and derive close + % change."""
    encoded = urllib.parse.quote(yf_sym)
    url = f"https://query1.finance.yahoo.com/v8/finance/chart/{encoded}?range=5d&interval=1d"
    try:
        r = await client.get(url, timeout=12, headers=_YF_HEADERS)
        r.raise_for_status()
        data = r.json()
    except Exception as exc:
        logger.warning("Yahoo Finance fetch failed for %s: %s", yf_sym, exc)
        return None

    try:
        result = data["chart"]["result"][0]
        closes = [c for c in result["indicators"]["quote"][0]["close"] if c is not None]
    except (KeyError, IndexError, TypeError):
        logger.warning("Yahoo Finance: unexpected response structure for %s", yf_sym)
        return None

    if len(closes) < 2:
        logger.warning("Yahoo Finance: only %d close(s) for %s", len(closes), yf_sym)
        return None

    close = closes[-1]
    prev  = closes[-2]
    if not close or not prev:
        return None
    return {
        "symbol":     orig_sym,
        "name":       name,
        "price":      round(close, 2),
        "change_pct": round((close - prev) / prev * 100, 2),
        "type":       sym_type,
    }


async def _fetch_quotes() -> list[dict]:
    """Fetch quotes from Yahoo Finance (free, no auth)."""
    async with httpx.AsyncClient(follow_redirects=True) as client:
        tasks = [
            _fetch_one_quote(client, yf_sym, orig_sym, name, sym_type)
            for yf_sym, orig_sym, name, sym_type in _QUOTES
        ]
        results = await asyncio.gather(*tasks)
    good = [r for r in results if r is not None]
    if not good:
        logger.warning("Yahoo Finance: all quote fetches failed")
    return good


async def _fetch_crypto() -> list[dict]:
    url = (
        "https://api.coingecko.com/api/v3/coins/markets"
        f"?vs_currency=usd&order=market_cap_desc&per_page={_CRYPTO_COUNT}"
        "&page=1&sparkline=false&price_change_percentage=24h"
    )
    try:
        async with httpx.AsyncClient(timeout=15) as client:
            r = await client.get(url)
            r.raise_for_status()
            data = r.json()
    except Exception as exc:
        logger.warning("CoinGecko fetch failed: %s", exc)
        return []

    return [
        {
            "rank":          i + 1,
            "symbol":        coin.get("symbol", "").upper(),
            "name":          coin.get("name", ""),
            "price":         float(coin.get("current_price") or 0),
            "change_pct_24h": round(float(coin.get("price_change_percentage_24h") or 0), 2),
        }
        for i, coin in enumerate(data)
    ]


# ── Endpoints ────────────────────────────────────────────────────────────────


@router.get("/market")
async def get_market() -> dict:
    global _cache, _cache_ts

    if _cache is not None and (time.monotonic() - _cache_ts) < _CACHE_TTL:
        return _cache

    fear_greed, quotes, crypto = await asyncio.gather(
        _fetch_fear_greed(),
        _fetch_quotes(),
        _fetch_crypto(),
    )

    _cache = {"fear_greed": fear_greed, "quotes": quotes, "crypto": crypto}
    _cache_ts = time.monotonic()
    cache_registry.update("market", ok=bool(quotes or crypto))
    return _cache
