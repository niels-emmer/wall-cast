# wall-cast Memory Index

## Project Status

**Phase**: Production-ready — fully functional, deployed via Docker Compose, cast to Chromecast.
**Location**: Smilde, NL (lat 52.5257, lon 6.4510)

## Dev Environments

Two Claude environments work on this project — they are NOT the same:

| Environment | Repo path | Capabilities |
|-------------|-----------|-------------|
| **Desktop Claude Code** (user's Mac) | `/Users/nemmer/repositories/wall-cast` | Git commit + push (authoritative). No local Docker. |
| **Web-based Claude IDE** (VPS/server) | `/home/coder/project/docker/wall-cast` | Docker Compose runs here. Does not own the git remote. |

When in the desktop environment: commit and push freely. When in the web IDE: run/test Docker, but do not assume git push capability.

## Quick Context

- Repo: `/Users/nemmer/repositories/wall-cast` (desktop) or `/home/coder/project/docker/wall-cast` (server)
- Stack: FastAPI 0.115 backend + React 18 / Vite / Tailwind frontend, Docker Compose
- Casting: `caster` Docker service uses `catt cast_site` → DashCast receiver on Google TV (192.168.101.77). `DISPLAY_URL` must be the host's LAN IP (192.168.101.184), NOT `localhost` — the TV resolves localhost as itself
- Config: `config/wall-cast.yaml` hot-reloads via SSE without container restart
- Layout: 12 × 8 CSS grid, all widget layout uses **inline `style` only** (Tailwind classes unreliable in prod build)

## Decision Log

See `records/decision-log.md` for all architectural decisions with rationale.

## Widget Status

| Widget | Backend route | Frontend component | Status |
|--------|--------------|-------------------|--------|
| clock | n/a (client-side) | ClockWidget.tsx | ✅ production |
| weather | /api/weather + /api/sun | WeatherWidget.tsx | ✅ production |
| rain | /api/rain | RainWidget.tsx | ✅ production |
| news | /api/news | NewsTickerWidget.tsx | ✅ production |
| garbage | /api/garbage | GarbageWidget.tsx | ✅ production |
| polestar | /api/polestar | PolestarWidget.tsx | ✅ production |
| rotate | n/a (container) | RotatorWidget.tsx | ✅ production |

## Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| CSS grid layout | ✅ | 12×8, widget positions from YAML |
| YAML hot-reload | ✅ | SSE push within ~1s of file save |
| Weather widget | ✅ | WEER title + current + 7h hourly + 7-day daily + sunrise/sunset/daylight |
| Rain SVG chart | ✅ | REGEN title, bezier area chart, Dutch labels, HTML overlay labels |
| News RSS ticker | ✅ | Infinite scroll, Web Animations API |
| Sunrise/sunset block | ✅ | Embedded top-right of weather widget (Opkomst/Ondergang + daglichttijd) |
| Breaking news (ntfy) | ✅ | SSE direct to browser, interspersed every ~3 items |
| Garbage widget | ✅ | mijnafvalwijzer.nl, 7-day window, horizontal cards, accent for today/tomorrow |
| Polestar widget | ✅ | pypolestar, SOC/range/charging/stats/service warning; creds via .env |
| Rotate widget | ✅ | Cycles child widgets in one grid cell, configurable interval |
| Visual harmony | ✅ | All widgets share title style (weight 300, uppercase, 0.25em tracking, white) |
| Auto-cast to Chromecast | ✅ | `caster` service using `catt cast_site` + DashCast; polls every 60s, re-casts on drop |
| Docker prod build | ✅ | `docker compose up --build -d` |
| Docker dev build | ✅ | `docker compose -f docker-compose.dev.yml up --build` |

## Critical Implementation Notes

### Layout
- ALL layout CSS must use inline `style={{ }}` — Tailwind classes are silently dropped in the production build
- Grid items need `height: '100%', minHeight: 0` to fill cells
- Flex containers need explicit `flexDirection` as inline style

### Rain chart
- SVG uses `preserveAspectRatio="none"` for fill — this distorts SVG `<text>` elements
- Y-axis labels are rendered as **HTML `<div>` overlays** positioned absolutely over the SVG, not as SVG text

### Weather widget
- `HourlyCol` and `DailyCol` both use `flex: 1, minHeight: 0, justifyContent: 'space-evenly'` to share equal height
- `SunBlock` is a subcomponent with `marginLeft: 'auto'` pushed to the far right of the current-weather row

### News ticker
- Uses Web Animations API (not CSS animations) — the track element is animated with `element.animate()`
- Breaking news: `useNtfy` hook connects directly to `<ntfy_url>/<topic>/sse` from the browser
- Breaking item is interspersed every `Math.floor(n/3)` news items (not just prepended once)

### Caster (auto-cast)
- Uses `catt cast_site <url>` via the DashCast receiver app (app ID `CC1AD845`) — the only open-source tool that casts arbitrary web URLs to Chromecast
- `network_mode: host` required for mDNS LAN discovery
- `DISPLAY_URL` **must** be the host machine's LAN IP — `http://localhost/` fails because the Google TV resolves localhost as itself, causing DashCast to get a blank page and immediately close
- `catt status` returns only volume info (no app name) when no session is active; the keepalive loop detects this and re-casts

### Polestar widget
- Uses `pypolestar` library; requires `async_init()` → `update_latest_data(vin, update_telematics=True)` → `get_car_telematics(vin)` in that order
- Credentials via `POLESTAR_USERNAME` / `POLESTAR_PASSWORD` env vars from `.env` (gitignored, see `.env.example`)
- Enum names are prefixed: `CHARGING_STATUS_CHARGING`, `CHARGER_CONNECTION_STATUS_CONNECTED`, etc. — use `.includes()` not `===`
- Extra fields (consumption, avg speed, trip meters) come back null from the API for this vehicle — rows are hidden when null
- Service warning only shown as alert tag when `service_warning` is not null (API returns null when no warning active)

### Garbage widget
- API: `api.mijnafvalwijzer.nl` — public key baked in, no auth needed
- Config (`postcode`, `huisnummer`) read from top-level `garbage:` YAML section, passed as query params
- JSON path: `raw["data"]["ophaaldagen"]["data"]` — do NOT include `afvaldata` param (breaks the response)
- Status check: `raw.get("response") != "OK"` (not `"status"`)

### Widget registry
- `BASE_REGISTRY` in `base-registry.ts` holds all widgets except `rotate`
- `WIDGET_REGISTRY` in `index.ts` adds `rotate` on top — avoids circular import since RotatorWidget imports BASE_REGISTRY

### API sources
- Weather: `api.open-meteo.com/v1/forecast` — no key, 15 min TTL
- Rain: `cdn-secure.buienalarm.nl/api/3.4/forecast.php` — replaced dead gpsgadget endpoint, 5 min TTL
- News: `feedparser` parsing RSS URLs from config, 10 min TTL
- Sun: `api.sunrise-sunset.org/json` — no key, 6 h TTL
- Garbage: `api.mijnafvalwijzer.nl` — public key, 1 h TTL
- Polestar: `pypolestar` → Polestar cloud API — 5 min TTL, uses cached data on error
- ntfy: browser connects directly, no backend proxy

## Open Items

- [ ] Push repo to GitHub
- [ ] Consider ENTSO-E energy price widget (free API, no key)
- [ ] Consider NS train departures widget (requires NS API key)
