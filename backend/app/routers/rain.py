"""
Proxy to buienalarm.nl rain forecast API.
Returns 2-hour rain intensity forecast in 5-minute intervals (25 readings).

API: https://cdn-secure.buienalarm.nl/api/3.4/forecast.php
Response: {
  "start": <unix timestamp>,
  "start_human": "HH:MM",
  "delta": 300,           # seconds between readings
  "precip": [float, ...]  # mm/hour for each 5-min slot (25 entries)
  "levels": {"light": 0.25, "moderate": 1, "heavy": 2.5}
}
"""

import logging
import time
from datetime import datetime, timezone
from typing import Any

import httpx

from app import wall_config
from app.config import settings
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(tags=["rain"])

_cache: dict[str, Any] = {}
_cache_ts: float = 0.0

BUIENALARM_URL = (
    "https://cdn-secure.buienalarm.nl/api/3.4/forecast.php"
    "?lat={lat}&lon={lon}&region=nl&unit=mm/u"
)


def _build_forecast(data: dict) -> list[dict]:
    """Convert buienalarm response into a time-stamped list."""
    start_ts = data["start"]
    delta = data.get("delta", 300)
    precip = data.get("precip", [])

    result = []
    for i, mm in enumerate(precip):
        slot_ts = start_ts + i * delta
        slot_time = datetime.fromtimestamp(slot_ts, tz=timezone.utc).strftime("%H:%M")
        result.append({
            "time": slot_time,
            "mm_per_hour": round(float(mm), 2),
        })
    return result


@router.get("/rain")
async def get_rain() -> dict:
    global _cache, _cache_ts

    if _cache and (time.monotonic() - _cache_ts) < settings.rain_cache_ttl:
        return _cache

    cfg = wall_config.get_config()
    location = cfg.get("location", {})
    lat = location.get("lat", 0.0)
    lon = location.get("lon", 0.0)

    url = BUIENALARM_URL.format(lat=lat, lon=lon)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("Rain fetch failed: %s", exc)
        if _cache:
            return _cache
        raise HTTPException(status_code=502, detail="Rain API unavailable")

    raw = resp.json()
    forecast = _build_forecast(raw)
    _cache = {
        "forecast": forecast,
        "levels": raw.get("levels", {}),
        "start_human": raw.get("start_human", ""),
    }
    _cache_ts = time.monotonic()
    return _cache
