"""
Weather alerts (shared).

Variables:
  weather.warning_level — MeteoAlarm severity (enum: geel/oranje/rood)
  weather.temperature   — current outdoor temperature (°C)
  weather.wind_speed    — current wind speed (km/h)
"""

from datetime import datetime, timezone

import state
from rules import Notification

_PRIORITY = {"rood": "urgent", "oranje": "high"}
_TAGS     = {"rood": ["rotating_light"], "oranje": ["warning"]}


def check(rule: dict, warnings_data: dict) -> list[Notification]:
    notify_levels = set(rule.get("condition", {}).get("value") or ["oranje", "rood"])
    notifications: list[Notification] = []

    for w in warnings_data.get("warnings", []):
        level = (w.get("level") or "").lower()
        if level not in notify_levels:
            continue

        phenomenon = w.get("phenomenon", "Weather event")
        valid_from = w.get("valid_from", "")
        key = f"warning:{phenomenon}:{valid_from}"
        if state.has_fired(key):
            continue

        regions     = ", ".join(w.get("regions", []))
        valid_until = w.get("valid_until", "")
        description = w.get("description", "")

        msg = f"{phenomenon} warning ({level}) for {regions}."
        if description:
            msg += f" {description}"
        if valid_until:
            msg += f" Until {valid_until[:16].replace('T', ' ')}."

        notifications.append(Notification(
            title=f"Weather: {level.capitalize()} — {phenomenon}",
            message=msg,
            state_key=key,
            priority=_PRIORITY.get(level, "default"),
            tags=_TAGS.get(level, ["cloud"]),
        ))

    return notifications


def check_current(rule: dict, weather_data: dict) -> list[Notification]:
    """Handle weather.temperature and weather.wind_speed rules."""
    condition = rule.get("condition", {})
    variable  = condition.get("variable", "")
    operator  = condition.get("operator", ">=")
    try:
        threshold = float(condition.get("value", 0))
    except (TypeError, ValueError):
        return []

    cw = weather_data.get("current_weather", {})
    if variable == "weather.temperature":
        value = cw.get("temperature")
        name  = "temperature"
        unit  = "°C"
        tags  = ["thermometer"]
    elif variable == "weather.wind_speed":
        value = cw.get("windspeed")  # open-meteo uses "windspeed" (no underscore)
        name  = "wind speed"
        unit  = " km/h"
        tags  = ["wind_face"]
    else:
        return []

    if value is None:
        return []

    ops: dict[str, bool] = {
        ">=": float(value) >= threshold,
        "<=": float(value) <= threshold,
        ">":  float(value) >  threshold,
        "<":  float(value) <  threshold,
        "==": float(value) == threshold,
    }
    if not ops.get(operator, False):
        return []

    hour = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")
    key  = f"{variable}:{operator}:{threshold}:{hour}"
    if state.has_fired(key):
        return []

    return [Notification(
        title=f"Weather: {name.capitalize()}",
        message=f"Current {name} is {value}{unit} ({operator} {threshold}{unit}).",
        state_key=key,
        priority="default",
        tags=tags,
    )]
