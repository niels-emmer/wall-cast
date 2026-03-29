"""
Rule engine — evaluates configured rules against live data.

Each rule has one or more conditions (variable, operator, value, unit).
Multi-condition rules use condition_logic ('and' | 'or', default 'and').
Single-condition rules (or legacy rules with only a 'condition' key) use the
original per-domain handlers which generate rich notification messages.
Multi-condition rules evaluate each condition as a boolean, combine with AND/OR,
and fire a generic notification from the rule title if the result is True.

Legacy rules with only a 'condition' key are transparently normalised to a
one-element 'conditions' list.
"""

import time

import httpx

import state
from rules import Notification
from rules import airquality as rule_airquality
from rules import bus as rule_bus
from rules import calendar as rule_calendar
from rules import garbage as rule_garbage
from rules import market as rule_market
from rules import network as rule_network
from rules import p2000 as rule_p2000
from rules import polestar as rule_polestar
from rules import rain as rule_rain
from rules import traffic as rule_traffic
from rules import weather as rule_weather

# Variables that need a person context to evaluate
REQUIRES_PERSON: dict[str, bool] = {
    "garbage.hours_until_pickup":      False,
    "weather.warning_level":           False,
    "weather.warning_provinces":       False,
    "weather.temperature":             False,
    "weather.wind_speed":              False,
    "rain.mm_now":                     False,
    "rain.minutes_until_rain":         False,
    "polestar.battery_pct":            False,
    "polestar.range_km":               False,
    "polestar.is_plugged_in":          False,
    "airquality.aqi":                  False,
    "airquality.pollen_birch":         False,
    "airquality.pollen_grass":         False,
    "airquality.pollen_alder":         False,
    "airquality.pollen_mugwort":       False,
    "airquality.pm2_5":                False,
    "airquality.pm10":                 False,
    "polestar.days_to_service":        False,
    "polestar.service_warning":        False,
    "p2000.new_incident":              False,
    "market.fear_greed":               False,
    "network.wan_down":                False,
    "bus.delay_minutes":               True,
    "bus.cancelled":                   True,
    "bus.minutes_until_departure":     True,
    "traffic.delay_pct":               True,
    "traffic.delay_minutes":           True,
    "calendar.minutes_until_event":    True,
}


# ── Multi-condition helpers ───────────────────────────────────────────────────

def get_conditions(rule: dict) -> list[dict]:
    """Return the conditions list, normalising legacy single-condition rules."""
    if "conditions" in rule and isinstance(rule["conditions"], list):
        return rule["conditions"]
    if "condition" in rule and isinstance(rule["condition"], dict):
        return [rule["condition"]]
    return []


def get_condition_logic(rule: dict) -> str:
    """Return 'and' or 'or' (default 'and')."""
    return rule.get("condition_logic", "and")


def _eval_op(actual, operator: str, threshold) -> bool:
    """Generic boolean operator evaluation."""
    try:
        if operator == "in":
            return actual in (threshold if isinstance(threshold, list) else [threshold])
        if operator == "==":  return actual == threshold
        if operator == ">=":  return float(actual) >= float(threshold)
        if operator == "<=":  return float(actual) <= float(threshold)
        if operator == ">":   return float(actual) >  float(threshold)
        if operator == "<":   return float(actual) <  float(threshold)
    except (TypeError, ValueError):
        return False
    return False


