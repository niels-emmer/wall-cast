"""
Bus alerts (per person).

Variables:
  bus.delay_minutes          — delay on next departure; cross-correlated with calendar events
  bus.cancelled              — next departure is cancelled; cross-correlated with calendar events
  bus.minutes_until_departure — minutes until the next (non-cancelled) departure
"""

from datetime import datetime, timezone

import state
from rules import Notification
from rules.calendar import upcoming_events


def check_departure(
    rule: dict,
    person: dict,
    bus_data: dict,
) -> list[Notification]:
    """
    Notify when the next bus departs within `threshold` minutes.
    Fires once per departure slot per person.
    """
    person_id   = person["id"]
    person_name = person.get("name", person_id)
    condition   = rule.get("condition", {})
    operator    = condition.get("operator", "<=")
    try:
        threshold = float(condition.get("value", 10))
    except (TypeError, ValueError):
        return []

    ops: dict[str, bool] = {}  # filled per-departure below
    now      = datetime.now(timezone.utc)
    stop     = bus_data.get("stop", "")
    notifications: list[Notification] = []

    for dep in bus_data.get("departures", []):
        if dep.get("cancelled", False):
            continue
        dep_time_str = dep.get("time", "")
        try:
            dep_dt = datetime.fromisoformat(
                f"{now.date().isoformat()}T{dep_time_str}:00"
            ).astimezone(timezone.utc)
        except Exception:
            continue

        mins_until = (dep_dt - now).total_seconds() / 60
        if mins_until < 0:
            continue  # already departed

        ops = {
            ">=": mins_until >= threshold,
            "<=": mins_until <= threshold,
            ">":  mins_until >  threshold,
            "<":  mins_until <  threshold,
            "==": mins_until == threshold,
        }
        if not ops.get(operator, False):
            continue

        key = f"bus.departure:{person_id}:{now.date().isoformat()}:{dep_time_str}"
        if state.has_fired(key):
            continue

        line      = dep.get("line", "?")
        direction = dep.get("direction", "")
        delay_min = dep.get("delay_min") or 0
        delay_str = f" (+{delay_min} min)" if delay_min else ""

        notifications.append(Notification(
            title=f"Bus departing — {stop}",
            message=(
                f"{person_name}: line {line} ({direction}) departs at "
                f"{dep_time_str}{delay_str} — {int(mins_until)} min away."
            ),
            person_id=person_id,
            priority="default",
            tags=["bus"],
        ))
        state.mark_fired(key)
        break  # notify only about the next departure

    return notifications


def check(
    rule: dict,
    person: dict,
    bus_data: dict,
    calendar_data: dict,
) -> list[Notification]:
    person_id   = person["id"]
    person_name = person.get("name", person_id)

    condition = rule.get("condition", {})
    variable  = condition.get("variable", "bus.delay_minutes")
    delay_thr = int(condition.get("value", 5))

    # Skip entirely if no upcoming calendar events — person isn't travelling
    coming_events = upcoming_events(calendar_data, within_min=90)
    if not coming_events:
        return []

    now = datetime.now(timezone.utc)
    stop_name = bus_data.get("stop", "")
    notifications: list[Notification] = []

    for dep in bus_data.get("departures", []):
        cancelled = dep.get("cancelled", False)
        delay_min = dep.get("delay_min") or 0

        if variable == "bus.cancelled":
            is_bad = cancelled
        else:  # bus.delay_minutes
            is_bad = cancelled or delay_min >= delay_thr

        if not is_bad:
            continue

        dep_time_str = dep.get("time", "")
        try:
            dep_dt = datetime.fromisoformat(
                f"{now.date().isoformat()}T{dep_time_str}:00"
            ).astimezone(timezone.utc)
        except Exception:
            continue

        mins_until_bus = (dep_dt - now).total_seconds() / 60
        if not (0 < mins_until_bus <= 60):
            continue  # only warn about buses in the next hour

        first_event = coming_events[0]
        event_id    = (first_event.get("id") or first_event.get("title") or "")[:30]
        key = f"bus:{person_id}:{dep_time_str}:{event_id}"
        if state.has_fired(key):
            continue

        line      = dep.get("line", "?")
        direction = dep.get("direction", "")
        delay_lbl = "CANCELLED" if cancelled else f"+{delay_min} min late"

        event_title = first_event.get("title", "an event")
        event_time  = first_event.get("start_time", "")

        notifications.append(Notification(
            title=f"Bus delay — {stop_name}",
            message=(
                f"{person_name}: line {line} ({direction}) at {dep_time_str} is {delay_lbl}. "
                f"You have '{event_title}' at {event_time}."
            ),
            person_id=person_id,
            priority="high",
            tags=["bus", "warning"],
        ))
        state.mark_fired(key)

    return notifications
