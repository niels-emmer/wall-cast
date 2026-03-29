"""
Network / WAN status alerts.

Variables:
  network.wan_down — fires when WAN connection is down or external connectivity fails

Source: /api/network
Deduplication: fires at most once per hour (WAN outages may be brief; hourly key avoids
flooding while still re-alerting if the issue persists after recovery).

Note: If WAN is genuinely down, ntfy/Matrix notifications over the internet won't reach
remote recipients. This variable is most useful with a locally-reachable ntfy server.
"""

from datetime import datetime, timezone

import state
from rules import Notification


def check(rule: dict, net_data: dict) -> list[Notification]:
    condition = rule.get("condition", {})
    variable  = condition.get("variable", "")

    if variable != "network.wan_down":
        return []

    # wan_down is true when WAN reports "down" OR external connectivity probe fails
    wan         = net_data.get("wan") or {}
    conn        = net_data.get("connectivity") or {}
    wan_down    = wan.get("status") == "down"
    no_internet = conn.get("ok") is False

    is_down = wan_down or no_internet
    if not is_down:
        return []

    now  = datetime.now(timezone.utc)
    hour = now.strftime("%Y-%m-%dT%H")
    key  = f"network.wan_down:{hour}"
    if state.has_fired(key):
        return []

    if wan_down:
        detail = f"WAN status: {wan.get('status', 'unknown')}"
    else:
        latency = conn.get("latency_ms")
        detail  = f"Connectivity probe failed (latency: {latency} ms)" if latency else "Connectivity probe failed"

    return [Notification(
        title="Network — WAN down",
        message=f"Internet connection appears to be down. {detail}.",
        state_key=key,
        priority="high",
        tags=["warning"],
    )]
