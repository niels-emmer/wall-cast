"""
Calendar event reminders (per person).

Fires rule.condition.value minutes before any timed event (default 30 min).
All-day events are skipped — they don't have a meaningful start time.
"""

from datetime import datetime, timezone

import state
from rules import Notification


def parse_event_dt(event: dict) -> datetime | None:
    """Return a UTC-aware datetime for the event's start, or None if not applicable."""
    if event.get("all_day"):
        return None
    d = event.get("date", "")
    t = event.get("start_time", "")
    if not d or not t:
        return None
    try:
        return datetime.fromisoformat(f"{d}T{t}:00").astimezone(timezone.utc)
    except Exception:
        return None


def _all_events(calendar_data: dict) -> list[dict]:
    events = list(calendar_data.get("today", []))
    for day in calendar_data.get("week", []):
        events.extend(day.get("events", []))
    return events


def check(rule: dict, person: dict, calendar_data: dict) -> list[Notification]:
    person_id    = person["id"]
    person_name  = person.get("name", person_id)
    reminder_min = int(rule.get("condition", {}).get("value", 30))

    now = datetime.now(timezone.utc)
    notifications: list[Notification] = []

    for event in _all_events(calendar_data):
        event_dt = parse_event_dt(event)
        if event_dt is None:
            continue

        minutes_until = (event_dt - now).total_seconds() / 60
        if not (0 <= minutes_until <= reminder_min):
            continue

        event_id = (event.get("id") or event.get("title") or "")[:40]
        key = f"cal:{person_id}:{event_id}:{reminder_min}"
        if state.has_fired(key):
            continue

        title_str = event.get("title", "Event")
        start_str = event.get("start_time", "")
        notifications.append(Notification(
            title=f"Reminder: {title_str}",
            message=f"{person_name}, '{title_str}' starts at {start_str} (in ~{int(minutes_until)} min).",
            person_id=person_id,
            priority="high",
            tags=["calendar"],
        ))
        state.mark_fired(key)

    return notifications


def upcoming_events(calendar_data: dict, within_min: int = 90) -> list[dict]:
    """Return timed events starting within the next `within_min` minutes."""
    now = datetime.now(timezone.utc)
    result = []
    for event in _all_events(calendar_data):
        dt = parse_event_dt(event)
        if dt is None:
            continue
        mins = (dt - now).total_seconds() / 60
        if 0 < mins <= within_min:
            result.append(event)
    return result
