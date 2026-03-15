"""
YAML config loader with async file watcher and SSE broadcaster.

When wall-cast.yaml is saved, all connected SSE clients receive a
'config-updated' event and the frontend re-fetches the config.
"""

import asyncio
import logging
from pathlib import Path
from typing import Any

import yaml
from watchfiles import awatch

from app.config import settings

logger = logging.getLogger(__name__)

_config: dict[str, Any] = {}
_subscribers: list[asyncio.Queue] = []


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
                _broadcast()
            except yaml.YAMLError as exc:
                logger.error("Config reload failed (YAML error): %s", exc)
