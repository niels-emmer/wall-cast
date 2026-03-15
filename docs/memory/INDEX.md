# wall-cast Memory Index

## Project Status

**Phase**: Production-ready — fully functional, deployed via Docker Compose, cast to Chromecast.
**Location**: Smilde, NL (lat 52.5257, lon 6.4510)

## Quick Context

- Repo: `/Users/nemmer/repositories/wall-cast`
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
| weather | /api/weather | WeatherWidget.tsx | ✅ production |
| rain | /api/rain | RainWidget.tsx | ✅ production |
| news | /api/news | NewsTickerWidget.tsx | ✅ production |
| sun | /api/sun | embedded in WeatherWidget | ✅ production |

## Feature Status

| Feature | Status | Notes |
|---------|--------|-------|
| CSS grid layout | ✅ | 12×8, widget positions from YAML |
| YAML hot-reload | ✅ | SSE push within ~1s of file save |
| Weather widget | ✅ | Current + 7h hourly + 7-day daily |
| Rain SVG chart | ✅ | Bezier area chart, HTML overlay labels |
| News RSS ticker | ✅ | Infinite scroll, Web Animations API |
| Sunrise/sunset block | ✅ | Embedded top-right of weather widget |
| Breaking news (ntfy) | ✅ | SSE direct to browser, interspersed every ~3 items |
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

### API sources
- Weather: `api.open-meteo.com/v1/forecast` — no key, 15 min TTL
- Rain: `cdn-secure.buienalarm.nl/api/3.4/forecast.php` — replaced dead gpsgadget endpoint, 5 min TTL
- News: `feedparser` parsing RSS URLs from config, 10 min TTL
- Sun: `api.sunrise-sunset.org/json` — no key, 6 h TTL
- ntfy: browser connects directly, no backend proxy

## Open Items

- [ ] Push repo to GitHub
- [ ] Consider ENTSO-E energy price widget (free API, no key)
- [ ] Consider NS train departures widget (requires NS API key)
