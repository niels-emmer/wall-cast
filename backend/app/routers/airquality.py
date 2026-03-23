"""
Proxy to open-meteo.com Air Quality API — no API key required.
Returns current European AQI, pollutant concentrations, and a 4-day pollen
forecast aggregated to daily maximums.
"""

import logging
import time
from datetime import datetime, timezone, timedelta
from typing import Any

import httpx

from app import wall_config
from app.config import settings
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(tags=["airquality"])

_cache: dict[str, Any] = {}
_cache_ts: float = 0.0

OPEN_METEO_AQ_URL = (
    "https://air-quality-api.open-meteo.com/v1/air-quality"
    "?latitude={lat}&longitude={lon}"
    "&hourly=european_aqi,pm10,pm2_5,nitrogen_dioxide,ozone,dust,"
    "grass_pollen,birch_pollen,alder_pollen,mugwort_pollen,ragweed_pollen"
    "&domains=auto"
    "&forecast_days=5"
)

POLLEN_SPECIES = ["birch", "grass", "alder", "mugwort", "ragweed"]
POLLEN_KEYS = {
    "birch":   "birch_pollen",
    "grass":   "grass_pollen",
    "alder":   "alder_pollen",
    "mugwort": "mugwort_pollen",
    "ragweed": "ragweed_pollen",
}


def _aqi_level(v: float | None) -> str:
    if v is None:  return "unknown"
    if v <= 20:    return "good"
    if v <= 40:    return "fair"
    if v <= 60:    return "moderate"
    if v <= 80:    return "poor"
    if v <= 100:   return "very_poor"
    return "extremely_poor"


def _pollen_level(v: float | None) -> str:
    if v is None or v <= 0: return "none"
    if v <= 30:  return "low"
    if v <= 70:  return "moderate"
    if v <= 200: return "high"
    return "very_high"


def _parse(raw: dict) -> dict:
    hourly = raw.get("hourly", {})
    times  = hourly.get("time", [])
    now    = datetime.now(timezone.utc)

    # Find the index of the current hour
    current_idx = 0
    for i, t in enumerate(times):
        try:
            dt = datetime.fromisoformat(t)
            if dt.tzinfo is None:
                dt = dt.replace(tzinfo=timezone.utc)
            if dt <= now:
                current_idx = i
        except Exception:
            pass

    def _val(key: str, idx: int) -> float | None:
        arr = hourly.get(key, [])
        if idx < len(arr) and arr[idx] is not None:
            return round(float(arr[idx]), 1)
        return None

    current_aqi = _val("european_aqi",      current_idx)
    pm2_5       = _val("pm2_5",             current_idx)
    pm10        = _val("pm10",              current_idx)
    no2         = _val("nitrogen_dioxide",  current_idx)
    ozone       = _val("ozone",             current_idx)
    dust_raw    = _val("dust",              current_idx)
    # Only surface dust when elevated (Saharan events); normal background <5 µg/m³
    dust = dust_raw if (dust_raw is not None and dust_raw > 5) else None

    # 4-day pollen forecast — daily maximum per species
    today = now.date()
    pollen = []
    for species in POLLEN_SPECIES:
        key = POLLEN_KEYS[species]
        arr = hourly.get(key, [])

        daily: dict[str, list[float]] = {}
        for i, t in enumerate(times):
            try:
                dt   = datetime.fromisoformat(t)
                date = dt.date()
            except Exception:
                continue
            delta = (date - today).days
            if delta < 0 or delta > 3:
                continue
            v = arr[i] if i < len(arr) else None
            if v is not None:
                daily.setdefault(date.isoformat(), []).append(float(v))

        days_out = []
        for delta in range(4):
            d  = today + timedelta(days=delta)
            ds = d.isoformat()
            vals    = daily.get(ds, [])
            max_val = round(max(vals), 1) if vals else None
            days_out.append({
                "date":  ds,
                "max":   max_val,
                "level": _pollen_level(max_val),
            })

        # Skip species with no season data
        if all(d["max"] is None or d["max"] <= 0 for d in days_out):
            continue

        pollen.append({"species": species, "days": days_out})

    return {
        "current_aqi": current_aqi,
        "aqi_level":   _aqi_level(current_aqi),
        "pm2_5":       pm2_5,
        "pm10":        pm10,
        "nitrogen_dioxide": no2,
        "ozone":       ozone,
        "dust":        dust,
        "pollen":      pollen,
    }


@router.get("/airquality")
async def get_air_quality() -> dict:
    global _cache, _cache_ts

    if _cache and (time.monotonic() - _cache_ts) < settings.airquality_cache_ttl:
        return _cache

    cfg      = wall_config.get_config()
    location = cfg.get("location", {})
    lat      = location.get("lat", 52.3676)
    lon      = location.get("lon", 4.9041)

    url = OPEN_METEO_AQ_URL.format(lat=lat, lon=lon)
    try:
        async with httpx.AsyncClient(timeout=15.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("Air quality fetch failed: %s", exc)
        if _cache:
            return _cache
        raise HTTPException(status_code=502, detail="Air quality API unavailable")

    _cache    = _parse(resp.json())
    _cache_ts = time.monotonic()
    return _cache
