"""
Traffic widget backend.

Two data sources:
  1. ANWB incidents API (no key) — current highway traffic jams in NL
  2. TomTom Routing API (key via TOMTOM_API_KEY env var) — live travel time
     from home (Smilde) to work (Lekkerbeetjesstraat 8, Den Bosch)

Addresses are geocoded via TomTom Search API on first request and cached
for the lifetime of the process, so routing always uses exact coordinates.

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

# Fallback coordinates (used if geocoding fails or addresses not configured)
_HOME_FALLBACK = (52.3676, 4.9041)   # Amsterdam centre — override via TRAFFIC_HOME_ADDRESS
_WORK_FALLBACK = (52.3676, 4.9041)

# Cached geocoded coords — populated lazily on first successful geocode
_coords: dict[str, tuple[float, float]] = {}

TOMTOM_GEOCODE_URL = (
    "https://api.tomtom.com/search/2/geocode/{query}.json"
    "?key={key}&limit=1&countrySet=NL"
)

ANWB_INCIDENTS_URL = (
    "https://api.anwb.nl/routing/v1/incidents/incidents-desktop"
)

TOMTOM_ROUTE_URL = (
    "https://api.tomtom.com/routing/1/calculateRoute"
    "/{olat},{olon}:{dlat},{dlon}/json"
    "?traffic=true&travelMode=car&key={key}"
)

# Incident types that count as traffic jams
JAM_TYPES = {
    "stationary-traffic",
    "queuing-traffic",
    "slow-traffic",
    "road-closed",
}


def _route_roads() -> frozenset[str]:
    """Return the set of road numbers that make up the configured commute route."""
    raw = settings.traffic_route_roads
    if not raw:
        return frozenset()
    return frozenset(r.strip().upper() for r in raw.split(",") if r.strip())


async def _geocode(client: httpx.AsyncClient, address: str, key: str) -> tuple[float, float] | None:
    """Return (lat, lon) for address using TomTom Geocoding API, or None on error."""
    try:
        url = TOMTOM_GEOCODE_URL.format(query=address, key=key)
        resp = await client.get(url)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if not results:
            logger.error("Geocoding returned no results for: %s", address)
            return None
        pos = results[0]["position"]
        lat, lon = pos["lat"], pos["lon"]
        logger.info("Geocoded '%s' → %.6f, %.6f", address, lat, lon)
        return (lat, lon)
    except Exception as exc:
        logger.error("Geocoding failed for '%s': %s", address, exc)
        return None


async def _ensure_coords(client: httpx.AsyncClient, api_key: str, home: str, work: str) -> None:
    """Geocode home and work addresses if not yet cached."""
    missing = [a for a in (home, work) if a and a not in _coords]
    if not missing:
        return

    results = await asyncio.gather(
        *[_geocode(client, a, api_key) for a in missing],
        return_exceptions=True,
    )
    for addr, result in zip(missing, results):
        if isinstance(result, tuple):
            _coords[addr] = result
        else:
            logger.warning("Using fallback coords for '%s'", addr)


def _parse_jams(raw: dict) -> list[dict]:
    """Extract jams from ANWB incidents response.

    Structure: roads[] → segments[] → jams[]
    Jam objects carry: road, from, to, distance (m), delay (s), incidentType.

    Sorted: on-route jams first (per TRAFFIC_ROUTE_ROADS), then by delay desc
    within each group. Capped at 12 rows.
    """
    route = _route_roads()
    jams: list[dict] = []
    for road_obj in raw.get("roads", []):
        road = road_obj.get("road", "")
        for seg in road_obj.get("segments", []):
            for jam in seg.get("jams", []):
                delay_s = jam.get("delay", 0) or 0
                distance_m = jam.get("distance", 0) or 0
                incident_type = jam.get("incidentType", "")
                if delay_s < 60 and incident_type not in JAM_TYPES:
                    continue
                road_final = (jam.get("road") or road).upper()
                jams.append({
                    "road": road_final,
                    "from": jam.get("from", ""),
                    "to": jam.get("to", ""),
                    "distance_km": round(distance_m / 1000, 1),
                    "delay_min": max(1, round(delay_s / 60)),
                    "type": incident_type,
                    "on_route": road_final in route,
                })
    # On-route jams first, then sort by delay desc within each group
    jams.sort(key=lambda j: (0 if j["on_route"] else 1, -j["delay_min"]))
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
    home_addr = settings.traffic_home_address
    work_addr = settings.traffic_work_address

    async with httpx.AsyncClient(timeout=10.0) as client:
        # Geocode addresses if needed (no-op after first successful call)
        if api_key and home_addr and work_addr:
            await _ensure_coords(client, api_key, home_addr, work_addr)

        home = _coords.get(home_addr, _HOME_FALLBACK) if home_addr else _HOME_FALLBACK
        work = _coords.get(work_addr, _WORK_FALLBACK) if work_addr else _WORK_FALLBACK

        # Fire ANWB and TomTom routing concurrently
        tasks: list = [client.get(ANWB_INCIDENTS_URL)]
        if api_key:
            route_url = TOMTOM_ROUTE_URL.format(
                olat=home[0], olon=home[1],
                dlat=work[0], dlon=work[1],
                key=api_key,
            )
            tasks.append(client.get(route_url))

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
