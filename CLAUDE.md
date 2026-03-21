# wall-cast — Claude Instructions

## Project Overview

A Docker-hosted wall display that casts to multiple Chromecast-connected screens. Dark-themed, widget-based, hot-reloading. Multi-screen: one installation drives any number of Chromecasts, each with its own layout, people, and Chromecast IP.

## Stack

- **Backend**: Python 3.12, FastAPI, pydantic-settings, pyyaml, watchfiles, httpx, feedparser
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v4, TanStack Query v5
- **Serving**: nginx:alpine proxies `/api/*` → `backend:8000`
- **Containers**: Docker Compose (four services: `frontend`, `backend`, `caster`, `scanner`)
- **Config**: `/config/wall-cast.yaml` — gitignored, auto-created on first run, hot-reloaded via SSE

## Commands

### Development

```bash
docker compose -f docker-compose.dev.yml up --build
```

- Frontend Vite dev server: http://localhost:5173
- Backend FastAPI: http://localhost:8000
- API docs: http://localhost:8000/docs

### Production

```bash
docker compose up --build -d
```

- Display URL: http://localhost/ (or VPS IP)
- Logs: `docker compose logs -f`

### Frontend (without Docker, for fast iteration)

```bash
cd frontend && npm install && npm run dev
```

## Memory System

See `docs/memory/INDEX.md` for project state, decisions, and context.
Decision log: `docs/memory/records/decision-log.md`.
Always read `docs/memory/INDEX.md` at the start of each session on this project.

## Architecture

```
┌─── Docker host ─────────────────────────────────────────────────────┐
│                                                                      │
│  ┌─────────────────┐   /api/*    ┌──────────────────────────────┐  │
│  │  frontend       │────────────▶│  backend  (FastAPI :8000)    │  │
│  │  nginx :80      │             │                              │  │
│  │  React SPA      │             │  GET /api/config?screen=     │  │
│  └─────────────────┘             │  GET /api/config/stream(SSE) │  │
│                                  │  PUT /api/admin/config       │  │
│                                  │  GET /api/admin/scan ──────► │──┼──▶ scanner :8765
│                                  │  GET /api/weather, rain, … │  │
│                                  └──────────────┬───────────────┘  │
│                                                 │ reads/writes      │
│                                        config/wall-cast.yaml        │
│                                                                      │
│  ┌─────────────────┐  host network   ┌──────────────────────────┐  │
│  │  caster         │                 │  scanner                 │  │
│  │  reads config   │                 │  HTTP :8765              │  │
│  │  catt cast_site │                 │  catt scan (mDNS)        │  │
│  │  → each screen  │                 └──────────────────────────┘  │
│  └────────┬────────┘                                                │
└───────────┼─────────────────────────────────────────────────────────┘
            │ DashCast receiver
            ▼
   Chromecast / Google TV  (same LAN)
   loads /?screen=<id>  ←  SSE keeps page live
   browser subscribes to ntfy SSE directly (no proxy)
```

**Services:**

- **frontend** — nginx:alpine, port 80. Serves the React SPA, proxies `/api/*` to backend with `proxy_buffering off` for SSE.
- **backend** — python:3.12-slim, internal only. FastAPI. Reads/writes `config/wall-cast.yaml`. `GET /api/config?screen=<id>` merges `shared` + the named screen config. Auto-creates a default config on first run. Auto-migrates old flat-format configs to the `shared + screens[]` schema. All external API calls proxied with caching.
- **caster** — python:3.12-slim, `network_mode: host` (required for mDNS). `cast.py` reads `chromecast_ip` from each screen in the YAML config. Manages all Chromecasts. Re-reads config on every check cycle — adding a screen's IP in the admin panel takes effect automatically without restart.
- **scanner** — python:3.12-slim, `network_mode: host`, port 8765. `scanner.py` runs `catt scan` on demand and returns `[{name, ip}]` as JSON. Backend proxies `GET /api/admin/scan` to it via `host.docker.internal`.

**Config file**: `config/wall-cast.yaml` is gitignored and auto-created on first run. It will never block `git pull`. `config/wall-cast.example.yaml` is the annotated template tracked in git.

**API endpoints:**

| Endpoint | Purpose | Cache TTL |
|----------|---------|-----------|
| `GET /api/config?screen=<id>` | Merged shared+screen config as JSON | — |
| `GET /api/config/stream` | SSE — pushes on YAML save | real-time |
| `PUT /api/admin/config` | Write config from admin panel (atomic) | — |
| `GET /api/admin/scan` | Proxy to scanner; returns Chromecast devices | — |
| `GET /api/weather` | open-meteo.com proxy | 15 min |
| `GET /api/rain` | buienalarm.nl proxy | 5 min |
| `GET /api/news` | RSS aggregator (feedparser) | 10 min |
| `GET /api/sun` | sunrise-sunset.org proxy | 6 h |
| `GET /api/garbage` | mijnafvalwijzer.nl proxy | 1 h |
| `GET /api/polestar` | pypolestar → Polestar cloud | 5 min |
| `GET /api/calendar` | Google Calendar API (service account) | 10 min |
| `GET /api/traffic` | ANWB jams + TomTom travel time | 5 min |
| `GET /api/warnings` | MeteoAlarm (KNMI) Atom/CAP feed | 15 min |
| `GET /api/bus` | vertrektijd.info proxy | 30 s |

