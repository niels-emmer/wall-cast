"""
P2000 Dutch emergency services alerts.

Variables:
  p2000.new_incident — fires once per new incident whose discipline is in the configured list

Source: /api/p2000
Deduplication: fires at most once per unique incident ID (IDs are stable and globally unique).
"""

import state
from rules import Notification

_DISCIPLINE_TAGS: dict[str, list[str]] = {
    "Brandweerdiensten": ["fire_engine"],
    "Ambulancediensten": ["ambulance"],
    "Politiediensten":   ["police_car"],
}


def check(rule: dict, p2000_data: dict) -> list[Notification]:
    condition = rule.get("condition", {})
    variable  = condition.get("variable", "")

    if variable != "p2000.new_incident":
        return []

    raw_val            = condition.get("value") or ["Brandweerdiensten"]
    notify_disciplines = set(raw_val) if isinstance(raw_val, list) else {raw_val}

    notifications: list[Notification] = []
    for incident in p2000_data.get("incidents", []):
        discipline = incident.get("discipline", "")
        if discipline not in notify_disciplines:
            continue
        incident_id = incident.get("id", "")
        if not incident_id:
            continue
        key = f"p2000.incident:{incident_id}"
        if state.has_fired(key):
            continue
        message_text = incident.get("message", "")
        age_min      = incident.get("age_min")
        age_str      = f" ({age_min} min ago)" if age_min is not None else ""
        tags         = _DISCIPLINE_TAGS.get(discipline, ["rotating_light"])
        notifications.append(Notification(
            title=f"P2000 — {discipline}",
            message=f"{message_text}{age_str}",
            state_key=key,
            priority="default",
            tags=tags,
        ))

    return notifications
