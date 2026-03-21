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

---

## 2026-03-20 — Admin panel, i18n, garbage improvements

### Admin panel: hash-based route, no extra router library
**Decision**: Admin UI lives at `/#admin`, detected via `window.location.hash` in `App.tsx`. No React Router dependency.
**Rationale**: nginx serves a single static file — React Router's `BrowserRouter` would need `try_files` rewrite rules. Hash routing works with the existing nginx config unchanged. The admin panel is a single overlay component, not a full SPA.

### Config write: atomic via tmpfile + os.replace()
**Decision**: `PUT /api/admin/config` writes to a temp file in the same directory, then renames it over the real config file.
**Rationale**: `os.replace()` is atomic on Linux (single inode rename). `watchfiles.awatch()` watches the directory and detects the rename, triggering an SSE broadcast to the display. Avoids partial-write corruption.

### Config volume: read-write (was read-only)
**Decision**: Changed `./config:/config:ro` → `./config:/config` in `docker-compose.yml`.
**Rationale**: The admin panel needs to write back to `wall-cast.yaml`. The read-only mount was a premature security measure — the config has never contained secrets (those live in `.env`). Network access is still restricted to the local network by design.

### i18n: typed interface, no i18n library
**Decision**: Flat `Translations` TypeScript interface with `nl` and `en` implementations in `frontend/src/i18n/translations.ts`. Callable members (e.g. `dayLabel(n)`, `fullIn(h, m)`) for format strings.
**Rationale**: No i18n library overhead. TypeScript enforces completeness — if a key is missing from `en`, the build fails. Callable members handle plurals and formatted strings without template string fragility. Easy to add a third language: just add a `Lang` union member + object.

### useLang(): useQuery directly, not useConfig()
**Decision**: `useLang()` calls `useQuery(['config'], ...)` directly instead of calling `useConfig()`.
**Rationale**: `useConfig()` sets up a new `EventSource` SSE connection per call via `useEffect`. Every widget calls `useLang()`, so calling `useConfig()` inside it would create 5–6 extra SSE connections on each page load. Using `useQuery` directly with the identical `['config']` key lets TanStack Query deduplicate the fetch — only `App.tsx`'s call to `useConfig()` sets up the SSE connection.

---

## 2026-03-21 — KNMI warnings widget

### RotatorWidget: onSkip mechanism for conditional slots
**Decision**: Added optional `onSkip?: () => void` to `WidgetProps`. The RotatorWidget passes a stable callback (via `useRef`) to each slot. When a widget has no content to show, it calls `onSkip()`. The rotator tracks a `skipSet: Set<number>` and skips those indices when cycling.
**Rationale**: The warnings widget should be invisible during calm weather — no blank slot, no user configuration needed. A data-driven approach (querying data in the rotator) would couple the rotator to specific widget types. The callback pattern keeps the rotator generic: any future widget can opt out of rotation when empty.

### KNMI warnings: CDN XML endpoint, no API key
**Decision**: Use `cdn.knmi.nl/knmi/map/page/weer/actueel-weer/waarschuwingen_actueel.xml` (public, no key). Parse with stdlib `xml.etree.ElementTree`. Group warnings by (level, phenomenon, description) and aggregate regions.
**Rationale**: The KNMI Open Data API requires registration. The CDN XML endpoint is stable, has been used by Dutch weather apps for years, and requires zero credentials. Backend returns empty list on error rather than 502 — the display should remain stable during brief API outages.

### Garbage widget: configurable days_ahead, fit-to-box
**Decision**: `days_ahead` is a per-widget YAML config key (default 7). The backend `?days_ahead=N` query param is validated (1–365) and cached per value. The widget measures its container with `ResizeObserver` and slices the collections list to show only complete cards.
**Rationale**: The hardcoded 7-day window was not always right — fewer or more days may be useful depending on widget size. Fit-to-box via ResizeObserver is more robust than guessing a fixed max based on row_span, since the actual rendered height depends on the grid and font scaling.
