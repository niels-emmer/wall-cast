import asyncio
import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app import wall_config
from app.routers import config, weather, rain, news, sun, garbage, polestar, calendar, traffic, warnings, bus, network

logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s %(levelname)s %(name)s — %(message)s",
)
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
    docs_url="/docs",
    redoc_url=None,
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],  # Restricted at nginx level; dev convenience
    allow_methods=["GET"],
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


@app.get("/health")
async def health() -> dict:
    return {"status": "ok"}