def _eval_condition_bool(
    condition: dict,
    person: dict | None,
    client,
    data_cache: dict,
    cal_data_by_person: dict,
    backend_url: str,
    garbage_cfg: dict,
) -> bool:
    """Evaluate a single condition and return True/False (no notification side-effects)."""
    variable = condition.get("variable", "")
    operator = condition.get("operator", "==")
    value    = condition.get("value")

    def fetch(url, params=None):
        return _cached_fetch(client, data_cache, url, params)

    # ── Weather
    if variable == "weather.temperature":
        cw = fetch(f"{backend_url}/api/weather").get("current_weather", {})
        return _eval_op(cw.get("temperature"), operator, value)
    if variable == "weather.wind_speed":
        cw = fetch(f"{backend_url}/api/weather").get("current_weather", {})
        return _eval_op(cw.get("windspeed"), operator, value)
    if variable == "weather.warning_level":
        warnings = fetch(f"{backend_url}/api/warnings").get("warnings", [])
        levels = {(w.get("level") or "").lower() for w in warnings}
        return any(_eval_op(lv, operator, value) for lv in levels)
    if variable == "weather.warning_provinces":
        warnings = fetch(f"{backend_url}/api/warnings").get("warnings", [])
        all_regions = {r for w in warnings for r in (w.get("regions") or [])}
        return any(_eval_op(region, operator, value) for region in all_regions)
    # ── Rain
    if variable == "rain.mm_now":
        return _eval_op(fetch(f"{backend_url}/api/rain").get("precipitation_now"), operator, value)
    if variable == "rain.minutes_until_rain":
        return _eval_op(fetch(f"{backend_url}/api/rain").get("minutes_until_rain"), operator, value)
    # ── Air quality / pollen
    if variable == "airquality.aqi":
        return _eval_op(fetch(f"{backend_url}/api/airquality").get("aqi"), operator, value)
    if variable == "airquality.pm2_5":
        return _eval_op(fetch(f"{backend_url}/api/airquality").get("pm2_5"), operator, value)
    if variable == "airquality.pm10":
        return _eval_op(fetch(f"{backend_url}/api/airquality").get("pm10"), operator, value)
    if variable in ("airquality.pollen_birch", "airquality.pollen_grass",
                    "airquality.pollen_alder", "airquality.pollen_mugwort"):
        key = variable.split(".")[1]  # e.g. "pollen_birch"
        return _eval_op(fetch(f"{backend_url}/api/airquality").get(key), operator, value)
    # ── Garbage
    if variable == "garbage.hours_until_pickup":
        if not (garbage_cfg.get("postcode") and garbage_cfg.get("huisnummer")):
            return False
        data = fetch(f"{backend_url}/api/garbage", {
            "postcode": garbage_cfg["postcode"],
            "huisnummer": str(garbage_cfg["huisnummer"]),
            "days_ahead": 3,
        })
        pickups = data.get("pickups", [])
        return any(_eval_op(p.get("hours_until"), operator, value) for p in pickups)
    # ── P2000
    if variable == "p2000.new_incident":
        incidents = fetch(f"{backend_url}/api/p2000").get("incidents", [])
        services  = {i.get("service", "") for i in incidents}
        return any(_eval_op(s, operator, value) for s in services)
    # ── Market
    if variable == "market.fear_greed":
        return _eval_op(fetch(f"{backend_url}/api/market").get("fear_greed"), operator, value)
    # ── Network
    if variable == "network.wan_down":
        return _eval_op(fetch(f"{backend_url}/api/network").get("wan_down"), operator, value)
    # ── Polestar
    polestar_map = {
        "polestar.battery_pct":    "battery_pct",
        "polestar.range_km":       "range_km",
        "polestar.is_plugged_in":  "is_plugged_in",
        "polestar.days_to_service":"days_to_service",
        "polestar.service_warning":"service_warning",
    }
    if variable in polestar_map:
        return _eval_op(fetch(f"{backend_url}/api/polestar").get(polestar_map[variable]), operator, value)
    # ── Calendar
    if variable == "calendar.minutes_until_event":
        if not person:
            return False
        cal_data = cal_data_by_person.get(person["id"], {})
        events = cal_data.get("events", [])
        return any(_eval_op(e.get("minutes_until"), operator, value) for e in events)
    # ── Bus
    if variable in ("bus.delay_minutes", "bus.cancelled", "bus.minutes_until_departure"):
        if not person:
            return False
        bus_cfg_p = person.get("bus") or {}
        if not (bus_cfg_p.get("stop_city") and bus_cfg_p.get("stop_name")):
            return False
        bus_data = fetch(f"{backend_url}/api/bus", {
            "stop_city": bus_cfg_p["stop_city"],
            "stop_name": bus_cfg_p["stop_name"],
        })
        departures = bus_data.get("departures", [])
        if variable == "bus.cancelled":
            return any(_eval_op(d.get("cancelled", False), operator, value) for d in departures)
        if variable == "bus.delay_minutes":
            return any(_eval_op(d.get("delay_minutes", 0), operator, value) for d in departures)
        if variable == "bus.minutes_until_departure":
            return any(_eval_op(d.get("minutes_until_departure"), operator, value) for d in departures)
    # ── Traffic
    if variable in ("traffic.delay_pct", "traffic.delay_minutes"):
        if not person:
            return False
        traf_cfg_p = person.get("traffic") or {}
        if not (traf_cfg_p.get("home_address") and traf_cfg_p.get("work_address")):
            return False
        params: dict = {"home": traf_cfg_p["home_address"], "work": traf_cfg_p["work_address"]}
        if traf_cfg_p.get("route_roads"):
            params["route_roads"] = traf_cfg_p["route_roads"]
        traf_data = fetch(f"{backend_url}/api/traffic", params)
        key = "delay_pct" if variable == "traffic.delay_pct" else "delay_minutes"
        return _eval_op(traf_data.get(key), operator, value)

    print(f"[assistant] Unknown variable '{variable}' in multi-condition eval — treating as False", flush=True)
    return False


def _make_multi_notification(rule: dict, conditions: list[dict]) -> "Notification":
    """Generate a simple notification for a matched multi-condition rule."""
    logic = get_condition_logic(rule)
    parts = [f"{c.get('variable', '?')} {c.get('operator', '?')} {c.get('value', '?')}" for c in conditions]
    message = f" {logic.upper()} ".join(parts)
    return Notification(
        title=rule.get("title", "Rule triggered"),
        message=message,
        state_key=None,  # dedup handled by caller
        priority="default",
        tags=["bell"],
    )


