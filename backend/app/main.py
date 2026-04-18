import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import log_capture, wall_config
from app.routers import config, weather, rain, news, sun, garbage, polestar, calendar, traffic, warnings, bus, network, status, rule_variables, airquality, market, p2000  # truthometer disabled

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
log_capture.install()
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    task = asyncio.create_task(wall_config.watch_config())
    yield
    task.cancel()
    try:
        await task
    except asyncio.CancelledError:
        pass


app = FastAPI(
    title="wall-cast API",
    description="Backend for the wall-cast display system",
    version="0.1.0",
    lifespan=lifespan,
    docs_url="/api/docs",
    openapi_url="/api/openapi.json",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restricted at nginx level; dev convenience
    allow_methods=["GET", "PUT", "POST"],
    allow_headers=["*"],
)

app.include_router(config.router, prefix="/api")
app.include_router(weather.router, prefix="/api")
app.include_router(rain.router, prefix="/api")
app.include_router(news.router, prefix="/api")
app.include_router(sun.router, prefix="/api")
app.include_router(garbage.router, prefix="/api")
app.include_router(polestar.router, prefix="/api")
app.include_router(calendar.router, prefix="/api")
app.include_router(traffic.router, prefix="/api")
app.include_router(warnings.router, prefix="/api")
app.include_router(bus.router, prefix="/api")
app.include_router(network.router, prefix="/api")
app.include_router(status.router, prefix="/api")
app.include_router(rule_variables.router, prefix="/api")
app.include_router(airquality.router,    prefix="/api")
app.include_router(market.router,        prefix="/api")
app.include_router(p2000.router,         prefix="/api")
# app.include_router(truthometer.router,   prefix="/api")  # disabled


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
