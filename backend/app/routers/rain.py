"""
Proxy to buienradar.nl rain forecast API.
Returns 2-hour rain intensity forecast in 5-minute intervals.
"""

import logging
import time
from typing import Any

import httpx

from app import wall_config
from app.config import settings
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(tags=["rain"])

_cache: dict[str, Any] = {}
_cache_ts: float = 0.0

# Returns a plain-text response: "intensity|timestamp" per line
BUIENRADAR_URL = "https://gpsgadget.buienradar.nl/data/raintext?lat={lat}&lon={lon}"


def _parse_buienradar(text: str) -> list[dict]:
    """Parse buienradar rain text into a list of {time, intensity, mm_per_hour}."""
    results = []
    for line in text.strip().splitlines():
        line = line.strip()
        if not line or "|" not in line:
            continue
        raw_intensity, timestamp = line.split("|", 1)
        intensity = int(raw_intensity)
        # Convert buienradar scale (0-255) to mm/h: mm = 10^((intensity-109)/32)
        if intensity == 0:
            mm_per_hour = 0.0
        else:
            mm_per_hour = round(10 ** ((intensity - 109) / 32), 2)
        results.append({
            "time": timestamp.strip(),
            "intensity": intensity,
            "mm_per_hour": mm_per_hour,
        })
    return results


@router.get("/rain")
async def get_rain() -> dict:
    global _cache, _cache_ts

    if _cache and (time.monotonic() - _cache_ts) < settings.rain_cache_ttl:
        return _cache

    cfg = wall_config.get_config()
    location = cfg.get("location", {})
    lat = location.get("lat", 52.3676)
    lon = location.get("lon", 4.9041)

    url = BUIENRADAR_URL.format(lat=lat, lon=lon)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("Rain fetch failed: %s", exc)
        if _cache:
            return _cache
        raise HTTPException(status_code=502, detail="Rain API unavailable")

    data = _parse_buienradar(resp.text)
    _cache = {"forecast": data}
    _cache_ts = time.monotonic()
    return _cache
