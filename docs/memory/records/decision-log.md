# Decision Log

## 2026-03-15 — Initial Architecture

### Casting approach: URL cast, no SDK
**Decision**: No Cast SDK in the container. Cast `http://<vps-ip>/` via Chrome browser once; Chromecast keeps it running. Optionally automate with `go-chromecast` CLI as a one-shot compose service.
**Rationale**: Cast SDK requires Google Cloud project setup, device registration, and complex auth. Casting a URL from Chrome is trivial and stable. The SSE connection keeps the page alive and auto-updates on config change.

### Frontend: React + Vite + Tailwind
**Decision**: React 18, TypeScript, Vite, Tailwind CSS v4, TanStack Query v5.
**Rationale**: Consistent with user's other projects (mypolestar, time-keeper). Fast dev cycle. TanStack Query handles caching and refetch intervals for API widgets cleanly.

### Backend: FastAPI (Python 3.12)
**Decision**: FastAPI with pydantic-settings, pyyaml, watchfiles, httpx, feedparser.
**Rationale**: Consistent with mypolestar. SSE support is built-in via `StreamingResponse`. `watchfiles.awatch` is the cleanest async file watcher available.

### Config: YAML file, volume-mounted
**Decision**: `/config/wall-cast.yaml`, hot-reloaded via SSE.
**Rationale**: Human-readable, easy to edit via SSH on the VPS. SSE means zero-downtime config changes — the display updates within ~1 second of saving the file.

### API proxying in backend
**Decision**: All external API calls go through the backend, not direct from the browser.
**Rationale**: buienradar.nl does not send CORS headers. Proxy solves this and also caches responses to avoid rate-limit issues. Caching TTLs: weather 15m, rain 5m, news 10m.

### Weather API: open-meteo.com
**Decision**: Use open-meteo.com free tier for weather data.
**Rationale**: No API key required. Returns hourly + daily forecast. Dutch users are within the European coverage. Covers Netherlands perfectly.

### No auth on the app
**Decision**: No login/session in the app. Network-level protection only.
**Rationale**: This is a display-only kiosk on a local network. If the VPS is internet-facing, user should add nginx `allow 192.168.0.0/16; deny all;` to restrict access.
