"""
YAML config loader with async file watcher and SSE broadcaster.

Supports two YAML formats:

  OLD (flat, single-screen):
    location: ...
    language: nl
    layout: ...
    widgets: [...]

  NEW (multi-screen):
    shared:
      location: ...
      language: nl
      widgets: [...]        # appended to every screen (e.g. news ticker)
    screens:
      - id: living-room
        name: Living Room
        layout: ...
        widgets: [...]      # screen-specific widgets

get_config(screen) returns a merged single-screen view:
  location / language / layout  from screen (overrides shared) or shared default
  widgets = screen widgets + shared widgets (shared appended at end)

Old flat configs are returned as-is (no migration needed).
"""

import asyncio
import logging
import os
import uuid
from pathlib import Path
from typing import Any

import yaml
from watchfiles import awatch

from app.config import settings

logger = logging.getLogger(__name__)

# ── Default config written on first run ───────────────────────────────────────
_DEFAULT_CONFIG: dict[str, Any] = {
    "shared": {
        "location": {"lat": 52.37, "lon": 4.89, "name": "My City"},
        "language": "nl",
        "fade_speed": 0.8,
        "people": [],
        "widgets": [
            {
                "id": "news",
                "type": "news",
                "col": 1, "row": 8, "col_span": 12, "row_span": 1,
                "config": {
                    "feeds": [
                        {"url": "https://news.ycombinator.com/rss", "label": "HackerNews"},
                    ],
                    "scroll_speed_px_per_sec": 80,
                },
            },
        ],
    },
    "screens": [
        {
            "id": "main",
            "name": "Main Screen",
            "chromecast_ip": "",
            "people": [],
            "layout": {"columns": 12, "rows": 8},
            "widgets": [
                {
                    "id": "clock",
                    "type": "clock",
                    "col": 1, "row": 1, "col_span": 4, "row_span": 3,
                    "config": {"show_seconds": True, "show_date": True},
                },
                {
                    "id": "main-rotator",
                    "type": "rotate",
                    "col": 5, "row": 1, "col_span": 8, "row_span": 7,
                    "config": {
                        "interval_sec": 20,
                        "widgets": [
                            {"type": "weather", "config": {"show_hourly": True, "show_daily": True}},
                            {"type": "calendar", "config": {}},
                            {"type": "traffic", "config": {}},
                            {"type": "warnings", "config": {}},
                        ],
                    },
                },
                {
                    "id": "bottom-left-rotator",
                    "type": "rotate",
                    "col": 1, "row": 4, "col_span": 4, "row_span": 4,
                    "config": {
                        "interval_sec": 20,
                        "widgets": [
                            {"type": "rain", "config": {}},
                            {"type": "garbage", "config": {"days_ahead": 31}},
                            {"type": "polestar", "config": {}},
                            {"type": "bus", "config": {}},
                        ],
                    },
                },
            ],
        },
    ],
}


def _write_config(path: Path, data: dict[str, Any]) -> None:
    """Write config to YAML and ensure it is world-readable/writable.

    chmod 0o664 means any user (including the host user running git) can
    read and write the file even if it is owned by the container's root.
    """
    path.parent.mkdir(parents=True, exist_ok=True)
    with open(path, "w", encoding="utf-8") as f:
        yaml.dump(data, f, allow_unicode=True, default_flow_style=False, sort_keys=False)
    try:
        os.chmod(path, 0o664)
    except OSError:
        pass


