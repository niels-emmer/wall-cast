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

    return data


def _is_multi_screen(raw: dict[str, Any]) -> bool:
    return "screens" in raw


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

    # Inject people's calendar_ids into calendar widgets
    all_people = shared.get("people") or []
    screen_people_ids = target.get("people")  # None = field absent, [] = explicitly empty
    merged_widgets = _inject_people_calendars(merged_widgets, screen_people_ids, all_people)

    merged: dict[str, Any] = {
        "location": target.get("location") or shared.get("location", {}),
        "language": target.get("language") or shared.get("language", "nl"),
        "layout":   target.get("layout")   or shared.get("layout", {"columns": 12, "rows": 8}),
        # Screen-specific widgets first, shared widgets appended (e.g. news ticker stays at bottom)
        "widgets": merged_widgets,
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
