"""
Weather warning alerts (shared).

Fires for warning levels in rule.condition.value (default: ["oranje", "rood"]).
"""

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
            priority=_PRIORITY.get(level, "default"),
            tags=_TAGS.get(level, ["cloud"]),
        ))
        state.mark_fired(key)

    return notifications
