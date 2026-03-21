"""
KNMI weather warnings backend.

Fetches active warnings from the KNMI CDN XML feed:
  https://cdn.knmi.nl/knmi/map/page/weer/actueel-weer/waarschuwingen_actueel.xml

XML structure: <waarschuwingen> → <regio naam="..."> → <waarschuwing>
Each warning has: kleur (geel/oranje/rood), verschijnsel (phenomenon),
geldend_van / geldend_tot (validity window), omschrijving (description).

Warnings with the same level + phenomenon + description are grouped and
their regions are aggregated. Sorted by severity: rood → oranje → geel.

Returns empty list when no warnings are active — never raises 502.
Cache TTL: 15 minutes.
"""

import logging
import time
import xml.etree.ElementTree as ET

import httpx
from fastapi import APIRouter

logger = logging.getLogger(__name__)
router = APIRouter(tags=["warnings"])

_cache: list[dict] = []
_cache_ts: float = 0.0
_CACHE_TTL = 15 * 60  # 15 minutes

KNMI_WARNINGS_URL = (
    "https://cdn.knmi.nl/knmi/map/page/weer/actueel-weer/waarschuwingen_actueel.xml"
)

_LEVEL_ORDER = {"rood": 0, "oranje": 1, "geel": 2}


def _text(el: ET.Element, *tags: str) -> str:
    """Return first non-empty text value found in element children or attributes."""
    for tag in tags:
        child = el.find(tag)
        if child is not None and child.text:
            return child.text.strip()
    for tag in tags:
        val = el.get(tag, "")
        if val:
            return val.strip()
    return ""


def _extract_warning(el: ET.Element, region_name: str) -> dict:
    """Extract fields from a <waarschuwing> element."""
    level = _text(el, "kleur", "color", "code", "kleurcode").lower()
    phenomenon = _text(el, "verschijnsel", "phenomenon", "type")
    valid_from = _text(el, "geldend_van", "geldig_van", "van", "validFrom")
    valid_until = _text(el, "geldend_tot", "geldig_tot", "tot", "validTo")
    description = _text(el, "omschrijving", "tekst", "description", "samenvatting")

    return {
        "level": level,
        "phenomenon": phenomenon,
        "region": region_name,
        "valid_from": valid_from,
        "valid_until": valid_until,
        "description": description,
    }


def _parse_warnings(xml_text: str) -> list[dict]:
    """Parse KNMI warnings XML into a structured, deduplicated list.

    Handles the standard nested structure:
      <waarschuwingen>
        <regio naam="Groningen">
          <waarschuwing>...</waarschuwing>
        </regio>
        ...
      </waarschuwingen>

    Groups warnings by (level, phenomenon, description) and aggregates regions.
    Sorted by severity: rood → oranje → geel.
    """
    try:
        root = ET.fromstring(xml_text)
    except ET.ParseError as exc:
        logger.error("KNMI XML parse error: %s", exc)
        return []

    raw: list[dict] = []

    # Standard nested structure: root → <regio naam="..."> → <waarschuwing>
    for regio_el in root.findall(".//regio"):
        region_name = regio_el.get("naam", regio_el.get("name", ""))
        for warn_el in regio_el.findall("waarschuwing"):
            raw.append(_extract_warning(warn_el, region_name))

    # Flat fallback: root → <waarschuwing regio="..."> (some older formats)
    if not raw:
        for warn_el in root.findall("waarschuwing"):
            region_name = (
                warn_el.get("regio", "")
                or warn_el.get("region", "")
                or (_text(warn_el, "regio") or "")
            )
            raw.append(_extract_warning(warn_el, region_name))

    # Filter out entries with no recognised level (e.g. "geen" / empty)
    valid_levels = {"geel", "oranje", "rood"}
    raw = [w for w in raw if w["level"] in valid_levels]

    if not raw:
        logger.info("KNMI warnings: no active warnings")
        return []

    # Group by (level, phenomenon, description) → aggregate regions
    groups: dict[tuple, dict] = {}
    for w in raw:
        key = (w["level"], w["phenomenon"], w["description"])
        if key not in groups:
            groups[key] = {
                "level": w["level"],
                "phenomenon": w["phenomenon"],
                "regions": [],
                "valid_from": w["valid_from"],
                "valid_until": w["valid_until"],
                "description": w["description"],
            }
        if w["region"] and w["region"] not in groups[key]["regions"]:
            groups[key]["regions"].append(w["region"])

    result = list(groups.values())
    result.sort(key=lambda w: _LEVEL_ORDER.get(w["level"], 9))
    logger.info("KNMI warnings: %d active warning(s)", len(result))
    return result


@router.get("/warnings")
async def get_warnings() -> dict:
    global _cache, _cache_ts

    if _cache_ts and (time.monotonic() - _cache_ts) < _CACHE_TTL:
        return {"warnings": _cache}

    try:
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(KNMI_WARNINGS_URL)
            resp.raise_for_status()
            warnings = _parse_warnings(resp.text)
    except Exception as exc:
        logger.error("KNMI warnings fetch error: %s", exc)
        # Serve stale cache rather than erroring — display should stay stable
        return {"warnings": _cache}

    _cache = warnings
    _cache_ts = time.monotonic()
    return {"warnings": warnings}
