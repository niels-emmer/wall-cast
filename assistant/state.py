"""
Notification deduplication state.

Persisted to /config/assistant-state.json so sent-notification memory
survives container restarts. Keys are rule-specific strings; values are
ISO timestamps of when the notification was first sent.
"""

import json
import os
from datetime import datetime, timedelta, timezone

_STATE_PATH = os.environ.get("ASSISTANT_STATE_PATH", "/config/assistant-state.json")
_state: dict[str, str] = {}


def load() -> None:
    global _state
    try:
        with open(_STATE_PATH, encoding="utf-8") as f:
            _state = json.load(f)
        print(f"[assistant] Loaded {len(_state)} dedup entries from state", flush=True)
    except FileNotFoundError:
        _state = {}
    except Exception as exc:
        print(f"[assistant] State load error: {exc}", flush=True)
        _state = {}


def _save() -> None:
    try:
        with open(_STATE_PATH, "w", encoding="utf-8") as f:
            json.dump(_state, f, indent=2)
    except Exception as exc:
        print(f"[assistant] State save error: {exc}", flush=True)


def has_fired(key: str) -> bool:
    return key in _state


def mark_fired(key: str) -> None:
    _state[key] = datetime.now(timezone.utc).isoformat()
    _save()


def prune(max_age_days: int = 7) -> None:
    """Remove entries older than max_age_days to keep the state file tidy."""
    cutoff = datetime.now(timezone.utc) - timedelta(days=max_age_days)
    old_keys = [
        k for k, ts in list(_state.items())
        if datetime.fromisoformat(ts) < cutoff
    ]
    for k in old_keys:
        del _state[k]
    if old_keys:
        print(f"[assistant] Pruned {len(old_keys)} expired state entries", flush=True)
        _save()