_DEFAULT_RULES: list[dict[str, Any]] = [
    {
        "id": "garbage-reminder",
        "title": "Garbage pickup reminder",
        "description": "Alert when bin collection is approaching",
        "enabled": True,
        "condition": {"variable": "garbage.hours_until_pickup", "operator": "<=", "value": 18, "unit": "h"},
    },
    {
        "id": "bus-delay",
        "title": "Bus delay alert",
        "description": "Alert when your bus is delayed or cancelled",
        "enabled": True,
        "condition": {"variable": "bus.delay_minutes", "operator": ">=", "value": 5, "unit": "min"},
    },
    {
        "id": "traffic-delay",
        "title": "Traffic delay",
        "description": "Alert when commute is significantly delayed",
        "enabled": True,
        "condition": {"variable": "traffic.delay_pct", "operator": ">=", "value": 25, "unit": "%"},
    },
    {
        "id": "calendar-reminder",
        "title": "Calendar reminder",
        "description": "Remind before upcoming calendar events",
        "enabled": True,
        "condition": {"variable": "calendar.minutes_until_event", "operator": "<=", "value": 30, "unit": "min"},
    },
    {
        "id": "weather-warning",
        "title": "Weather warning",
        "description": "Alert for severe weather warnings",
        "enabled": True,
        "condition": {"variable": "weather.warning_level", "operator": "in", "value": ["oranje", "rood"], "unit": None},
    },
]

# Maps old flat rule keys to the default rule ID and condition value field
_FLAT_RULE_MAP = {
    "garbage_notify_hours_before": ("garbage-reminder", "garbage.hours_until_pickup"),
    "bus_delay_threshold_min":     ("bus-delay",         "bus.delay_minutes"),
    "traffic_delay_threshold_pct": ("traffic-delay",     "traffic.delay_pct"),
    "calendar_reminder_min":       ("calendar-reminder", "calendar.minutes_until_event"),
}


