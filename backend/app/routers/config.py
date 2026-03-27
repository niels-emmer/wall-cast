import asyncio
import json
import logging
import os
import re
import tempfile
import urllib.parse
from pathlib import Path
from typing import Any, Optional

import httpx
import yaml
from fastapi import APIRouter, HTTPException, Query
from fastapi.responses import JSONResponse, StreamingResponse

from app import wall_config
from app.config import settings

logger = logging.getLogger(__name__)
router = APIRouter(tags=["config"])


@router.get("/config")
async def get_config(screen: str | None = Query(default=None)) -> JSONResponse:
    return JSONResponse(content=wall_config.get_config(screen=screen))


@router.get("/config/stream")
async def config_stream(screen: str | None = Query(default=None)) -> StreamingResponse:
    """
    Server-Sent Events endpoint.
    Sends a 'config-updated' event whenever wall-cast.yaml changes.
    All screens subscribe to the same stream; each re-fetches its own
    /api/config?screen=<id> when the event fires.
    """

    async def event_generator():
        # Announce startup ID so clients can detect a backend restart
        hello = json.dumps({"startup_id": wall_config.get_startup_id()})
        yield f"event: server-hello\ndata: {hello}\n\n"

        queue = wall_config.subscribe()
        try:
            while True:
                try:
                    msg = await asyncio.wait_for(queue.get(), timeout=30)
                    yield f"event: {msg}\ndata: {{}}\n\n"
                except asyncio.TimeoutError:
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


@router.get("/admin/config")
async def get_admin_config() -> JSONResponse:
    """Return the full unmerged config (for the admin panel)."""
    return JSONResponse(content=wall_config.get_raw_config())


@router.get("/admin/scan")
async def scan_chromecasts() -> JSONResponse:
    """Proxy to the scanner sidecar to discover Chromecasts on the LAN.

    The scanner sidecar runs `catt scan` with host networking so mDNS works.
    Returns a list of {name, ip} objects, or an empty list if none found.
    """
    try:
        async with httpx.AsyncClient() as client:
            r = await client.get("http://host.docker.internal:8765/scan", timeout=35.0)
            return JSONResponse(content=r.json())
    except Exception as exc:
        raise HTTPException(status_code=503, detail=f"Scanner unavailable: {exc}")


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


@router.get("/admin/google-sa-email")
async def get_google_sa_email() -> JSONResponse:
    """Return the service account email from the Google SA key file, or null if not configured."""
    path = Path(settings.google_sa_key_file)
    if not path.exists():
        return JSONResponse(content={"email": None})
    try:
        data = json.loads(path.read_text(encoding="utf-8"))
        return JSONResponse(content={"email": data.get("client_email")})
    except Exception:
        return JSONResponse(content={"email": None})


_TOMTOM_SEARCH_URL = "https://api.tomtom.com/search/2/search/{query}.json"
_TOMTOM_ROUTE_URL = (
    "https://api.tomtom.com/routing/1/calculateRoute"
    "/{olat},{olon}:{dlat},{dlon}/json"
    "?traffic=false&travelMode=car&instructionsType=text&key={key}"
)
_TOMTOM_GEOCODE_URL = (
    "https://api.tomtom.com/search/2/geocode/{query}.json"
    "?key={key}&limit=1&countrySet=NL,BE,DE"
)
_ROAD_PATTERN = re.compile(r"^[ANEN]\d+[a-z]?$", re.IGNORECASE)


@router.get("/admin/address-search")
async def address_search(q: str = Query(default="")) -> JSONResponse:
    """Return TomTom address autocomplete suggestions for the given query string."""
    if not q.strip() or not settings.tomtom_api_key:
        return JSONResponse(content={"results": []})
    url = _TOMTOM_SEARCH_URL.format(query=urllib.parse.quote(q.strip()))
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            resp = await client.get(url, params={
                "key": settings.tomtom_api_key,
                "limit": 6,
                "typeahead": "true",
            })
            resp.raise_for_status()
        results = resp.json().get("results", [])
        addresses = [
            r["address"]["freeformAddress"]
            for r in results
            if r.get("address", {}).get("freeformAddress")
        ]
        return JSONResponse(content={"results": addresses})
    except Exception as exc:
        logger.warning("Address search failed: %s", exc)
        return JSONResponse(content={"results": []})


