"""
Polestar car alerts.

Variables:
  polestar.range_km        — estimated range remaining (km)
  polestar.is_plugged_in   — whether the car is connected to a charger (boolean)
  polestar.battery_pct     — state of charge (%)
  polestar.days_to_service — days until next scheduled service (numeric)
  polestar.service_warning — any active service/fluid warning flag (boolean)

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
        soc     = data.get("soc")
        soc_str = f" ({soc}% battery)" if soc is not None else ""
        return [Notification(
            title="Polestar — low range",
            message=f"Estimated range is {range_km} km{soc_str}.",
            state_key=key,
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
        range_km = data.get("range_km")
        range_str = f" (~{range_km} km range)" if range_km is not None else ""
        return [Notification(
            title="Polestar — battery",
            message=f"Battery at {soc}%{range_str}.",
            state_key=key,
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
        status = "plugged in" if is_plugged else "not plugged in"
        return [Notification(
            title="Polestar — charging",
            message=f"Car is {status} (connection: {conn or 'none'}).",
            state_key=key,
            priority="default",
            tags=["electric_plug"],
        )]

    # ── polestar.days_to_service ───────────────────────────────────────────────
    if variable == "polestar.days_to_service":
        days = data.get("days_to_service")
        if days is None:
            return []
        try:
            threshold = float(condition.get("value", 30))
        except (TypeError, ValueError):
            return []
        if not _cmp(float(days), operator, threshold):
            return []
        key = f"polestar.days_to_service:{operator}:{threshold}:{today}"
        if state.has_fired(key):
            return []
        dist = data.get("distance_to_service_km")
        dist_str = f" or {dist} km" if dist is not None else ""
        return [Notification(
            title="Polestar — service due",
            message=f"Service due in {days} days{dist_str}.",
            state_key=key,
            priority="default",
            tags=["wrench"],
        )]

    # ── polestar.service_warning ───────────────────────────────────────────────
    if variable == "polestar.service_warning":
        _no_warn = ("NO_WARNING", "UNSPECIFIED")
        active: list[str] = []
        for field, label in (
            ("service_warning",     "service"),
            ("brake_fluid_warning", "brake fluid"),
            ("coolant_warning",     "coolant"),
            ("oil_warning",         "oil"),
        ):
            val = data.get(field)
            if val and val not in _no_warn:
                active.append(label)
        has_warning = len(active) > 0
        raw_val     = condition.get("value", True)
        if isinstance(raw_val, str):
            want_warning = raw_val.lower() in ("true", "1", "yes")
        else:
            want_warning = bool(raw_val)
        if has_warning != want_warning:
            return []
        key = f"polestar.service_warning:{today}"
        if state.has_fired(key):
            return []
        detail = ", ".join(active) if active else "unknown"
        return [Notification(
            title="Polestar — service warning",
            message=f"Active warnings: {detail}.",
            state_key=key,
            priority="default",
            tags=["warning", "wrench"],
        )]

    return []
