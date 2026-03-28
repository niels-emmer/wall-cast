#!/usr/bin/env python3
"""
wall-cast assistant

Polls the wall-cast backend for live data (garbage, calendar, bus, traffic,
weather warnings) and pushes proactive notifications via ntfy. Runs as a
standalone Docker sidecar — zero changes to the main app required.

Configuration is read from the same wall-cast.yaml used by the rest of the
stack. All assistant settings live under shared.assistant — if that block is
absent or assistant.enabled is false, this service does nothing.

Example config (new format):
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

      rules:
        - id: garbage-reminder
          title: Garbage pickup reminder
          enabled: true
          condition:
            variable: garbage.hours_until_pickup
            operator: "<="
            value: 18
            unit: h
        - id: bus-delay
          title: Bus delay alert
          enabled: true
          condition:
            variable: bus.delay_minutes
            operator: ">="
            value: 5
            unit: min
        - id: traffic-delay
          title: Traffic delay
          enabled: true
          condition:
            variable: traffic.delay_pct
            operator: ">="
            value: 25
            unit: "%"
        - id: calendar-reminder
          title: Calendar reminder
          enabled: true
          condition:
            variable: calendar.minutes_until_event
            operator: "<="
            value: 30
            unit: min
        - id: weather-warning
          title: Weather warning
          enabled: true
          condition:
            variable: weather.warning_level
            operator: in
            value: [oranje, rood]

Per-person rules (optional, under each person in shared.people):
  shared:
    people:
      - id: alice
        rules:
          - id: alice-bus-custom
            title: Alice's bus (low threshold)
            enabled: true
            condition:
              variable: bus.delay_minutes
              operator: ">="
              value: 3
              unit: min
        notify:
          ntfy_topic: wall-cast-alice   # overrides global topic for Alice's alerts
"""

import os
import time
from pathlib import Path

import yaml

import state
from ai import formatter as ai_fmt
from notify import matrix as notify_matrix
from notify import ntfy as notify_ntfy
from rules import Notification
from rules.engine import REQUIRES_PERSON, _cached_fetch, run_rule

MATRIX_TOKEN = os.environ.get("MATRIX_TOKEN", "")

CONFIG_PATH = os.environ.get("WALL_CONFIG_PATH", "/config/wall-cast.yaml")


# ── Config ────────────────────────────────────────────────────────────────────

def load_config() -> dict:
    try:
        with open(CONFIG_PATH, encoding="utf-8") as f:
            return yaml.safe_load(f) or {}
    except Exception as exc:
        print(f"[assistant] Config read error: {exc}", flush=True)
        return {}


# ── Notification dispatch ─────────────────────────────────────────────────────

def _dispatch(
    notification: Notification,
    person: dict | None,
    notify_cfg: dict,
    ai_cfg: dict,
    context: str = "",
    all_people: list[dict] | None = None,
) -> None:
    ntfy_cfg   = notify_cfg.get("ntfy", {})
    matrix_cfg = notify_cfg.get("matrix", {})

    ntfy_enabled   = ntfy_cfg.get("enabled", False)
    ntfy_url       = ntfy_cfg.get("url", "").rstrip("/")
    matrix_enabled = matrix_cfg.get("enabled", False)
    matrix_hs      = matrix_cfg.get("homeserver", "").rstrip("/")
    matrix_room    = matrix_cfg.get("room_id", "")

    if not ntfy_enabled and not matrix_enabled:
        print(f"[assistant] No notification channel enabled — skipping: {notification.title}", flush=True)
        return

    # AI reformatting done once, reused across all channels
    message = ai_fmt.format_message(notification.title, notification.message, context, ai_cfg)

    dispatched = False

    if person:
        # Personal notification — send on each of this person's configured channels
        p_notify = person.get("notify") or {}
        if ntfy_enabled and ntfy_url:
            topic = p_notify.get("ntfy_topic") or ""
            if topic:
                notify_ntfy.send(
                    ntfy_url=ntfy_url, topic=topic,
                    title=notification.title, message=message,
                    priority=notification.priority, tags=notification.tags,
                )
                dispatched = True
        if matrix_enabled and matrix_hs and MATRIX_TOKEN:
            room = p_notify.get("matrix_room_id") or matrix_room
            if room:
                notify_matrix.send(
                    homeserver=matrix_hs, room_id=room, token=MATRIX_TOKEN,
                    title=notification.title, message=message,
                )
                dispatched = True
    else:
        # Global notification — ntfy: all unique topics; matrix: system room + per-person rooms
        if ntfy_enabled and ntfy_url:
            topics: list[str] = []
            for p in (all_people or []):
                topic = (p.get("notify") or {}).get("ntfy_topic")
                if topic and topic not in topics:
                    topics.append(topic)
            for topic in topics:
                notify_ntfy.send(
                    ntfy_url=ntfy_url, topic=topic,
                    title=notification.title, message=message,
                    priority=notification.priority, tags=notification.tags,
                )
                dispatched = True

        if matrix_enabled and matrix_hs and MATRIX_TOKEN:
            rooms: list[str] = []
            if matrix_room:
                rooms.append(matrix_room)
            for p in (all_people or []):
                room = (p.get("notify") or {}).get("matrix_room_id")
                if room and room not in rooms:
                    rooms.append(room)
            for room in rooms:
                notify_matrix.send(
                    homeserver=matrix_hs, room_id=room, token=MATRIX_TOKEN,
                    title=notification.title, message=message,
                )
                dispatched = True

    # Mark the dedup key only after at least one channel was attempted,
    # so a misconfigured / silent dispatch failure can retry next cycle.
    if dispatched and notification.state_key:
        state.mark_fired(notification.state_key)


