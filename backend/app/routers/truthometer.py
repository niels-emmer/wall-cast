"""
Trump's Truth-o-Meter — fetches posts from Truth Social via the Mastodon-compatible API.

Endpoint: GET https://truthsocial.com/api/v1/accounts/107780257626128497/statuses
  - Trump's public account ID: 107780257626128497
  - Returns Mastodon status objects; 'content' field contains HTML
  - Public account, no OAuth required

Stats computed from fetched posts:
  posts_last_hour, posts_last_24h, reposts, originals, trend

TLDRs generated via OpenAI gpt-4o-mini (if OPENAI_API_KEY set in env),
  else truncated plain text. Cached by post ID across request cycles.
"""

import html
import logging
import os
import re
import time
from datetime import datetime, timezone
from typing import Any

import httpx

from app import cache_registry
from app.config import settings
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(tags=["truthometer"])

ACCOUNT_ID = "107780257626128497"
STATUSES_URL = f"https://truthsocial.com/api/v1/accounts/{ACCOUNT_ID}/statuses"
_HEADERS = {
    "User-Agent": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36",
    "Accept": "application/json",
}

# ── HTML stripping ─────────────────────────────────────────────────────────────

_TAG_RE = re.compile(r"<[^>]+>")
_WS_RE  = re.compile(r"\s{2,}")


def _strip_html(raw: str) -> str:
    text = _TAG_RE.sub(" ", raw)
    text = html.unescape(text)
    return _WS_RE.sub(" ", text).strip()


# ── TLDR cache (persists across request cycles) ────────────────────────────────

_tldr_cache: dict[str, str] = {}


def _generate_tldr(post_id: str, content: str) -> str:
    if post_id in _tldr_cache:
        return _tldr_cache[post_id]

    api_key = os.environ.get("OPENAI_API_KEY", "")
    if not api_key:
        tldr = content[:280] + ("…" if len(content) > 280 else "")
        _tldr_cache[post_id] = tldr
        return tldr

    prompt = (
        "Summarize the following Truth Social post by Donald Trump in 1-2 sentences. "
        "Be factual and neutral. Do not editorialize.\n\n"
        f"Post: {content}"
    )
    try:
        resp = httpx.post(
            "https://api.openai.com/v1/chat/completions",
            headers={"Authorization": f"Bearer {api_key}", "Content-Type": "application/json"},
            json={
                "model": "gpt-4o-mini",
                "messages": [{"role": "user", "content": prompt}],
                "max_tokens": 120,
                "temperature": 0.3,
            },
            timeout=10.0,
        )
        resp.raise_for_status()
        tldr = resp.json()["choices"][0]["message"]["content"].strip()
    except Exception as exc:
        logger.warning("TLDR generation failed for post %s: %s", post_id, exc)
        tldr = content[:280] + ("…" if len(content) > 280 else "")

    _tldr_cache[post_id] = tldr
    return tldr


# ── Stats ──────────────────────────────────────────────────────────────────────

def _compute_stats(posts: list[dict[str, Any]]) -> dict[str, Any]:
    now = datetime.now(tz=timezone.utc)

    last_hour   = sum(1 for p in posts if p["age_min"] <= 60)
    last_24h    = sum(1 for p in posts if p["age_min"] <= 1440)
    prev_hour   = sum(1 for p in posts if 60 < p["age_min"] <= 120)
    reposts     = sum(1 for p in posts if p["is_repost"])
    originals   = sum(1 for p in posts if not p["is_repost"])

    if last_hour > prev_hour:
        trend = "up"
    elif last_hour < prev_hour:
        trend = "down"
    else:
        trend = "steady"

    return {
        "posts_last_hour": last_hour,
        "posts_last_24h":  last_24h,
        "posts_prev_hour": prev_hour,
        "trend":           trend,
        "reposts":         reposts,
        "originals":       originals,
    }


# ── Response parser ────────────────────────────────────────────────────────────

def _parse_statuses(raw: list[dict]) -> list[dict[str, Any]]:
    now = datetime.now(tz=timezone.utc)
    posts: list[dict[str, Any]] = []

    for item in raw:
        post_id    = item.get("id", "")
        created_at = item.get("created_at", "")
        reblog     = item.get("reblog")
        is_repost  = reblog is not None

        # For reposts, use the original content
        source = reblog if is_repost else item
        raw_content = source.get("content", "")
        content = _strip_html(raw_content)

        if not content:
            continue

        original_account: str | None = None
        if is_repost and reblog:
            acct = reblog.get("account", {})
            original_account = acct.get("acct") or acct.get("username")

        # Parse timestamp
        try:
            ts = datetime.fromisoformat(created_at.replace("Z", "+00:00"))
        except (ValueError, AttributeError):
            ts = now

        age_min = max(0, round((now - ts).total_seconds() / 60))

        tldr = _generate_tldr(post_id, content)

        posts.append({
            "id":               post_id,
            "created_at":       created_at,
            "content":          content,
            "tldr":             tldr,
            "is_repost":        is_repost,
            "original_account": original_account,
            "age_min":          age_min,
        })

    return posts


# ── Cache ──────────────────────────────────────────────────────────────────────

_cache: dict[str, Any] | None = None
_cache_ts: float = 0.0


# ── Endpoint ───────────────────────────────────────────────────────────────────

@router.get("/truthometer")
async def get_truthometer() -> dict:
    global _cache, _cache_ts

    now = time.monotonic()
    if _cache is not None and (now - _cache_ts) < settings.truthometer_cache_ttl:
        return _cache

    try:
        async with httpx.AsyncClient(timeout=15.0, headers=_HEADERS, follow_redirects=True) as client:
            resp = await client.get(STATUSES_URL, params={"limit": 40})
            resp.raise_for_status()
            raw: list[dict] = resp.json()
    except httpx.HTTPStatusError as exc:
        logger.error("Truth Social API error %s: %s", exc.response.status_code, exc)
        cache_registry.update("truthometer", ok=False)
        if _cache is not None:
            return _cache
        raise HTTPException(status_code=502, detail=f"Truth Social API returned {exc.response.status_code}")
    except httpx.HTTPError as exc:
        logger.error("Truth Social fetch failed: %s", exc)
        cache_registry.update("truthometer", ok=False)
        if _cache is not None:
            return _cache
        raise HTTPException(status_code=502, detail="Truth Social unavailable")

    posts = _parse_statuses(raw)
    stats = _compute_stats(posts)

    result: dict[str, Any] = {"posts": posts, "stats": stats}
    _cache    = result
    _cache_ts = now
    cache_registry.update("truthometer", ok=True)
    return result
