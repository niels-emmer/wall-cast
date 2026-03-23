"""
Garbage pickup reminders.

Fires once per collection type per pickup date when the collection is within
the threshold hours (rule.condition.value; default 18 h → next-day alert).
"""

import state
from rules import Notification

_LABEL = {
    "gft":       "GFT (organic waste)",
    "pmd":       "PMD (plastic/metal/cartons)",
    "restafval": "General waste",
    "papier":    "Paper",
}


def check(rule: dict, data: dict) -> list[Notification]:
    hours_before = int(rule.get("condition", {}).get("value", 18))
    # 18 h → notify when pickup is tomorrow (days_until == 1)
    # ≤ 12 h → notify same-day only (days_until == 0)
    threshold_days = 1 if hours_before > 12 else 0

    notifications: list[Notification] = []
    for col in data.get("collections", []):
        days_until = col.get("days_until", 99)
        col_type   = col.get("type", "unknown")
        col_date   = col.get("date", "")

        if days_until > threshold_days:
            continue

        key = f"garbage:{col_type}:{col_date}"
        if state.has_fired(key):
            continue

        label = _LABEL.get(col_type, col_type.capitalize())
        when  = "today" if days_until == 0 else "tomorrow"

        notifications.append(Notification(
            title="Garbage collection",
            message=f"{label} is being collected {when} ({col_date}).",
            priority="default",
            tags=["wastebasket"],
        ))
        state.mark_fired(key)

    return notifications
