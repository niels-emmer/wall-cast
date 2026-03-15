import asyncio
import json
import logging

from fastapi import APIRouter
from fastapi.responses import JSONResponse, StreamingResponse

from app import wall_config

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
