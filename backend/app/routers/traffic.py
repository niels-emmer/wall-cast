"""
Traffic widget backend.

Two data sources:
  1. ANWB incidents API (no key) — current highway traffic jams in NL
  2. TomTom Routing API (key via TOMTOM_API_KEY env var) — live travel time
     from home (Smilde) to work (Lekkerbeetjesstraat 8, Den Bosch)

Cache TTL: traffic_cache_ttl seconds (default 5 minutes).
"""

import asyncio
import logging
import time
from typing import Any

import httpx

from app.config import settings
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(tags=["traffic"])

_cache: dict[str, Any] = {}
_cache_ts: float = 0.0

# Home: Smilde, NL
HOME_LAT = 52.5257
HOME_LON = 6.4510

# Work: Lekkerbeetjesstraat 8, 5211AL Den Bosch
WORK_LAT = 51.6895
WORK_LON = 5.3007

ANWB_INCIDENTS_URL = (
    "https://api.anwb.nl/routing/v1/incidents/incidents-desktop"
)

TOMTOM_ROUTE_URL = (
    "https://api.tomtom.com/routing/1/calculateRoute"
    f"/{HOME_LAT},{HOME_LON}:{WORK_LAT},{WORK_LON}/json"
    "?traffic=true&travelMode=car&key={key}"
)

# Incident types that count as traffic jams
JAM_TYPES = {
    "stationary-traffic",
    "queuing-traffic",
    "slow-traffic",
}


def _parse_jams(raw: dict) -> list[dict]:
    """Extract jams from ANWB incidents response, sorted by delay desc."""
    jams: list[dict] = []
    for road_obj in raw.get("roads", []):
        road = road_obj.get("road", "")
        for seg in road_obj.get("segments", []):
            delay_s = seg.get("delay", 0) or 0
            distance_m = seg.get("distance", 0) or 0
            incident_type = seg.get("incidentType", "")
            # Only include actual traffic jams with meaningful delay
            if delay_s < 60 and incident_type not in JAM_TYPES:
                continue
            jams.append({
                "road": road or seg.get("road", ""),
                "from": seg.get("from", ""),
                "to": seg.get("to", ""),
                "distance_km": round(distance_m / 1000, 1),
                "delay_min": max(1, round(delay_s / 60)),
                "type": incident_type,
            })
    # Sort by delay descending, cap at 12 rows
    jams.sort(key=lambda j: j["delay_min"], reverse=True)
    return jams[:12]


def _parse_travel(raw: dict) -> dict | None:
    """Extract travel time summary from TomTom route response."""
    try:
        summary = raw["routes"][0]["summary"]
        return {
            "duration_min": round(summary["travelTimeInSeconds"] / 60),
            "delay_min": round(summary.get("trafficDelayInSeconds", 0) / 60),
            "distance_km": round(summary["lengthInMeters"] / 1000, 1),
        }
    except (KeyError, IndexError, TypeError):
        return None


@router.get("/traffic")
async def get_traffic() -> dict:
    global _cache, _cache_ts

    if _cache and (time.monotonic() - _cache_ts) < settings.traffic_cache_ttl:
        return _cache

    api_key = settings.tomtom_api_key

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Fire both requests concurrently
        tasks = [
            client.get(ANWB_INCIDENTS_URL),
        ]
        if api_key:
            tasks.append(client.get(TOMTOM_ROUTE_URL.format(key=api_key)))

        try:
            responses = await asyncio.gather(*tasks, return_exceptions=True)
        except Exception as exc:
            logger.error("Traffic fetch error: %s", exc)
            if _cache:
                return _cache
            raise HTTPException(status_code=502, detail="Traffic API unavailable")

    # Parse jams
    jams: list[dict] = []
    anwb_ok = False
    anwb_resp = responses[0]
    if isinstance(anwb_resp, Exception):
        logger.error("ANWB incidents fetch failed: %s", anwb_resp)
    else:
        try:
            anwb_resp.raise_for_status()
            jams = _parse_jams(anwb_resp.json())
            anwb_ok = True
        except Exception as exc:
            logger.error("ANWB incidents parse error: %s", exc)

    # Parse travel time
    travel: dict | None = None
    tomtom_ok = not api_key  # no key → skip is fine, not an error
    if api_key and len(responses) > 1:
        tomtom_resp = responses[1]
        if isinstance(tomtom_resp, Exception):
            logger.error("TomTom fetch failed: %s", tomtom_resp)
        else:
            try:
                tomtom_resp.raise_for_status()
                travel = _parse_travel(tomtom_resp.json())
                tomtom_ok = True
            except Exception as exc:
                logger.error("TomTom parse error: %s", exc)

    # At least one source must have succeeded
    if not anwb_ok and not tomtom_ok:
        if _cache:
            return _cache
        raise HTTPException(status_code=502, detail="Traffic data unavailable")

    result: dict = {"jams": jams, "travel": travel}
    _cache = result
    _cache_ts = time.monotonic()
    return result
