"""
Bus delay alerts — cross-correlated with calendar events (per person).

Only fires when the person has an upcoming calendar event (within 90 min)
AND their next bus departure is significantly delayed or cancelled.
This avoids spamming delays on days the person isn't travelling.
"""

from datetime import datetime, timezone

import state
from rules import Notification
from rules.calendar import upcoming_events, parse_event_dt


def check(
    person: dict,
    bus_data: dict,
    calendar_data: dict,
    rules_cfg: dict,
) -> list[Notification]:
    person_id   = person["id"]
    person_name = person.get("name", person_id)
    delay_thr   = int(rules_cfg.get("bus_delay_threshold_min", 5))

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
        is_bad    = cancelled or delay_min >= delay_thr
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

        # Key: person + bus departure + first upcoming event (avoids re-firing per cycle)
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
