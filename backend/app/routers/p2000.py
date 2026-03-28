"""
Proxy to the P2000 Dutch emergency services paging network.

Feed: http://p2000.brandweer-berkel-enschot.nl/homeassistant/rss.asp
- Returns the last ~80 national messages regardless of URL params; we filter in-process.
- No API key required.

Filtering rules (per investigation 2026-03-28):
  KEEP  Brandweerdiensten  — any priority (fires are always newsworthy)
  KEEP  Ambulancediensten  — A1 only (life-threatening; A2/B1/B2 are routine)
  KEEP  Politiediensten    — P1 / "Prio 1" only (major incidents)
  SKIP  Gereserveerd       — pager routing / system noise (~22 % of feed)
  SKIP  TESTOPROEP         — test pages
  SKIP  messages with no readable text (pure pager codes like "A2 13156 29209")

Deduplication: same incident dispatches to multiple units → same message text appears
2-4× with different IDs. We deduplicate by normalised message body within 5 minutes.

Region is derived from shared.location lat/lon using a hardcoded NL safety-region
bounding-box table (25 veiligheidsregio's). Where bboxes overlap, the closest centre wins.
"""

import logging
import math
import re
import time
import xml.etree.ElementTree as ET
from datetime import datetime, timezone
from typing import Any

import httpx

from app.config import settings
from app import cache_registry, wall_config
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(tags=["p2000"])

FEED_URL = "http://p2000.brandweer-berkel-enschot.nl/homeassistant/rss.asp"

# ── NL veiligheidsregio bounding boxes ────────────────────────────────────────
# (regcode, regname, lat_min, lat_max, lon_min, lon_max)
# Centres are computed as mid-points; used as tie-breaker when point is in
# multiple overlapping bboxes.
NL_REGIONS: list[tuple[str, str, float, float, float, float]] = [
    ("01", "Groningen",               52.90, 53.55, 6.40, 7.25),
    ("02", "Friesland",               52.70, 53.55, 4.85, 6.10),
    ("03", "Drenthe",                 52.47, 53.10, 6.10, 7.10),
    ("04", "IJsselland",              52.20, 52.72, 5.95, 6.65),
    ("05", "Twente",                  51.97, 52.60, 6.35, 7.10),
    ("06", "Noord en Oost Gelderland",51.90, 52.55, 5.85, 7.05),
    ("07", "Gelderland Midden",       51.75, 52.25, 5.30, 6.35),
    ("08", "Gelderland Zuid",         51.60, 52.05, 5.45, 6.25),
    ("09", "Utrecht",                 51.88, 52.35, 4.75, 5.75),
    ("10", "Noord-Holland Noord",     52.50, 53.05, 4.45, 5.30),
    ("11", "Zaanstreek Waterland",    52.30, 52.75, 4.75, 5.25),
    ("12", "Kennemerland",            52.18, 52.75, 4.35, 5.05),
    ("13", "Amsterdam Amstelland",    52.18, 52.52, 4.68, 5.15),
    ("14", "Gooi en Vechtstreek",     52.08, 52.50, 4.95, 5.55),
    ("15", "Haaglanden",              51.88, 52.22, 4.05, 4.55),
    ("16", "Hollands Midden",         51.90, 52.30, 4.28, 5.05),
    ("17", "Rotterdam Rijnmond",      51.68, 52.10, 4.05, 5.05),
    ("18", "Zuid-Holland Zuid",       51.58, 52.00, 4.28, 5.05),
    ("19", "Zeeland",                 51.22, 51.72, 3.35, 4.30),
    ("20", "Midden en West Brabant",  51.40, 51.92, 4.25, 5.30),
    ("21", "Brabant Noord",           51.48, 51.95, 4.95, 5.95),
    ("22", "Brabant Zuidoost",        51.28, 51.70, 5.28, 6.15),
    ("23", "Limburg Noord",           51.28, 51.72, 5.72, 6.35),
    ("24", "Limburg Zuid",            50.72, 51.40, 5.55, 6.35),
    ("25", "Flevoland",               52.18, 52.85, 5.05, 5.95),
]


def region_for_coords(lat: float, lon: float) -> str:
    """Return the RegName of the NL safety region containing the given coordinates.
    Where multiple bboxes contain the point, returns the one whose centre is closest.
    Falls back to nearest centre when no bbox matches (e.g. offshore / border)."""
    candidates: list[tuple[float, str]] = []
    for _code, name, lat_min, lat_max, lon_min, lon_max in NL_REGIONS:
        clat = (lat_min + lat_max) / 2
        clon = (lon_min + lon_max) / 2
        dist = math.hypot(lat - clat, lon - clon)
        if lat_min <= lat <= lat_max and lon_min <= lon <= lon_max:
            candidates.append((dist, name))
    if candidates:
        return min(candidates, key=lambda x: x[0])[1]
    # Fall back to nearest centre
    return min(NL_REGIONS, key=lambda r: math.hypot(lat - (r[2]+r[3])/2, lon - (r[4]+r[5])/2))[1]


# ── Message classification ────────────────────────────────────────────────────

_KEEP_DISCIPLINES = {"Brandweerdiensten", "Ambulancediensten", "Politiediensten"}

_A1_RE = re.compile(r"^A1\b", re.IGNORECASE)
_P1_RE = re.compile(r"^(P\s*1\b|Prio\s*1\b|GRIP\b)", re.IGNORECASE)

