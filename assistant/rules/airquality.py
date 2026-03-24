"""
Air quality and pollen alerts.

Variables:
  airquality.aqi          — current European AQI index (numeric, 0–500+)
  airquality.pollen_birch — today's birch pollen level (enum: none/low/moderate/high/very_high)
  airquality.pollen_grass — today's grass pollen level (enum: none/low/moderate/high/very_high)

Source: /api/airquality (open-meteo air-quality API).
Deduplication: fires at most once per day per rule.
"""

from datetime import datetime, timezone

import state
from rules import Notification

_AQI_LABEL: dict[str, str] = {
    "good":            "Good",
    "fair":            "Fair",
    "moderate":        "Moderate",
    "poor":            "Poor",
    "very_poor":       "Very Poor",
    "extremely_poor":  "Extremely Poor",
}


def _cmp(value: float, operator: str, threshold: float) -> bool:
    return {
        ">=": value >= threshold,
        "<=": value <= threshold,
        ">":  value >  threshold,
        "<":  value <  threshold,
        "==": value == threshold,
    }.get(operator, False)


def _today_pollen_level(pollen_list: list[dict], species: str) -> str | None:
    """Return today's pollen level string for the given species, or None."""
    for entry in pollen_list:
        if entry.get("species") == species:
            days = entry.get("days", [])
            if days:
                return days[0].get("level")
    return None


def check(rule: dict, aq_data: dict) -> list[Notification]:
    condition = rule.get("condition", {})
    variable  = condition.get("variable", "")
    operator  = condition.get("operator", ">=")
    today     = datetime.now(timezone.utc).date().isoformat()

    # ── airquality.aqi ─────────────────────────────────────────────────────────
    if variable == "airquality.aqi":
        aqi = aq_data.get("current_aqi")
        if aqi is None:
            return []
        try:
            threshold = float(condition.get("value", 60))
        except (TypeError, ValueError):
            return []
        if not _cmp(float(aqi), operator, threshold):
            return []
        key = f"airquality.aqi:{operator}:{threshold}:{today}"
        if state.has_fired(key):
            return []
        state.mark_fired(key)
        aqi_label = _AQI_LABEL.get(aq_data.get("aqi_level", ""), "")
        label_str = f" — {aqi_label}" if aqi_label else ""
        return [Notification(
            title="Air quality alert",
            message=f"Current air quality index is {aqi}{label_str}.",
            priority="default",
            tags=["cloud"],
        )]

    # ── airquality.pollen_birch / airquality.pollen_grass ─────────────────────
    pollen_species = None
    if variable == "airquality.pollen_birch":
        pollen_species = "birch"
    elif variable == "airquality.pollen_grass":
        pollen_species = "grass"

    if pollen_species:
        pollen_list = aq_data.get("pollen", [])
        level = _today_pollen_level(pollen_list, pollen_species)
        if level is None:
            return []
        # condition.value may be a list ["high", "very_high"] or a single string
        raw_val       = condition.get("value") or ["high", "very_high"]
        notify_levels = set(raw_val) if isinstance(raw_val, list) else {raw_val}
        if level not in notify_levels:
            return []
        key = f"airquality.{pollen_species}_pollen:{level}:{today}"
        if state.has_fired(key):
            return []
        state.mark_fired(key)
        return [Notification(
            title=f"Pollen alert — {pollen_species.capitalize()}",
            message=f"Today's {pollen_species} pollen level is {level.replace('_', ' ')}.",
            priority="default",
            tags=["seedling"],
        )]

    return []
