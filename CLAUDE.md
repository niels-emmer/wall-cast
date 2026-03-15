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

- Display URL: http://<vps-ip>/
- Logs: `docker compose logs -f`

### Frontend (without Docker, for fast iteration)

```bash
cd frontend && npm install && npm run dev
```

## Memory System

See `docs/memory/INDEX.md` for project state, decisions, and context.
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
    ├── GET /api/rain            → proxy → buienradar.nl (5m cache)
    └── GET /api/news            → proxy → RSS feeds (10m cache)

Chromecast (same LAN) → renders http://<vps-ip>/
```

## Widget System

Widgets are registered in `frontend/src/widgets/index.ts`. To add a widget:

1. Create `frontend/src/widgets/<name>/<Name>Widget.tsx`
2. Add a data router in `backend/app/routers/<name>.py` if external data is needed
3. Register the component in `frontend/src/widgets/index.ts`
4. Add the widget type to `docs/config-reference.md`
5. Use it in `/config/wall-cast.yaml`

## Security Notes

- Backend is NOT exposed on the host — nginx is the only public port
- Config directory is mounted read-only into backend
- nginx: `server_tokens off`, security headers set
- No auth by design (local network only); add nginx `allow/deny` if VPS is internet-facing
- No secrets in the app — all external APIs are public/unauthenticated

## Key Files

| File | Purpose |
|------|---------|
| `config/wall-cast.yaml` | User widget configuration |
| `backend/app/wall_config.py` | YAML loader + file watcher + SSE broadcaster |
| `backend/app/routers/` | API proxy routes |
| `frontend/src/widgets/index.ts` | Widget registry |
| `frontend/src/App.tsx` | Root: reads config, renders grid |
| `frontend/src/hooks/use-config.ts` | Fetches config, subscribes to SSE |
