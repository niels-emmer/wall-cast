"""
Rule engine — evaluates configured rules against live data.

Each rule has a condition (variable, operator, value, unit).
This module dispatches each rule to the correct handler based on its variable,
fetches the required API data (with caching), and returns notifications.
"""

import httpx

from rules import Notification
from rules import bus as rule_bus
from rules import calendar as rule_calendar
from rules import garbage as rule_garbage
from rules import traffic as rule_traffic
from rules import weather as rule_weather

# Variables that need a person context to evaluate
REQUIRES_PERSON: dict[str, bool] = {
    "garbage.hours_until_pickup":   False,
    "weather.warning_level":        False,
    "polestar.battery_pct":         False,
    "bus.delay_minutes":            True,
    "bus.cancelled":                True,
    "traffic.delay_pct":            True,
    "traffic.delay_minutes":        True,
    "calendar.minutes_until_event": True,
}


def _cached_fetch(
    client: httpx.Client,
    data_cache: dict,
    url: str,
    params: dict | None = None,
) -> dict:
    """Fetch url with params, caching the result in data_cache."""
    cache_key = url + (
        "?" + "&".join(f"{k}={v}" for k, v in sorted(str(x) for x in (params or {}).items()))
        if params else ""
    )
    if cache_key not in data_cache:
        try:
            r = client.get(url, params=params, timeout=15.0)
            r.raise_for_status()
            data_cache[cache_key] = r.json()
        except Exception as exc:
            print(f"[assistant] Fetch error {url}: {exc}", flush=True)
            data_cache[cache_key] = {}
    return data_cache[cache_key]


def run_rule(
    rule: dict,
    person: dict | None,
    client: httpx.Client,
    data_cache: dict,
    cal_data_by_person: dict,
    backend_url: str,
    garbage_cfg: dict,
) -> list[Notification]:
    """Evaluate a single rule and return any notifications to send."""
    variable = rule.get("condition", {}).get("variable", "")

    # ── Garbage ───────────────────────────────────────────────────────────────
    if variable == "garbage.hours_until_pickup":
        if not (garbage_cfg.get("postcode") and garbage_cfg.get("huisnummer")):
            return []
        data = _cached_fetch(client, data_cache, f"{backend_url}/api/garbage", {
            "postcode":   garbage_cfg["postcode"],
            "huisnummer": str(garbage_cfg["huisnummer"]),
            "days_ahead": 3,
        })
        return rule_garbage.check(rule, data)

    # ── Weather warnings ──────────────────────────────────────────────────────
    if variable == "weather.warning_level":
        data = _cached_fetch(client, data_cache, f"{backend_url}/api/warnings")
        return rule_weather.check(rule, data)

    # ── Calendar reminders ────────────────────────────────────────────────────
    if variable == "calendar.minutes_until_event":
        if not person:
            return []
        cal_data = cal_data_by_person.get(person["id"], {})
        return rule_calendar.check(rule, person, cal_data)

    # ── Bus delays ────────────────────────────────────────────────────────────
    if variable in ("bus.delay_minutes", "bus.cancelled"):
        if not person:
            return []
        bus_cfg_p = person.get("bus") or {}
        if not (bus_cfg_p.get("stop_city") and bus_cfg_p.get("stop_name")):
            return []
        bus_data = _cached_fetch(client, data_cache, f"{backend_url}/api/bus", {
            "stop_city": bus_cfg_p["stop_city"],
            "stop_name": bus_cfg_p["stop_name"],
        })
        cal_data = cal_data_by_person.get(person["id"], {})
        return rule_bus.check(rule, person, bus_data, cal_data)

    # ── Traffic / commute ─────────────────────────────────────────────────────
    if variable in ("traffic.delay_pct", "traffic.delay_minutes"):
        if not person:
            return []
        traf_cfg_p = person.get("traffic") or {}
        if not (traf_cfg_p.get("home_address") and traf_cfg_p.get("work_address")):
            return []
        params: dict = {
            "home": traf_cfg_p["home_address"],
            "work": traf_cfg_p["work_address"],
        }
        if traf_cfg_p.get("route_roads"):
            params["route_roads"] = traf_cfg_p["route_roads"]
        traf_data = _cached_fetch(client, data_cache, f"{backend_url}/api/traffic", params)
        return rule_traffic.check(rule, person, traf_data)

    print(f"[assistant] Unknown variable '{variable}' in rule '{rule.get('id', '?')}' — skipping", flush=True)
    return []