def _cached_fetch(
    client: httpx.Client,
    data_cache: dict,
    url: str,
    params: dict | None = None,
) -> dict:
    """Fetch url with params, caching the result in data_cache."""
    cache_key = url + (
        "?" + "&".join(f"{k}={v}" for k, v in sorted((params or {}).items()))
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
    conditions = get_conditions(rule)
    if not conditions:
        return []

    # ── Multi-condition path (2+ conditions) ──────────────────────────────────
    if len(conditions) > 1:
        logic = get_condition_logic(rule)
        results = [
            _eval_condition_bool(c, person, client, data_cache, cal_data_by_person, backend_url, garbage_cfg)
            for c in conditions
        ]
        matched = all(results) if logic == "and" else any(results)
        if not matched:
            return []
        rule_id = rule.get("id", "rule")
        hour = time.strftime("%Y-%m-%dT%H")
        dedup_key = f"{rule_id}:{hour}"
        if state.has_fired(dedup_key):
            return []
        notif = _make_multi_notification(rule, conditions)
        notif = Notification(
            title=notif.title, message=notif.message,
            state_key=dedup_key, priority=notif.priority, tags=notif.tags,
        )
        return [notif]

    # ── Single-condition path — use per-domain handlers (rich messages) ───────
    variable = conditions[0].get("variable", "")
    # Ensure legacy 'condition' key is present for domain handlers that read it directly
    if "condition" not in rule:
        rule = {**rule, "condition": conditions[0]}

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
    if variable in ("weather.warning_level", "weather.warning_provinces"):
        data = _cached_fetch(client, data_cache, f"{backend_url}/api/warnings")
        return rule_weather.check(rule, data)

    # ── Weather: temperature / wind ───────────────────────────────────────────
    if variable in ("weather.temperature", "weather.wind_speed"):
        data = _cached_fetch(client, data_cache, f"{backend_url}/api/weather")
        return rule_weather.check_current(rule, data)

    # ── Rain ──────────────────────────────────────────────────────────────────
    if variable in ("rain.mm_now", "rain.minutes_until_rain"):
        data = _cached_fetch(client, data_cache, f"{backend_url}/api/rain")
        return rule_rain.check(rule, data)

    # ── Polestar ──────────────────────────────────────────────────────────────
    if variable in ("polestar.range_km", "polestar.is_plugged_in", "polestar.battery_pct",
                    "polestar.days_to_service", "polestar.service_warning"):
        data = _cached_fetch(client, data_cache, f"{backend_url}/api/polestar")
        return rule_polestar.check(rule, data)

    # ── Air quality / pollen ──────────────────────────────────────────────────
    if variable in ("airquality.aqi", "airquality.pollen_birch", "airquality.pollen_grass",
                    "airquality.pollen_alder", "airquality.pollen_mugwort",
                    "airquality.pm2_5", "airquality.pm10"):
        data = _cached_fetch(client, data_cache, f"{backend_url}/api/airquality")
        return rule_airquality.check(rule, data)

    # ── Calendar reminders ────────────────────────────────────────────────────
    if variable == "calendar.minutes_until_event":
        if not person:
            return []
        cal_data = cal_data_by_person.get(person["id"], {})
        return rule_calendar.check(rule, person, cal_data)

    # ── Bus delays / departure ────────────────────────────────────────────────
    if variable in ("bus.delay_minutes", "bus.cancelled", "bus.minutes_until_departure"):
        if not person:
            return []
        bus_cfg_p = person.get("bus") or {}
        if not (bus_cfg_p.get("stop_city") and bus_cfg_p.get("stop_name")):
            return []
        bus_data = _cached_fetch(client, data_cache, f"{backend_url}/api/bus", {
            "stop_city": bus_cfg_p["stop_city"],
            "stop_name": bus_cfg_p["stop_name"],
        })
        if variable == "bus.minutes_until_departure":
            return rule_bus.check_departure(rule, person, bus_data)
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

    # ── P2000 emergency incidents ─────────────────────────────────────────────
    if variable == "p2000.new_incident":
        data = _cached_fetch(client, data_cache, f"{backend_url}/api/p2000")
        return rule_p2000.check(rule, data)

    # ── Financial market ──────────────────────────────────────────────────────
    if variable == "market.fear_greed":
        data = _cached_fetch(client, data_cache, f"{backend_url}/api/market")
        return rule_market.check(rule, data)

    # ── Network / WAN ─────────────────────────────────────────────────────────
    if variable == "network.wan_down":
        data = _cached_fetch(client, data_cache, f"{backend_url}/api/network")
        return rule_network.check(rule, data)

    print(f"[assistant] Unknown variable '{variable}' in rule '{rule.get('id', '?')}' — skipping", flush=True)
    return []
