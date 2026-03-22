"""
Commute delay alerts (per person).

Fires at most once per day when the calculated travel time exceeds
`traffic_delay_threshold_pct` percent above the undelayed baseline.
Requires TomTom API key to be set for the backend's travel time feature.
"""

from datetime import datetime, timezone

import state
from rules import Notification


def check(person: dict, traffic_data: dict, rules_cfg: dict) -> list[Notification]:
    person_id   = person["id"]
    person_name = person.get("name", person_id)
    threshold_pct = int(rules_cfg.get("traffic_delay_threshold_pct", 25))

    travel = traffic_data.get("travel")
    if not travel:
        return []   # TomTom not configured or no route data

    delay_min  = travel.get("delay_min") or 0
    total_min  = travel.get("duration_min") or 0
    normal_min = total_min - delay_min

    if delay_min < 5 or normal_min <= 0:
        return []   # not meaningfully delayed

    delay_pct = (delay_min / normal_min) * 100
    if delay_pct < threshold_pct:
        return []

    today = datetime.now(timezone.utc).date().isoformat()
    key   = f"traffic:{person_id}:{today}"
    if state.has_fired(key):
        return []

    state.mark_fired(key)
    return [Notification(
        title="Traffic delay",
        message=(
            f"{person_name}: commute is {total_min} min today "
            f"({delay_min} min delay, +{int(delay_pct)}% above normal)."
        ),
        person_id=person_id,
        priority="default",
        tags=["car", "warning"],
    )]