# ── Main cycle ────────────────────────────────────────────────────────────────

def run_cycle(cfg: dict) -> None:
    shared        = cfg.get("shared", {})
    assistant_cfg = shared.get("assistant", {})
    notify_cfg    = assistant_cfg.get("notify", {})
    ai_cfg        = assistant_cfg.get("ai", {})
    backend_url   = assistant_cfg.get("backend_url", "http://backend:8000").rstrip("/")
    garbage_cfg   = shared.get("garbage", {})
    people        = shared.get("people", [])

    # Rules must be a list (new format); silently ignore old flat dict
    rules_raw  = assistant_cfg.get("rules", [])
    rules_list: list[dict] = rules_raw if isinstance(rules_raw, list) else []

    # Partition generic rules into global (person-agnostic) and person-aware
    global_rules       = [r for r in rules_list
                          if not REQUIRES_PERSON.get(r.get("condition", {}).get("variable", ""), False)]
    person_aware_rules = [r for r in rules_list
                          if REQUIRES_PERSON.get(r.get("condition", {}).get("variable", ""), False)]

    import httpx
    with httpx.Client() as client:
        data_cache: dict = {}

        # Pre-fetch calendar data for all people upfront —
        # needed by both calendar reminders and bus cross-correlation.
        cal_data_by_person: dict[str, dict] = {}
        for person in people:
            pid     = person.get("id")
            cal_ids = person.get("calendar_ids") or []
            if pid and cal_ids:
                cal_data_by_person[pid] = _cached_fetch(
                    client, data_cache,
                    f"{backend_url}/api/calendar",
                    {"calendar_ids": cal_ids},
                )

        # ── Global rules (garbage, weather, …) ───────────────────────────────
        for rule in global_rules:
            if not rule.get("enabled", True):
                continue
            for n in run_rule(rule, None, client, data_cache, cal_data_by_person,
                              backend_url, garbage_cfg):
                _dispatch(n, None, notify_cfg, ai_cfg, all_people=people)

        # ── Per-person rules ──────────────────────────────────────────────────
        for person in people:
            pid = person.get("id")
            if not pid:
                continue

            # Generic person-aware rules + rules defined on this person
            all_rules = person_aware_rules + (person.get("rules") or [])
            for rule in all_rules:
                if not rule.get("enabled", True):
                    continue
                for n in run_rule(rule, person, client, data_cache, cal_data_by_person,
                                  backend_url, garbage_cfg):
                    _dispatch(n, person, notify_cfg, ai_cfg)


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
            Path("/config/assistant-heartbeat.txt").write_text(str(time.time()))
        except Exception as exc:
            print(f"[assistant] Cycle error: {exc}", flush=True)

        print(f"[assistant] Next check in {check_interval} s", flush=True)
        time.sleep(check_interval)


if __name__ == "__main__":
    main()