def _migrate_rules(data: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    """Convert old flat assistant.rules dict to new Rule list format.

    Returns (updated_data, changed). If already in new format (list), returns unchanged.
    """
    assistant = data.get("shared", {}).get("assistant")
    if not isinstance(assistant, dict):
        return data, False
    rules = assistant.get("rules")
    if not isinstance(rules, dict):
        return data, False  # already a list or absent — nothing to do

    logger.info("Migrating flat assistant.rules to Rule list format")

    # Build new rules list from defaults, overriding values from old flat keys
    new_rules = []
    for tpl in _DEFAULT_RULES:
        rule = {**tpl, "condition": dict(tpl["condition"])}
        rid = rule["id"]
        # Find the matching old flat key and carry its value over
        for flat_key, (target_id, _var) in _FLAT_RULE_MAP.items():
            if target_id == rid and flat_key in rules:
                rule["condition"]["value"] = int(rules[flat_key])
        new_rules.append(rule)

    # Deep-copy with updated rules
    new_data = {
        **data,
        "shared": {
            **data["shared"],
            "assistant": {
                **assistant,
                "rules": new_rules,
            },
        },
    }
    return new_data, True


def _upgrade_rule_list(rules: list[Any]) -> tuple[list[Any], bool]:
    """Convert any rule with only a 'condition' key to the new 'conditions' list format.

    Returns (updated_rules, changed).
    """
    changed = False
    upgraded: list[Any] = []
    for rule in rules:
        if not isinstance(rule, dict):
            upgraded.append(rule)
            continue
        if "conditions" not in rule and "condition" in rule:
            rule = {
                **{k: v for k, v in rule.items() if k != "condition"},
                "conditions": [rule["condition"]],
            }
            changed = True
        upgraded.append(rule)
    return upgraded, changed


def _migrate_rule_conditions(data: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    """Migrate rules using legacy 'condition' key to new 'conditions' list format.

    Applies to both shared.assistant.rules and each person's rules.
    Returns (updated_data, changed).
    """
    any_changed = False
    data = dict(data)
    shared = dict(data.get("shared", {}))

    # Shared assistant rules
    assistant = shared.get("assistant")
    if isinstance(assistant, dict) and isinstance(assistant.get("rules"), list):
        new_rules, ch = _upgrade_rule_list(assistant["rules"])
        if ch:
            any_changed = True
            shared["assistant"] = {**assistant, "rules": new_rules}

    # Per-person rules
    people = shared.get("people", [])
    if isinstance(people, list):
        new_people = []
        for person in people:
            if isinstance(person, dict) and isinstance(person.get("rules"), list):
                new_pr, ch = _upgrade_rule_list(person["rules"])
                if ch:
                    any_changed = True
                    person = {**person, "rules": new_pr}
            new_people.append(person)
        if any_changed:
            shared["people"] = new_people

    if any_changed:
        logger.info("Migrated rule 'condition' keys to 'conditions' list format")
        data["shared"] = shared

    return data, any_changed


def _gtfs_stop_code_lookup(city: str, stop_name: str) -> str | None:
    """Look up the OVapi timing point code for a Dutch bus stop by city + name.

    Downloads only stops.txt (~1.5 MB) from the national GTFS zip via two
    HTTP range requests: one for the zip central directory, one for the
    compressed stops.txt data.  The full zip (~240 MB) is never downloaded.
    Returns the first matching stop_code, or None if not found or on error.
    """
    import csv
    import io
    import struct
    import zlib

    import httpx

    GTFS_URL = "http://gtfs.ovapi.nl/nl/gtfs-nl.zip"
    target_name = f"{city}, {stop_name}"

    try:
        with httpx.Client(timeout=60.0) as client:
            # Step 1: get file size via HEAD
            head = client.head(GTFS_URL)
            file_size = int(head.headers["content-length"])

            # Step 2: download last 65 KB to find end-of-central-directory
            tail_start = max(0, file_size - 65536)
            resp = client.get(GTFS_URL, headers={"Range": f"bytes={tail_start}-{file_size-1}"})
            tail = resp.content

            eocd_pos = tail.rfind(b"PK\x05\x06")
            if eocd_pos == -1:
                logger.warning("Bus migration: EOCD not found in GTFS zip")
                return None
            eocd = tail[eocd_pos:]
            cd_size = struct.unpack("<I", eocd[12:16])[0]
            cd_offset = struct.unpack("<I", eocd[16:20])[0]

            # Step 3: download central directory to find stops.txt offset
            resp = client.get(GTFS_URL, headers={"Range": f"bytes={cd_offset}-{cd_offset+cd_size-1}"})
            cd = resp.content

            stops_local_offset: int | None = None
            stops_comp_size: int | None = None
            pos = 0
            while pos < len(cd) - 4:
                if cd[pos:pos+4] != b"PK\x01\x02":
                    break
                comp = struct.unpack("<I", cd[pos+20:pos+24])[0]
                fname_len = struct.unpack("<H", cd[pos+28:pos+30])[0]
                extra_len = struct.unpack("<H", cd[pos+30:pos+32])[0]
                comment_len = struct.unpack("<H", cd[pos+32:pos+34])[0]
                local_off = struct.unpack("<I", cd[pos+42:pos+46])[0]
                fname = cd[pos+46:pos+46+fname_len].decode("utf-8", errors="replace")
                if fname == "stops.txt":
                    stops_local_offset = local_off
                    stops_comp_size = comp
                    break
                pos += 46 + fname_len + extra_len + comment_len

            if stops_local_offset is None or stops_comp_size is None:
                logger.warning("Bus migration: stops.txt not found in GTFS central directory")
                return None

            # Step 4: download local file header + compressed stops.txt data
            # Local header: 30 bytes + filename + extra (allow 256 bytes margin)
            download_end = stops_local_offset + 30 + 256 + stops_comp_size
            resp = client.get(GTFS_URL, headers={"Range": f"bytes={stops_local_offset}-{download_end}"})
            local_data = resp.content

            if local_data[:4] != b"PK\x03\x04":
                logger.warning("Bus migration: invalid local file header for stops.txt")
                return None

            fname_len_local = struct.unpack("<H", local_data[26:28])[0]
            extra_len_local = struct.unpack("<H", local_data[28:30])[0]
            data_start = 30 + fname_len_local + extra_len_local
            compressed = local_data[data_start:data_start+stops_comp_size]
            text = zlib.decompress(compressed, -15).decode("utf-8")

        reader = csv.DictReader(io.StringIO(text))
        for row in reader:
            if row.get("stop_name", "").strip('"') == target_name and row.get("stop_code"):
                return row["stop_code"]

        return None

    except Exception as exc:
        logger.warning("Bus migration: GTFS lookup failed — %s", exc)
        return None


def _migrate_bus_stop_codes(data: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    """Migrate person bus configs from stop_city/stop_name to OVapi stop_code.

    Looks up the timing point code in the Dutch national GTFS via range
    requests (downloads ~1.5 MB, not the full 240 MB zip).
    Only acts when stop_city + stop_name are present and stop_code is absent.
    """
    people = data.get("shared", {}).get("people", [])
    if not isinstance(people, list):
        return data, False

    needs = [
        p for p in people
        if isinstance(p, dict)
        and isinstance(p.get("bus"), dict)
        and p["bus"].get("stop_city")
        and p["bus"].get("stop_name")
        and not p["bus"].get("stop_code")
    ]
    if not needs:
        return data, False

    logger.info("Bus migration: looking up stop_code for %d person(s) via GTFS", len(needs))

    changed = False
    new_people = []
    for person in people:
        bus = person.get("bus") if isinstance(person, dict) else None
        if (isinstance(bus, dict)
                and bus.get("stop_city")
                and bus.get("stop_name")
                and not bus.get("stop_code")):
            city = bus["stop_city"]
            stop = bus["stop_name"]
            code = _gtfs_stop_code_lookup(city, stop)
            if code:
                person = {**person, "bus": {"stop_code": code}}
                logger.info("Bus migration: '%s, %s' → stop_code=%s", city, stop, code)
                changed = True
            else:
                logger.warning(
                    "Bus migration: stop '%s, %s' not found in GTFS — "
                    "set bus.stop_code manually in the admin panel",
                    city, stop,
                )
        new_people.append(person)

    if not changed:
        return data, False

    return {**data, "shared": {**data["shared"], "people": new_people}}, True


def _migrate_flat(raw: dict[str, Any]) -> dict[str, Any]:
    """Convert old flat single-screen config to multi-screen format."""
    logger.info("Migrating flat config to multi-screen format")
    return {
        "shared": {
            "location": raw.get("location", {}),
            "language": raw.get("language", "nl"),
            "people": [],
            "widgets": [],
        },
        "screens": [
            {
                "id": "main",
                "name": "Main Screen",
                "chromecast_ip": "",
                "people": [],
                "layout": raw.get("layout", {"columns": 12, "rows": 8}),
                "widgets": raw.get("widgets", []),
            },
        ],
    }


def _migrate_notify(data: dict[str, Any]) -> tuple[dict[str, Any], bool]:
    """Migrate old flat notify config to nested ntfy/matrix structure.

    Old: assistant.notify.ntfy_url / assistant.notify.ntfy_topic
    New: assistant.notify.ntfy.{enabled, url}  (ntfy_topic is now per-person only)
    """
    assistant = data.get("shared", {}).get("assistant")
    if not isinstance(assistant, dict):
        return data, False
    notify = assistant.get("notify")
    if not isinstance(notify, dict):
        return data, False

    # Already migrated if ntfy key is a dict
    if isinstance(notify.get("ntfy"), dict):
        return data, False

    old_url   = notify.get("ntfy_url", "")
    if not old_url and "ntfy_topic" not in notify:
        return data, False  # nothing to migrate

    logger.info("Migrating flat assistant.notify to nested ntfy/matrix structure")
    new_notify: dict[str, Any] = {k: v for k, v in notify.items()
                                   if k not in ("ntfy_url", "ntfy_topic")}
    new_notify["ntfy"] = {"enabled": bool(old_url), "url": old_url or ""}

    new_data = {
        **data,
        "shared": {
            **data["shared"],
            "assistant": {
                **assistant,
                "notify": new_notify,
            },
        },
    }
    return new_data, True


_config: dict[str, Any] = {}
_subscribers: list[asyncio.Queue] = []
_change_callbacks: list = []  # callables invoked synchronously on every config reload

# Unique ID for this backend process. Changes on every container restart.
_startup_id: str = str(uuid.uuid4())


def on_config_change(fn) -> None:
    """Register a zero-argument callable to be called whenever the config reloads."""
    _change_callbacks.append(fn)


def get_startup_id() -> str:
    return _startup_id


def load_config() -> dict[str, Any]:
    """Parse the YAML config file and return as a dict.

    On first run (file missing): writes a default config and returns it.
    Old flat format: migrates to multi-screen format, writes back, returns it.
    """
    path = Path(settings.wall_config_path)

    if not path.exists():
        logger.info("Config file not found — writing default config to %s", path)
        _write_config(path, _DEFAULT_CONFIG)
        return _DEFAULT_CONFIG

    with open(path, encoding="utf-8") as f:
        data = yaml.safe_load(f) or {}

    if data and not _is_multi_screen(data):
        data = _migrate_flat(data)
        _write_config(path, data)
        logger.info("Flat config migrated and written back to %s", path)

    data, changed = _migrate_rules(data)
    if changed:
        _write_config(path, data)
        logger.info("Rules migrated to new format and written back to %s", path)

    data, changed = _migrate_notify(data)
    if changed:
        _write_config(path, data)
        logger.info("Notify config migrated to nested structure and written back to %s", path)

    data, changed = _migrate_rule_conditions(data)
    if changed:
        _write_config(path, data)
        logger.info("Rule conditions migrated to list format and written back to %s", path)

    data, changed = _migrate_bus_stop_codes(data)
    if changed:
        _write_config(path, data)
        logger.info("Bus stop codes migrated to OVapi stop_code format and written back to %s", path)

    return data


def _is_multi_screen(raw: dict[str, Any]) -> bool:
    return "screens" in raw


def _inject_people_commute(
    widgets: list[dict[str, Any]],
    screen_people_ids: list[str] | None,
    all_people: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Inject traffic and bus config from the first matching person on this screen.

    Mirrors _inject_people_calendars: includes family people plus those explicitly
    assigned to the screen. Uses the first person that has the relevant config set.
    Slot-level config takes priority — only fills in missing (empty/absent) keys.
    """
    if screen_people_ids is None:
        return widgets

    traffic_cfg: dict[str, Any] | None = None
    bus_cfg: dict[str, Any] | None = None

    for person in all_people:
        if not (person.get("family") or person.get("id") in screen_people_ids):
            continue
        if traffic_cfg is None and person.get("traffic"):
            traffic_cfg = person["traffic"]
        if bus_cfg is None and person.get("bus"):
            bus_cfg = person["bus"]
        if traffic_cfg and bus_cfg:
            break

    def _inject(wlist: list[dict[str, Any]]) -> list[dict[str, Any]]:
        result = []
        for w in wlist:
            wtype = w.get("type")
            if wtype == "traffic" and traffic_cfg:
                cfg = dict(w.get("config") or {})
                for key in ("home_address", "work_address", "route_roads"):
                    if not cfg.get(key):
                        cfg[key] = traffic_cfg.get(key, "")
                w = {**w, "config": cfg}
            elif wtype == "bus" and bus_cfg:
                cfg = dict(w.get("config") or {})
                if not cfg.get("stop_code"):
                    cfg["stop_code"] = bus_cfg.get("stop_code", "")
                w = {**w, "config": cfg}
            elif wtype == "rotate":
                inner = _inject(w.get("config", {}).get("widgets") or [])
                w = {**w, "config": {**w.get("config", {}), "widgets": inner}}
            result.append(w)
        return result

    return _inject(widgets)


def _inject_garbage(
    widgets: list[dict[str, Any]],
    garbage_config: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    """Inject shared garbage postcode/huisnummer into garbage slots that have none."""
    if not garbage_config:
        return widgets

    def _inject(wlist: list[dict[str, Any]]) -> list[dict[str, Any]]:
        result = []
        for w in wlist:
            if w.get("type") == "garbage":
                cfg = dict(w.get("config") or {})
                for key in ("postcode", "huisnummer"):
                    if not cfg.get(key):
                        cfg[key] = garbage_config.get(key, "")
                w = {**w, "config": cfg}
            elif w.get("type") == "rotate":
                inner = _inject(w.get("config", {}).get("widgets") or [])
                w = {**w, "config": {**w.get("config", {}), "widgets": inner}}
            result.append(w)
        return result

    return _inject(widgets)


def _inject_p2000(
    widgets: list[dict[str, Any]],
    p2000_config: dict[str, Any] | None,
) -> list[dict[str, Any]]:
    """Inject shared p2000.widget_enabled into p2000 widget slots."""
    if p2000_config is None:
        return widgets
    enabled = p2000_config.get("widget_enabled", True)

    def _inject(wlist: list[dict[str, Any]]) -> list[dict[str, Any]]:
        result = []
        for w in wlist:
            if w.get("type") == "p2000":
                cfg = dict(w.get("config") or {})
                cfg["enabled"] = enabled
                w = {**w, "config": cfg}
            elif w.get("type") == "rotate":
                inner = _inject(w.get("config", {}).get("widgets") or [])
                w = {**w, "config": {**w.get("config", {}), "widgets": inner}}
            result.append(w)
        return result

    return _inject(widgets)


def _inject_people_feeds(
    widgets: list[dict[str, Any]],
    screen_people_ids: list[str] | None,
    all_people: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Append personal RSS feeds from assigned people into news widget feeds.

    Global feeds defined in the news widget config stay first; personal feeds
    are appended after, deduplicated by URL. Family people are always included.
    If screen_people_ids is None (field absent from YAML), widgets are left untouched.
    """
    if screen_people_ids is None:
        return widgets

    personal: list[dict[str, Any]] = []
    seen_urls: set[str] = set()

    for person in all_people:
        if not (person.get("family") or person.get("id") in screen_people_ids):
            continue
        for feed in person.get("rss_feeds") or []:
            url = feed.get("url", "").strip()
            if url and url not in seen_urls:
                seen_urls.add(url)
                personal.append({
                    "url": url,
                    "label": (feed.get("label") or "").strip() or person.get("name") or "Personal",
                })

    if not personal:
        return widgets

    def _inject(wlist: list[dict[str, Any]]) -> list[dict[str, Any]]:
        result = []
        for w in wlist:
            if w.get("type") == "news":
                cfg = dict(w.get("config") or {})
                existing: list[dict[str, Any]] = list(cfg.get("feeds") or [])
                existing_urls = {f.get("url") for f in existing}
                new_feeds = [f for f in personal if f["url"] not in existing_urls]
                cfg["feeds"] = existing + new_feeds
                w = {**w, "config": cfg}
            elif w.get("type") == "rotate":
                inner = _inject(w.get("config", {}).get("widgets") or [])
                w = {**w, "config": {**w.get("config", {}), "widgets": inner}}
            result.append(w)
        return result

    return _inject(widgets)


def _inject_people_calendars(
    widgets: list[dict[str, Any]],
    screen_people_ids: list[str] | None,
    all_people: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    """Inject calendar_ids derived from people into all calendar widgets.

    If screen_people_ids is None (field absent from YAML), calendar widgets are
    left untouched — manual calendar_ids in widget config still work.
    If screen_people_ids is [] or a list, family people are always included.
    """
    if screen_people_ids is None:
        return widgets

    calendar_ids: list[str] = []
    for person in all_people:
        if person.get("family") or person.get("id") in screen_people_ids:
            calendar_ids.extend(person.get("calendar_ids") or [])

    # Deduplicate preserving order
    seen: set[str] = set()
    merged: list[str] = [x for x in calendar_ids if not (x in seen or seen.add(x))]

    def _inject(wlist: list[dict[str, Any]]) -> list[dict[str, Any]]:
        result = []
        for w in wlist:
            if w.get("type") == "calendar":
                w = {**w, "config": {**w.get("config", {}), "calendar_ids": merged}}
            elif w.get("type") == "rotate":
                inner = _inject(w.get("config", {}).get("widgets") or [])
                w = {**w, "config": {**w.get("config", {}), "widgets": inner}}
            result.append(w)
        return result

    return _inject(widgets)


def get_config(screen: str | None = None) -> dict[str, Any]:
    """Return a merged single-screen config view.

    For old flat format: returns the raw config unchanged.
    For new multi-screen format: merges shared + the requested screen.
    Falls back to the first screen if the requested screen ID is not found.
    """
    raw = _config

    if not _is_multi_screen(raw):
        return raw

    shared: dict[str, Any] = raw.get("shared", {})
    screens: list[dict[str, Any]] = raw.get("screens", [])

    if not screens:
        # Only shared — return shared as a degenerate single-screen view
        return {
            "location": shared.get("location", {}),
            "language": shared.get("language", "nl"),
            "layout": shared.get("layout", {"columns": 12, "rows": 8}),
            "widgets": shared.get("widgets", []),
        }

    # Find the requested screen, or default to the first
    target: dict[str, Any] | None = None
    if screen:
        target = next((s for s in screens if s.get("id") == screen), None)
        if target is None:
            logger.warning("Screen '%s' not found — falling back to first screen", screen)
    if target is None:
        target = screens[0]

    # Merge: screen overrides shared for location/language/layout
    screen_widgets = list(target.get("widgets", []))
    screen_widget_ids = {w["id"] for w in screen_widgets}
    # Screen-level widget with the same id shadows the shared one (e.g. portrait
    # screens can reposition the news ticker without duplicating it).
    shared_widgets_filtered = [
        w for w in shared.get("widgets", []) if w["id"] not in screen_widget_ids
    ]
    merged_widgets = screen_widgets + shared_widgets_filtered

    # Inject person-specific config into widgets
    all_people = shared.get("people") or []
    screen_people_ids = target.get("people")  # None = field absent, [] = explicitly empty
    merged_widgets = _inject_people_feeds(merged_widgets, screen_people_ids, all_people)
    merged_widgets = _inject_people_calendars(merged_widgets, screen_people_ids, all_people)
    merged_widgets = _inject_people_commute(merged_widgets, screen_people_ids, all_people)
    merged_widgets = _inject_garbage(merged_widgets, shared.get("garbage"))
    merged_widgets = _inject_p2000(merged_widgets, shared.get("p2000"))

    merged: dict[str, Any] = {
        "location":    target.get("location")    or shared.get("location", {}),
        "language":    target.get("language")    or shared.get("language", "nl"),
        "layout":      target.get("layout")      or shared.get("layout", {"columns": 12, "rows": 8}),
        "orientation": target.get("orientation") or shared.get("orientation", "landscape"),
        # Screen-specific widgets first, shared widgets appended (e.g. news ticker stays at bottom)
        "widgets": merged_widgets,
        # Pass through shared-only keys used by backend routers
        "network":   shared.get("network", {}),
        "p2000":     shared.get("p2000", {}),
        "assistant": shared.get("assistant", {}),
        "fade_speed": shared.get("fade_speed", 0.8),
    }
    return merged


def get_screen_ids() -> list[str]:
    """Return the list of screen IDs defined in the config (empty for flat format)."""
    if not _is_multi_screen(_config):
        return []
    return [s.get("id", "") for s in _config.get("screens", []) if s.get("id")]


def get_raw_config() -> dict[str, Any]:
    """Return the full unmerged config (for admin panel reads)."""
    return _config


def save_config(data: dict[str, Any]) -> None:
    """Atomically write data to the config file (triggers file watcher + SSE)."""
    _write_config(Path(settings.wall_config_path), data)


def subscribe() -> asyncio.Queue:
    q: asyncio.Queue = asyncio.Queue()
    _subscribers.append(q)
    return q


def unsubscribe(q: asyncio.Queue) -> None:
    try:
        _subscribers.remove(q)
    except ValueError:
        pass


def _broadcast() -> None:
    for q in list(_subscribers):
        try:
            q.put_nowait("config-updated")
        except asyncio.QueueFull:
            pass


async def watch_config() -> None:
    """Background task: watch the config file and broadcast on change."""
    global _config
    _config = load_config()
    logger.info("Config loaded from %s", settings.wall_config_path)

    path = Path(settings.wall_config_path)
    # Watch the parent directory so we also catch atomic saves (tmp→rename)
    async for changes in awatch(path.parent):
        changed_paths = {str(c[1]) for c in changes}
        if str(path) in changed_paths:
            try:
                _config = load_config()
                logger.info("Config reloaded")
                for fn in list(_change_callbacks):
                    try:
                        fn()
                    except Exception as exc:
                        logger.warning("Config change callback failed: %s", exc)
                _broadcast()
            except yaml.YAMLError as exc:
                logger.error("Config reload failed (YAML error): %s", exc)
