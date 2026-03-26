# Multi-Screen / Multi-User wall-cast

> Architectural design document for extending wall-cast from a single-screen household display
> into a multi-screen, per-person system — one backend, many Chromecasts, family + individual data.

> **Implementation status (2026-03):**
> Phases 1–3 are complete and shipped as part of the current release. The `shared + screens[]` YAML schema, per-widget params (calendar IDs, bus stops, traffic routes), the `?screen=` config endpoint, and the multi-screen admin panel are all live.
>
> Phase 4 (separate caster Docker services per screen) was superseded: the single `caster` service reads all screens from `wall-cast.yaml` and manages them in one loop, including DHCP re-discovery by device name. See `caster/cast.py`.
>
> The sections below are kept as architectural background — they explain the design decisions that shaped the current implementation.

---

## Vision

Each screen in the house shows a common set of family-wide information (shared news, shared weather, shared family calendar) plus content that is specific to whoever's room it's in — their personal calendar, their bus stop, their commute. The admin panel at `/#admin` can reach and configure every screen from one place.

Example household:

| Screen | Location | Shows |
|--------|----------|-------|
| `living-room` | Kitchen/living room | Family calendar, everyone's agenda summary, shared weather, traffic |
| `dad-office` | Home office | Dad's calendar + family, commute traffic, Polestar, weather |
| `emma-bedroom` | Emma's room | Emma's calendar + family, Emma's bus stop, rain |
| `liam-bedroom` | Liam's room | Liam's calendar + family, Liam's bus stop |

---

## Current Architecture (single-screen)

```
/config/wall-cast.yaml          ← single YAML, one layout, one widget list
        │
        ▼
GET /api/config                 ← returns full YAML as JSON
        │
        ▼
All screens                     ← every browser tab gets identical config
```

Data sources that are **per-person** live today as **env vars** (container-wide):
- `GOOGLE_CALENDAR_ID` — one calendar
- `BUSSTOP_CITY` / `BUSSTOP_NAME` — one bus stop
- `GARBAGE_POSTCODE` / `GARBAGE_HUISNUMMER` — one address
- `TRAFFIC_HOME_ADDRESS` / `TRAFFIC_WORK_ADDRESS` — one commute

---

## Proposed Architecture

### 1. YAML schema: `shared` + `screens[]`

```yaml
# ── Shared: applies to every screen ────────────────────────────────────────
shared:
  location: { lat: 52.37, lon: 4.90, name: Amsterdam }
  language: en
  widgets:
    - id: news
      type: news
      col: 1
      row: 8
      col_span: 12
      row_span: 1
      config:
        feeds:
          - { url: "https://feeds.nos.nl/nosnieuwsalgemeen", label: NOS }
        scroll_speed_px_per_sec: 80

# ── Screens: one entry per physical display ─────────────────────────────────
screens:
  - id: living-room
    name: Living Room
    layout: { columns: 12, rows: 8 }
    widgets:
      - id: clock
        type: clock
        col: 1
        row: 1
        col_span: 4
        row_span: 3
        config: { show_seconds: true, show_date: true }

      - id: main-rotator
        type: rotate
        col: 5
        row: 1
        col_span: 8
        row_span: 7
        config:
          interval_sec: 15
          widgets:
            - type: weather
              config: { show_hourly: true, show_daily: true }
            - type: calendar
              config:
                calendar_ids:
                  - family@group.calendar.google.com
                  - dad@gmail.com
                  - mom@gmail.com
            - type: traffic
              config:
                home_address: "Streetname 1, 1234AB City, NL"
                work_address: "Streetname 1, 5678CD City, NL"

      - id: bottom-rotator
        type: rotate
        col: 1
        row: 4
        col_span: 4
        row_span: 4
        config:
          interval_sec: 15
          widgets:
            - type: rain
            - type: garbage
              config: { postcode: 1234AB, huisnummer: 1, days_ahead: 14 }
            - type: bus
              config: { stop_city: Amsterdam, stop_name: Leidseplein }
            - type: polestar

  - id: emma-bedroom
    name: "Emma's Room"
    layout: { columns: 12, rows: 8 }
    widgets:
      - id: clock
        type: clock
        col: 1
        row: 1
        col_span: 4
        row_span: 3
        config: { show_seconds: false, show_date: true }

      - id: calendar-emma
        type: calendar
        col: 5
        row: 1
        col_span: 8
        row_span: 7
        config:
          calendar_ids:
            - family@group.calendar.google.com
            - emma@gmail.com          # Emma's personal calendar

      - id: bottom-rotator
        type: rotate
        col: 1
        row: 4
        col_span: 4
        row_span: 4
        config:
          interval_sec: 20
          widgets:
            - type: rain
            - type: bus
              config:
                stop_city: Zaandam
                stop_name: Station Zaandam     # Liam's school bus stop
```

