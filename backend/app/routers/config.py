import asyncio
import json
import logging
import os
import tempfile
from pathlib import Path
from typing import Any

import yaml
from fastapi import APIRouter, HTTPException
from fastapi.responses import JSONResponse, StreamingResponse

from app import wall_config
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(tags=["config"])


@router.get("/config")
async def get_config() -> JSONResponse:
    return JSONResponse(content=wall_config.get_config())


@router.get("/config/stream")
async def config_stream() -> StreamingResponse:
    """
    Server-Sent Events endpoint.
    Sends a 'config-updated' event whenever wall-cast.yaml changes.
    """

    async def event_generator():
        # First: announce startup ID so clients can detect a backend restart
        hello = json.dumps({"startup_id": wall_config.get_startup_id()})
        yield f"event: server-hello\ndata: {hello}\n\n"

        # Send current config on connect so the client is immediately in sync
        data = json.dumps(wall_config.get_config())
        yield f"event: config\ndata: {data}\n\n"

        queue = wall_config.subscribe()
        try:
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"event: {msg}\ndata: {{}}\n\n"
                except asyncio.TimeoutError:
                    # Keep-alive comment
                    yield ": keep-alive\n\n"
        except asyncio.CancelledError:
            pass
        finally:
            wall_config.unsubscribe(queue)

    return StreamingResponse(
        event_generator(),
        media_type="text/event-stream",
        headers={
            "Cache-Control": "no-cache",
            "X-Accel-Buffering": "no",  # disable nginx buffering for SSE
        },
    )


@router.put("/admin/config", status_code=204)
async def update_config(body: dict[str, Any]) -> None:
    """Write a new config to wall-cast.yaml atomically."""
    path = Path(settings.wall_config_path)
    try:
        yaml_text = yaml.dump(body, allow_unicode=True, sort_keys=False, default_flow_style=False)
    except yaml.YAMLError as exc:
        raise HTTPException(status_code=422, detail=f"Cannot serialize config: {exc}")

    # Atomic write: write to a sibling tmp file then rename
    try:
        fd, tmp_path = tempfile.mkstemp(dir=path.parent, suffix=".tmp")
        try:
            with os.fdopen(fd, "w", encoding="utf-8") as f:
                f.write(yaml_text)
            os.replace(tmp_path, path)
        except Exception:
            os.unlink(tmp_path)
            raise
    except OSError as exc:
        raise HTTPException(status_code=500, detail=f"Cannot write config: {exc}")
