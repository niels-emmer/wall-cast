"""
Lightweight per-API-source cache health registry.

Each API router calls update() after every fetch attempt.
The status endpoint reads get_all() to surface freshness and error state
on the landing page.
"""
import time

# source_name → {ok: bool, ts: float (monotonic), detail: str}
_sources: dict[str, dict] = {}


def update(name: str, ok: bool, detail: str = "") -> None:
    """Record the outcome of a fetch attempt for the given source."""
    _sources[name] = {"ok": ok, "ts": time.monotonic(), "detail": detail}


def get_all() -> dict[str, dict]:
    """Return all tracked sources with computed age_s (seconds since last update)."""
    now = time.monotonic()
    return {
        name: {
            "ok":     s["ok"],
            "age_s":  round(now - s["ts"]),
            "detail": s["detail"],
        }
        for name, s in _sources.items()
    }
