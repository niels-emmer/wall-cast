"""Status endpoints for the landing page and admin panel."""
import asyncio
import json
import time
from pathlib import Path

import httpx
from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app import cache_registry, log_capture, wall_config

router = APIRouter(tags=["status"])

CASTER_HEARTBEAT_PATH    = Path("/config/caster-heartbeat.txt")
CASTER_STATUS_PATH       = Path("/config/caster-status.json")
CASTER_STALE_AFTER       = 180  # seconds — 3× the default 60 s check interval

ASSISTANT_HEARTBEAT_PATH = Path("/config/assistant-heartbeat.txt")
ASSISTANT_STALE_AFTER    = 600  # seconds — 2× the default 300 s check interval

SCANNER_HOST = "host.docker.internal"
SCANNER_PORT = 8765


async def _check_scanner() -> str:
    """TCP probe to scanner port — returns 'ok' or 'offline'."""
    try:
        _, writer = await asyncio.wait_for(
            asyncio.open_connection(SCANNER_HOST, SCANNER_PORT), timeout=1.0
        )
        writer.close()
        return "ok"
    except Exception:
        return "offline"


async def _check_http(url: str) -> str:
    """HTTP GET probe — returns 'ok' or 'offline'. Any HTTP response counts as ok."""
    try:
        async with httpx.AsyncClient(timeout=3.0) as client:
            await client.get(url)
        return "ok"
    except Exception:
        return "offline"


@router.get("/admin/status")
async def get_status() -> JSONResponse:
    # Caster
    caster_status = "offline"
    last_seen_s: int | None = None
    try:
        ts = float(CASTER_HEARTBEAT_PATH.read_text().strip())
        last_seen_s = int(time.time() - ts)
        caster_status = "ok" if last_seen_s < CASTER_STALE_AFTER else "stale"
    except Exception:
        pass

    # Scanner (TCP probe — no scanner changes needed)
    scanner_status = await _check_scanner()

    # Assistant
    cfg = wall_config.get_config()
    assistant_enabled = cfg.get("assistant", {}).get("enabled", False)
    assistant_status = "disabled"
    assistant_last_s: int | None = None
    if assistant_enabled:
        try:
            ts_a = float(ASSISTANT_HEARTBEAT_PATH.read_text().strip())
            assistant_last_s = int(time.time() - ts_a)
            assistant_status = "ok" if assistant_last_s < ASSISTANT_STALE_AFTER else "stale"
        except Exception:
            assistant_status = "offline"

    # Notification server reachability — read from raw config (shared.assistant.notify)
    raw = wall_config.get_raw_config()
    notify_cfg = raw.get("shared", {}).get("assistant", {}).get("notify", {})
    ntfy_cfg   = notify_cfg.get("ntfy", {})
    matrix_cfg = notify_cfg.get("matrix", {})

    ntfy_url    = ntfy_cfg.get("url", "").rstrip("/")
    matrix_hs   = matrix_cfg.get("homeserver", "").rstrip("/")

    async def _static(val: str) -> str:
        return val

    ntfy_status, matrix_status = await asyncio.gather(
        _check_http(ntfy_url) if ntfy_url else _static("unconfigured"),
        _check_http(f"{matrix_hs}/_matrix/client/versions") if matrix_hs else _static("unconfigured"),
    )

    return JSONResponse(content={
        "backend":     {"status": "ok"},
        "caster":      {"status": caster_status, "last_seen_s": last_seen_s},
        "scanner":     {"status": scanner_status},
        "assistant":   {"status": assistant_status, "last_seen_s": assistant_last_s},
        "ntfy":        {"status": ntfy_status},
        "matrix":      {"status": matrix_status},
        "api_sources": cache_registry.get_all(),
    })


@router.get("/admin/screens/status")
async def get_screens_status() -> JSONResponse:
    """Per-screen caster status written by cast.py after each cycle."""
    try:
        data = json.loads(CASTER_STATUS_PATH.read_text())
        return JSONResponse(content=data)
    except Exception:
        return JSONResponse(content={"updated_at": None, "screens": {}})


@router.get("/admin/logs")
async def get_logs() -> JSONResponse:
    return JSONResponse(content={"records": log_capture.get_records()})
