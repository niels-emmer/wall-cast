# wall-cast Memory Index

## Project Status

**Phase**: Production-ready — multi-screen, fully functional, deployed via Docker Compose, cast to Chromecast.
**Location**: Amsterdam, NL (lat 52.3676, lon 4.9041)

## Dev Environments

Two Claude environments work on this project — they are NOT the same:

| Environment | Repo path | Capabilities |
|-------------|-----------|-------------|
| **Desktop Claude Code** (user's Mac) | `/Users/[your-user-name]/repositories/wall-cast` | Git commit + push (authoritative). No local Docker. |
| **Web-based Claude IDE** (VPS/server) | `/home/coder/project/docker/wall-cast` | Docker Compose runs here. Does not own the git remote. |

When in the desktop environment: commit and push freely. When in the web IDE: run/test Docker, but do not assume git push capability.

## Quick Context

- Repo: `/Users/[your-user-name]/repositories/wall-cast` (desktop) or `/home/coder/project/docker/wall-cast` (server)
- Stack: FastAPI 0.115 backend + React 18 / Vite / Tailwind frontend, Docker Compose
- Casting: `caster` Docker service uses `catt cast_site` → DashCast receiver on Google TV. `caster/cast.py` reads `chromecast_ip` from each screen in the config. `SERVER_URL` must be the host's LAN IP, NOT `localhost` — the TV resolves localhost as itself
- Scanner: `scanner` service (host network, port 8765) runs `catt scan` on demand; backend proxies `GET /api/admin/scan` to it via `host.docker.internal`
- Config: `config/wall-cast.yaml` is **gitignored** and **auto-created on first run** — never blocks `git pull`. Hot-reloads via SSE within ~1s of file save. `config/wall-cast.example.yaml` is the annotated template in git.
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
| calendar | /api/calendar | CalendarWidget.tsx | ✅ production |
| traffic | /api/traffic | TrafficWidget.tsx | ✅ production |
| rotate | n/a (container) | RotatorWidget.tsx | ✅ production |
| info | n/a (static) | InfoWidget.tsx | ✅ production |
| warnings | /api/warnings | WarningsWidget.tsx | ✅ production |
| bus | /api/bus | BusWidget.tsx | ✅ production |
| network | /api/network | NetworkWidget.tsx | ✅ production |
| market | /api/market | MarketWidget.tsx | ✅ production |
| p2000 | /api/p2000 | P2000Widget.tsx | ✅ production |

## Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| CSS grid layout | ✅ | 12×8, widget positions from YAML |
| YAML hot-reload | ✅ | SSE push within ~1s of file save |
| Multi-screen support | ✅ | `shared + screens[]` YAML schema; `GET /api/config?screen=<id>` |
| People system | ✅ | `shared.people[]` + per-screen `people: [id, ...]`; backend injects calendar_ids |
| Smart caster | ✅ | Single `caster` service reads `chromecast_ip` from all screens in config |
| Scanner sidecar | ✅ | `scanner` service on :8765; `catt scan` via mDNS; admin "Scan network" button |
| Config auto-create/migrate | ✅ | Default config written on first run; old flat format auto-migrated to multi-screen |
| Admin panel (3 tabs) | ✅ | `/#admin` — General, Screens (with scan button), People |
| i18n (nl/en) | ✅ | `language: nl/en` in YAML; all widget labels translated via `useLang()` hook |
| Weather widget | ✅ | WEER title + current + 7h hourly + 7-day daily + sunrise/sunset/daylight |
| Rain SVG chart | ✅ | REGEN title, bezier area chart, Dutch labels, HTML overlay labels — 12 × 15-min slots (3h) via open-meteo minutely_15 |
| News RSS ticker | ✅ | Infinite scroll, Web Animations API |
| Sunrise/sunset block | ✅ | Embedded top-right of weather widget (Op/Onder + daglichttijd) |
| Breaking news (ntfy) | ✅ | SSE direct to browser, interspersed every ~3 items |
| Garbage widget | ✅ | mijnafvalwijzer.nl, configurable days-ahead window, fit-to-box, accent for today/tomorrow |
| Polestar widget | ✅ | pypolestar, SOC/range/charging/stats; amber service tag + red fluid warning tags |
| Calendar widget | ✅ | Google Calendar via service account; card layout, event colours |
| Traffic widget | ✅ | ANWB jam list + TomTom travel time; H:MM format; addresses via YAML or env vars |
| KNMI warnings widget | ✅ | MeteoAlarm Atom/CAP; geel/oranje/rood; auto-skipped from rotation when no active warnings |
| Rotate widget | ✅ | Cycles child widgets in one grid cell, configurable interval; skips slots that call onSkip() |
| Bus widget | ✅ | vertrektijd.info live departures; cancelled services shown |
| Visual harmony | ✅ | Shared design token system in `frontend/src/widgets/styles.ts` — 7 font tiers, unified shell gap/card padding/radius across all widgets. See `docs/widget-style-guide.md`. |
| Auto-cast to Chromecast | ✅ | `caster` service using `catt cast_site` + DashCast; polls every 60s, re-casts on genuine drop; cooldown prevents false-negative recast loop; post-cast verification catches silent failures (e.g. after "Hey Google") |
| Network widget | ✅ | WAN status, connectivity, DNS, LAN host count, speedtest; Zyxel VMG8825 DAL API; router password via `ROUTER_PASSWORD` env var |
| P2000 widget | ✅ | Dutch emergency alerts widget + news ticker injection; region from shared.location; Brandweer all / Ambulance A1 / Politie P1; auto-skipped when no incidents |
| Cache health registry | ✅ | `backend/app/cache_registry.py` — all 13 API routers call `update(name, ok)` on success/failure; `GET /api/admin/status` surfaces per-source age + health |
| Landing page STATUS section | ✅ | Services (backend/caster/scanner/assistant/ntfy/matrix) + API sources grid; card order: Header → Screens → System → Logs |
| Matrix notifications | ✅ | `assistant/notify/matrix.py` — parallel ntfy+Matrix dispatch; MATRIX_TOKEN from .env; per-person matrix_room_id; system room for global alerts; ntfy/matrix reachability in STATUS section |
| Docker prod build | ✅ | `docker compose up --build -d` |
| Docker dev build | ✅ | `docker compose -f docker-compose.dev.yml up --build` |

## Critical Implementation Notes

### Layout
- ALL layout CSS must use inline `style={{ }}` — Tailwind classes are silently dropped in the production build
- Grid items need `height: '100%', minHeight: 0` to fill cells
- Flex containers need explicit `flexDirection` as inline style

### Widget design tokens
- `frontend/src/widgets/styles.ts` — single source of truth for all widget font sizes, spacing, and colours
- Import `shellStyle`, `titleStyle`, `dividerStyle`, `sectionLabelStyle`, `cardBase`, `cardBaseDim`, `fs`, `sp`, `col`
- `fs.title` — widget header; `fs.md` — primary card text; `fs.sm` — secondary; `fs.xs` — badges
- `fs.lg` — featured numbers; `fs.hero` — single dominant figure; `fs.icon` — emoji
- `sp.shellGap: '0.45rem'` keeps title/divider/content compact; `sp.cardPad: '0.45rem 0.7rem'`; `sp.cardRadius: 8`
- Full reference: `docs/widget-style-guide.md`

### Multi-screen
- `SCREEN_ID` is captured at module load time in `use-config.ts` (not inside the hook) — this gives a stable value that does not change between renders and can be used as a `queryKey` safely
- Each screen's config is fetched via `GET /api/config?screen=<id>` — backend merges `shared` + the named screen
- Per-screen query key: `['config', screenId]` — TanStack Query caches per screen

### People system
- `shared.people[]` defines all household members with `id`, `name`, `family` (bool), `calendar_ids[]`
- Family members (`family: true`) have their `calendar_ids` injected into every screen's calendar widget
- Each screen lists `people: [id, ...]` — their `calendar_ids` are merged in addition to family members' IDs
- The backend injects the resolved `calendar_ids` list into the calendar widget config before serving the screen config

### Smart caster
- `cast.py` reads the YAML config directly on every check cycle — no env var for Chromecast IP
- Manages one catt session per screen; detects dropped sessions and re-casts
- `SERVER_URL` env var sets the base; screen URL is `{SERVER_URL}/?screen={id}`
- `network_mode: host` required for mDNS LAN discovery
- **Cooldown guard**: `catt status` gives a false negative right after `cast_site` completes — `is_casting()` returns `False` even though the page is loading. Without a guard this caused a recast loop every 60 s, constantly reloading the display. `cast.py` tracks `last_cast_at` per IP and skips the recast if it was cast within `CAST_COOLDOWN` seconds (default 300 s, configurable via env var). Only genuinely stale sessions (no cast for > 5 min) are restarted.
- **Post-cast verification**: after every cast attempt, sleeps `CAST_VERIFY_DELAY` seconds (default 10) then calls `is_casting()`. If the cast silently failed (e.g. Google Home Hub Mini rejected the cast after a "Hey Google" voice command), `last_cast_at` is reset to 0 so the cooldown guard does not block the next retry. Status is set to `cast_failed` — visible in the admin panel. Set `CAST_VERIFY_DELAY=0` in `docker-compose.yml` to disable.

### Scanner sidecar
- Separate `scanner` service with `network_mode: host` on port 8765 — host network needed for mDNS
- Backend proxies `GET /api/admin/scan` to `http://host.docker.internal:8765/scan`
- Returns `[{name, ip}]` as JSON; admin panel shows clickable device chips to pre-fill Chromecast IP field
- Kept as a separate service so the backend container doesn't need host network

### Config auto-create/migrate
- `wall_config.py` writes a default config (with sensible example values) on startup if the file is missing
- Old flat-format configs (without `shared + screens[]`) are auto-migrated to the multi-screen format on load
- `config/wall-cast.yaml` is in `.gitignore` — `git pull` never touches it

### Backend file ownership
- Backend runs as `${UID:-1000}:${GID:-1000}` from `.env`
- Config written with `chmod 664` so the host user always has read/write access after admin saves

### Rain chart
- SVG uses `preserveAspectRatio="none"` for fill — this distorts SVG `<text>` elements
- Y-axis labels are rendered as **HTML `<div>` overlays** positioned absolutely over the SVG, not as SVG text

### Weather widget
- `HourlyCol` and `DailyCol` both use `flex: 1, minHeight: 0, justifyContent: 'space-evenly'` to share equal height
- `SunBlock` is a subcomponent with `marginLeft: 'auto'` pushed to the far right of the current-weather row
- Icons: Meteocons static SVGs (MIT, `@bybas/weather-icons` dev branch) served from `frontend/public/icons/weather/`. Loaded via `<img>` tags (not inline SVG). 13 files cover all WMO codes. No SMIL animations — safe on older Chromecasts.

### News ticker
- Uses Web Animations API (not CSS animations) — the track element is animated with `element.animate()`
- Breaking news: `useNtfy` hook connects directly to `<ntfy_url>/<topic>/sse` from the browser
- Breaking item is interspersed every `Math.floor(n/3)` news items (not just prepended once)

### Caster (auto-cast)
- Uses `catt cast_site <url>` via the DashCast receiver app (app ID `CC1AD845`) — the only open-source tool that casts arbitrary web URLs to Chromecast
- `network_mode: host` required for mDNS LAN discovery
- `SERVER_URL` **must** be the host machine's LAN IP — `http://localhost/` fails because the Google TV resolves localhost as itself, causing DashCast to get a blank page and immediately close
- `catt status` returns only volume info (no app name) when no session is active; the keepalive loop detects this and re-casts

### Polestar widget
- Uses `pypolestar` library; requires `async_init()` → `update_latest_data(vin, update_telematics=True)` → `get_car_telematics(vin)` in that order
- Credentials via `POLESTAR_USERNAME` / `POLESTAR_PASSWORD` env vars from `.env` (gitignored, see `.env.example`)
- Enum names are prefixed: `CHARGING_STATUS_CHARGING`, `CHARGER_CONNECTION_STATUS_CONNECTED`, etc. — use `.includes()` not `===`
- Extra fields (consumption, avg speed, trip meters) come back null from the API for this vehicle — rows are hidden when null
- Service warning → amber alert tag; brake_fluid / coolant / oil warnings → red alert tags — all suppressed when `NO_WARNING` or `UNSPECIFIED`
- `_no_warn = ("NO_WARNING", "UNSPECIFIED")` sentinel tuple used for all health field filtering
- **gql task leak**: `pypolestar` uses `gql` WebSocket transport which spawns a persistent `ReconnectingAsyncClientSession._connection_loop()` background task. `async_logout()` does not cancel it, causing "Task was destroyed but pending" errors every cache cycle. Fix: snapshot `asyncio.all_tasks()` before `PolestarApi()`, then cancel/await all new tasks after `async_logout()`.

### Calendar widget
- Uses `google-api-python-client` + `google-auth` (service account JSON at `GOOGLE_SA_KEY_FILE`, default `/config/google-sa.json`)
- `config/google-sa.json` is gitignored via `config/*.json` rule — never commit it
- Google API call is synchronous — wrapped in `asyncio.to_thread(_fetch_events)` to avoid blocking the event loop
- Returns `today` (events on current date) + `week` (next 7 days grouped by date) + `today_label` (formatted date string)
- Timezone: `Europe/Amsterdam` via Python `zoneinfo` (stdlib, no extra dep)
- Event `color` field maps colorId (1–11) to hex; `null` when no colour set → widget falls back to `rgba(255,255,255,0.3)` dot
- `docker-compose.dev.yml` has `env_file` block so `GOOGLE_CALENDAR_ID` and `GOOGLE_SA_KEY_FILE` are available in dev
- Timed today events that have already ended are hidden from the `today` list. All-day events are always shown. Removal happens at the next cache refresh (≤10 min lag).
- `googleapiclient.http` logger is set to ERROR at module level to suppress the 403 WARNING the library emits when a shared calendar's `calendarList` entry is inaccessible. The events fetch still succeeds — the 403 is non-fatal.

### Traffic widget
- ANWB incidents API structure: `roads[] → segments[] → jams[]` — jams are nested two levels under roads (NOT at segment level directly)
- Jam fields: `road`, `from`, `to`, `fromLoc: {lat,lon}`, `toLoc: {lat,lon}`, `distance` (meters), `delay` (seconds), `incidentType`
- Valid `incidentType` values seen: `stationary-traffic`, `queuing-traffic`, `slow-traffic`, `road-closed`, `radar`
- Home/work addresses read from YAML widget config (`home_address`, `work_address`) or env var fallback; geocoded via TomTom Search API on first request, cached forever in `_coords` dict
- Travel time displayed as `H:MM` (e.g. `3:13`), delay as `+H:MM`; uses `fmtDuration()` in TrafficWidget.tsx
- `TOMTOM_API_KEY` is in `.env` (gitignored) — must be added manually on each server
- `on_route` uses route-corridor proximity: a jam is on-route only if its road name is in `route_roads` AND its `fromLoc` is within `ON_ROUTE_CORRIDOR_KM` (25 km) of the TomTom route polyline (`legs[0].points`). Falls back to road-name-only when TomTom hasn't responded yet.
- Zero-length (`distance=0`) off-route jams are discarded — they are phantom/informational ANWB entries.
- Total jam km shown right-aligned in the TRAFFIC JAMS section header — counts ALL jams (on-route and off-route); only rendered when `jams.length > 0`

### Garbage widget
- API: `api.mijnafvalwijzer.nl` — public key baked in, no auth needed
- Config (`postcode`, `huisnummer`) readable from YAML widget config (preferred) or env vars (`GARBAGE_POSTCODE`, `GARBAGE_HUISNUMMER`) as fallback
- `days_ahead` is configurable per-widget in YAML (default 7); backend accepts `?days_ahead=N` (1–365); cache is keyed per days_ahead value
- JSON path: `raw["data"]["ophaaldagen"]["data"]` — do NOT include `afvaldata` param (breaks the response)
- Status check: `raw.get("response") != "OK"` (not `"status"`)
- Fit-to-box: `ResizeObserver` on the list container measures first card height and slices `collections` to only show complete cards
- Icons use `@phosphor-icons/react`: `Leaf` (fill, green) for GFT, `Recycle` (fill, orange) for PMD, `TrashSimple` (regular, grey) for restafval

### KNMI warnings widget
- API: `feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-netherlands` — public Atom/CAP feed, no key, 15 min TTL
- The KNMI CDN XML (`cdn.knmi.nl/.../waarschuwingen_actueel.xml`) returns 403 to non-browser requests — do not use
- XML: Atom namespace + CAP 1.2 namespace (`urn:oasis:names:tc:emergency:cap:1.2`); entries have `cap:severity`, `cap:areaDesc`, `cap:event`, `cap:onset`, `cap:expires`, `cap:status`, `cap:message_type`
- Parser groups by (level + phenomenon + description) and aggregates regions; sorted rood → oranje → geel
- Returns empty list (never 502) when no warnings — stale cache served on fetch error
- **RotatorWidget skip mechanism**: `WidgetProps` has optional `onSkip?: () => void`; WarningsWidget calls it when no warnings after load; RotatorWidget tracks `skipSet` and advances past empty slots automatically
- No YAML config keys needed — zero-configuration, just add `type: warnings` to a rotator slot

### Admin panel
- Route: `/#admin` — hash-based, no React Router dependency, works with nginx static serving
- `PUT /api/admin/config` — receives full WallConfig JSON, serialises to YAML atomically (tmpfile + `os.replace()`); existing `watchfiles` watcher detects the rename and broadcasts SSE to the display
- Config volume is **read-write** (`./config:/config`, not `:ro`) — required for admin writes
- Admin state: `draft` is initialised from server data once (when `draft === null`). The `useEffect` that syncs `remoteConfig → draft` is guarded by `draft === null` so it only fires on first load. After save, `queryClient.setQueryData()` updates the cache directly — no refetch is triggered, so `remoteConfig` never changes and the useEffect never overwrites the user's ongoing edits. **Do NOT use `invalidateQueries` after admin saves** — it triggers a refetch that fires the useEffect and silently resets the draft.
- Rotation slots: toggled per widget via `enabled` field on each slot in `config.widgets`
- Rotator "Add slot" UI: `RotatorSection` has a `Select + Add` button at the bottom; only shows widget types not already in the rotator; uses `defaultSlotConfig()` helper to seed sensible defaults
- **Screen ID field**: `currentScreen` is derived with `selectedId !== null` (not `selectedId ?`) — empty string is falsy and would otherwise make `currentScreen` null, crashing all code below that reads `currentScreen.id`. The TextInput shows an inline error when the ID is empty.
- **Rotator widget IDs**: `makeDefaultScreen` uses plain `clock`, `main-rotator`, `bottom-rotator` — no screen-ID prefix. IDs only need to be unique within a screen's widget array. To migrate existing production configs: `sed -i -E 's/id: new-screen(-[0-9]+)?-main-rotator/id: main-rotator/g' config/wall-cast.yaml` (and equivalents for `bottom-rotator`, `clock`).

### i18n
- `frontend/src/i18n/translations.ts` — `Translations` interface + `nl` and `en` objects; all widget labels, day/month names, WMO codes, and format functions live here
- `frontend/src/i18n/use-lang.ts` — `useLang()` reads `config.language` via `useQuery(['config'], ...)` directly (NOT via `useConfig()` — that would create an extra SSE `EventSource` per widget)
- **Do NOT call `useConfig()` from `useLang()`** — `useConfig()` sets up a new SSE connection per render; `useLang()` must use `useQuery` directly with the same `['config']` key so TanStack Query deduplicates
- `LANGUAGES` registry supports additional languages: add a new `Lang` union member + object in `translations.ts`
- `language` is a top-level key under `shared` in the YAML

### Network widget
- `GET /api/network` aggregates 5 probes concurrently: WAN status, external connectivity, DNS reachability, LAN host count, speedtest
- Router integration: Zyxel VMG8825 DAL API (RSA+AES encrypted). Requires `cryptography` package (in `requirements.txt`). Optional — widget still shows connectivity/DNS/speed without it.
- `router_url` and `router_username` live in `shared.network` in the YAML (set via Admin → General → Network widget)
- `router_password` is **never stored in YAML** — read from `ROUTER_PASSWORD` env var in `.env`
- **Shared-only backend keys must be explicitly forwarded** in `wall_config.get_config()` merged dict — e.g. `shared.network`, `shared.p2000`, `shared.assistant`. Any new key that a backend router reads directly from `cfg` (not from a widget config) must be added to the merged dict, otherwise `cfg.get(key)` returns `{}` and the feature silently breaks.
- Speedtest: Cloudflare `speed.cloudflare.com/__down` / `__up`, runs every 60 s in background, capped at `speedtest_bytes_down` / `speedtest_bytes_up` (YAML, defaults 2 MB / 200 KB)
- Cache TTL: 30 s. Speedtest runs async so it never blocks the main probe responses.
- WAN uptime: separate `status` OID call after the main `cardpage_status` query
- LAN host count: `lanhosts` OID; wifi detected by "Wi-Fi" in `X_ZYXEL_ConnectionType`
- **Post-deploy recovery**: `use-network.ts` uses `refetchInterval: (query) => (!query.state.data?.wan ? 5_000 : 30_000)` — polls every 5 s while `wan` is null (backend still initializing), then settles to 30 s. Prevents "No router / --" persisting after a redeploy.

### Widget registry
- `BASE_REGISTRY` in `base-registry.ts` holds all widgets except `rotate`
- `WIDGET_REGISTRY` in `index.ts` adds `rotate` on top — avoids circular import since RotatorWidget imports BASE_REGISTRY

### API sources
- Weather: `api.open-meteo.com/v1/forecast` — no key, 15 min TTL
- Rain: `api.open-meteo.com/v1/forecast` minutely_15 — switched from buienalarm.nl (Cloudflare started timing out from server IPs). 12 × 15-min slots = 3h lookahead, mm/15min × 4 → mm/hour. 5 min TTL
- News: `feedparser` parsing RSS URLs from config, 10 min TTL
- Sun: `api.sunrise-sunset.org/json` — no key, 6 h TTL
- Garbage: `api.mijnafvalwijzer.nl` — public key, 1 h TTL per days_ahead value
- Polestar: `pypolestar` → Polestar cloud API — 5 min TTL, uses cached data on error
- Calendar: Google Calendar API v3 (service account) — 10 min TTL
- ntfy: browser connects directly, no backend proxy
- Traffic jams: `api.anwb.nl/routing/v1/incidents/incidents-desktop` — no key, 5 min TTL
- Travel time: TomTom Routing API — free key (`TOMTOM_API_KEY`), 5 min TTL, traffic-aware
- TomTom Geocoding: `api.tomtom.com/search/2/geocode/{query}.json` — resolves home/work addresses to coords on first request, cached for process lifetime
- Market Fear & Greed: `api.alternative.me/fng/` — no key, 5 min TTL
- Market quotes (indices + stocks): `stooq.com/q/d/l/` CSV — no key, 7-day date range to get latest close + prev close, 5 min TTL
- Crypto top 10: `api.coingecko.com/api/v3/coins/markets` — no key, 5 min TTL
- P2000: `p2000.brandweer-berkel-enschot.nl/homeassistant/rss.asp` — public RSS, no key, 30 s TTL; filter by RegName (bbox lookup from shared.location), discipline + priority rules, dedup within 5 min window
- Bus (vertrektijd.info): 20 s timeout (raised from 10 s — API occasionally slow). `asyncio.CancelledError` is `BaseException` not `Exception` in Python 3.8+; bus.py has a broad `except Exception` fallback after the two httpx handlers to catch it and serve stale data instead of 500.

## In-Progress Work

### Rules System Rewrite
See `records/rules-rewrite-plan.md` for the full plan and status.
- Replacing flat `assistant.rules` dict with a structured `Rule[]` list
- Generic (shared) and personal (per-person) rules
- Variable catalogue, generic rule engine in assistant
- Admin panel: rule list UI + rule editor modal
- **Current batch:** Batches A–D complete. Waiting for Phase 5c (rule editor modal) with user.
- **Stop before:** Phase 5c (rule editor modal) — implement with user
- **Status:** All code written and verified in Vite dev preview. Needs deploy + server YAML migration to show populated rules.

### Notification channels (2026-03-28)
ntfy and Matrix run in parallel; both optional; configured independently.

**Config structure** (`shared.assistant.notify`):
```yaml
notify:
  ntfy:
    enabled: true
    url: https://ntfy.example.com
  matrix:
    enabled: true
    homeserver: https://matrix.example.com
    room_id: "!systemroom:matrix.example.com"   # fallback for global alerts
# MATRIX_TOKEN=syt_... in .env only — never in YAML
```

**Per-person** (`shared.people[].notify`):
- `ntfy_topic` — personal ntfy topic; global alerts also fan out here
- `matrix_room_id` — personal Matrix room; falls back to system room if absent

**Dispatch logic** (`assistant/notify/matrix.py` + `_dispatch()` in `assistant.py`):
- Personal rule fired → sends to person's configured channels only
- Global rule fired → ntfy fan-out to all personal topics; Matrix to all personal rooms + system room
- MATRIX_TOKEN read from `MATRIX_TOKEN` env var at module load

**Matrix bot setup**: create account with `create-account` in Dendrite, invite bot to room, then `curl POST /_matrix/client/v3/join/{roomId}` (single-time join — membership persists).

**Admin panel**: AssistantTab Notifications card has separate ntfy / Matrix sections with enable toggles + fields. PeopleTab shows both `ntfy topic` and `Matrix room ID` per person.

**Status probes**: `GET /api/admin/status` returns `ntfy: {status}` and `matrix: {status}` (ok/offline/unconfigured) via HTTP probe. Shown in landing page STATUS section above the divider.

## Open Items

See `records/future-ideas.md` for the full backlog with detailed notes on each.

Planned widgets (all considered relevant, to be implemented):
- [ ] Energy prices (ENTSO-E, no key)
- [ ] Countdown to events (YAML config, no backend)
- [ ] Photo slideshow (local directory)
- [x] KNMI weather warnings (no key) — done
- [x] Bus departures (vertrektijd.info, free key) — done
- [ ] NS train departures (free NS API key needed)
- [ ] Home Assistant sensors (HA long-lived token needed)
