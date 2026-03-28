"""
Proxy to mijnafvalwijzer.nl for garbage collection dates.
Returns upcoming GFT / PMD / Restafval dates within the next N days.

Config: postcode / huisnummer per widget config (set via admin panel or wall-cast.yaml).
Cache keyed by "postcode:huisnummer:days_ahead".
"""

import logging
import time
from datetime import date, timedelta
from typing import Any

import httpx

from app import cache_registry
from app.config import settings
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)
router = APIRouter(tags=["garbage"])

_cache: dict[str, dict] = {}       # "postcode:huisnummer:days_ahead" -> result
_cache_ts: dict[str, float] = {}

AFVALWIJZER_URL = (
    "https://api.mijnafvalwijzer.nl/webservices/appsinput/"
    "?apikey=5ef443e778f41c4f75c69459eea6e6ae0c2d92de729aa0fc61653815fbd6a8ca"
    "&method=postcodecheck"
    "&postcode={postcode}"
    "&street="
    "&huisnummer={huisnummer}"
    "&toevoeging="
    "&app_name=afvalwijzer"
    "&platform=web"
    "&langs=nl"
)

CONTAINER_TYPES = {"gft", "pmd", "restafval"}
CONTAINER_LABELS = {
    "gft": "GFT",
    "pmd": "PMD",
    "restafval": "Restafval",
}


@router.get("/garbage")
async def get_garbage(
    days_ahead: int = Query(default=7, ge=1, le=365),
    postcode: str | None = Query(default=None),
    huisnummer: str | None = Query(default=None),
) -> dict:
    global _cache, _cache_ts

    pc = (postcode or "").replace(" ", "")
    hn = huisnummer or ""

    if not pc or not hn:
        raise HTTPException(
            status_code=400,
            detail="postcode and huisnummer must be configured — set them in the admin panel",
        )

    cache_key = f"{pc}:{hn}:{days_ahead}"

    if cache_key in _cache and (time.monotonic() - _cache_ts.get(cache_key, 0)) < settings.garbage_cache_ttl:
        return _cache[cache_key]

    today = date.today()
    url = AFVALWIJZER_URL.format(postcode=pc, huisnummer=hn)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("Garbage fetch failed: %s", exc)
        cache_registry.update("garbage", ok=False)
        if cache_key in _cache:
            return _cache[cache_key]
        raise HTTPException(status_code=502, detail="Afvalwijzer API unavailable")

    raw = resp.json()
    if raw.get("response") != "OK":
        logger.error("Afvalwijzer returned response %s", raw.get("response"))
        cache_registry.update("garbage", ok=False)
        if cache_key in _cache:
            return _cache[cache_key]
        raise HTTPException(status_code=502, detail="Afvalwijzer returned error status")

    all_dates: list = (
        raw.get("data", {})
           .get("ophaaldagen", {})
           .get("data", [])
    )

    cutoff = today + timedelta(days=days_ahead)
    # Find the next upcoming date per type (within days_ahead days)
    next_per_type: dict[str, date] = {}
    for item in all_dates:
        waste_type = item.get("type", "").lower()
        if waste_type not in CONTAINER_TYPES:
            continue
        try:
            d = date.fromisoformat(item["date"])
        except (KeyError, ValueError):
            continue
        if d < today or d > cutoff:
            continue
        if waste_type not in next_per_type or d < next_per_type[waste_type]:
            next_per_type[waste_type] = d

    collections = [
        {
            "type": t,
            "label": CONTAINER_LABELS[t],
            "date": next_per_type[t].isoformat(),
            "days_until": (next_per_type[t] - today).days,
        }
        for t in ("gft", "pmd", "restafval")
        if t in next_per_type
    ]
    collections.sort(key=lambda x: x["days_until"])

    result = {"collections": collections}
    _cache[cache_key] = result
    _cache_ts[cache_key] = time.monotonic()
    cache_registry.update("garbage", ok=True)
    return result
