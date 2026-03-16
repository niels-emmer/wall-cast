"""
Proxy to mijnafvalwijzer.nl for garbage collection dates.
Returns upcoming GFT / PMD / Restafval dates within the next 7 days.

Config via environment variables:
  GARBAGE_POSTCODE=1234AB
  GARBAGE_HUISNUMMER=1
"""

import logging
import time
from datetime import date, timedelta
from typing import Any

import httpx

from app.config import settings
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(tags=["garbage"])

_cache: dict[str, Any] = {}
_cache_ts: float = 0.0

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
async def get_garbage() -> dict:
    global _cache, _cache_ts

    if _cache and (time.monotonic() - _cache_ts) < settings.garbage_cache_ttl:
        return _cache

    postcode = settings.garbage_postcode.replace(" ", "")
    huisnummer = settings.garbage_huisnummer

    if not postcode or not huisnummer:
        raise HTTPException(
            status_code=400,
            detail="GARBAGE_POSTCODE and GARBAGE_HUISNUMMER must be set in the environment (or .env file)",
        )

    today = date.today()
    url = AFVALWIJZER_URL.format(postcode=postcode, huisnummer=huisnummer)

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("Garbage fetch failed: %s", exc)
        if _cache:
            return _cache
        raise HTTPException(status_code=502, detail="Afvalwijzer API unavailable")

    raw = resp.json()
    if raw.get("response") != "OK":
        logger.error("Afvalwijzer returned response %s", raw.get("response"))
        if _cache:
            return _cache
        raise HTTPException(status_code=502, detail="Afvalwijzer returned error status")

    all_dates: list = (
        raw.get("data", {})
           .get("ophaaldagen", {})
           .get("data", [])
    )

    cutoff = today + timedelta(days=7)
    # Find the next upcoming date per type (within 7 days)
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

    _cache = {"collections": collections}
    _cache_ts = time.monotonic()
    return _cache
