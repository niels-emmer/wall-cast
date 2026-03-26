# wall-cast — Claude Instructions

## Always do first

Read `docs/memory/INDEX.md` at the start of every session. Decision log: `docs/memory/records/decision-log.md`.

## Stack

Python 3.12 / FastAPI | React 18 / TypeScript / Vite / Tailwind CSS v4 / TanStack Query v5 | nginx:alpine | Docker Compose (5 services: `frontend`, `backend`, `caster`, `scanner`, `assistant`)

Config: `config/wall-cast.yaml` — gitignored, auto-created on first run, hot-reloads via SSE. Never blocks `git pull`. Annotated template: `config/wall-cast.example.yaml`.

## CRITICAL: Layout CSS

Tailwind utility classes silently drop in the production build. ALL layout CSS must use inline `style={{ }}`.

```tsx
// correct
<div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
// silently broken in prod
<div className="flex flex-col h-full">
```

Applies to: `display`, `flexDirection`, `height`, `overflow`, `whiteSpace`, `gap`, `alignItems`, `justifyContent`, `minHeight`, `flex`, `padding`, `margin`. CSS variables and `clamp()` for font sizing are fine.

## Services

- **frontend** — nginx:alpine :80, serves React SPA, proxies `/api/*` to backend (`proxy_buffering off` for SSE)
- **backend** — FastAPI :8000 (internal only), reads/writes `config/wall-cast.yaml`, merges `shared`+screen config, proxies all external APIs with caching
- **caster** — `network_mode: host`, `cast.py` reads `chromecast_ip` per screen, uses `catt cast_site`, re-reads config every cycle
- **scanner** — `network_mode: host` :8765, `scanner.py` runs `catt scan` on demand; backend proxies via `host.docker.internal`
- **assistant** — polls `/api/*`, runs rules, pushes ntfy notifications; opt-in via `shared.assistant.enabled`

## API endpoints

| Endpoint | Backend / source | Cache |
|----------|-----------------|-------|
| `GET /api/config?screen=<id>` | merged shared+screen config | — |
| `GET /api/config/stream` | SSE — fires on YAML save | real-time |
| `PUT /api/admin/config` | atomic YAML write → triggers SSE | — |
| `GET /api/admin/scan` | proxy to scanner → `[{name,ip}]` | — |
| `GET /api/weather` | open-meteo.com | 15 min |
| `GET /api/rain` | open-meteo minutely_15 | 5 min |
| `GET /api/news` | RSS / feedparser | 10 min |
| `GET /api/sun` | sunrise-sunset.org | 6 h |
| `GET /api/garbage` | mijnafvalwijzer.nl | 1 h |
| `GET /api/polestar` | pypolestar → Polestar cloud | 5 min |
| `GET /api/calendar` | Google Calendar v3 (service account) | 10 min |
| `GET /api/traffic` | ANWB jams + TomTom routing | 5 min |
| `GET /api/warnings` | MeteoAlarm Atom/CAP | 15 min |
| `GET /api/bus` | vertrektijd.info | 30 s |
| `GET /api/airquality` | open-meteo CAMS AQI + pollen | 1 h |

API keys: `POLESTAR_USERNAME`/`PASSWORD`, `TOMTOM_API_KEY`, `VERTREKTIJD_API_KEY`, `ROUTER_PASSWORD`, `OPENAI_API_KEY` — all in `.env`. Google Calendar: service account JSON at `config/google-sa.json`.

## Widget system

Registry: `frontend/src/widgets/index.ts`. To add a widget:
1. `frontend/src/widgets/<name>/<Name>Widget.tsx`
2. Add translation keys to `frontend/src/i18n/translations.ts` — both `nl` and `en` objects, identical keys
3. `backend/app/routers/<name>.py` (if external data needed)
4. Register in `frontend/src/widgets/index.ts`
5. Add type to `docs/config-reference.md`

Note: `BASE_REGISTRY` lives in `base-registry.ts`; `WIDGET_REGISTRY` in `index.ts` adds `rotate` on top — avoids circular import since RotatorWidget imports BASE_REGISTRY.

Hooks in `.claude/settings.json` + `.claude/hooks/` enforce the rules above automatically (Tailwind classes, translation parity, TypeScript, compose validation, widget registry). See `docs/claude-hooks.md`.

## Key files

| File | Notes |
|------|-------|
| `backend/app/wall_config.py` | YAML loader + auto-create/migrate + file watcher + SSE broadcaster |
| `frontend/src/widgets/index.ts` | Widget registry |
| `frontend/src/App.tsx` | CSS grid layout + admin routing |
| `frontend/src/hooks/use-config.ts` | Config fetch + SSE — `SCREEN_ID` captured at module load, not inside hook |
| `frontend/src/hooks/use-ntfy.ts` | Browser-side ntfy SSE subscriber |
| `frontend/src/i18n/use-lang.ts` | Uses `useQuery` directly, NOT `useConfig()` — avoids extra SSE `EventSource` per widget |
| `frontend/src/widgets/styles.ts` | Design token system — `shellStyle`, `titleStyle`, `fs.*`, `sp.*`, `col.*` |
| `caster/cast.py` | Multi-screen caster, keepalive, post-cast verification, recast signal files |
| `docs/memory/records/decision-log.md` | Architectural decisions with rationale |

## Gotchas

- `shared.network` must be explicitly forwarded in `wall_config.get_config()` — it is a top-level shared key that the network router reads directly. Any new shared-only backend key needs the same treatment.
- Admin panel: `draft` initialises from server data once (`draft === null` guard). Never use `invalidateQueries` after admin saves — triggers refetch that resets the draft.
- `PUT /api/admin/config` receives full WallConfig JSON, serialises to YAML atomically, existing `watchfiles` watcher detects the rename and broadcasts SSE.
- `catt status` gives false negatives right after `cast_site` — cooldown guard (`CAST_COOLDOWN`, default 300 s) prevents recast loops. Post-cast verification (`CAST_VERIFY_DELAY`, default 10 s) catches silent failures (e.g. Google Home Hub after a voice command) by resetting `last_cast_at` to 0 so the next cycle retries.
- `useLang()` must use `useQuery` directly with `['config']` key — not `useConfig()` which opens a new SSE connection per call.

## Commands

```bash
# dev
docker compose -f docker-compose.dev.yml up --build
# frontend :5173 / backend :8000 / API docs :8000/api/docs

# prod
docker compose up --build -d

# frontend standalone (fastest iteration, needs backend on :8000)
cd frontend && npm install && npm run dev
```
