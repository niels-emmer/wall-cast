# Future Widget Ideas

Status as of 2026-03-21. All ideas are considered relevant and likely to be implemented.

## Summary

| # | Widget | External API key needed | Effort |
|---|--------|------------------------|--------|
| 1 | Energy prices | None (ENTSO-E) | Low |
| 2 | Countdown | None (YAML config) | Very low |
| 3 | Photo slideshow | None (local files) | Low–medium |
| 4 | KNMI weather warnings | None | Low–medium | ✅ done (branch: weather-warnings) |
| 5 | NS train departures | Free (registration) | Medium |
| 5b | Bus departures (vertrektijd.info) | Free (registration) | Medium | ✅ done |
| 6 | Home Assistant sensors | HA long-lived token | Medium |

---

## 1. Energy prices

**What**: Show today's hourly day-ahead electricity price curve. Highlight cheap vs expensive hours at a glance — e.g. "now: €0.08/kWh — peak at 18:00: €0.31/kWh". Very actionable for Dutch households on dynamic contracts.

**API**: ENTSO-E Transparency Platform (`transparency.entsoe.eu`)
- Endpoint: `GET /api?documentType=A44&...` (Day-Ahead Prices, area NL, bidding zone `10YNL----------L`)
- Format: XML (`Publication_MarketDocument`)
- No API key required for the public transparency endpoint
- Data is published the day before, around 13:00 CET — cache TTL: 1 hour is fine, prices don't change intraday

**Backend route**: `GET /api/energy`
- Fetch today's + tomorrow's hourly prices (if available)
- Parse XML, return array of `{ hour: 0-23, price_eur_kwh: float }` for today (and optionally tomorrow)
- Add VAT (21%) and any fixed supplier markup if desired — or just show raw market price with a label

**Frontend**:
- Similar shape to the rain widget: time-series → SVG area/bar chart
- X-axis: hours 0–23, highlight current hour
- Y-axis: price in €ct/kWh
- Color-code bars: green (cheap) / amber / red (expensive) based on thresholds
- Small "now" indicator

**Notes**:
- The ENTSO-E public API occasionally requires a security token even for public data — worth checking at implementation time; there is also an unofficial wrapper `entsoe-py` (Python)
- Alternative: Tibber GraphQL API (requires Tibber account/token) gives real-time prices and actual consumption if user has a Tibber contract

---

## 2. Countdown widget

**What**: Display days (and optionally hours) until a named upcoming event. E.g. "Vakantie → 12 dagen", "Verjaardag Emma → 4 dagen". Multiple events show as a small list; the nearest one can be highlighted.

**API**: None — pure client-side date math.

**Config (YAML)**:
```yaml
- type: countdown
  col: 9
  row: 1
  col_span: 2
  row_span: 2
  events:
    - label: Zomervakantie
      date: "2026-07-18"
    - label: Verjaardag papa
      date: "2026-05-03"
```

**Backend route**: None needed. If events are in YAML they're already served by `GET /api/config`.

**Frontend**:
- Read `widget.events`, compute `Math.ceil((target - now) / 86400000)` per event
- Sort ascending, show nearest first
- Suppress events in the past (or show "vandaag!" on the day itself)
- Style: event label + large day count + "dagen" suffix

**Notes**:
- Very low effort — no new backend route, no external dependency
- Could integrate with Google Calendar in future: pull events with a specific label/tag as countdown targets

---

## 3. Photo slideshow

**What**: Cycle through family photos stored in a volume-mounted directory. Full-cell image with crossfade transition. Configurable interval.

**API**: No external API. Backend serves files from a mounted local directory.

**Backend route**: `GET /api/photos`
- Scan a configurable directory (e.g. `/photos`, volume-mounted in docker-compose)
- Return a shuffled list of relative file paths
- Add a static file mount in FastAPI: `app.mount("/photos", StaticFiles(directory="/photos"))`

**Config (YAML)**:
```yaml
- type: photos
  col: 7
  row: 3
  col_span: 4
  row_span: 4
  interval: 15   # seconds between photos
```

**Frontend**:
- Fetch `/api/photos` once on mount for the file list
- Cycle through URLs with a CSS `opacity` crossfade transition
- `object-fit: cover` to fill the cell without distortion
- Preload next image to avoid flash

**Docker**:
- Add volume to `docker-compose.yml`: `./photos:/photos:ro`
- User drops JPEG/PNG files in the `photos/` directory on the host — hot-reloadable (re-fetch list periodically or on SSE config event)

**Notes**:
- Keep the static mount path separate from `/api/*` so nginx doesn't proxy it to the backend — or proxy it via the existing `location /api/` rule and serve the files directly from the backend
- Could add EXIF date reading to show photo date as a caption

---

## 4. KNMI weather warnings

