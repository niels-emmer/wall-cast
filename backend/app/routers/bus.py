"""
Proxy to vertrektijd.info departure API for bus stop live departures.
Returns upcoming departures for a configured bus stop within the lookahead window.

API: https://api.vertrektijd.info/departures/_nametown/{city}/{stop}/
Auth: X-Vertrektijd-Client-Api-Key header
Config: stop_city / stop_name per widget config (or BUSSTOP_CITY / BUSSTOP_NAME env fallback)
Cache TTL: 30 seconds (real-time data), keyed by stop

Response structure:
  {"TRAIN": [], "BTMF": [{"Station_Info": {...}, "Departures": [...]}, ...]}
Each transport type key contains a list of platform groups, each with a Departures list.
VehicleStatus: "PLANNED" = scheduled, "CANCEL" = cancelled.
"""

import logging
import time
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import settings
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)
router = APIRouter(tags=["bus"])

_cache: dict[str, Any] = {}     # keyed by "city:stop"
_cache_ts: dict[str, float] = {}

VERTREKTIJD_URL = "https://api.vertrektijd.info/departures/_nametown/{city}/{stop}/"


def _parse_departures(raw: dict, lookahead_min: int) -> list[dict]:
    """
    Parse vertrektijd.info response into a flat sorted departure list.
    The response groups departures by transport type and platform — we flatten them,
    deduplicate by (line, planned time), filter to the lookahead window,
    and skip cancelled services.
    """
    now = datetime.now(tz=timezone.utc)
    seen: set[tuple[str, str]] = set()
    result = []

    # Iterate all transport type groups (BTMF = bus/tram/metro/ferry, TRAIN, etc.)
    for platform_list in raw.values():
        if not isinstance(platform_list, list):
            continue
        for platform in platform_list:
            departures = platform.get("Departures", [])
            for dep in departures:
                cancelled = dep.get("VehicleStatus") == "CANCEL"

                planned_str = dep.get("PlannedDeparture", "")
                expected_str = dep.get("ExpectedDeparture", "") or planned_str

                if not expected_str:
                    continue

                try:
                    expected_time = datetime.fromisoformat(expected_str)
                    planned_time = datetime.fromisoformat(planned_str) if planned_str else expected_time
                except ValueError:
                    continue

                # Make timezone-aware if naive (API returns local naive datetimes)
                if expected_time.tzinfo is None:
                    from zoneinfo import ZoneInfo
                    ams = ZoneInfo("Europe/Amsterdam")
                    expected_time = expected_time.replace(tzinfo=ams)
                    planned_time = planned_time.replace(tzinfo=ams)

                diff_min = (expected_time - now).total_seconds() / 60
                if diff_min < -1 or diff_min > lookahead_min:
                    continue

                line = str(dep.get("LineNumber", "?"))
                direction = dep.get("Destination", "")
                planned_key = planned_str[:16]  # deduplicate by line + minute

                dedup_key = (line, planned_key)
                if dedup_key in seen:
                    continue
                seen.add(dedup_key)

                delay_min = 0
                if expected_time > planned_time:
                    delay_min = round((expected_time - planned_time).total_seconds() / 60)

                # is_realtime: UpdateTime is more recent than PlannedDeparture data age
                is_realtime = bool(dep.get("ExpectedDeparture"))

                result.append({
                    "line": line,
                    "direction": direction,
                    "time": expected_time.strftime("%H:%M"),
                    "delay_min": delay_min,
                    "is_realtime": is_realtime,
                    "cancelled": cancelled,
                    "_sort_key": expected_time.isoformat(),
                })

    result.sort(key=lambda d: d["_sort_key"])
    for d in result:
        del d["_sort_key"]
    return result


@router.get("/bus")
async def get_bus(
    stop_city: str | None = Query(default=None),
    stop_name: str | None = Query(default=None),
) -> dict:
    global _cache, _cache_ts

    if not settings.vertrektijd_api_key:
        raise HTTPException(status_code=503, detail="Bus: VERTREKTIJD_API_KEY not configured")

    city = stop_city or settings.busstop_city
    stop = stop_name or settings.busstop_name

    if not city or not stop:
        raise HTTPException(status_code=503, detail="Bus: stop_city / stop_name not configured")

    cache_key = f"{city}:{stop}"

    if cache_key in _cache and (time.monotonic() - _cache_ts.get(cache_key, 0)) < settings.bus_cache_ttl:
        return _cache[cache_key]

    url = VERTREKTIJD_URL.format(city=city, stop=stop)
    headers = {"X-Vertrektijd-Client-Api-Key": settings.vertrektijd_api_key}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url, headers=headers)
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error("Bus fetch HTTP error %s: %s", exc.response.status_code, exc)
        if cache_key in _cache:
            return _cache[cache_key]
        raise HTTPException(status_code=502, detail=f"Bus API error: {exc.response.status_code}")
    except httpx.HTTPError as exc:
        logger.error("Bus fetch failed: %s", exc)
        if cache_key in _cache:
            return _cache[cache_key]
        raise HTTPException(status_code=502, detail="Bus API unavailable")

    raw = resp.json()
    departures = _parse_departures(raw, settings.bus_lookahead_min)

    result = {
        "stop": stop,
        "city": city,
        "departures": departures,
    }
    _cache[cache_key] = result
    _cache_ts[cache_key] = time.monotonic()
    return result
