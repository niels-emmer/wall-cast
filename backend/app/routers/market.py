import asyncio
import logging
import time

import httpx
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(tags=["market"])

_CACHE_TTL = 5 * 60  # 5 minutes

# Default tickers — indices first, then stocks
_INDEX_SYMBOLS  = ["^GSPC", "^IXIC", "^AEX", "^FTSE"]
_STOCK_SYMBOLS  = ["AAPL", "MSFT", "NVDA", "TSLA", "AMZN"]
_CRYPTO_COUNT   = 10

_cache: dict | None = None
_cache_ts: float = 0.0


async def _fetch_fear_greed() -> dict | None:
    """Fetch Crypto Fear & Greed index from alternative.me."""
    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get("https://api.alternative.me/fng/?limit=1")
            r.raise_for_status()
            data = r.json()
            entry = data["data"][0]
            return {
                "value": int(entry["value"]),
                "classification": entry["value_classification"],
                "updated": entry["timestamp"],
            }
    except Exception as exc:
        logger.warning("Fear & Greed fetch failed: %s", exc)
        return None


async def _fetch_quotes() -> list[dict]:
    """Fetch stock and index quotes from Yahoo Finance."""
    symbols = _INDEX_SYMBOLS + _STOCK_SYMBOLS
    url = (
        "https://query1.finance.yahoo.com/v7/finance/quote"
        f"?symbols={','.join(symbols)}"
        "&fields=shortName,regularMarketPrice,regularMarketChangePercent"
    )
    headers = {
        "User-Agent": "Mozilla/5.0 (compatible; wall-cast/1.0)",
        "Accept": "application/json",
    }
    try:
        async with httpx.AsyncClient(timeout=15, headers=headers) as client:
            r = await client.get(url)
            r.raise_for_status()
            result_list = r.json().get("quoteResponse", {}).get("result", [])
    except Exception as exc:
        logger.warning("Yahoo Finance fetch failed: %s", exc)
        return []

    quotes = []
    for q in result_list:
        sym = q.get("symbol", "")
        price = q.get("regularMarketPrice")
        change = q.get("regularMarketChangePercent")
        name = q.get("shortName") or sym
        if price is None:
            continue
        quotes.append({
            "symbol": sym,
            "name": name,
            "price": round(price, 2),
            "change_pct": round(change, 2) if change is not None else 0.0,
            "type": "index" if sym in _INDEX_SYMBOLS else "stock",
        })
    return quotes


async def _fetch_crypto() -> list[dict]:
    """Fetch top N crypto by market cap from CoinGecko."""
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

    result = []
    for i, coin in enumerate(data):
        price = coin.get("current_price") or 0
        change = coin.get("price_change_percentage_24h") or 0.0
        result.append({
            "rank": i + 1,
            "symbol": coin.get("symbol", "").upper(),
            "name": coin.get("name", ""),
            "price": float(price),
            "change_pct_24h": round(float(change), 2),
        })
    return result


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

    _cache = {
        "fear_greed": fear_greed,
        "quotes": quotes,
        "crypto": crypto,
    }
    _cache_ts = time.monotonic()
    return _cache
