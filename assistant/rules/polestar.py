"""
Polestar car alerts.

Variables:
  polestar.range_km        — estimated range remaining (km)
  polestar.is_plugged_in   — whether the car is connected to a charger (boolean)
  polestar.battery_pct     — state of charge (%)
  polestar.days_to_service — days until next scheduled service (numeric)
  polestar.service_warning — any active service/fluid warning flag (boolean)
  polestar.is_locked       — whether the car is locked (boolean)
  polestar.any_door_open   — whether any door is open (boolean)
  polestar.any_tyre_warning — whether any tyre pressure warning is active (boolean)
  polestar.any_light_failure — whether any exterior bulb has failed (boolean)
  polestar.low_12v_battery — whether the 12V battery warning is active (boolean)

Source: /api/polestar (unofficial-polestar-api / gRPC).
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
            ("service_warning",      "service"),
            ("brake_fluid_warning",  "brake fluid"),
            ("coolant_warning",      "coolant"),
            ("oil_warning",          "oil"),
            ("washer_fluid_warning", "washer fluid"),
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

    # ── polestar.is_locked ────────────────────────────────────────────────────
    if variable == "polestar.is_locked":
        is_locked = data.get("is_locked")
        if is_locked is None:
            return []
        raw_val = condition.get("value", False)
        if isinstance(raw_val, str):
            want_locked = raw_val.lower() in ("true", "1", "yes")
        else:
            want_locked = bool(raw_val)
        if bool(is_locked) != want_locked:
            return []
        key = f"polestar.is_locked:{want_locked}:{today}"
        if state.has_fired(key):
            return []
        status = "locked" if is_locked else "unlocked"
        return [Notification(
            title="Polestar — lock",
            message=f"Car is {status}.",
            state_key=key,
            priority="default",
            tags=["lock"],
        )]

    # ── polestar.any_door_open ────────────────────────────────────────────────
    if variable == "polestar.any_door_open":
        any_open = bool(data.get("any_door_open", False))
        raw_val  = condition.get("value", True)
        if isinstance(raw_val, str):
            want_open = raw_val.lower() in ("true", "1", "yes")
        else:
            want_open = bool(raw_val)
        if any_open != want_open:
            return []
        key = f"polestar.any_door_open:{today}"
        if state.has_fired(key):
            return []
        return [Notification(
            title="Polestar — door open",
            message="A car door is open.",
            state_key=key,
            priority="urgent",
            tags=["door", "warning"],
        )]

    # ── polestar.any_tyre_warning ─────────────────────────────────────────────
    if variable == "polestar.any_tyre_warning":
        tyres = data.get("tyre_warnings", {})
        has_warn = any(v is not None for v in tyres.values()) if isinstance(tyres, dict) else False
        raw_val  = condition.get("value", True)
        if isinstance(raw_val, str):
            want = raw_val.lower() in ("true", "1", "yes")
        else:
            want = bool(raw_val)
        if has_warn != want:
            return []
        key = f"polestar.any_tyre_warning:{today}"
        if state.has_fired(key):
            return []
        affected = [pos for pos, v in tyres.items() if v is not None] if isinstance(tyres, dict) else []
        detail = ", ".join(affected).upper() if affected else "unknown"
        return [Notification(
            title="Polestar — tyre pressure",
            message=f"Tyre pressure warning: {detail}.",
            state_key=key,
            priority="default",
            tags=["warning"],
        )]

    # ── polestar.any_light_failure ────────────────────────────────────────────
    if variable == "polestar.any_light_failure":
        has_failure = bool(data.get("any_light_failure", False))
        raw_val     = condition.get("value", True)
        if isinstance(raw_val, str):
            want = raw_val.lower() in ("true", "1", "yes")
        else:
            want = bool(raw_val)
        if has_failure != want:
            return []
        key = f"polestar.any_light_failure:{today}"
        if state.has_fired(key):
            return []
        return [Notification(
            title="Polestar — light failure",
            message="An exterior bulb has failed.",
            state_key=key,
            priority="default",
            tags=["bulb", "warning"],
        )]

    # ── polestar.low_12v_battery ──────────────────────────────────────────────
    if variable == "polestar.low_12v_battery":
        low = bool(data.get("low_12v_battery", False))
        raw_val = condition.get("value", True)
        if isinstance(raw_val, str):
            want = raw_val.lower() in ("true", "1", "yes")
        else:
            want = bool(raw_val)
        if low != want:
            return []
        key = f"polestar.low_12v_battery:{today}"
        if state.has_fired(key):
            return []
        return [Notification(
            title="Polestar — 12V battery",
            message="12V battery warning active.",
            state_key=key,
            priority="default",
            tags=["battery", "warning"],
        )]

    return []
