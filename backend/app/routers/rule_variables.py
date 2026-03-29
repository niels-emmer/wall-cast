"""
Variable catalogue for the rule builder.

GET /api/admin/rule-variables returns the list of variables that can be used
in rule conditions, along with their labels, allowed operators, units, and
whether they require a person context (personal rules only).

Variables are ordered by api_endpoint group so the frontend picker can render
them in logical sections. Within each group, more commonly used variables come
first.
"""

from fastapi import APIRouter

router = APIRouter()

RULE_VARIABLES: list[dict] = [
    # ── Weather (/api/weather) ────────────────────────────────────────────────
    {
        "id": "weather.temperature",
        "label": "Weather — current temperature (°C)",
        "api_endpoint": "/api/weather",
        "requires_person": False,
        "type": "number",
        "default_unit": "°C",
        "operators": ["<=", ">=", "<", ">", "=="],
    },
    {
        "id": "weather.wind_speed",
        "label": "Weather — current wind speed (km/h)",
        "api_endpoint": "/api/weather",
        "requires_person": False,
        "type": "number",
        "default_unit": "km/h",
        "operators": [">=", "<=", ">", "<", "=="],
    },
    # ── Warnings (/api/warnings) ──────────────────────────────────────────────
    {
        "id": "weather.warning_level",
        "label": "Warnings — KNMI weather warning level",
        "api_endpoint": "/api/warnings",
        "requires_person": False,
        "type": "enum",
        "default_unit": None,
        "operators": ["in"],
        "enum_values": ["geel", "oranje", "rood"],
    },
    # ── Rain (/api/rain) ──────────────────────────────────────────────────────
    {
        "id": "rain.mm_now",
        "label": "Rain — current intensity (mm/hour)",
        "api_endpoint": "/api/rain",
        "requires_person": False,
        "type": "number",
        "default_unit": "mm/h",
        "operators": [">=", "<=", ">", "<", "=="],
    },
    {
        "id": "rain.minutes_until_rain",
        "label": "Rain — minutes until rain starts (0 = raining now, 999 = none in 3 h)",
        "api_endpoint": "/api/rain",
        "requires_person": False,
        "type": "number",
        "default_unit": "min",
        "operators": ["<=", ">=", "<", ">", "=="],
    },
    # ── Air quality (/api/airquality) ─────────────────────────────────────────
    {
        "id": "airquality.aqi",
        "label": "Air quality — European AQI index (0–100+; good ≤20, fair ≤40, moderate ≤60, poor ≤80)",
        "api_endpoint": "/api/airquality",
        "requires_person": False,
        "type": "number",
        "default_unit": None,
        "operators": [">=", "<=", ">", "<", "=="],
    },
    {
        "id": "airquality.pm2_5",
        "label": "Air quality — PM2.5 fine particles (µg/m³; WHO: 15, EU: 25)",
        "api_endpoint": "/api/airquality",
        "requires_person": False,
        "type": "number",
        "default_unit": "µg/m³",
        "operators": [">=", "<=", ">", "<", "=="],
    },
    {
        "id": "airquality.pm10",
        "label": "Air quality — PM10 coarse particles (µg/m³; WHO: 45, EU: 50)",
        "api_endpoint": "/api/airquality",
        "requires_person": False,
        "type": "number",
        "default_unit": "µg/m³",
        "operators": [">=", "<=", ">", "<", "=="],
    },
    {
        "id": "airquality.pollen_birch",
        "label": "Air quality — birch pollen level",
        "api_endpoint": "/api/airquality",
        "requires_person": False,
        "type": "enum",
        "default_unit": None,
        "operators": ["in"],
        "enum_values": ["none", "low", "moderate", "high", "very_high"],
    },
    {
        "id": "airquality.pollen_grass",
        "label": "Air quality — grass pollen level",
        "api_endpoint": "/api/airquality",
        "requires_person": False,
        "type": "enum",
        "default_unit": None,
        "operators": ["in"],
        "enum_values": ["none", "low", "moderate", "high", "very_high"],
    },
    {
        "id": "airquality.pollen_alder",
        "label": "Air quality — alder pollen level",
        "api_endpoint": "/api/airquality",
        "requires_person": False,
        "type": "enum",
        "default_unit": None,
        "operators": ["in"],
        "enum_values": ["none", "low", "moderate", "high", "very_high"],
    },
    {
        "id": "airquality.pollen_mugwort",
        "label": "Air quality — mugwort pollen level",
        "api_endpoint": "/api/airquality",
        "requires_person": False,
        "type": "enum",
        "default_unit": None,
        "operators": ["in"],
        "enum_values": ["none", "low", "moderate", "high", "very_high"],
    },
    # ── Garbage (/api/garbage) ────────────────────────────────────────────────
    {
        "id": "garbage.hours_until_pickup",
        "label": "Garbage — hours until pickup",
        "api_endpoint": "/api/garbage",
        "requires_person": False,
        "type": "number",
        "default_unit": "h",
        "operators": ["<=", ">=", "<", ">", "=="],
    },
    # ── P2000 (/api/p2000) ────────────────────────────────────────────────────
    {
        "id": "p2000.new_incident",
        "label": "P2000 — new local emergency incident",
        "api_endpoint": "/api/p2000",
        "requires_person": False,
        "type": "enum",
        "default_unit": None,
        "operators": ["in"],
        "enum_values": ["Brandweerdiensten", "Ambulancediensten", "Politiediensten"],
    },
    # ── Market (/api/market) ──────────────────────────────────────────────────
    {
        "id": "market.fear_greed",
        "label": "Market — Fear & Greed index (0 = extreme fear, 100 = extreme greed)",
        "api_endpoint": "/api/market",
        "requires_person": False,
        "type": "number",
        "default_unit": None,
        "operators": ["<=", ">=", "<", ">", "=="],
    },
    # ── Network (/api/network) ────────────────────────────────────────────────
    {
        "id": "network.wan_down",
        "label": "Network — WAN / internet connection down",
        "api_endpoint": "/api/network",
        "requires_person": False,
        "type": "boolean",
        "default_unit": None,
        "operators": ["=="],
    },
    # ── Polestar (/api/polestar) ──────────────────────────────────────────────
    {
        "id": "polestar.battery_pct",
        "label": "Polestar — battery level (%)",
        "api_endpoint": "/api/polestar",
        "requires_person": False,
        "type": "number",
        "default_unit": "%",
        "operators": ["<=", ">=", "<", ">", "=="],
    },
    {
        "id": "polestar.range_km",
        "label": "Polestar — estimated range (km)",
        "api_endpoint": "/api/polestar",
        "requires_person": False,
        "type": "number",
        "default_unit": "km",
        "operators": ["<=", ">=", "<", ">", "=="],
    },
    {
        "id": "polestar.is_plugged_in",
        "label": "Polestar — is plugged in",
        "api_endpoint": "/api/polestar",
        "requires_person": False,
        "type": "boolean",
        "default_unit": None,
        "operators": ["=="],
    },
    {
        "id": "polestar.days_to_service",
        "label": "Polestar — days until next service",
        "api_endpoint": "/api/polestar",
        "requires_person": False,
        "type": "number",
        "default_unit": "days",
        "operators": ["<=", ">=", "<", ">", "=="],
    },
    {
        "id": "polestar.service_warning",
        "label": "Polestar — active service / fluid warning",
        "api_endpoint": "/api/polestar",
        "requires_person": False,
        "type": "boolean",
        "default_unit": None,
        "operators": ["=="],
    },
    # ── Calendar (/api/calendar) — requires person ────────────────────────────
    {
        "id": "calendar.minutes_until_event",
        "label": "Calendar — minutes until next event",
        "api_endpoint": "/api/calendar",
        "requires_person": True,
        "type": "number",
        "default_unit": "min",
        "operators": ["<=", ">=", "<", ">", "=="],
    },
    # ── Traffic (/api/traffic) — requires person ──────────────────────────────
    {
        "id": "traffic.delay_pct",
        "label": "Traffic — delay above normal (%)",
        "api_endpoint": "/api/traffic",
        "requires_person": True,
        "type": "number",
        "default_unit": "%",
        "operators": [">=", "<=", ">", "<", "=="],
    },
    {
        "id": "traffic.delay_minutes",
        "label": "Traffic — delay (minutes)",
        "api_endpoint": "/api/traffic",
        "requires_person": True,
        "type": "number",
        "default_unit": "min",
        "operators": [">=", "<=", ">", "<", "=="],
    },
    # ── Bus (/api/bus) — requires person ─────────────────────────────────────
    {
        "id": "bus.minutes_until_departure",
        "label": "Bus — minutes until next departure",
        "api_endpoint": "/api/bus",
        "requires_person": True,
        "type": "number",
        "default_unit": "min",
        "operators": ["<=", ">=", "<", ">", "=="],
    },
    {
        "id": "bus.delay_minutes",
        "label": "Bus — delay (minutes)",
        "api_endpoint": "/api/bus",
        "requires_person": True,
        "type": "number",
        "default_unit": "min",
        "operators": [">=", "<=", ">", "<", "=="],
    },
    {
        "id": "bus.cancelled",
        "label": "Bus — cancelled",
        "api_endpoint": "/api/bus",
        "requires_person": True,
        "type": "boolean",
        "default_unit": None,
        "operators": ["=="],
    },
]


@router.get("/admin/rule-variables")
async def get_rule_variables() -> list[dict]:
    """Return the catalogue of variables available for rule conditions."""
    return RULE_VARIABLES