**Merge rule**: A screen's effective config = `shared.widgets` appended to `screens[n].widgets`.
Shared settings (location, language) fill in as defaults, overridable per-screen.

### 2. Screen identity — URL query param

Each Chromecast is cast to a URL that includes the screen ID:

```
http://192.168.2.100/?screen=living-room
http://192.168.2.100/?screen=emma-bedroom
```

- Frontend reads `window.location.search` on load
- Passes `?screen=living-room` to `GET /api/config?screen=living-room`
- Backend merges shared + screen block and returns the result
- Falls back to the first screen if no param given

### 3. Backend: config endpoint gains `?screen=` param

```python
# backend/app/routers/config.py
@router.get("/config")
async def get_config(screen: str | None = Query(default=None)) -> dict:
    return wall_config.get_config(screen=screen)
```

`wall_config.get_config(screen)` merges `shared` + the matching `screens[]` entry.

### 4. Per-widget data params move from env vars → YAML widget config

Non-secret per-person configuration moves out of `.env` into the YAML `config` block of each widget. The backend endpoints accept these as optional query params, falling back to env vars when not supplied (backwards-compatible).

| Widget | Currently (env var) | Proposed (YAML widget config + query param) |
|--------|--------------------|--------------------------------------------|
| `calendar` | `GOOGLE_CALENDAR_ID` (one ID) | `calendar_ids: [id1, id2]` (list, merged) |
| `bus` | `BUSSTOP_CITY` / `BUSSTOP_NAME` | `stop_city`, `stop_name` per widget |
| `garbage` | `GARBAGE_POSTCODE` / `GARBAGE_HUISNUMMER` | `postcode`, `huisnummer` per widget |
| `traffic` | `TRAFFIC_HOME_ADDRESS` / `TRAFFIC_WORK_ADDRESS` | `home_address`, `work_address` per widget |
| `polestar` | `POLESTAR_USERNAME` / `POLESTAR_PASSWORD` | **stays in env** (credentials) |
| `weather` | location from top-level YAML | stays location-based (shared) |

**Secrets that MUST stay in env** (never in YAML):
- `POLESTAR_USERNAME` / `POLESTAR_PASSWORD`
- `GOOGLE_SA_KEY_FILE`
- `TOMTOM_API_KEY`
- `VERTREKTIJD_API_KEY`

For multi-car Polestar support: use `POLESTAR_VIN_DAD`, `POLESTAR_VIN_MOM` env vars
and widget config references `vin_key: dad`. Deferred to a later phase.

### 5. Backend cache strategy change

Current caches are module-level dicts (one cache per endpoint). With per-widget params,
caches must be keyed by the full parameter set:

```python
# Before
_cache: dict[str, Any] = {}   # one global cache

# After
_cache: dict[str, Any] = {}   # keyed by param hash, e.g. "Amsterdam:Leidseplein"
_cache_ts: dict[str, float] = {}
```

### 6. Admin panel: multi-screen support

- **Screen selector** dropdown at the top of the admin panel
- All existing controls (rotator slots, intervals, feeds, language, days_ahead) scoped to the selected screen
- **Shared** tab for family-wide settings (news feeds, language, location)
- `PUT /api/admin/config` accepts `?screen=` param and writes only that screen's block
- The full YAML is always preserved; the PUT merges/replaces only the targeted section

### 7. Caster: one instance per screen

