"""
YAML config loader with async file watcher and SSE broadcaster.

When wall-cast.yaml is saved, all connected SSE clients receive a
'config-updated' event and the frontend re-fetches the config.
"""

import asyncio
import logging
import uuid
from pathlib import Path
from typing import Any

import yaml
from watchfiles import awatch

from app.config import settings

logger = logging.getLogger(__name__)

_config: dict[str, Any] = {}
_subscribers: list[asyncio.Queue] = []
_change_callbacks: list = []  # callables invoked synchronously on every config reload


def on_config_change(fn) -> None:
    """Register a zero-argument callable to be called whenever the config reloads."""
    _change_callbacks.append(fn)

# Unique ID for this backend process. Changes on every container restart.
# Clients use this to detect a restart and reload the page.
_startup_id: str = str(uuid.uuid4())


def get_startup_id() -> str:
    return _startup_id


def load_config() -> dict[str, Any]:
    """Parse the YAML config file and return as a dict."""
    path = Path(settings.wall_config_path)
    if not path.exists():
        logger.warning("Config file not found: %s — using empty config", path)
        return {}
    with open(path, encoding="utf-8") as f:
        return yaml.safe_load(f) or {}


def get_config() -> dict[str, Any]:
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
