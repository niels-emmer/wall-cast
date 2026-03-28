"""
Commute delay alerts (per person).

Fires at most once per day when commute delay meets the rule condition.
Variable: traffic.delay_pct (% above normal) or traffic.delay_minutes (absolute).
"""

from datetime import datetime, timezone

import state
from rules import Notification


def check(rule: dict, person: dict, traffic_data: dict) -> list[Notification]:
    person_id   = person["id"]
    person_name = person.get("name", person_id)

    condition = rule.get("condition", {})
    variable  = condition.get("variable", "traffic.delay_pct")
    threshold = int(condition.get("value", 25))

    travel = traffic_data.get("travel")
    if not travel:
        return []   # TomTom not configured or no route data

    delay_min  = travel.get("delay_min") or 0
    total_min  = travel.get("duration_min") or 0
    normal_min = total_min - delay_min

    if delay_min < 5 or normal_min <= 0:
        return []   # not meaningfully delayed

    delay_pct = (delay_min / normal_min) * 100

    if variable == "traffic.delay_minutes":
        if delay_min < threshold:
            return []
    else:  # traffic.delay_pct
        if delay_pct < threshold:
            return []

    today = datetime.now(timezone.utc).date().isoformat()
    key   = f"traffic:{person_id}:{today}"
    if state.has_fired(key):
        return []

    return [Notification(
        title="Traffic delay",
        message=(
            f"{person_name}: commute is {total_min} min today "
            f"({delay_min} min delay, +{int(delay_pct)}% above normal)."
        ),
        state_key=key,
        person_id=person_id,
        priority="default",
        tags=["car", "warning"],
    )]