```yaml
# docker-compose.yml additions
caster-living-room:
  build: ./caster
  network_mode: host
  environment:
    CHROMECAST_IP: "192.168.2.50"
    DISPLAY_URL: "http://192.168.2.100/?screen=living-room"
  restart: unless-stopped

caster-emma:
  build: ./caster
  network_mode: host
  environment:
    CHROMECAST_IP: "192.168.2.51"
    DISPLAY_URL: "http://192.168.2.100/?screen=emma-bedroom"
  restart: unless-stopped
```

### 8. SSE hot-reload: unchanged

The SSE broadcast sends `config-updated` to all subscribers. Each screen re-fetches
`/api/config?screen=<its-own-id>`. Only the screens affected by a change will see
meaningful differences — others simply get the same data back. No per-screen SSE filtering needed.

---

## Per-Widget Impact

| Widget | Impact | Work |
|--------|--------|------|
| **clock** | None — no data source | None |
| **weather** | None — location stays shared | None |
| **rain** | None — location stays shared | None |
| **sun** | None — location stays shared | None |
| **warnings** | None — nationwide NL | None |
| **news** | Shared feeds in `shared.widgets`, per-screen additions in screen widgets | Schema only |
| **garbage** | Accept `postcode`/`huisnummer` from widget config; cache keyed by address | Backend + frontend |
| **bus** | Accept `stop_city`/`stop_name` from widget config; cache keyed by stop | Backend + frontend |
| **calendar** | Accept `calendar_ids[]` from widget config; fetch N calendars in parallel, merge events | Backend (most complex) + frontend |
| **traffic** | Accept `home_address`/`work_address` from widget config; re-geocode per unique pair | Backend + frontend |
| **polestar** | Single car per household (env vars stay); multi-car via VIN env vars possible later | None for phase 1 |
| **rotate** | None — meta-widget, children already carry their own configs | None |

---

## Phased Implementation

### Phase 1 — Per-widget params (non-breaking, no schema restructure)

Move data-source config from env vars to YAML widget config + backend query params.
Existing env vars remain as fallback. Single-screen YAML continues to work unchanged.
**This phase alone already enables a useful multi-screen setup** — different screens can have different widget configs pointing to different calendars/stops/addresses.

Files changed:
- `backend/app/routers/calendar.py` — accept `?calendar_ids=` param, fetch N in parallel
- `backend/app/routers/bus.py` — accept `?stop_city=&stop_name=` params, cache by stop
- `backend/app/routers/garbage.py` — accept `?postcode=&huisnummer=` params
- `backend/app/routers/traffic.py` — accept `?home=&work=` params, geocode per unique pair
- `frontend/src/hooks/use-calendar.ts` — pass calendar_ids from widget config
- `frontend/src/hooks/use-bus.ts` — pass stop from widget config
- `frontend/src/hooks/use-garbage.ts` — pass address from widget config
- `frontend/src/hooks/use-traffic.ts` — pass addresses from widget config
- `frontend/src/widgets/*/` — extract params from `config` prop and pass to hooks

**Estimated effort**: 1.5–2 days / Claude Code: ~2–3 hours
**Risk**: Low — backwards-compatible, env var fallback preserved

---

### Phase 2 — YAML schema: `shared` + `screens[]`

Introduce the new top-level structure. Backend config parser handles both old (flat) and
new (screens) formats. `/api/config?screen=` endpoint added.

Files changed:
- `backend/app/wall_config.py` — new schema parser, merge logic, screen lookup
- `backend/app/routers/config.py` — `?screen=` query param on GET and SSE endpoints
- `frontend/src/hooks/use-config.ts` — read `?screen=` from URL, pass to API
- `frontend/src/App.tsx` — extract screen id for SSE re-fetch scoping
- `docs/config-reference.md` — full schema documentation update

**Estimated effort**: 1.5 days / Claude Code: ~2 hours
**Risk**: Medium — schema migration. Old single-screen YAML must still work as fallback (detected by absence of `screens:` key).

---

### Phase 3 — Admin panel multi-screen

Screen selector, scoped controls, shared section.

Files changed:
- `frontend/src/admin/AdminPanel.tsx` — screen selector dropdown, scoped state
- `backend/app/routers/config.py` — PUT `/api/admin/config?screen=` partial write

