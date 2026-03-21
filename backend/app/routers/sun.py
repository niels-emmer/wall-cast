import time
from datetime import datetime, timedelta

import httpx
from fastapi import APIRouter, HTTPException

from app import wall_config

router = APIRouter()

_cache: dict = {}
CACHE_TTL = 6 * 3600  # 6 hours — sun times barely change day to day
SUN_URL = "https://api.sunrise-sunset.org/json"


def _parse(iso: str) -> datetime:
    return datetime.fromisoformat(iso).astimezone()


def _fmt(dt: datetime) -> str:
    return dt.strftime("%H:%M")


@router.get("/sun")
async def get_sun() -> dict:
    cfg = wall_config.get_config()
    location = cfg.get("location", {})
    lat = location.get("lat", 52.3676)
    lon = location.get("lon", 4.9041)
    key = f"{lat},{lon}"
    now = time.time()

    if key in _cache and now - _cache[key]["ts"] < CACHE_TTL:
        return _cache[key]["data"]

    try:
        async with httpx.AsyncClient(timeout=10) as client:
            r = await client.get(
                SUN_URL,
                params={"lat": lat, "lng": lon, "formatted": 0},
            )
            r.raise_for_status()
            raw = r.json()["results"]
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Sun API error: {exc}") from exc

    sunrise = _parse(raw["sunrise"])
    sunset = _parse(raw["sunset"])
    solar_noon = _parse(raw["solar_noon"])
    day_secs = int(raw["day_length"])

    data = {
        "sunrise": _fmt(sunrise),
        "sunset": _fmt(sunset),
        "solar_noon": _fmt(solar_noon),
        # Golden hour = first/last ~60 min of direct sunlight
        "golden_dawn_start": _fmt(sunrise),
        "golden_dawn_end": _fmt(sunrise + timedelta(hours=1)),
        "golden_dusk_start": _fmt(sunset - timedelta(hours=1)),
        "golden_dusk_end": _fmt(sunset),
        "day_length_h": day_secs // 3600,
        "day_length_m": (day_secs % 3600) // 60,
    }

    _cache[key] = {"ts": now, "data": data}
    return data
