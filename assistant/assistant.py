#!/usr/bin/env python3
"""
wall-cast assistant

Polls the wall-cast backend for live data (garbage, calendar, bus, traffic,
weather warnings) and pushes proactive notifications via ntfy. Runs as a
standalone Docker sidecar — zero changes to the main app required.

Configuration is read from the same wall-cast.yaml used by the rest of the
stack. All assistant settings live under shared.assistant — if that block is
absent or assistant.enabled is false, this service does nothing.

Example config:
  shared:
    assistant:
      enabled: true
      check_interval: 300          # seconds between cycles
      backend_url: http://backend:8000

      notify:
        ntfy_url: https://ntfy.example.com
        ntfy_topic: wall-cast-alerts

      ai:
        provider: none             # none | ollama | openai
        # ollama_url: http://host.docker.internal:11434
        # ollama_model: llama3.2:3b

      rules:
        garbage_notify_hours_before: 18
        bus_delay_threshold_min: 5
        traffic_delay_threshold_pct: 25
        calendar_reminder_min: 30

Per-person notification routing (optional):
  shared:
    people:
      - id: alice
        notify:
          ntfy_topic: wall-cast-alice   # overrides global topic for Alice's alerts
"""

import os
import time

import httpx
import yaml

import state
from ai import formatter as ai_fmt
from notify import ntfy as notify_ntfy
from rules import Notification
from rules import bus as rule_bus
from rules import calendar as rule_calendar
from rules import garbage as rule_garbage
from rules import traffic as rule_traffic
from rules import weather as rule_weather

CONFIG_PATH = os.environ.get("WALL_CONFIG_PATH", "/config/wall-cast.yaml")


# ── Config ────────────────────────────────────────────────────────────────────

def load_config() -> dict:
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception as exc:
        print(f"[assistant] Config read error: {exc}", flush=True)
        return {}


# ── Data fetching ─────────────────────────────────────────────────────────────

def _fetch(client: httpx.Client, url: str, params: dict | None = None) -> dict:
    try:
        r = client.get(url, params=params, timeout=15.0)
        r.raise_for_status()
        return r.json()
    except Exception as exc:
        print(f"[assistant] Fetch error {url}: {exc}", flush=True)
        return {}


# ── Notification dispatch ─────────────────────────────────────────────────────

def _dispatch(
    notification: Notification,
    person: dict | None,
    notify_cfg: dict,
    ai_cfg: dict,
    context: str = "",
) -> None:
    ntfy_url      = notify_cfg.get("ntfy_url", "")
    default_topic = notify_cfg.get("ntfy_topic", "wall-cast-alerts")

    if not ntfy_url:
        print(f"[assistant] No ntfy_url — skipping: {notification.title}", flush=True)
        return

    # Per-person topic override
    topic = default_topic
    if person:
        topic = (person.get("notify") or {}).get("ntfy_topic", default_topic)

    # Optional AI reformatting
    message = ai_fmt.format_message(notification.title, notification.message, context, ai_cfg)

    notify_ntfy.send(
        ntfy_url=ntfy_url,
        topic=topic,
        title=notification.title,
        message=message,
        priority=notification.priority,
        tags=notification.tags,
    )


# ── Main cycle ────────────────────────────────────────────────────────────────

def run_cycle(cfg: dict) -> None:
    shared        = cfg.get("shared", {})
    assistant_cfg = shared.get("assistant", {})
    notify_cfg    = assistant_cfg.get("notify", {})
    ai_cfg        = assistant_cfg.get("ai", {})
    rules_cfg     = assistant_cfg.get("rules", {})
    backend_url   = assistant_cfg.get("backend_url", "http://backend:8000").rstrip("/")
    garbage_cfg   = shared.get("garbage", {})
    people        = shared.get("people", [])

    with httpx.Client() as client:

        # ── Shared: garbage ───────────────────────────────────────────────────
        if garbage_cfg.get("postcode") and garbage_cfg.get("huisnummer"):
            data = _fetch(client, f"{backend_url}/api/garbage", {
                "postcode":   garbage_cfg["postcode"],
                "huisnummer": str(garbage_cfg["huisnummer"]),
                "days_ahead": 3,
            })
            for n in rule_garbage.check(data, rules_cfg):
                _dispatch(n, None, notify_cfg, ai_cfg, str(data))

        # ── Shared: weather warnings ──────────────────────────────────────────
        data = _fetch(client, f"{backend_url}/api/warnings")
        for n in rule_weather.check(data, rules_cfg):
            _dispatch(n, None, notify_cfg, ai_cfg, str(data))

        # ── Per-person rules ──────────────────────────────────────────────────
        for person in people:
            pid = person.get("id")
            if not pid:
                continue

            # Calendar — needed for reminders AND bus cross-correlation
            cal_ids = person.get("calendar_ids") or []
            cal_data: dict = {}
            if cal_ids:
                cal_data = _fetch(
                    client,
                    f"{backend_url}/api/calendar",
                    {"calendar_ids": cal_ids},
                )
                for n in rule_calendar.check(person, cal_data, rules_cfg):
                    _dispatch(n, person, notify_cfg, ai_cfg, str(cal_data))

            # Bus (cross-correlated with calendar — only alerts when travelling)
            bus_cfg_p = person.get("bus") or {}
            if bus_cfg_p.get("stop_city") and bus_cfg_p.get("stop_name"):
                bus_data = _fetch(client, f"{backend_url}/api/bus", {
                    "stop_city": bus_cfg_p["stop_city"],
                    "stop_name": bus_cfg_p["stop_name"],
                })
                if cal_data:
                    for n in rule_bus.check(person, bus_data, cal_data, rules_cfg):
                        _dispatch(n, person, notify_cfg, ai_cfg, str(bus_data))

            # Traffic / commute
            traf_cfg_p = person.get("traffic") or {}
            if traf_cfg_p.get("home_address") and traf_cfg_p.get("work_address"):
                params: dict = {
                    "home": traf_cfg_p["home_address"],
                    "work": traf_cfg_p["work_address"],
                }
                if traf_cfg_p.get("route_roads"):
                    params["route_roads"] = traf_cfg_p["route_roads"]
                traf_data = _fetch(client, f"{backend_url}/api/traffic", params)
                for n in rule_traffic.check(person, traf_data, rules_cfg):
                    _dispatch(n, person, notify_cfg, ai_cfg, str(traf_data))


# ── Entry point ───────────────────────────────────────────────────────────────

def main() -> None:
    print(f"[assistant] Starting — config={CONFIG_PATH}", flush=True)
    state.load()

    while True:
        cfg           = load_config()
        shared        = cfg.get("shared", {})
        assistant_cfg = shared.get("assistant", {})

        if not assistant_cfg.get("enabled", False):
            print("[assistant] Disabled in config — sleeping 60 s", flush=True)
            time.sleep(60)
            continue

        check_interval = int(assistant_cfg.get("check_interval", 300))
        print("[assistant] Running check cycle", flush=True)

        try:
            state.prune()
            run_cycle(cfg)
        except Exception as exc:
            print(f"[assistant] Cycle error: {exc}", flush=True)

        print(f"[assistant] Next check in {check_interval} s", flush=True)
        time.sleep(check_interval)


if __name__ == "__main__":
    main()
