"""
RSS feed proxy — returns a flat list of news items from configured feeds.

Accepts an optional ?screen=<id> parameter. When provided the backend merges
shared + screen config (including personal RSS feeds of assigned people) before
determining which feeds to fetch. Each screen gets its own cache entry.
"""

import logging
import time
from typing import Any

import feedparser
import httpx

from app import cache_registry, wall_config
from app.config import settings
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(tags=["news"])

# Per-screen cache: key = screen id (empty string = no screen specified)
_cache: dict[str, list[dict]] = {}
_cache_ts: dict[str, float] = {}


def _invalidate_cache() -> None:
    _cache.clear()
    _cache_ts.clear()


# Clear the news cache whenever the config changes (e.g. feed URLs updated)
wall_config.on_config_change(_invalidate_cache)

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
async def get_news(screen: str | None = None) -> dict:
    cache_key = screen or ""

    if _cache.get(cache_key) and (time.monotonic() - _cache_ts.get(cache_key, 0)) < settings.news_cache_ttl:
        return {"items": _cache[cache_key]}

    cfg = wall_config.get_config(screen)
    feeds_cfg = cfg.get("widgets", [])
    feeds: list[dict[str, Any]] = DEFAULT_FEEDS

    # Pull feed list from the news widget (includes injected personal feeds)
    for widget in feeds_cfg:
        if widget.get("type") == "news":
            feeds = widget.get("config", {}).get("feeds", DEFAULT_FEEDS)
            break

    all_items: list[dict] = []
    for feed in feeds:
        items = await _fetch_feed(feed["url"], feed["label"])
        all_items.extend(items)

    if not all_items and _cache.get(cache_key):
        cache_registry.update("news", ok=False)
        return {"items": _cache[cache_key]}  # return stale on total failure

    if all_items:
        _cache[cache_key] = all_items
        _cache_ts[cache_key] = time.monotonic()
        cache_registry.update("news", ok=True)
    else:
        cache_registry.update("news", ok=False)

    return {"items": all_items}
