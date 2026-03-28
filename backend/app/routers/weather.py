"""
Proxy to open-meteo.com — no API key required.
Returns hourly and daily forecast for the configured location.
"""

import logging
import time
from typing import Any

import httpx

from app import cache_registry, wall_config
from app.config import settings
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(tags=["weather"])

_cache: dict[str, Any] = {}
_cache_ts: float = 0.0

OPEN_METEO_URL = (
    "https://api.open-meteo.com/v1/forecast"
    "?latitude={lat}&longitude={lon}"
    "&hourly=temperature_2m,precipitation_probability,weathercode,windspeed_10m"
    "&daily=weathercode,temperature_2m_max,temperature_2m_min,precipitation_sum"
    "&current_weather=true"
    "&timezone=Europe%2FAmsterdam"
    "&forecast_days=7"
)


@router.get("/weather")
async def get_weather() -> dict:
    global _cache, _cache_ts

    if _cache and (time.monotonic() - _cache_ts) < settings.weather_cache_ttl:
        return _cache

    cfg = wall_config.get_config()
    location = cfg.get("location", {})
    lat = location.get("lat", 52.3676)
    lon = location.get("lon", 4.9041)

    url = OPEN_METEO_URL.format(lat=lat, lon=lon)
    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("Weather fetch failed: %s", exc)
        cache_registry.update("weather", ok=False)
        if _cache:
            return _cache  # return stale on error
        raise HTTPException(status_code=502, detail="Weather API unavailable")

    _cache = resp.json()
    _cache_ts = time.monotonic()
    cache_registry.update("weather", ok=True)
    return _cache
