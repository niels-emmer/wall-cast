# Config Reference

The display is controlled by two things:

- **`config/wall-cast.yaml`** — layout and widget list. Save the file and the display updates within ~1 second (no restart needed). Can also be edited via the **admin panel** at `/#admin`.
- **`.env`** — secrets and personal settings. Requires a container restart when changed. Copy `.env.example` to `.env` and fill in only the sections you need.

---

## Environment variables (`.env`)

| Variable | Required for | Default | Description |
|----------|-------------|---------|-------------|
| `TIMEZONE` | `calendar` | `UTC` | IANA timezone name, e.g. `Europe/Amsterdam`. Controls date/time display in the calendar widget. See [tz database](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones). |
| `POLESTAR_USERNAME` | `polestar` | — | Email address for your Polestar account. |
| `POLESTAR_PASSWORD` | `polestar` | — | Password for your Polestar account. |
| `GOOGLE_CALENDAR_ID` | `calendar` | — | Calendar ID from Google Calendar settings (e.g. `xxxxx@group.calendar.google.com`). |
| `GOOGLE_SA_KEY_FILE` | `calendar` | `/config/google-sa.json` | Path inside the container to the service account JSON key file. Leave at the default and place your JSON at `config/google-sa.json` in the repo root — it is gitignored and never committed. |
| `TOMTOM_API_KEY` | `traffic` | — | API key for the TomTom Routing API (travel time + geocoding). Free — see [API keys](#api-keys) below. |
| `VERTREKTIJD_API_KEY` | `bus` | — | API key for vertrektijd.info. Free account at [vertrektijd.info/starten.html](https://vertrektijd.info/starten.html). |

All widget-specific settings (addresses, stop names, postcodes, etc.) are configured in the **admin panel** at `/#admin` — not in `.env`. See `.env.example` for the full template with step-by-step setup instructions for Google Calendar.

---

## YAML structure

wall-cast supports two formats. The **multi-screen format** is recommended:

```yaml
# Multi-screen (recommended)
shared:
  location:   { lat, lon, name }
  language:   nl              # display language: nl (default) or en
  garbage:    { postcode, huisnummer }
  people:
    - id: alice
      name: Alice
      family: true
      calendar_ids:
        - alice@gmail.com
    - id: bob
      name: Bob
      family: false
      calendar_ids:
        - bob@gmail.com
      traffic:
        home_address: "Home Street 1, 1234AB City, NL"
        work_address: "Work Street 1, 5678CD City, NL"
        route_roads: "A10,A2"     # jams on these roads get an 'on route' badge
      bus:
        stop_city: Amsterdam
        stop_name: Leidseplein
  widgets:    [ ... ]         # widgets shown on every screen (e.g. news ticker)

screens:
  - id: living-room
    name: Living Room
    enabled: true             # false = keep the entry but stop casting (default: true)
    layout: { columns: 12, rows: 8 }
    widgets: [ ... ]          # widgets specific to this screen

  - id: bedroom
    name: Bedroom
    layout: { columns: 12, rows: 8 }
    widgets: [ ... ]
```

Each screen's effective widget list = its own widgets + shared widgets (appended). This keeps shared widgets like the news ticker at the bottom without repeating the config.

The **flat single-screen format** (old) still works unchanged:

```yaml
# Flat (single-screen, backwards-compatible)
location:   { lat, lon, name }
language:   nl
layout:     { columns, rows }
widgets:    [ ... ]
```

---

### Screen casting fields

Each screen entry in `screens` supports the following casting fields:

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `id` | string | — | Unique screen identifier. Used as `?screen=<id>` in the cast URL. |
| `name` | string | — | Display name shown in the admin panel and landing page. |
| `enabled` | bool | `true` | `false` = keep the entry but stop casting entirely (caster skips the screen). |
| `casting_active` | bool | `true` | Runtime on/off toggle. `false` = caster stops recasting this screen. Toggled by the power button on the landing page. |
| `chromecast_ip` | string | — | IP address of the Chromecast / Google Nest Hub. Set manually or auto-updated by the scanner after a scan → use pick flow. |
| `chromecast_name` | string | — | Device name as it appears in the Google Home app. Used by the scanner to match a discovered device back to this screen and auto-update `chromecast_ip` when it changes. |
| `chromecast_mac` | string | — | MAC address of the device. Only used for Wake-on-LAN. Optional — most Cast OS devices (Nest Hub, Chromecast) do not support WoL, so this field has no effect for them. |

```yaml
screens:
  - id: living-room
    name: Living Room
    enabled: true
    casting_active: true
    chromecast_ip: 192.168.1.50
    chromecast_name: Living Room TV
    chromecast_mac: "aa:bb:cc:dd:ee:ff"   # optional, WoL only
    layout: { columns: 12, rows: 8 }
    widgets: [ ... ]
```

> **Tip**: Use the **Scan** button in the admin panel (Admin → Screens → select screen) to discover devices on the LAN and populate `chromecast_ip` + `chromecast_name` automatically.

---

### Screen identity

Each Chromecast is cast to a URL with a `?screen=` param matching an `id` in the `screens` list:

```
http://192.168.2.100/?screen=living-room
http://192.168.2.100/?screen=bedroom
```

The display falls back to the first screen if the param is missing or the ID is not found.

---

## `location`

Used by the weather, rain, and sunrise/sunset widgets.

| Key | Type | Description |
|-----|------|-------------|
| `lat` | float | Latitude (decimal degrees) |
| `lon` | float | Longitude (decimal degrees) |
| `name` | string | Display name — cosmetic only, not used in API calls |

```yaml
location:
  lat: 52.37      # your latitude (decimal degrees)
  lon: 4.90       # your longitude (decimal degrees)
  name: Amsterdam
```

---

## `language`

Controls all widget labels, day/month names, weather condition descriptions, and status text.

| Value | Language |
|-------|----------|
| `nl` | Dutch (default) |
| `en` | English |

```yaml
language: nl
```

Can be changed live via the admin panel at `/#admin` — the display updates without a restart.

---

## `layout`

Defines the CSS grid that widgets are placed on.

| Key | Type | Default | Description |
|-----|------|---------|-------------|
| `columns` | int | 12 | Number of grid columns |
| `rows` | int | 8 | Number of grid rows |

All widget positions (`col`, `col_span`, `row`, `row_span`) refer to this grid.

---

## Widget fields (all types)

Every widget entry requires these fields:

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier — used as React key |
| `type` | string | Widget type (see below) |
| `col` | int | Starting column (1-based) |
| `row` | int | Starting row (1-based) |
| `col_span` | int | Width in columns |
| `row_span` | int | Height in rows |
| `config` | object | Widget-specific options (see per-type docs below) |

---

## Widget types

### `clock`

Live clock with seconds and date. Purely client-side — no API calls.

```yaml
- id: clock
  type: clock
  col: 1
  row: 1
  col_span: 4
  row_span: 3
  config:
    show_seconds: true   # show the seconds counter (default: true)
    show_date: true      # show day and date below the time (default: true)
```

**Display:** Large HH:MM with a smaller seconds counter, accent separator line, day name, and full date.

---

### `info`

Static key/value display. Useful for pinning any fixed information (passwords, contact numbers, room notes) onto a screen. Purely client-side — no API calls.

```yaml
- id: info-panel
  type: info
  col: 1
  row: 4
  col_span: 4
  row_span: 4
  config:
    title: "WiFi"           # optional header label
    items:
      - label: Network
        value: MyWifi
      - label: Password
        value: hunter2
```

**Display:** Optional muted uppercase title with divider, followed by label/value rows distributed evenly in the available height. Labels are muted, values are white.

---

### `weather`

Current conditions, 7-hour hourly forecast, and 7-day daily forecast. Data from [open-meteo.com](https://open-meteo.com) — no API key required. Sunrise/sunset times are fetched from [sunrise-sunset.org](https://sunrise-sunset.org/api) and displayed in the top-right of the widget.

```yaml
- id: weather
  type: weather
  col: 5
  row: 1
  col_span: 8
  row_span: 7
  config:
    show_hourly: true    # show the hourly forecast row (default: true)
    show_daily: true     # show the daily forecast row (default: true)
```

**Display (top to bottom):**
1. Title row — weather icon, temperature, condition label, wind speed
2. Sunrise · Sunset times + daylight duration (top-right)
3. Hourly row — 7 columns: time, weather icon, temperature, precipitation %
4. Daily row — 7 columns: day name, icon, high, low temperature

Hourly and daily rows share equal height in the widget.

**Backend cache:** Weather 15 min, sun data 6 h.

---

### `rain`

3-hour rain intensity forecast in 15-minute intervals, rendered as a bezier area chart. Data from [open-meteo.com](https://open-meteo.com) (minutely_15 precipitation) — no API key required.

```yaml
- id: rain
  type: rain
  col: 1
  row: 4
  col_span: 4
  row_span: 4
  config: {}   # no configuration options currently
```

**Display:** Title with current status ("Droog" / "Dry" or peak mm/h) on the right. SVG area chart with gradient fill, dashed threshold lines (light / moderate / heavy), time axis, legend, and HTML-overlay Y-axis labels. Shows "no rain expected" when the forecast is dry.

**Backend cache:** 5 min.

---

### `news`

Horizontally scrolling news ticker fed by one or more RSS feeds.

```yaml
- id: news
  type: news
  col: 1
  row: 8
  col_span: 12
  row_span: 1
  config:
    feeds:
      - url: https://feeds.nos.nl/nosnieuwsalgemeen
        label: NOS
      - url: https://www.nu.nl/rss/Algemeen
        label: NU.nl
    scroll_speed_px_per_sec: 80   # pixels per second (default: 80)
    ntfy_url: https://ntfy.example.com   # optional — enables breaking news
    ntfy_topic: wall-cast                # ntfy topic name
```

**`feeds`** — list of RSS feed objects:
- `url`: full RSS feed URL
- `label`: short source label shown in accent colour before each headline

**`scroll_speed_px_per_sec`** — how fast the ticker scrolls. `80` is comfortable; `120` is fast.

**`ntfy_url` / `ntfy_topic`** — optional. If set, the browser subscribes directly to `<ntfy_url>/<ntfy_topic>/sse`. Incoming messages appear as **BREAKING** items (see below). Remove these keys to disable breaking news.

**Backend cache:** 10 min.

#### Breaking news appearance

When an ntfy message arrives, it is inserted into the ticker as a special item:

```
● BREAKING  [Title if distinct]  —  Message body  ·
```

- Red `BREAKING` badge, blinking red dot
- Amber title (if the ntfy message includes a `Title:` header distinct from the body)
- White message body
- The breaking item is interspersed every ~3 news items so it stays visible throughout the full scroll cycle
- It replays on every cycle until a new message replaces it

**Sending a breaking news alert:**
```bash
# Body only
curl -d "Message text" https://ntfy.example.com/wall-cast

# With title
curl -H "Title: Headline" -d "Message text" https://ntfy.example.com/wall-cast
```

---

### `garbage`

Upcoming waste collection dates from [mijnafvalwijzer.nl](https://mijnafvalwijzer.nl). Shows the next collection per type (GFT, PMD, Restafval) as horizontal cards.

Postcode and house number are set in the **General** tab of the admin panel (shared across all screens) or in `shared.garbage` in the YAML. Only `days_ahead` is widget-level config.

```yaml
- id: garbage
  type: garbage
  col: 1
  row: 4
  col_span: 4
  row_span: 4
  config:
    days_ahead: 7        # look-ahead window in days (default: 7, range: 1–365)
```

`days_ahead` controls how far ahead to look for upcoming collections. Only collections due within this window are shown. The widget automatically shows only as many cards as fit in the available space — no scrolling, no cut-off cards.

**Display:** Title. One horizontal card per upcoming collection, sorted by proximity. Cards for today or tomorrow have an accent background. Each card shows a colour-coded left border, colour-coded SVG icon (leaf / recycling / bin), container name, and relative day label + date on the right.

**Backend cache:** 1 hour (results are cached per `days_ahead` value).

---

### `polestar`

Battery, range, charging status, and service data for a Polestar vehicle via the [pypolestar](https://github.com/pypolestar/pypolestar) library. Credentials are provided via environment variables.

```yaml
- id: polestar
  type: polestar
  col: 1
  row: 4
  col_span: 4
  row_span: 4
  config: {}
```

**Environment variables (`.env`):**
```
POLESTAR_USERNAME=your@email.com
POLESTAR_PASSWORD=yourpassword
```

**Display:** Title, large SOC percentage (colour-coded green/amber/red), range in km, battery progress bar, charging status with live kW and amps when charging, estimated time to full charge. Additional rows appear automatically when the API returns data: efficiency (kWh/100km), average speed, trip meters A/B. Service warning appears as an amber alert tag only when active. Fluid warnings (brake fluid, coolant, oil) appear as red alert tags only when the car reports a problem.

**Backend cache:** 5 min. Shows last known data on API error.

---

### `calendar`

Google Calendar events via a service account. Shows today's events and the next few days. Supports multiple calendar IDs per widget — events are merged and deduplicated, each inheriting its calendar's background colour.

Calendar IDs are configured per widget in the **admin panel** or directly in YAML. Falls back to `GOOGLE_CALENDAR_ID` env var when `calendar_ids` is empty.

```yaml
- id: calendar
  type: calendar
  col: 5
  row: 1
  col_span: 8
  row_span: 7
  config:
    calendar_ids:
      - family@group.calendar.google.com    # shared family calendar
      - personal@gmail.com                  # personal calendar
    calendar_color: "#4caf50"               # optional fallback accent colour
```

**Environment variables (`.env`) — secrets only:**
```
TIMEZONE=Europe/Amsterdam
GOOGLE_CALENDAR_ID=xxxxx@group.calendar.google.com   # fallback when calendar_ids not set in widget config
GOOGLE_SA_KEY_FILE=/config/google-sa.json
```

**One-time Google setup:**
1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create (or select) a project
2. APIs & Services → Enable APIs → search **Google Calendar API** → Enable
3. APIs & Services → Credentials → Create Credentials → **Service Account**. Give it any name. Click Done.
4. Click the service account → **Keys** tab → Add Key → Create new key → **JSON**. Save the downloaded file as `config/google-sa.json` in the repo root. (`config/*.json` is gitignored — this file is never committed.)
5. Open Google Calendar → Settings → your calendar → **Share with specific people**. Add the service account email (ends in `@...iam.gserviceaccount.com`). Permission: "See all event details".
6. Google Calendar → Settings → your calendar → **Integrate calendar**. Copy the **Calendar ID**.

**Display:** Title. Today's events as cards (or a "nothing scheduled" placeholder). Upcoming days section with the next events grouped by day. Each event card has a 4px coloured left border matching the event's Google Calendar colour.

**Backend cache:** 10 min.

---

### `traffic`

Current Dutch highway traffic jams and live travel time from home to work. Two data sources:

- **Traffic jams** — [ANWB](https://www.anwb.nl/verkeer) incidents API. No API key required. Covers all Dutch rijkswegen (A- and N-roads).
- **Travel time** — [TomTom Routing API](https://developer.tomtom.com/routing-api). Requires a free API key (see [API keys](#api-keys)). Traffic-aware: shows real-time delay on top of the base travel time.

Home address, work address, and route roads are configured **per person** in the **People** tab of the admin panel (or under `people[].traffic` in the YAML). The widget config itself is empty — values are injected at serve time from the first person assigned to the screen.

```yaml
- id: traffic
  type: traffic
  col: 5
  row: 1
  col_span: 8
  row_span: 7
  config: {}    # home/work address and route roads come from the person assigned to this screen
```

**Environment variables (`.env`) — API key only:**
```
TOMTOM_API_KEY=your_key_here
```

**Display:** Title. Travel time card at the top showing journey time as `H:MM`, distance, and delay (green = no delay, orange = delayed with `+H:MM` indicator). Below: a list of current traffic jams sorted by delay, each showing a colour-coded road badge (A-roads blue, N-roads grey), from → to, distance in km, and delay in minutes. Jam rows are colour-coded by severity: yellow < 10 min, orange 10–30 min, red ≥ 30 min. Shows "Geen files" / "No jams" when the roads are clear.

The widget still renders (showing only the jam list) if `TOMTOM_API_KEY` is not set.

**Backend cache:** 5 min.

---

### `bus`

Shows upcoming bus departures from a configured stop, sourced from [vertrektijd.info](https://vertrektijd.info).

Stop city and name are configured **per person** in the **People** tab of the admin panel (or under `people[].bus` in the YAML). The widget config itself is empty — values are injected at serve time from the first person assigned to the screen.

```yaml
- id: bus
  type: bus
  col: 1
  row: 4
  col_span: 4
  row_span: 4
  config: {}    # stop city and name come from the person assigned to this screen
```

**Display:** Title with stop name. Lists upcoming departures showing line number, destination, and departure time. Cancelled departures are shown with a strikethrough. Lookahead window: 90 minutes.

**Backend cache:** 30 s.

---

### `network`

Live network status monitor: WAN connection, internet connectivity, DNS server health, active LAN host count, and a periodic speedtest.

```yaml
- id: network
  type: network
  col: 1
  row: 4
  col_span: 4
  row_span: 4
  config: {}   # all options are in shared.network (see below)
```

To enable router integration (WAN IP, host count), add a `network` block to `shared`:

```yaml
shared:
  network:
    router_url:      https://192.168.1.1
    router_username: admin
    # router_password is NOT stored in YAML — set ROUTER_PASSWORD=... in .env
```

The `router_url` / `router_username` / `router_password` fields are only needed for Zyxel VMG8825-series routers (DAL API). Without them the widget still shows connectivity, DNS status, and speedtest results.

**Display (5 rows):**
1. **WAN** — status dot (green/red), WAN IP, link type badge (ETH/VDSL/ADSL), router uptime
2. **Net** — Online/Offline with latency in ms
3. **DNS** — Cloudflare (CF) and Google (G) badges, coloured green/red
4. **LAN** — total active host count + ethernet/wifi breakdown
5. **Speed** — last speedtest ↓ / ↑ in Mbps with time since last run

**Backend cache:** 30 s. Speedtest runs in background every 60 s.

---

### `airquality`

Current outdoor air quality and a 4-day pollen forecast. Data from [open-meteo.com](https://open-meteo.com) (CAMS European air quality model) — no API key required. Location is taken from `shared.location`.

```yaml
- id: airquality
  type: airquality
  col: 5
  row: 1
  col_span: 8
  row_span: 7
  config: {}   # no configuration options — location comes from shared.location
```

**Display (top to bottom):**
1. Title
2. AQI card — large European AQI index number, quality level label (Good / Fair / Moderate / Poor / Very Poor / Hazardous), and pollutant chips (PM2.5, PM10, NO₂, O₃, Dust). Card border colour reflects the AQI level.
3. Pollen section — one row per active pollen species (birch, grass, alder, mugwort, ragweed). Each row shows the species name and a 4-day bar chart coloured by intensity (green → amber → orange → red). Species with no pollen forecast are hidden. Shows "None" when pollen is absent for all species.

**Backend cache:** 1 hour (CAMS model updates twice daily).

---

### `market`

Live market overview — crypto Fear & Greed index, main stock indices (S&P 500, NASDAQ, AEX, FTSE), key stock tickers, and top 10 crypto coins. No API key required.

Data sources:
- Fear & Greed: [alternative.me/fng](https://alternative.me/fng/) — no key
- Stock/index quotes: Yahoo Finance — no key
- Crypto top 10: [CoinGecko](https://coingecko.com) — no key

```yaml
- id: market
  type: market
  col: 1
  row: 1
  col_span: 6
  row_span: 8
  config: {}   # no configuration — tickers and crypto count are hardcoded defaults
```

**Display (top to bottom):**
1. Title — `MARKT` (nl) / `MARKET` (en)
2. Fear & Greed gauge — gradient bar (red → yellow → green), needle at current value (0–100), classification label (Extreme Fear / Fear / Neutral / Greed / Extreme Greed)
3. Indices section — S&P 500, NASDAQ, AEX, FTSE as cards with price + % change
4. Stocks section — AAPL, MSFT, NVDA, TSLA, AMZN as cards with price + % change
5. Crypto section — top 10 coins by market cap (rank, symbol, price, 24h %)

**Backend cache:** 5 minutes.

---

### `warnings`

Active KNMI weather warnings for the Netherlands, sourced from [MeteoAlarm](https://meteoalarm.org) (Atom/CAP feed) — no API key required. **Automatically hidden when there are no active warnings**, making it a good fit inside a `rotate` widget.

```yaml
- id: warnings
  type: warnings
  col: 5
  row: 1
  col_span: 8
  row_span: 7
  config: {}   # no configuration — location not needed; warnings cover the whole country
```

**Display:** Title. One card per active warning, sorted by severity (rood → oranje → geel). Each card shows the severity level badge (colour-coded), phenomenon (e.g. "Onweer"), affected regions, and a "valid until" timestamp. No warnings → widget calls `onSkip()` so the enclosing `rotate` widget advances past it automatically.

**Backend cache:** 15 min.

---

### `rotate`

Cycles through a list of child widgets, showing one at a time. Used to display multiple widgets in a single grid cell.

```yaml
- id: rotator
  type: rotate
  col: 1
  row: 4
  col_span: 4
  row_span: 4
  config:
    interval_sec: 20    # seconds per slot (default: 10)
    widgets:
      - type: rain
        config: {}
        enabled: true   # set to false to skip this slot (default: true)
      - type: garbage
        config:
          days_ahead: 7
      - type: polestar
        config: {}
```

**Notes:**
- Child widgets in `config.widgets` use the same `type` and `config` keys as top-level widgets, but do not need `id`, `col`, `row`, `col_span`, or `row_span` — they inherit the rotator's grid cell.
- `enabled: false` skips a slot entirely. Useful for temporarily hiding a widget without removing its config.
- Rotation and individual slot `enabled` states can be toggled live from the admin panel at `/#admin`.
- **Fade speed** is a global setting — set `shared.fade_speed` (seconds) in the YAML or use the **Rotator fade speed** slider in Admin → General. Presets: `2.0` (Slow) · `1.4` (Relaxed) · `0.8` (Normal, default) · `0.4` (Snappy) · `0.15` (Fast). All rotators on all screens share this value.

---

## Admin panel

Open `http://<your-host>/#admin` to access the admin panel.

In **multi-screen** mode a screen selector appears at the top — choose **Shared** to edit settings that apply to every screen (language, news ticker), or select a named screen to edit its widgets. In single-screen (flat) mode there is no selector.

From the admin panel you can:

**General tab**
- Set the **home location** (lat/lon/name) with a Geolocate button
- Set the **garbage collection** address (postcode and house number — Netherlands; shared across all screens)
- Set the **display language** (Dutch or English)
- Set the **rotator fade speed** (Slow / Relaxed / Normal / Snappy / Fast — applies to all rotators on all screens)
- Configure **news ticker** feeds, scroll speed, ntfy URL and topic

**Screens tab** (per screen)
- Add, rename, delete, **enable/disable** screens; set Chromecast IP (with network scan)
- Toggle **clock** show-seconds / show-date
- Configure **rotator** interval and enable/disable individual slots
- Toggle **weather** hourly / daily forecast rows
- Manage **calendar** extra calendar IDs per rotator slot
- Assign which **people** appear on this screen (controls whose calendar/commute/bus are shown)

**People tab** (multi-screen only)
- Add people with name and optional **family** flag (family members appear on all screens automatically)
- Add **Google Calendar IDs** per person; the admin panel shows the service account email to share with
- Set **commute** (home address, work address, route roads) with TomTom address autocomplete and a **Lookup** button that auto-detects highway numbers along the route
- Set **bus stop** (city and stop name) per person
- Add **per-person RSS feeds** (personalised news shown only when that person's screen is active)
- Add **per-person notification rules** (same condition builder as the shared rules; only evaluated when that person is in scope)

Changes are saved back to `config/wall-cast.yaml` and take effect on the display immediately via hot-reload.

---

## Layout tips

- The default 12 × 8 grid gives fine-grained control. Think of it like a newspaper layout.
- Widgets that share a column edge should use complementary `row_span` values so they fill the full height (e.g. clock 3 rows + rain 4 rows + news 1 row = 8 rows total).
- The news ticker works best at `row_span: 1` spanning all 12 columns in the last row.
- For 720p screens: keep font sizes readable by giving any text-heavy widget at least `col_span: 4`.
- Widgets never overflow their grid cell — content scales to fit.

### Reference layout (12 × 8)

```
Col:  1   2   3   4   5   6   7   8   9  10  11  12
Row 1 ├── clock (4×3) ──┤├──── main rotator (8×7) ───────────────────┤
Row 2 │                 ││  weather ↔ calendar ↔ traffic (30s)        │
Row 3 │                 ││                                            │
Row 4 ├─ rotator (4×4) ─┤│                                            │
Row 5 │ rain/garbage/   ││                                            │
Row 6 │ polestar (20s)  ││                                            │
Row 7 │                 │└────────────────────────────────────────────┘
Row 8 ├────────────────── news ticker (12×1) ─────────────────────────┤
```

---

## Auto-refresh schedule

All data sources refresh automatically — the display never needs a manual reload.

| Source | Refresh interval |
|--------|-----------------|
| Clock | Every second (client-side) |
| Weather | Every 15 minutes |
| Rain | Every 5 minutes |
| News | Every 10 minutes |
| Sunrise/sunset | Every 6 hours |
| Garbage | Every 1 hour |
| Polestar | Every 5 minutes |
| Calendar | Every 10 minutes |
| Traffic | Every 5 minutes |
| KNMI warnings | Every 15 minutes |
| Air quality | Every 1 hour |
| Config (YAML) | Instant (SSE push on file save) |
| Breaking news (ntfy) | Instant (persistent SSE connection) |

---

## API keys

Most data sources used by wall-cast are fully public and require no authentication. The table below lists every external service, whether a key is needed, and how to get one.

| Service | Widget | Key required | Cost | How to get |
|---------|--------|-------------|------|-----------|
| [open-meteo.com](https://open-meteo.com) | `weather`, `rain`, `airquality` | No | Free | — |
| [sunrise-sunset.org](https://sunrise-sunset.org/api) | `weather` | No | Free | — |
| [mijnafvalwijzer.nl](https://www.mijnafvalwijzer.nl) | `garbage` | No (public key baked in) | Free | — |
| RSS feeds | `news` | No | Free | — |
| [MeteoAlarm](https://meteoalarm.org) | `warnings` | No | Free | — |
| [ANWB incidents](https://www.anwb.nl/verkeer) | `traffic` (jam list) | No | Free | — |
| [TomTom Routing API](https://developer.tomtom.com/routing-api) | `traffic` (travel time) | **Yes** | Free tier: 2,500 req/day | See below |
| [Google Calendar API](https://developers.google.com/calendar) | `calendar` | **Yes** (service account) | Free | See below |
| [Polestar cloud](https://www.polestar.com) | `polestar` | **Yes** (your account) | Free | Your Polestar login |

### TomTom API key

Used for live traffic-aware travel time in the `traffic` widget. The jam list works without it.

1. Go to [developer.tomtom.com](https://developer.tomtom.com) and create a free account — **no credit card required**.
2. In the dashboard, create a new app (any name).
3. Copy the generated API key.
4. Add it to your `.env`:
   ```
   TOMTOM_API_KEY=your_key_here
   ```
5. Restart the containers: `docker compose up -d`

**Free tier limits:** 2,500 non-tile requests/day. At a 5-minute polling interval the traffic widget makes ~288 requests/day — well within the limit.

### Google Calendar service account

Used by the `calendar` widget. A service account lets wall-cast read your calendar without OAuth tokens that expire.

1. Go to [console.cloud.google.com](https://console.cloud.google.com) → create (or select) a project.
2. **APIs & Services → Enable APIs** → search **Google Calendar API** → Enable.
3. **APIs & Services → Credentials → Create Credentials → Service Account**. Give it any name. Click Done.
4. Click the service account → **Keys** tab → Add Key → Create new key → **JSON**. Save the downloaded file as `config/google-sa.json` in the repo root. (`config/*.json` is gitignored.)
5. Open **Google Calendar → Settings → your calendar → Share with specific people**. Add the service account email (ends in `@...iam.gserviceaccount.com`). Permission: "See all event details".
6. Go to **Integrate calendar** and copy the **Calendar ID**.
7. Add to your `.env`:
   ```
   GOOGLE_CALENDAR_ID=xxxxx@group.calendar.google.com
   GOOGLE_SA_KEY_FILE=/config/google-sa.json
   ```
