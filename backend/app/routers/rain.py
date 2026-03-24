"""
Rain forecast proxy — 3-hour outlook in 15-minute slots.

Source: open-meteo.com minutely_15 (free, no key, no Cloudflare issues).
Previously used buienalarm.nl (cdn-secure) which started silently timing out
behind Cloudflare from server/datacenter IPs.

open-meteo minutely_15.precipitation is in mm per 15-minute interval.
Multiply × 4 to get mm/hour for display.

Response shape (unchanged from previous API — frontend compatible):
  forecast: [{time: "_NOW_" | "HH:MM", mm_per_hour: float}, ...]  — 12 slots × 15 min = 3 h
  levels:   {light: 0.25, moderate: 1.0, heavy: 2.5}
"""

import logging
import time
from datetime import datetime
from typing import Any
from zoneinfo import ZoneInfo

import httpx

from app import wall_config
from app.config import settings
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(tags=["rain"])

_cache: dict[str, Any] = {}
_cache_ts: float = 0.0

OPENMETEO_RAIN_URL = (
    "https://api.open-meteo.com/v1/forecast"
    "?latitude={lat}&longitude={lon}"
    "&minutely_15=precipitation"
    "&timezone={tz}"
    "&forecast_minutely_15=12"
)

# Fixed thresholds in mm/hour — match previous buienalarm levels
RAIN_LEVELS = {"light": 0.25, "moderate": 1.0, "heavy": 2.5}


def _build_forecast(data: dict, tz: ZoneInfo) -> list[dict]:
    """Convert open-meteo minutely_15 response to time-stamped mm/hour list."""
    m15 = data.get("minutely_15", {})
    times = m15.get("time", [])
    precip = m15.get("precipitation", [])

    result = []
    for i, (t_str, mm_15min) in enumerate(zip(times, precip)):
        slot_dt = datetime.fromisoformat(t_str).replace(tzinfo=tz)
        label = "_NOW_" if i == 0 else slot_dt.strftime("%H:%M")
        result.append({
            "time": label,
            "mm_per_hour": round(float(mm_15min) * 4, 2),
        })
    return result


@router.get("/rain")
async def get_rain() -> dict:
    global _cache, _cache_ts

    if _cache and (time.monotonic() - _cache_ts) < settings.rain_cache_ttl:
        return _cache

    cfg = wall_config.get_config()
    location = cfg.get("location", {})
    lat = location.get("lat", 52.3676)
    lon = location.get("lon", 4.9041)
    tz_name = settings.timezone
    tz = ZoneInfo(tz_name)

    url = OPENMETEO_RAIN_URL.format(lat=lat, lon=lon, tz=tz_name.replace("/", "%2F"))
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
    _cache = {
        "forecast": _build_forecast(raw, tz),
        "levels": RAIN_LEVELS,
    }
    _cache_ts = time.monotonic()
    return _cache
