import asyncio
import csv
import io
import logging
import time

import httpx
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(tags=["market"])

_CACHE_TTL   = 5 * 60  # 5 minutes
_CRYPTO_COUNT = 10

# Stooq symbol → (canonical symbol, display name, type)
# Stooq: indices use ^ prefix; US stocks use .US suffix
_QUOTES = [
    ("^SPX",   "^GSPC", "S&P 500",   "index"),
    ("^DJI",   "^DJI",  "Dow Jones", "index"),
    ("^AEX",   "^AEX",  "AEX",       "index"),
    ("^UKX",   "^FTSE", "FTSE 100",  "index"),
    ("AAPL.US","AAPL",  "Apple",     "stock"),
    ("MSFT.US","MSFT",  "Microsoft", "stock"),
    ("NVDA.US","NVDA",  "NVIDIA",    "stock"),
    ("TSLA.US","TSLA",  "Tesla",     "stock"),
    ("AMZN.US","AMZN",  "Amazon",    "stock"),
]

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
    stooq_sym: str, orig_sym: str, name: str, sym_type: str,
) -> dict | None:
    """Fetch 2-day daily history from Stooq and derive close + % change."""
    url = f"https://stooq.com/q/d/l/?s={stooq_sym}&i=d&l=2"
    try:
        r = await client.get(url, timeout=12)
        r.raise_for_status()
        rows = list(csv.DictReader(io.StringIO(r.text)))
    except Exception as exc:
        logger.warning("Stooq history failed for %s: %s", stooq_sym, exc)
        return None

    if len(rows) < 2:
        logger.warning("Stooq: only %d row(s) for %s", len(rows), stooq_sym)
        return None
    try:
        close = float(rows[-1].get("Close") or 0)
        prev  = float(rows[-2].get("Close") or 0)
    except (ValueError, TypeError):
        return None
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
    """Fetch quotes from Stooq (free, no auth, server-accessible)."""
    async with httpx.AsyncClient(follow_redirects=True) as client:
        tasks = [
            _fetch_one_quote(client, stooq_sym, orig_sym, name, sym_type)
            for stooq_sym, orig_sym, name, sym_type in _QUOTES
        ]
        results = await asyncio.gather(*tasks)
    good = [r for r in results if r is not None]
    if not good:
        logger.warning("Stooq: all quote fetches failed")
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

@router.get("/market/debug")
async def debug_market() -> dict:
    """Temporary: test one Stooq symbol and return raw response."""
    try:
        async with httpx.AsyncClient(follow_redirects=True, timeout=12) as client:
            r = await client.get("https://stooq.com/q/d/l/?s=aapl.us&i=d&l=2")
            return {"status": r.status_code, "url": str(r.url), "body": r.text[:500]}
    except Exception as exc:
        return {"error": str(exc)}


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
    return _cache