## Widget System

Widgets are registered in `frontend/src/widgets/index.ts`. To add a widget:

1. Create `frontend/src/widgets/<name>/<Name>Widget.tsx`
2. Add a data router in `backend/app/routers/<name>.py` if external data is needed
3. Register the component in `frontend/src/widgets/index.ts`
4. Add the widget type to `docs/config-reference.md`
5. Use it in `/config/wall-cast.yaml`

## CRITICAL: Layout CSS Rules

**Tailwind utility classes are unreliable in the production build.** All layout-critical CSS must use inline `style={{ }}` objects. This is a known and confirmed issue — do not attempt to use Tailwind for layout.

```tsx
// ✅ correct — always works
<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>

// ❌ silently breaks in production build
<div className="flex flex-col h-full">
```

This applies to: `display`, `flexDirection`, `height`, `overflow`, `whiteSpace`, `gap`, `alignItems`, `justifyContent`, `minHeight`, `flex`, `padding`, `margin`, and all other layout properties.

CSS variables and `clamp()` for font sizing work fine. Only layout utilities are unreliable.

## Security Notes

- Backend is NOT exposed on the host — nginx is the only public port
- Config directory is mounted **read-write** (admin panel writes back to wall-cast.yaml)
- nginx: `server_tokens off`, security headers set
- No auth by design (local network only); add nginx `allow/deny` if VPS is internet-facing
- No secrets in the app — all external APIs are public/unauthenticated (private credentials go in `.env`)
- Backend runs as `${UID:-1000}:${GID:-1000}` (set in `.env`); config written with `chmod 664` so host user retains access

## Key Files

| File | Purpose |
|------|---------|
| `docs/memory/records/decision-log.md` | Architectural decision log with rationale |
| `config/wall-cast.yaml` | User widget configuration — gitignored, auto-created, hot-reloads on save |
| `config/wall-cast.example.yaml` | Annotated config template tracked in git |
| `backend/app/wall_config.py` | YAML loader + auto-create/migrate + file watcher + SSE broadcaster |
| `backend/app/routers/weather.py` | open-meteo proxy, 15 min cache |
| `backend/app/routers/rain.py` | buienalarm.nl proxy, 5 min cache |
| `backend/app/routers/news.py` | RSS aggregator, 10 min cache |
| `backend/app/routers/sun.py` | sunrise-sunset.org proxy, 6 h cache |
| `backend/app/routers/calendar.py` | Google Calendar API, 10 min cache |
| `backend/app/routers/traffic.py` | ANWB + TomTom proxy, 5 min cache |
| `backend/app/routers/warnings.py` | MeteoAlarm Atom/CAP proxy, 15 min cache |
| `backend/app/routers/bus.py` | vertrektijd.info proxy, 30 s cache |
| `caster/cast.py` | Smart multi-screen caster; reads chromecast_ip from config |
| `caster/scanner.py` | HTTP server on :8765; runs catt scan on demand |
| `frontend/src/widgets/index.ts` | Widget registry |
| `frontend/src/App.tsx` | Root: reads config, renders CSS grid |
| `frontend/src/hooks/use-config.ts` | Fetches config (with ?screen=), subscribes to SSE |
| `frontend/src/hooks/use-ntfy.ts` | Browser-side ntfy SSE subscriber (breaking news) |
| `frontend/src/widgets/weather/WeatherWidget.tsx` | Weather + sunrise/sunset (SunBlock subcomponent) |
| `frontend/src/widgets/news/NewsTickerWidget.tsx` | News ticker + breaking news integration |

## Data Sources

| Endpoint | External API | Cache TTL | API key |
|----------|-------------|-----------|---------|
| /api/weather | open-meteo.com | 15 min | None |
| /api/rain | cdn-secure.buienalarm.nl | 5 min | None |
| /api/news | RSS feeds (configurable) | 10 min | None |
| /api/sun | sunrise-sunset.org | 6 h | None |
| /api/garbage | api.mijnafvalwijzer.nl | 1 h | None (public key) |
| /api/polestar | Polestar cloud via pypolestar | 5 min | `POLESTAR_USERNAME` / `POLESTAR_PASSWORD` |
| /api/calendar | Google Calendar API v3 | 10 min | Service account JSON at `config/google-sa.json` |
| /api/traffic | ANWB incidents + TomTom routing | 5 min | `TOMTOM_API_KEY` |
| /api/warnings | MeteoAlarm Atom/CAP feed | 15 min | None |
| /api/bus | vertrektijd.info | 30 s | None |
| ntfy (browser direct) | ntfy instance (self-hosted) | real-time | None |
