# Decision Log

## 2026-03-23 — Icon Libraries

### Weather icons: Meteocons static SVGs via `<img>`
**Decision**: Replace hand-drawn inline SVGs in `WeatherIcons.tsx` with Meteocons static SVGs (`@bybas/weather-icons` dev branch, MIT). Served from `frontend/public/icons/weather/` as `<img>` tags.
**Rationale**: The hand-drawn SVGs were functional but not visually clear. Meteocons are a purpose-built, beautiful weather icon set. Static SVG variant (no SMIL animations) is Chromecast-safe. `<img>` approach is simpler than `vite-plugin-svgr` and Meteocons already carry their own colour palette, so `currentColor` recolouring isn't needed.

### Garbage icons: Phosphor Icons React
**Decision**: Replace hand-drawn inline SVGs in `GarbageWidget.tsx` with `@phosphor-icons/react` — `Leaf` (GFT), `Recycle` (PMD), `TrashSimple` (restafval).
**Rationale**: Phosphor renders pure inline SVGs, matching the existing Chromecast-compatible approach. Clean, consistent icon set with fill/regular weight variants to visually distinguish container types by colour and weight.

## 2026-03-23 — Traffic Route Corridor

### `on_route` filtered by TomTom polyline proximity
**Decision**: Mark a jam on-route only if its road name is in `route_roads` AND its `fromLoc` coordinates are within 25 km of the TomTom route polyline.
**Rationale**: Road-name-only matching flagged jams on the entire length of a road (e.g. A28 near Groningen when commuting Smilde→'s-Hertogenbosch). ANWB jams carry `fromLoc: {lat,lon}`; TomTom route response already returns `legs[0].points`. Haversine point-to-polyline check costs negligible CPU and requires no extra API calls. 25 km corridor is generous enough for Dutch highway geometry while excluding geographically distant sections of the same road.

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

### KNMI warnings: MeteoAlarm Atom/CAP feed, no API key
**Decision**: Use `feeds.meteoalarm.org/feeds/meteoalarm-legacy-atom-netherlands` (public Atom + CAP 1.2 XML). Parse with stdlib `xml.etree.ElementTree` using namespaced tag lookup. Group by (level, event) and aggregate regions. Filter to currently-active entries (status=Actual, message_type=Alert, now within [onset, expires]).
**Rationale**: The KNMI CDN XML (`cdn.knmi.nl/.../waarschuwingen_actueel.xml`) returns 403 to server-side HTTP requests — it is browser-only. MeteoAlarm is the official European meteorological alarm service that KNMI feeds into; it is properly public, stable, and requires no credentials. CAP severity maps cleanly to geel/oranje/rood.

### RotatorWidget: skipSet must be a ref, not state
**Decision**: `skipSet` is stored in `skipSetRef` (a `useRef`) rather than `useState`. A version counter (`skipVersion`) triggers re-renders when the ref changes.
**Rationale**: Having `skipSet` in `useState` caused it to appear in the `setInterval` effect's dependency array. Every time a widget called `onSkip()`, the interval was cleared and restarted, giving the currently-visible slot a fresh full rotation period — effectively doubling its display time. Moving it to a ref means the interval effect only recreates on `slots.length` or `intervalSec` changes, while the callback still reads the latest skip set via the ref.

### Garbage widget: configurable days_ahead, fit-to-box
**Decision**: `days_ahead` is a per-widget YAML config key (default 7). The backend `?days_ahead=N` query param is validated (1–365) and cached per value. The widget measures its container with `ResizeObserver` and slices the collections list to show only complete cards.
**Rationale**: The hardcoded 7-day window was not always right — fewer or more days may be useful depending on widget size. Fit-to-box via ResizeObserver is more robust than guessing a fixed max based on row_span, since the actual rendered height depends on the grid and font scaling.

---

## 2026-03-21 — Multi-screen, people system, smart caster

### Multi-screen YAML schema: shared + screens[]
**Decision**: Config uses a top-level `shared` object (location, language, people, shared widgets like news ticker) and a `screens[]` array (each with id, name, chromecast_ip, people[], layout, widgets[]). Backend `GET /api/config?screen=<id>` merges shared + the named screen config before returning.
**Rationale**: Alternatives considered: (a) separate YAML file per screen — fragments configuration, makes shared settings harder to maintain; (b) env var `SCREEN_ID` in docker-compose — less flexible, requires file changes to add a screen. The merged schema keeps all config in one place and makes shared settings (location, language, news feeds) DRY. Old flat-format configs are auto-migrated so existing installs are not broken.

### SCREEN_ID captured at module load, not in hook
**Decision**: `SCREEN_ID` is read from `new URLSearchParams(window.location.search).get('screen') ?? 'default'` once at module load time in `use-config.ts`, not inside the hook function.
**Rationale**: If captured inside the hook, `SCREEN_ID` would be re-evaluated on every render. Since it appears in the TanStack Query `queryKey` as `['config', screenId]`, a changing value would cause every widget to re-fetch on every render. Capturing it at module load gives a stable value for the lifetime of the page.

### Per-widget params moved from env vars to YAML widget config
**Decision**: Garbage (`postcode`, `huisnummer`), bus (`stop_city`, `stop_name`), traffic (`home_address`, `work_address`, `route_roads`), calendar (`calendar_ids`) are all configurable as per-widget keys in YAML. Env vars remain as fallbacks for backward compatibility.
**Rationale**: Multi-screen operation requires different widgets on different screens to have different parameters (e.g. different bus stops, different home/work addresses). Env vars are process-global and cannot vary per widget or per screen. YAML config is the right place for display content parameters. Env var fallback means no migration burden for existing single-screen installs.

### People system: family flag + per-screen people list
**Decision**: `shared.people[]` defines all household members. Each person has `family: bool` and `calendar_ids[]`. Each screen has `people: [id, ...]`. The backend injects all family members' calendar_ids plus the listed people's calendar_ids into each screen's calendar widget config.
**Rationale**: Calendars are the most per-person, per-screen piece of data in the system. Rather than requiring users to manually copy calendar IDs into each widget on each screen, the people system makes this declarative: define a person once with their calendar IDs, assign them to screens. Family members (shared family calendar, holidays, etc.) flow to every screen automatically.

### Smart caster: single container reads chromecast_ip from config
**Decision**: `cast.py` reads `chromecast_ip` from each screen object in the YAML config. A single `caster` container manages all screens. Adding a screen's Chromecast IP in the admin panel takes effect on the next polling cycle, with no restart.
**Rationale**: Alternatives: (a) separate caster container per screen — N screens requires N containers and N env vars; (b) env vars for all Chromecast IPs — requires docker-compose.yml edits and container restarts. Config-driven is consistent with the rest of the system: the admin panel is the place to manage screen settings, not the Compose file.

### Scanner sidecar: separate service with host network
**Decision**: Chromecast discovery (`catt scan`) runs in a separate `scanner` service with `network_mode: host`. The backend proxies `GET /api/admin/scan` to it via `http://host.docker.internal:8765/scan`.
**Rationale**: `catt scan` uses mDNS (Zeroconf/Bonjour), which requires host network mode. Adding `network_mode: host` to the backend would change its networking significantly (losing the Docker internal network), breaking backend→frontend routing and the `backend:8000` alias. A dedicated sidecar with host network keeps backend networking clean. The backend→scanner proxy via `host.docker.internal` is a standard Docker pattern for this case.

### Config gitignored + auto-create/migrate
**Decision**: `config/wall-cast.yaml` is in `.gitignore`. The backend writes a default config on first run if the file does not exist. Old flat-format configs are detected and auto-migrated to the `shared + screens[]` schema on startup.
**Rationale**: Previously the file was tracked in git with `git update-index --skip-worktree` as a workaround. This was fragile: the workaround had to be manually managed, could be lost after fresh clones, and required a dance to pull schema changes. Gitignoring is the correct solution: the admin panel is the interface for config changes, not git. Auto-create ensures the first `docker compose up` produces a working display immediately. Auto-migrate ensures existing installs are not broken when pulling a new version with a schema change.

### Backend user: ${UID:-1000}:${GID:-1000} + chmod 664
**Decision**: Backend container runs as the user specified by `UID` and `GID` in `.env` (defaults to 1000:1000). Config file is written with `chmod 664` after every admin save.
**Rationale**: Previously the backend ran as root, which caused `config/wall-cast.yaml` to be owned by root after the first admin save. This meant `git pull` on the host would fail with a permission error on the config directory. Running as the host user's UID/GID makes the file ownership match the host user, so git, editors, and Docker all have consistent access.

---

## 2026-03-21 — Visual polish: shared design token system

### Widget styles: centralised design tokens in styles.ts
**Decision**: Created `frontend/src/widgets/styles.ts` as the single source of truth for all widget typography, spacing, and colour values. All 7 display widgets import from it.
**Rationale**: Each widget had independently authored font sizes (`clamp()` strings), spacing values, and card radii that had drifted apart over time — approximately 15 distinct font-size values for what should have been 7 semantic tiers. Centralising eliminates drift, makes global adjustments a one-line edit, and gives future widget authors a clear contract. The file exports named constants (`fs`, `sp`, `col`) and pre-composed style objects (`shellStyle`, `titleStyle`, `dividerStyle`, `cardBase`, etc.) so components stay concise.

### Font scale: 7 semantic tiers replacing ~15 ad-hoc values
**Decision**: `xs / sm / md / lg / hero / title / icon` — each a single `clamp()` string.
**Rationale**: TV displays at 1080p with widgets ranging from a 2×2 clock cell to a 4×7 weather panel need `clamp()` to scale with viewport width. But 15 slightly different `clamp()` values across 7 files creates visual noise that is invisible in code review and hard to maintain. Seven named tiers covers every semantic role without ambiguity.

### Shell gap: reduced from 0.5–0.65rem to 0.45rem
**Decision**: Unified `shellStyle.gap` to `0.45rem` across all widgets.
**Rationale**: The `gap` in a flex-column shell applies equally above and below the title divider, so a 0.65rem gap produced ~1.3rem of perceived vertical space between the title and the first card — visibly more than the horizontal card padding of 0.4–0.6rem. Reducing to 0.45rem makes vertical and horizontal rhythm match.

### Card padding and radius: unified across all widgets
**Decision**: `cardPad = '0.45rem 0.7rem'`, `cardRadius = 8` everywhere.
**Rationale**: TravelCard used `0.6rem 0.85rem`; GarbageCard used `0.4em 0.65em`; JamRow used radius 6. The differences were not intentional design choices but natural drift. Uniform values make cards read as a consistent system regardless of which widget they appear in.

---

## 2026-03-22 — Network widget, caster fix, admin save fix

### Network widget: router password in .env, not YAML
**Decision**: `router_url` and `router_username` are stored in `shared.network` in the YAML (editable via admin panel). `router_password` is read exclusively from the `ROUTER_PASSWORD` environment variable.
**Rationale**: Passwords should never be stored in config files that could be shared, backed up, or accidentally committed. The `.env` file is gitignored and explicitly excluded from the config volume. The YAML is the right place for non-secret configuration (URLs, usernames); the env file is the right place for secrets.

### Network widget: shared.network must be forwarded through get_config() merge
**Decision**: Added `"network": shared.get("network", {})` explicitly to the merged dict returned by `wall_config.get_config()`.
**Rationale**: The merge function only forwarded `location`, `language`, `layout`, and `widgets`. All other top-level shared keys were silently dropped. The network router calls `get_config()` (not `get_raw_config()`) and looked up `cfg.get("network", {})` — always getting an empty dict, so `router_url` was always `""` and the router session was never created. Any future shared-only backend config key (not widget config) needs the same explicit forwarding in the merge.

### Network widget: Zyxel VMG8825 DAL API with RSA+AES auth
**Decision**: Implemented a `RouterSession` class that performs the full Zyxel RSA+AES handshake: fetch RSA public key → generate AES key → RSA-encrypt AES key → AES-encrypt credentials → POST to `/UserLogin` → decrypt response → use `sessionkey` as CSRFToken on subsequent DAL requests.
**Rationale**: The Zyxel VMG8825 does not use basic auth or a simple API key. It uses an encrypted login flow derived from CryptoJS. Without implementing this handshake, the router API is inaccessible. The `cryptography` Python package handles both RSA (PKCS1v15) and AES-CBC with PKCS7 padding.

### Caster: cooldown to prevent false-negative recast loop
**Decision**: `cast.py` tracks `last_cast_at: dict[str, float]` per Chromecast IP. If `is_casting()` returns `False` but we cast within the last `CAST_COOLDOWN` seconds (default 300, env-configurable), the recast is skipped.
**Rationale**: `catt status` consistently returns no PLAYING/DashCast match immediately after `cast_site` completes — likely because the receiver is still loading. Without a cooldown, `is_casting()` returns `False` on the very next 60 s check, triggering a recast that reloads the display page. This caused all widgets to flash "unavailable" every 60 s (reload → TanStack Query cache miss → loading state). The cooldown gives the cast 5 minutes to settle before the caster considers it genuinely dropped.

### Admin panel: draft overwrite bug on save
**Decision**: Two changes: (1) the `useEffect` that syncs `remoteConfig → draft` is guarded by `draft === null` so it only runs on initial load; (2) `handleSave` uses `queryClient.setQueryData()` instead of `queryClient.invalidateQueries()`.
**Rationale**: The original code called `invalidateQueries()` after a successful save, which triggered a background refetch. When the refetch completed, `remoteConfig` changed, and the unguarded `useEffect` called `setDraft(deepClone(remoteConfig))`, silently overwriting the user's current draft with the server snapshot. This caused newly added people/screens or changed values to disappear immediately after saving, or when switching tabs back. The fix ensures the draft is a one-way initialisation from server data, and that saves never trigger a refetch (since we know the server now holds exactly what we just sent).

### Caster: dynamic IP recovery via scanner sidecar
**Decision**: When a device is unreachable at its configured IP, `cast.py` calls the scanner sidecar (`GET localhost:8765/scan`) to locate the device by its `chromecast_name`. If found at a new IP, the config YAML is atomically updated so the change persists across restarts. `last_cast_at` is now keyed by screen ID (not IP) so cooldown survives IP changes.
**Rationale**: TVs and set-top boxes get new DHCP leases after a reboot. Previously the caster kept trying the stale IP until a human manually updated the config. The scanner already does LAN-wide TCP probing; matching by device name is reliable because friendly names are set by the user and don't change on reboot. The config write re-uses the same atomic tmp→rename pattern used by the admin panel, and triggers the SSE watcher so the admin panel IP field updates immediately. Requires `chromecast_name` to be set per screen — without it the caster still works but cannot auto-recover.
