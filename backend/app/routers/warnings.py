"""
KNMI weather warnings backend.

Uses the MeteoAlarm Atom/CAP feed for the Netherlands — the official
European meteorological alarm service that KNMI feeds into. Fully public,
no API key required.

Feed URL: https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-netherlands

CAP severity → level mapping:
  Minor    → geel
  Moderate → oranje
  Severe   → rood
  Extreme  → rood

Only entries with status=Actual, message_type=Alert, and where the current
time falls within [onset, expires] are included.

Entries with the same (level, event) are grouped and their regions aggregated.
Sorted by severity: rood → oranje → geel.

Returns empty list when no warnings are active — never raises 502.
Cache TTL: 15 minutes.
"""

import logging
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone

import httpx
from fastapi import APIRouter

from app import cache_registry

logger = logging.getLogger(__name__)
router = APIRouter(tags=["warnings"])

_cache: list[dict] = []
_cache_ts: float = 0.0
_CACHE_TTL = 15 * 60  # 15 minutes

METEOALARM_URL = (
    "https://feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-netherlands"
)

ATOM_NS = "http://www.w3.org/2005/Atom"
CAP_NS  = "urn:oasis:names:tc:emergency:cap:1.2"

_SEVERITY_TO_LEVEL = {
    "minor":    "geel",
    "moderate": "oranje",
    "severe":   "rood",
    "extreme":  "rood",
}

_LEVEL_ORDER = {"rood": 0, "oranje": 1, "geel": 2}

# Words to strip from cap:event to get a clean phenomenon label
_SEVERITY_PREFIXES = ("minor ", "moderate ", "severe ", "extreme ")


def _cap(tag: str) -> str:
    return f"{{{CAP_NS}}}{tag}"


def _atom(tag: str) -> str:
    return f"{{{ATOM_NS}}}{tag}"


def _clean_phenomenon(event: str) -> str:
    """Strip severity prefix and ' warning' suffix from CAP event string."""
    text = event.lower()
    for prefix in _SEVERITY_PREFIXES:
        if text.startswith(prefix):
            text = text[len(prefix):]
            break
    if text.endswith(" warning"):
        text = text[: -len(" warning")]
    return text.strip().capitalize()


def _parse_dt(iso: str) -> datetime | None:
    try:
        return datetime.fromisoformat(iso.replace("Z", "+00:00"))
    except Exception:
        return None


def _parse_warnings(xml_text: str) -> list[dict]:
    """Parse MeteoAlarm Atom/CAP XML into a structured, deduplicated list."""
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        logger.error("MeteoAlarm XML parse error: %s", exc)
        return []

    now = datetime.now(timezone.utc)
    raw: list[dict] = []

    for entry in root.findall(_atom("entry")):
        # Filter: only real, active alerts
        status       = entry.findtext(_cap("status"), "")
        message_type = entry.findtext(_cap("message_type"), "")
        if status.lower() != "actual" or message_type.lower() != "alert":
            continue

        # Time window check
        onset_str   = entry.findtext(_cap("onset"),   "")
        expires_str = entry.findtext(_cap("expires"),  "")
        onset   = _parse_dt(onset_str)
        expires = _parse_dt(expires_str)
        if expires and now > expires:
            continue  # already expired

        severity   = entry.findtext(_cap("severity"), "").lower()
        level      = _SEVERITY_TO_LEVEL.get(severity, "")
        if not level:
            continue

        event      = entry.findtext(_cap("event"), "")
        area_desc  = entry.findtext(_cap("areaDesc"), "")
        phenomenon = _clean_phenomenon(event)

        raw.append({
            "level":       level,
            "phenomenon":  phenomenon,
            "region":      area_desc,
            "valid_from":  onset_str,
            "valid_until": expires_str,
            "description": "",  # CAP feed has no free-text description in this format
        })

    if not raw:
        logger.info("MeteoAlarm NL: no active warnings")
        return []

    # Group by (level, phenomenon) → aggregate regions
    groups: dict[tuple, dict] = {}
    for w in raw:
        key = (w["level"], w["phenomenon"])
        if key not in groups:
            groups[key] = {
                "level":       w["level"],
                "phenomenon":  w["phenomenon"],
                "regions":     [],
                "valid_from":  w["valid_from"],
                "valid_until": w["valid_until"],
                "description": w["description"],
            }
        if w["region"] and w["region"] not in groups[key]["regions"]:
            groups[key]["regions"].append(w["region"])

    result = list(groups.values())
    result.sort(key=lambda w: _LEVEL_ORDER.get(w["level"], 9))
    logger.info("MeteoAlarm NL: %d active warning(s)", len(result))
    return result


def _filter_expired(warnings: list[dict]) -> list[dict]:
    """Drop any warnings whose valid_until has already passed."""
    now = datetime.now(timezone.utc)
    out = []
    for w in warnings:
        dt = _parse_dt(w.get("valid_until", ""))
        if dt is not None and now > dt:
            continue
        out.append(w)
    return out


@router.get("/warnings")
async def get_warnings() -> dict:
    global _cache, _cache_ts

    if _cache_ts and (time.monotonic() - _cache_ts) < _CACHE_TTL:
        # Re-check expiry on every cache hit so warnings clear as soon as
        # their valid_until passes, without waiting for the next full fetch.
        live = _filter_expired(_cache)
        return {"warnings": live}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(METEOALARM_URL)
            resp.raise_for_status()
            warnings = _parse_warnings(resp.text)
    except Exception as exc:
        logger.error("MeteoAlarm fetch error: %s", exc)
        cache_registry.update("warnings", ok=False)
        # On fetch error return whatever is still live from the last cache.
        return {"warnings": _filter_expired(_cache)}

    _cache = warnings
    _cache_ts = time.monotonic()
    cache_registry.update("warnings", ok=True)
    return {"warnings": warnings}