# A message is "readable" if it contains at least one word that is not
# a pure digit string and is longer than 3 chars (filters "A2 13156 29209")
_READABLE_RE = re.compile(r"\b(?!\d+\b)[A-Za-zÀ-ÿ][A-Za-zÀ-ÿ0-9]{3,}\b")


def _should_keep(discipline: str, message: str) -> bool:
    if discipline not in _KEEP_DISCIPLINES:
        return False
    if "TESTOPROEP" in message.upper():
        return False
    if not _READABLE_RE.search(message):
        return False
    if discipline == "Ambulancediensten":
        return bool(_A1_RE.match(message))
    if discipline == "Politiediensten":
        return bool(_P1_RE.match(message))
    return True  # Brandweerdiensten — keep all priorities


def _extract_priority(message: str) -> str:
    """Return a short priority label from the message text."""
    m = re.match(r"^(A1|A2|B1|B2|C1|P\s*\d|Prio\s*\d|GRIP\s*\d)", message, re.IGNORECASE)
    if m:
        return re.sub(r"\s+", "", m.group(0)).upper()
    return ""


# ── Deduplication ─────────────────────────────────────────────────────────────

def _normalise_body(msg: str) -> str:
    """Strip unit codes and numeric IDs; keep the human-readable location/type text."""
    # Remove leading priority code (A1, P 1, Prio 1, …)
    s = re.sub(r"^(A1|A2|B1|B2|C1|P\s*\d+|Prio\s*\d+|GRIP\s*\d*)\s*", "", msg, flags=re.IGNORECASE)
    # Remove standalone numeric tokens (unit/rit codes)
    s = re.sub(r"\b\d{3,}\b", "", s)
    # Collapse whitespace
    return re.sub(r"\s{2,}", " ", s).strip().lower()


# ── Feed parser ────────────────────────────────────────────────────────────────

def _parse_feed(xml_bytes: bytes, region_name: str, history_hours: int = 6) -> list[dict[str, Any]]:
    """Parse the national P2000 RSS feed, filter to region + discipline rules,
    deduplicate multi-unit dispatches, and return a sorted list of incidents."""
    try:
        root = ET.fromstring(xml_bytes)
    except ET.ParseError as exc:
        logger.error("P2000 XML parse error: %s", exc)
        return []

    now = datetime.now(tz=timezone.utc)
    cutoff_sec = history_hours * 3600

    seen_bodies: dict[str, float] = {}   # normalised_body → earliest timestamp (epoch)
    incidents: list[dict[str, Any]] = []

    for item in root.findall(".//item"):
        reg_name = item.findtext("RegName") or ""
        if reg_name != region_name:
            continue

        discipline = item.findtext("Dienst") or ""
        message = (item.findtext("message") or "").strip()

        if not _should_keep(discipline, message):
            continue

        # Parse timestamp
        pub_date = item.findtext("pubDate") or ""
        try:
            ts = datetime.strptime(pub_date, "%a, %d %b %Y %H:%M:%S %z")
        except ValueError:
            ts = now

        age_sec = (now - ts).total_seconds()
        if age_sec > cutoff_sec or age_sec < -60:
            continue

        # Deduplicate within 5-minute window
        body_key = _normalise_body(message)
        prev_ts = seen_bodies.get(body_key)
        if prev_ts is not None and abs(ts.timestamp() - prev_ts) < 300:
            continue
        seen_bodies[body_key] = ts.timestamp()

        incidents.append({
            "id":         item.findtext("code") or "",
            "ts":         ts.isoformat(),
            "discipline": discipline,
            "priority":   _extract_priority(message),
            "message":    message,
            "age_min":    max(0, round(age_sec / 60)),
        })

    # Sort by timestamp descending (most recent first)
    incidents.sort(key=lambda x: x["ts"], reverse=True)
    return incidents


# ── Cache ──────────────────────────────────────────────────────────────────────

_cache: dict[str, Any] | None = None
_cache_ts: float = 0.0
_cached_region: str = ""


# ── Endpoint ──────────────────────────────────────────────────────────────────

@router.get("/p2000")
async def get_p2000() -> dict:
    global _cache, _cache_ts, _cached_region

    cfg = wall_config.get_config()
    loc = cfg.get("location", {})
    lat = loc.get("lat")
    lon = loc.get("lon")

    if not lat or not lon:
        raise HTTPException(status_code=503, detail="P2000: location (lat/lon) not configured")

    region = region_for_coords(float(lat), float(lon))

    now = time.monotonic()
    if _cache is not None and region == _cached_region and (now - _cache_ts) < settings.p2000_cache_ttl:
        return _cache

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(FEED_URL)
            resp.raise_for_status()
    except httpx.HTTPError as exc:
        logger.error("P2000 feed fetch failed: %s", exc)
        cache_registry.update("p2000", ok=False)
        if _cache is not None:
            return _cache
        raise HTTPException(status_code=502, detail="P2000 feed unavailable")

    incidents = _parse_feed(resp.content, region)

    result: dict[str, Any] = {
        "region":    region,
        "incidents": incidents,
    }
    _cache = result
    _cache_ts = now
    _cached_region = region
    cache_registry.update("p2000", ok=True)
    return result
