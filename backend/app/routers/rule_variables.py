"""
Variable catalogue for the rule builder.

GET /api/admin/rule-variables returns the list of variables that can be used
in rule conditions, along with their labels, allowed operators, units, and
whether they require a person context (personal rules only).
"""

from fastapi import APIRouter

router = APIRouter()

RULE_VARIABLES: list[dict] = [
    {
        "id": "garbage.hours_until_pickup",
        "label": "Garbage — hours until pickup",
        "api_endpoint": "/api/garbage",
        "requires_person": False,
        "type": "number",
        "default_unit": "h",
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
    {
        "id": "calendar.minutes_until_event",
        "label": "Calendar — minutes until next event",
        "api_endpoint": "/api/calendar",
        "requires_person": True,
        "type": "number",
        "default_unit": "min",
        "operators": ["<=", ">=", "<", ">", "=="],
    },
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
        "id": "weather.warning_level",
        "label": "Weather warning level",
        "api_endpoint": "/api/warnings",
        "requires_person": False,
        "type": "enum",
        "default_unit": None,
        "operators": ["in"],
        "enum_values": ["geel", "oranje", "rood"],
    },
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
        "id": "airquality.aqi",
        "label": "Air quality — European AQI index (0–100+; good ≤20, fair ≤40, moderate ≤60, poor ≤80)",
        "api_endpoint": "/api/airquality",
        "requires_person": False,
        "type": "number",
        "default_unit": None,
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
        "id": "bus.minutes_until_departure",
        "label": "Bus — minutes until next departure",
        "api_endpoint": "/api/bus",
        "requires_person": True,
        "type": "number",
        "default_unit": "min",
        "operators": ["<=", ">=", "<", ">", "=="],
    },
]


@router.get("/admin/rule-variables")
async def get_rule_variables() -> list[dict]:
    """Return the catalogue of variables available for rule conditions."""
    return RULE_VARIABLES
