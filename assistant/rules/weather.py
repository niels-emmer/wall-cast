"""
Weather warning alerts (shared).

Fires for rood (red) and oranje (orange) KNMI warnings via MeteoAlarm.
Geel (yellow) warnings are skipped by default — too frequent to be actionable.
"""

import state
from rules import Notification

_PRIORITY = {"rood": "urgent", "oranje": "high"}
_TAGS     = {"rood": ["rotating_light"], "oranje": ["warning"]}


def check(warnings_data: dict, rules_cfg: dict) -> list[Notification]:
    notify_levels = {"rood", "oranje"}
    notifications: list[Notification] = []

    for w in warnings_data.get("warnings", []):
        level = (w.get("level") or "").lower()
        if level not in notify_levels:
            continue

        phenomenon  = w.get("phenomenon", "Weather event")
        valid_from  = w.get("valid_from", "")
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
            until_str = valid_until[:16].replace("T", " ")
            msg += f" Until {until_str}."

        notifications.append(Notification(
            title=f"Weather: {level.capitalize()} — {phenomenon}",
            message=msg,
            person_id=None,
            priority=_PRIORITY.get(level, "default"),
            tags=_TAGS.get(level, ["cloud"]),
        ))
        state.mark_fired(key)

    return notifications
