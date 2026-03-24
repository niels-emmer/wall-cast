"""
Rain alerts — current precipitation and time until rain.

Variables:
  rain.mm_now             — current precipitation intensity (mm/hour)
  rain.minutes_until_rain — minutes until rain starts (0 = raining now, 999 = no rain in 3 h window)

Source: /api/rain — open-meteo minutely_15, 12 × 15-min slots.
Deduplication: fires at most once per hour per rule.
"""

from datetime import datetime, timezone

import state
from rules import Notification

# mm/hour above which a slot is counted as "rain"
_RAIN_THRESHOLD_MM = 0.1


def _cmp(value: float, operator: str, threshold: float) -> bool:
    return {
        ">=": value >= threshold,
        "<=": value <= threshold,
        ">":  value >  threshold,
        "<":  value <  threshold,
        "==": value == threshold,
    }.get(operator, False)


def check(rule: dict, rain_data: dict) -> list[Notification]:
    condition = rule.get("condition", {})
    variable  = condition.get("variable", "")
    operator  = condition.get("operator", ">=")
    try:
        threshold = float(condition.get("value", 0))
    except (TypeError, ValueError):
        return []

    forecast = rain_data.get("forecast", [])
    if not forecast:
        return []

    hour = datetime.now(timezone.utc).strftime("%Y-%m-%dT%H")

    # ── rain.mm_now ────────────────────────────────────────────────────────────
    if variable == "rain.mm_now":
        mm_now = float(forecast[0].get("mm_per_hour", 0))
        if not _cmp(mm_now, operator, threshold):
            return []
        key = f"rain.mm_now:{operator}:{threshold}:{hour}"
        if state.has_fired(key):
            return []
        state.mark_fired(key)
        return [Notification(
            title="Rain alert",
            message=f"Current rainfall is {mm_now:.1f} mm/hour.",
            priority="default",
            tags=["rain_cloud"],
        )]

    # ── rain.minutes_until_rain ────────────────────────────────────────────────
    if variable == "rain.minutes_until_rain":
        mins_until = 999
        for i, slot in enumerate(forecast):
            if float(slot.get("mm_per_hour", 0)) >= _RAIN_THRESHOLD_MM:
                mins_until = i * 15
                break
        if not _cmp(float(mins_until), operator, threshold):
            return []
        key = f"rain.minutes_until_rain:{operator}:{threshold}:{hour}"
        if state.has_fired(key):
            return []
        state.mark_fired(key)
        if mins_until == 0:
            msg = "It is raining now."
        elif mins_until >= 999:
            msg = "No rain expected in the next 3 hours."
        else:
            msg = f"Rain expected in {mins_until} minutes."
        return [Notification(
            title="Rain forecast",
            message=msg,
            priority="default",
            tags=["rain_cloud"],
        )]

    return []