**Estimated effort**: 1.5 days / Claude Code: ~2 hours
**Risk**: Low — additive UI change

---

### Phase 4 — Multiple casters

Parameterise docker-compose for N caster instances.

Files changed:
- `docker-compose.yml` — N caster services with screen-specific URLs
- `docs/` — updated setup guide

**Estimated effort**: 0.5 days
**Risk**: Low

---

**Total estimated effort**: 5–6 developer-days / ~6–8 hours with Claude Code

---

## Risk Register

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|-----------|
| Secrets leak into YAML | Medium | High | Hard rule: only non-secret config in YAML. Credentials stay in `.env` always. Backend validates no credential keys appear in widget config. |
| Calendar API rate limits | Medium | Medium | Google Calendar API free tier: 1M queries/day. N parallel fetches per 10-min TTL is negligible. Cache aggressively. |
| Cache key collisions | Low | Medium | Key all caches by full param hash (e.g. `f"{stop_city}:{stop_name}"`). Already done for garbage `days_ahead`. |
| SSE fan-out on config update | Low | Low | All screens re-fetch on any change; each fetches its own screen slice. No extra load beyond current behaviour. |
| Old YAML breaks on schema change | Medium | High | Parser detects `screens:` key to choose new vs old path. Old flat YAML auto-treated as a single `screens[0]` entry. |
| Admin panel writes wrong screen | Low | Medium | PUT scoped to explicit `?screen=` param; backend validates screen ID exists before writing. |
| Polestar multi-car | Low | Low | Out of scope for now. VIN-based env var scheme (`POLESTAR_VIN_DAD`) deferred to later. |
| Per-screen location (different cities) | Low | Low | Out of scope — designed for one household. Widget-level location override is a possible future extension. |

---

## Open Questions

1. **`shared.widgets` — always appended or mergeable?** Proposal: always appended (simplest). A screen suppresses a shared widget by not including it in its own list, or an `enabled: false` flag.

2. **Language per-screen?** Likely overkill for one household. Keep it in `shared`, overridable per-screen if wanted.

3. **Guest/phone screen?** A URL without `?screen=` falls back to first screen or a read-only `shared`-only view.

4. **Polestar multi-car.** If two people have Polestar cars, use `POLESTAR_VIN_DAD` / `POLESTAR_VIN_MOM` env vars + widget `config: { vin_key: dad }`. Deferred.

5. **News per-screen.** Family news in `shared.widgets`, personal interest feeds added per-screen. The news widget aggregates all feeds it receives, so the frontend simply merges both lists before passing to the hook.

---

## Starting Point for Implementation

Work in the `multi-user` branch. Start with **Phase 1** — it delivers the most value with the least risk and no schema breaking changes. Each phase is independently mergeable.

**Phase 1 entry points:**

| File | What to change |
|------|----------------|
| `backend/app/routers/calendar.py` | Accept `calendar_ids` query param (comma-separated), fetch each in parallel with `asyncio.gather`, merge and sort events |
| `backend/app/routers/bus.py` | Accept `stop_city` / `stop_name` query params; fall back to `settings.*`; key cache as `f"{city}:{stop}"` |
| `backend/app/routers/garbage.py` | Accept `postcode` / `huisnummer` query params; fall back to `settings.*`; key cache as `f"{postcode}:{huisnummer}"` |
| `backend/app/routers/traffic.py` | Accept `home_address` / `work_address` query params; geocode per unique pair (already uses a `_coords` dict keyed by address) |
| `frontend/src/widgets/calendar/CalendarWidget.tsx` | Read `config.calendar_ids` (list), pass to `useCalendar()` |
| `frontend/src/hooks/use-calendar.ts` | Accept `calendarIds: string[]`, append as `?calendar_ids=id1,id2` |
| `frontend/src/widgets/bus/BusWidget.tsx` | Read `config.stop_city` / `config.stop_name`, fall back to no param (backend uses env var) |
| `frontend/src/hooks/use-bus.ts` | Accept optional stop params, append to query if present |
| Similarly for garbage and traffic hooks/widgets | Same pattern |
