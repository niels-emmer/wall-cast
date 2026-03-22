"""Status endpoints for the landing page."""
import time
from pathlib import Path

from fastapi import APIRouter
from fastapi.responses import JSONResponse

from app import log_capture

router = APIRouter(tags=["status"])

CASTER_HEARTBEAT_PATH = Path("/config/caster-heartbeat.txt")
CASTER_STALE_AFTER = 180  # seconds — 3× the default 60 s check interval


@router.get("/admin/status")
async def get_status() -> JSONResponse:
    caster_status = "offline"
    last_seen_s: int | None = None
    try:
        ts = float(CASTER_HEARTBEAT_PATH.read_text().strip())
        last_seen_s = int(time.time() - ts)
        caster_status = "ok" if last_seen_s < CASTER_STALE_AFTER else "stale"
    except Exception:
        pass

    return JSONResponse(content={
        "backend": {"status": "ok"},
        "caster": {"status": caster_status, "last_seen_s": last_seen_s},
    })


@router.get("/admin/logs")
async def get_logs() -> JSONResponse:
    return JSONResponse(content={"records": log_capture.get_records()})
