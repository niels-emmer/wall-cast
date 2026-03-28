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


async def _fetch_quotes() -> list[dict]:
    """Fetch quotes from Stooq (free, no auth, works from server environments)."""
    stooq_syms = ",".join(s[0] for s in _QUOTES)
    # f= fields: Symbol, Date, Time, Close, Prev.Close
    url = f"https://stooq.com/q/l/?s={stooq_syms}&f=sd2t2cp&h&e=csv"
    try:
        async with httpx.AsyncClient(timeout=15, follow_redirects=True) as client:
            r = await client.get(url)
            r.raise_for_status()
            text = r.text
    except Exception as exc:
        logger.warning("Stooq fetch failed: %s", exc)
        return []

    # Build lookup: uppercase stooq symbol → row dict
    reader = csv.DictReader(io.StringIO(text))
    rows: dict[str, dict] = {}
    for row in reader:
        rows[row.get("Symbol", "").upper()] = row

    results = []
    for stooq_sym, orig_sym, name, sym_type in _QUOTES:
        row = rows.get(stooq_sym.upper())
        if not row:
            logger.debug("Stooq: no row for %s", stooq_sym)
            continue
        try:
            close = float(row.get("Close") or 0)
            prev  = float(row.get("Prev. Close") or 0)
        except (ValueError, TypeError):
            continue
        if not close or not prev:
            continue
        results.append({
            "symbol":     orig_sym,
            "name":       name,
            "price":      round(close, 2),
            "change_pct": round((close - prev) / prev * 100, 2),
            "type":       sym_type,
        })

    if not results:
        logger.warning("Stooq returned no usable rows; raw: %s", text[:300])
    return results


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


# ── Endpoint ──────────────────────────────────────────────────────────────────

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
