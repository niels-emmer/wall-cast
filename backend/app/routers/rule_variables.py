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
]


@router.get("/admin/rule-variables")
async def get_rule_variables() -> list[dict]:
    """Return the catalogue of variables available for rule conditions."""
    return RULE_VARIABLES
