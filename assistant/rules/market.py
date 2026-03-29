"""
Financial market alerts.

Variables:
  market.fear_greed — Crypto Fear & Greed index value (0–100)

Source: /api/market (alternative.me Fear & Greed index).
Deduplication: fires at most once per day per threshold condition.
"""

from datetime import datetime, timezone

import state
from rules import Notification


def _cmp(value: float, operator: str, threshold: float) -> bool:
    return {
        ">=": value >= threshold,
        "<=": value <= threshold,
        ">":  value >  threshold,
        "<":  value <  threshold,
        "==": value == threshold,
    }.get(operator, False)


def check(rule: dict, market_data: dict) -> list[Notification]:
    condition = rule.get("condition", {})
    variable  = condition.get("variable", "")

    if variable != "market.fear_greed":
        return []

    fg = market_data.get("fear_greed")
    if not fg:
        return []
    value = fg.get("value")
    if value is None:
        return []

    operator = condition.get("operator", "<=")
    try:
        threshold = float(condition.get("value", 20))
    except (TypeError, ValueError):
        return []

    if not _cmp(float(value), operator, threshold):
        return []

    today = datetime.now(timezone.utc).date().isoformat()
    key   = f"market.fear_greed:{operator}:{threshold}:{today}"
    if state.has_fired(key):
        return []

    classification = fg.get("classification", "")
    class_str      = f" ({classification})" if classification else ""
    tag = "chart_with_upwards_trend" if float(value) >= 50 else "chart_with_downwards_trend"

    return [Notification(
        title="Market — Fear & Greed",
        message=f"Fear & Greed index is {value}{class_str}.",
        state_key=key,
        priority="default",
        tags=[tag],
    )]
