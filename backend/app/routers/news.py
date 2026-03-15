"""
RSS feed proxy — returns a flat list of news items from configured feeds.
"""

import logging
import time
from typing import Any

import feedparser
import httpx

from app import wall_config
from app.config import settings
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(tags=["news"])

_cache: list[dict] = []
_cache_ts: float = 0.0

DEFAULT_FEEDS = [
    {"url": "https://feeds.nos.nl/nosnieuwsalgemeen", "label": "NOS"},
    {"url": "https://www.nu.nl/rss/Algemeen", "label": "NU.nl"},
]


async def _fetch_feed(url: str, label: str) -> list[dict]:
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, follow_redirects=True)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.warning("Feed fetch failed (%s): %s", label, exc)
        return []

    parsed = feedparser.parse(resp.text)
    items = []
    for entry in parsed.entries[:10]:
        items.append({
            "source": label,
            "title": entry.get("title", ""),
            "link": entry.get("link", ""),
            "published": entry.get("published", ""),
        })
    return items


@router.get("/news")
async def get_news() -> dict:
    global _cache, _cache_ts

    if _cache and (time.monotonic() - _cache_ts) < settings.news_cache_ttl:
        return {"items": _cache}

    cfg = wall_config.get_config()
    feeds_cfg = cfg.get("widgets", [])
    feeds = DEFAULT_FEEDS

    # Pull feed config from the news widget if present
    for widget in feeds_cfg:
        if widget.get("type") == "news":
            feeds = widget.get("config", {}).get("feeds", DEFAULT_FEEDS)
            break

    all_items: list[dict] = []
    for feed in feeds:
        items = await _fetch_feed(feed["url"], feed["label"])
        all_items.extend(items)

    if not all_items and _cache:
        return {"items": _cache}  # return stale on total failure
    if not all_items:
        raise HTTPException(status_code=502, detail="No news feeds available")

    _cache = all_items
    _cache_ts = time.monotonic()
    return {"items": _cache}
