"""
Polestar car alerts.

Variables:
  polestar.range_km     — estimated range remaining (km)
  polestar.is_plugged_in — whether the car is connected to a charger (boolean)
  polestar.battery_pct  — state of charge (%)

Source: /api/polestar (pypolestar).
Deduplication: fires at most once per day per rule.
"""

from datetime import datetime, timezone

import state
from rules import Notification


def _cmp(value: float, operator: str, threshold: float) -> bool:
    return {
        ">=": value >= threshold,
        "<=": value <= threshold,
        ">":  value >  threshold,
        "<":  value <  threshold,
        "==": value == threshold,
    }.get(operator, False)


def check(rule: dict, data: dict) -> list[Notification]:
    condition = rule.get("condition", {})
    variable  = condition.get("variable", "")
    operator  = condition.get("operator", "<=")
    today     = datetime.now(timezone.utc).date().isoformat()

    # ── polestar.range_km ──────────────────────────────────────────────────────
    if variable == "polestar.range_km":
        range_km = data.get("range_km")
        if range_km is None:
            return []
        try:
            threshold = float(condition.get("value", 50))
        except (TypeError, ValueError):
            return []
        if not _cmp(float(range_km), operator, threshold):
            return []
        key = f"polestar.range_km:{operator}:{threshold}:{today}"
        if state.has_fired(key):
            return []
        state.mark_fired(key)
        soc     = data.get("soc")
        soc_str = f" ({soc}% battery)" if soc is not None else ""
        return [Notification(
            title="Polestar — low range",
            message=f"Estimated range is {range_km} km{soc_str}.",
            priority="default",
            tags=["electric_plug", "warning"],
        )]

    # ── polestar.battery_pct ──────────────────────────────────────────────────
    if variable == "polestar.battery_pct":
        soc = data.get("soc")
        if soc is None:
            return []
        try:
            threshold = float(condition.get("value", 20))
        except (TypeError, ValueError):
            return []
        if not _cmp(float(soc), operator, threshold):
            return []
        key = f"polestar.battery_pct:{operator}:{threshold}:{today}"
        if state.has_fired(key):
            return []
        state.mark_fired(key)
        range_km = data.get("range_km")
        range_str = f" (~{range_km} km range)" if range_km is not None else ""
        return [Notification(
            title="Polestar — battery",
            message=f"Battery at {soc}%{range_str}.",
            priority="default",
            tags=["electric_plug", "warning"],
        )]

    # ── polestar.is_plugged_in ─────────────────────────────────────────────────
    if variable == "polestar.is_plugged_in":
        conn       = data.get("charging_connection_status")
        is_plugged = conn not in (None, "DISCONNECTED")
        # rule value may arrive as bool true/false or string "true"/"false"
        raw_val    = condition.get("value", True)
        if isinstance(raw_val, str):
            want_plugged = raw_val.lower() in ("true", "1", "yes")
        else:
            want_plugged = bool(raw_val)
        if is_plugged != want_plugged:
            return []
        key = f"polestar.is_plugged_in:{want_plugged}:{today}"
        if state.has_fired(key):
            return []
        state.mark_fired(key)
        status = "plugged in" if is_plugged else "not plugged in"
        return [Notification(
            title="Polestar — charging",
            message=f"Car is {status} (connection: {conn or 'none'}).",
            priority="default",
            tags=["electric_plug"],
        )]

    return []
