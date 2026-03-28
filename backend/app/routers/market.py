import asyncio
import logging
import time

import httpx
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(tags=["market"])

_CACHE_TTL = 5 * 60  # 5 minutes

_INDEX_SYMBOLS = ["^GSPC", "^IXIC", "^AEX", "^FTSE"]
_STOCK_SYMBOLS = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN"]
_CRYPTO_COUNT  = 10

# Short display names — avoids relying on Yahoo returning shortName
_NAME_MAP = {
    "^GSPC": "S&P 500",
    "^IXIC": "NASDAQ",
    "^AEX":  "AEX",
    "^FTSE": "FTSE 100",
    "AAPL":  "Apple",
    "MSFT":  "Microsoft",
    "NVDA":  "NVIDIA",
    "TSLA":  "Tesla",
    "AMZN":  "Amazon",
}

_YAHOO_HEADERS = {
    "User-Agent": (
        "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) "
        "AppleWebKit/537.36 (KHTML, like Gecko) "
        "Chrome/124.0.0.0 Safari/537.36"
    ),
    "Accept":          "application/json, text/plain, */*",
    "Accept-Language": "en-US,en;q=0.9",
    "Origin":          "https://finance.yahoo.com",
    "Referer":         "https://finance.yahoo.com/",
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
    client: httpx.AsyncClient, symbol: str, sym_type: str
) -> dict | None:
    """Fetch current price + prev close from Yahoo Finance v8 chart API."""
    url = (
        f"https://query1.finance.yahoo.com/v8/finance/chart/{symbol}"
        "?interval=1d&range=2d&includePrePost=false"
    )
    try:
        r = await client.get(url, timeout=12)
        r.raise_for_status()
        result = r.json().get("chart", {}).get("result", [])
        if not result:
            return None
        meta  = result[0].get("meta", {})
        price = meta.get("regularMarketPrice")
        prev  = meta.get("chartPreviousClose") or meta.get("previousClose")
        if price is None or not prev:
            return None
        change_pct = (price - prev) / prev * 100
        name = _NAME_MAP.get(symbol, meta.get("shortName") or symbol)
        return {
            "symbol":     symbol,
            "name":       name,
            "price":      round(float(price), 2),
            "change_pct": round(change_pct, 2),
            "type":       sym_type,
        }
    except Exception as exc:
        logger.warning("Yahoo v8 chart failed for %s: %s", symbol, exc)
        return None


async def _fetch_quotes() -> list[dict]:
    async with httpx.AsyncClient(headers=_YAHOO_HEADERS, follow_redirects=True) as client:
        tasks = (
            [_fetch_one_quote(client, s, "index") for s in _INDEX_SYMBOLS]
            + [_fetch_one_quote(client, s, "stock") for s in _STOCK_SYMBOLS]
        )
        results = await asyncio.gather(*tasks)
    return [r for r in results if r is not None]


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
