# wall-cast — Claude Instructions

## Project Overview

A Docker-hosted wall display that casts to a Chromecast-connected screen. Dark-themed, widget-based, hot-reloading.

## Stack

- **Backend**: Python 3.12, FastAPI, pydantic-settings, pyyaml, watchfiles, httpx, feedparser
- **Frontend**: React 18, TypeScript, Vite, Tailwind CSS v4, TanStack Query v5
- **Serving**: nginx:alpine proxies `/api/*` → `backend:8000`
- **Containers**: Docker Compose (two services: `backend`, `frontend`)
- **Config**: `/config/wall-cast.yaml` — volume-mounted, hot-reloaded via SSE

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
VPS Docker
├── frontend (nginx:alpine, port 80)
│   └── Vite-built React app → serves display page
└── backend (python:3.12-slim, internal)
    ├── GET /api/config          → parsed YAML as JSON
    ├── GET /api/config/stream   → SSE hot-reload events
    ├── GET /api/weather         → proxy → open-meteo.com (15m cache)
    ├── GET /api/rain            → proxy → buienalarm.nl (5m cache)
    ├── GET /api/news            → proxy → RSS feeds (10m cache)
    └── GET /api/sun             → proxy → sunrise-sunset.org (6h cache)

Chromecast (same LAN) → renders http://<vps-ip>/
Breaking news: browser connects directly to ntfy SSE (no backend proxy)
```

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
- No secrets in the app — all external APIs are public/unauthenticated

## Key Files

| File | Purpose |
|------|---------|
| `docs/memory/records/decision-log.md` | Architectural decision log with rationale |
| `config/wall-cast.yaml` | User widget configuration — hot-reloads on save |
| `backend/app/wall_config.py` | YAML loader + file watcher + SSE broadcaster |
| `backend/app/routers/weather.py` | open-meteo proxy, 15 min cache |
| `backend/app/routers/rain.py` | buienalarm.nl proxy, 5 min cache |
| `backend/app/routers/news.py` | RSS aggregator, 10 min cache |
| `backend/app/routers/sun.py` | sunrise-sunset.org proxy, 6 h cache |
| `frontend/src/widgets/index.ts` | Widget registry |
| `frontend/src/App.tsx` | Root: reads config, renders CSS grid |
| `frontend/src/hooks/use-config.ts` | Fetches config, subscribes to SSE |
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
| ntfy (browser direct) | ntfy instance (self-hosted) | real-time | None |