**What**: Show active severe weather warnings for the Netherlands (code yellow / orange / red). Widget is invisible when no warning is active — appears automatically when one is issued. Shows warning type (storm, snow, fog, ice) and level.

**API**: KNMI Open Data API (`api.dataplatform.knmi.nl`) or the GeoJSON warnings endpoint
- Public endpoint (no key): `https://cdn.knmi.nl/knmi/map/page/weer/actueel-weer/waarschuwingen_actueel.xml` (legacy but stable)
- Modern: KNMI Open Data Platform — requires a free API key
- Simpler alternative: `https://www.knmi.nl/nederland-nu/weer/waarschuwingen` page scrape, or use Buienradar's warning feed

**Backend route**: `GET /api/warnings`
- Fetch and parse the KNMI warning feed
- Return active warnings: `{ level: "yellow"|"orange"|"red", type: "wind"|"snow"|"fog"|"rain", region: string, valid_until: ISO datetime }[]`
- Cache TTL: 15 minutes
- Return empty array when no warnings → frontend hides the widget

**Frontend**:
- Hidden (renders nothing) when warnings array is empty
- When active: colored banner with warning icon + type + level
- Color matches level: yellow / amber / red background
- Could flash or animate for orange/red

**Notes**:
- The legacy XML endpoint at `cdn.knmi.nl` is the easiest — no key, straightforward XML
- The new KNMI Open Data API requires registration but gives more structured data
- Worth checking whether Buienradar's widget API exposes the same data in a simpler format

---

## 5. NS train departures

**What**: Live departure board for a configured NS station. Shows next N trains: destination, departure time, platform, and delay. Familiar "station board" look.

**API**: NS API (`gateway.apiportal.ns.nl`)
- Endpoint: `GET /reisinformatie-api/api/v2/departures?station=<code>`
- Requires a free API key — register at `developer.ns.nl`
- Returns rich JSON with departure time, delay, platform, direction, cancelled flag
- Cache TTL: 30–60 seconds (real-time data)

**Config (YAML)**:
```yaml
- type: ns
  col: 1
  row: 6
  col_span: 3
  row_span: 2
  station: HLM       # NS station code, e.g. HLM = Haarlem
  max_departures: 5
```

**Backend route**: `GET /api/ns?station=<code>`
- Proxy NS API with the key from env var `NS_API_KEY`
- Return: `{ departures: [{ time, delay_min, platform, direction, cancelled }] }`

**Frontend**:
- Classic departure board table: time | destination | platform | delay
- Strikethrough + red for cancelled trains
- Amber for delayed, green for on-time
- Show planned time + "+N min" delay separately

**Notes**:
- Nearest relevant stations to Amsterdam: Haarlem (HLM), Zaandam (ZD), Utrecht (UT)
- `NS_API_KEY` goes in `.env` (gitignored), add to `.env.example`
- The NS API also has a route planning endpoint — could extend later to show travel time home→work by train

---

## 6. Home Assistant sensors

**What**: Display live sensor values from a local Home Assistant instance — indoor temperature, humidity, energy consumption, door/window states, anything HA exposes. Flexible card-based layout, fully configurable in YAML.

**API**: Home Assistant REST API (`http://<ha-host>:8123/api/states/<entity_id>`)
- Requires a Long-Lived Access Token (generated in HA user profile)
- One request per entity, or use the `/api/states` bulk endpoint and filter
- Cache TTL: 60 seconds (or 30s for fast-changing sensors)

**Config (YAML)**:
```yaml
- type: homeassistant
  col: 10
  row: 5
  col_span: 2
  row_span: 3
  sensors:
    - entity: sensor.living_room_temperature
      label: Woonkamer
      unit: "°C"
    - entity: sensor.p1_current_power
      label: Verbruik
      unit: W
    - entity: binary_sensor.front_door
      label: Voordeur
      on_label: Open
      off_label: Dicht
```

**Backend route**: `GET /api/homeassistant`
- Read entity IDs from config (passed as query params or read from the YAML directly in the router)
- Fetch each entity state from the HA REST API using `HA_TOKEN` and `HA_URL` env vars
- Return: `{ entity_id, label, state, unit }[]`

**Frontend**:
- Grid of sensor cards: label + value + unit
- `binary_sensor` entities show on_label/off_label with color (red=open/on, green=closed/off for doors; customizable)
- Numeric sensors show value + unit, optionally with a small sparkline if history is fetched

**Notes**:
- `HA_URL` and `HA_TOKEN` go in `.env` (gitignored)
- HA must be reachable from the Docker network — if HA runs on the same host, use `host.docker.internal` or `network_mode: host`
- The HA WebSocket API could be used for push updates instead of polling — lower latency but more complex; polling is fine for a display board
- Future: HA automations could push alerts to ntfy → already integrated via breaking news banner