async def _geocode_address(
    client: httpx.AsyncClient, address: str, key: str
) -> tuple[float, float] | None:
    """Geocode a single address string via TomTom. Returns (lat, lon) or None."""
    try:
        url = _TOMTOM_GEOCODE_URL.format(query=urllib.parse.quote(address), key=key)
        resp = await client.get(url)
        resp.raise_for_status()
        results = resp.json().get("results", [])
        if not results:
            return None
        pos = results[0]["position"]
        return (pos["lat"], pos["lon"])
    except Exception as exc:
        logger.warning("Geocoding failed for '%s': %s", address, exc)
        return None


@router.get("/admin/route-roads")
async def get_route_roads(
    home: str = Query(default=""),
    work: str = Query(default=""),
) -> JSONResponse:
    """Given home and work addresses, return the A/N road numbers along the TomTom route."""
    if not home.strip() or not work.strip() or not settings.tomtom_api_key:
        return JSONResponse(content={"roads": [], "error": None})

    async with httpx.AsyncClient(timeout=10.0) as client:
        home_coords, work_coords = await asyncio.gather(
            _geocode_address(client, home.strip(), settings.tomtom_api_key),
            _geocode_address(client, work.strip(), settings.tomtom_api_key),
        )

    if not home_coords or not work_coords:
        return JSONResponse(content={
            "roads": [],
            "error": "Could not geocode one or both addresses — check them in the Traffic section.",
        })

    try:
        url = _TOMTOM_ROUTE_URL.format(
            olat=home_coords[0], olon=home_coords[1],
            dlat=work_coords[0], dlon=work_coords[1],
            key=settings.tomtom_api_key,
        )
        async with httpx.AsyncClient(timeout=10.0) as client:
            resp = await client.get(url)
            resp.raise_for_status()
        data = resp.json()
    except Exception as exc:
        logger.warning("Route roads fetch failed: %s", exc)
        return JSONResponse(content={"roads": [], "error": "TomTom routing request failed."})

    roads: set[str] = set()
    instructions = (
        data.get("routes", [{}])[0]
            .get("guidance", {})
            .get("instructions", [])
    )
    for instr in instructions:
        for road in instr.get("roadNumbers", []):
            if road and _ROAD_PATTERN.match(road):
                roads.add(road.upper())

    return JSONResponse(content={"roads": sorted(roads), "error": None})


@router.post("/admin/casting/global", status_code=204)
async def set_global_casting(body: dict[str, Any]) -> None:
    """Toggle global casting on/off in shared.casting_enabled."""
    raw = wall_config.get_raw_config()
    raw.setdefault("shared", {})["casting_enabled"] = bool(body.get("enabled", True))
    wall_config.save_config(raw)


@router.post("/admin/casting/screen", status_code=204)
async def set_screen_casting(body: dict[str, Any]) -> None:
    """Toggle casting for a specific screen via screen.casting_active."""
    screen_id = body.get("screen_id")
    active = bool(body.get("active", True))
    raw = wall_config.get_raw_config()
    for screen in raw.get("screens", []):
        if screen.get("id") == screen_id:
            screen["casting_active"] = active
            break
    wall_config.save_config(raw)


