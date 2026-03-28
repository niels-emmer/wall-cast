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
                for key in ("stop_city", "stop_name"):
                    if not cfg.get(key):
                        cfg[key] = bus_cfg.get(key, "")
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
    merged_widgets = list(target.get("widgets", [])) + list(shared.get("widgets", []))

    # Inject person-specific config into widgets
    all_people = shared.get("people") or []
    screen_people_ids = target.get("people")  # None = field absent, [] = explicitly empty
    merged_widgets = _inject_people_feeds(merged_widgets, screen_people_ids, all_people)
    merged_widgets = _inject_people_calendars(merged_widgets, screen_people_ids, all_people)
    merged_widgets = _inject_people_commute(merged_widgets, screen_people_ids, all_people)
    merged_widgets = _inject_garbage(merged_widgets, shared.get("garbage"))
    merged_widgets = _inject_p2000(merged_widgets, shared.get("p2000"))

    merged: dict[str, Any] = {
        "location": target.get("location") or shared.get("location", {}),
        "language": target.get("language") or shared.get("language", "nl"),
        "layout":   target.get("layout")   or shared.get("layout", {"columns": 12, "rows": 8}),
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
