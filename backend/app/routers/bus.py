"""
Proxy to OVapi (v0.ovapi.nl) for real-time bus departures.
Returns upcoming departures for a configured timing point code within the lookahead window.

API: http://v0.ovapi.nl/tpc/{stop_code}/
No auth required.
Config: stop_code per person (set via admin panel or wall-cast.yaml)
Cache TTL: 30 seconds (real-time data), keyed by stop_code

Response structure:
  {stop_code: {"Stop": {...}, "Passes": {journey_id: {...}, ...}}}
TripStopStatus: "PLANNED" = scheduled, "CANCEL" = cancelled.
"""

import logging
import time
from datetime import datetime, timezone
from typing import Any

import httpx

from app import cache_registry
from app.config import settings
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)
router = APIRouter(tags=["bus"])

_cache: dict[str, Any] = {}
_cache_ts: dict[str, float] = {}

OVAPI_URL = "http://v0.ovapi.nl/tpc/{stop_code}/"


def _parse_departures(raw: dict, lookahead_min: int) -> list[dict]:
    """
    Parse OVapi /tpc/ response into a flat sorted departure list.
    The response has a single stop key whose value contains a "Passes" dict.
    We flatten, deduplicate by (line, planned minute), filter to the lookahead
    window, and skip passes with no departure time.
    """
    now = datetime.now(tz=timezone.utc)
    seen: set[tuple[str, str]] = set()
    result = []

    # Raw is keyed by stop_code; there's usually exactly one entry
    for stop_data in raw.values():
        passes = stop_data.get("Passes") or {}
        for pass_data in passes.values():
            status = pass_data.get("TripStopStatus", "PLANNED")
            cancelled = status == "CANCEL"

            planned_str = pass_data.get("TargetDepartureTime", "")
            expected_str = pass_data.get("ExpectedDepartureTime", "") or planned_str

            if not expected_str:
                continue

            try:
                expected_time = datetime.fromisoformat(expected_str)
                planned_time = datetime.fromisoformat(planned_str) if planned_str else expected_time
            except ValueError:
                continue

            if expected_time.tzinfo is None:
                from zoneinfo import ZoneInfo
                ams = ZoneInfo("Europe/Amsterdam")
                expected_time = expected_time.replace(tzinfo=ams)
                planned_time = planned_time.replace(tzinfo=ams)

            diff_min = (expected_time - now).total_seconds() / 60
            if diff_min < -1 or diff_min > lookahead_min:
                continue

            line = str(pass_data.get("LinePublicNumber", "?"))
            direction = pass_data.get("DestinationName50", "")
            planned_key = planned_str[:16]

            dedup_key = (line, planned_key)
            if dedup_key in seen:
                continue
            seen.add(dedup_key)

            delay_min = 0
            if expected_time > planned_time:
                delay_min = round((expected_time - planned_time).total_seconds() / 60)

            # LastUpdateTimeStamp present → realtime data available
            is_realtime = bool(pass_data.get("LastUpdateTimeStamp"))

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
    stop_code: str | None = Query(default=None),
) -> dict:
    global _cache, _cache_ts

    if not stop_code:
        raise HTTPException(status_code=503, detail="Bus: stop_code not configured — set it in the admin panel")

    if stop_code in _cache and (time.monotonic() - _cache_ts.get(stop_code, 0)) < settings.bus_cache_ttl:
        return _cache[stop_code]

    url = OVAPI_URL.format(stop_code=stop_code)

    try:
        async with httpx.AsyncClient(timeout=20.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
    except httpx.HTTPStatusError as exc:
        logger.error("Bus fetch HTTP error %s: %s", exc.response.status_code, exc)
        cache_registry.update("bus", ok=False)
        if stop_code in _cache:
            return _cache[stop_code]
        raise HTTPException(status_code=502, detail=f"Bus API error: {exc.response.status_code}")
    except httpx.HTTPError as exc:
        logger.error("Bus fetch failed: %s", exc)
        cache_registry.update("bus", ok=False)
        if stop_code in _cache:
            return _cache[stop_code]
        raise HTTPException(status_code=502, detail="Bus API unavailable")
    except Exception as exc:
        logger.error("Bus fetch unexpected error: %s", exc)
        cache_registry.update("bus", ok=False)
        if stop_code in _cache:
            return _cache[stop_code]
        raise HTTPException(status_code=502, detail="Bus API unavailable")

    raw = resp.json()

    # OVapi returns 200 with an empty dict for unknown stop codes
    if not raw or not any(v.get("Passes") for v in raw.values() if isinstance(v, dict)):
        logger.warning("Bus: no data for stop_code=%s (unknown stop?)", stop_code)

    # Extract stop name from first entry for display
    stop_name = stop_code
    for stop_data in raw.values():
        stop_info = stop_data.get("Stop") or {}
        if stop_info.get("TimingPointName"):
            stop_name = stop_info["TimingPointName"]
            break

    departures = _parse_departures(raw, settings.bus_lookahead_min)

    result = {
        "stop": stop_name,
        "stop_code": stop_code,
        "departures": departures,
    }
    _cache[stop_code] = result
    _cache_ts[stop_code] = time.monotonic()
    cache_registry.update("bus", ok=True)
    return result