@router.post("/admin/notify/test", status_code=204)
async def test_notification() -> None:
    """Send a test notification to the system ntfy topic."""
    raw      = wall_config.get_raw_config()
    shared   = raw.get("shared", {})
    assistant = shared.get("assistant", {})
    notify   = assistant.get("notify", {})
    ntfy_url = notify.get("ntfy_url", "").rstrip("/")
    ntfy_topic = notify.get("ntfy_topic", "wall-cast-alerts")

    if not ntfy_url:
        raise HTTPException(status_code=400, detail="No ntfy_url configured in assistant.notify")

    url = f"{ntfy_url}/{ntfy_topic}"
    async with httpx.AsyncClient(timeout=10.0) as client:
        try:
            resp = await client.post(
                url,
                content="This is a test notification from wall-cast. ✅".encode(),
                headers={
                    "Title":    "wall-cast test",
                    "Priority": "default",
                    "Tags":     "white_check_mark",
                },
            )
            resp.raise_for_status()
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"ntfy send failed: {exc}")


@router.post("/admin/casting/recast", status_code=204)
async def recast_screen(body: dict[str, Any]) -> None:
    """Drop a signal file that tells the caster to force-recast this screen immediately."""
    screen_id = (body.get("screen_id") or "").strip()
    if not screen_id:
        raise HTTPException(status_code=400, detail="screen_id required")
    config_dir = Path(settings.wall_config_path).parent
    signal_path = config_dir / f"recast-{screen_id}.signal"
    signal_path.touch()


@router.get("/admin/pairing/{screen_id}")
async def get_pairing_status(screen_id: str) -> JSONResponse:
    """Return whether a screen is paired and the current pairing session state (if any)."""
    config_dir = Path(settings.wall_config_path).parent
    cert_file  = config_dir / "atv-certs" / screen_id / "cert.pem"
    paired     = cert_file.exists()

    session: Optional[dict] = None
    status_file = config_dir / f"pair-status-{screen_id}.json"
    if status_file.exists():
        try:
            session = json.loads(status_file.read_text())
        except Exception:
            pass

    return JSONResponse(content={"paired": paired, "session": session})


@router.post("/admin/pairing/start", status_code=204)
async def start_pairing(body: dict[str, Any]) -> None:
    """Write a pair-start signal so cast.py spawns pair.py for this screen."""
    screen_id = (body.get("screen_id") or "").strip()
    ip        = (body.get("ip") or "").strip()
    if not screen_id:
        raise HTTPException(status_code=400, detail="screen_id required")
    if not ip:
        raise HTTPException(status_code=400, detail="ip required")

    config_dir  = Path(settings.wall_config_path).parent
    status_file = config_dir / f"pair-status-{screen_id}.json"
    if status_file.exists():
        status_file.unlink()

    (config_dir / f"pair-start-{screen_id}.signal").write_text(ip)


@router.post("/admin/pairing/pin", status_code=204)
async def submit_pairing_pin(body: dict[str, Any]) -> None:
    """Write the PIN file so pair.py can finish pairing."""
    screen_id = (body.get("screen_id") or "").strip()
    pin       = (body.get("pin") or "").strip()
    if not screen_id:
        raise HTTPException(status_code=400, detail="screen_id required")
    if not pin:
        raise HTTPException(status_code=400, detail="pin required")

    config_dir = Path(settings.wall_config_path).parent
    (config_dir / f"pair-pin-{screen_id}.json").write_text(json.dumps({"pin": pin}))


@router.post("/admin/casting/wake", status_code=204)
async def wake_screen(body: dict[str, Any]) -> None:
    """Drop a wake signal — caster wakes the display then resumes normal casting."""
    screen_id = (body.get("screen_id") or "").strip()
    if not screen_id:
        raise HTTPException(status_code=400, detail="screen_id required")
    config_dir = Path(settings.wall_config_path).parent
    (config_dir / f"wake-{screen_id}.signal").touch()


@router.post("/admin/casting/sleep", status_code=204)
async def sleep_screen(body: dict[str, Any]) -> None:
    """Drop a sleep signal — caster stops casting and puts the display in standby."""
    screen_id = (body.get("screen_id") or "").strip()
    if not screen_id:
        raise HTTPException(status_code=400, detail="screen_id required")
    config_dir = Path(settings.wall_config_path).parent
    (config_dir / f"sleep-{screen_id}.signal").touch()
