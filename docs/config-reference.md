# Config Reference

The display is fully controlled by `config/wall-cast.yaml`. Save the file — the display updates within ~1 second without any restart required.

## Top-level structure

```yaml
location:   { lat, lon, name }
layout:     { columns, rows }
widgets:    [ ... ]
```

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
  lat: 52.5257
  lon: 6.4510
  name: Smilde
```

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
1. Title row — "WEER" + current weather icon, temperature, condition label, wind speed (km/u)
2. Sunrise (Opkomst) · Sunset (Ondergang) times + daylight duration (top-right)
3. Hourly row — 7 columns: time, weather icon, temperature, precipitation %
4. Daily row — 7 columns: day name, icon, high, low temperature

Hourly and daily rows share equal height in the widget.

**Backend cache:** Weather 15 min, sun data 6 h.

---

### `rain`

2-hour rain intensity forecast in 5-minute intervals, rendered as a bezier area chart. Data from [buienalarm.nl](https://buienalarm.nl).

```yaml
- id: rain
  type: rain
  col: 1
  row: 4
  col_span: 4
  row_span: 4
  config: {}   # no configuration options currently
```

**Display:** "REGEN" title with current status ("Droog" or peak mm/h) on the right. SVG area chart with gradient fill, dashed threshold lines (light / moderate / heavy), time axis ("Nu" for current), legend in mm/u, and HTML-overlay Y-axis labels. Shows "no rain expected" when the forecast is dry.

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

Upcoming waste collection dates from [mijnafvalwijzer.nl](https://mijnafvalwijzer.nl). Shows collections due within the next 7 days as horizontal cards. Postcode and house number are configured at the top level under `garbage:`, not in the widget config.

```yaml
# Top-level section (required once):
garbage:
  postcode: "9422KM"
  huisnummer: "5"

# Widget entry:
- id: garbage
  type: garbage
  col: 1
  row: 4
  col_span: 4
  row_span: 4
  config: {}
```

**Display:** "AFVAL" title. One horizontal card per upcoming collection. Cards for today or tomorrow have an accent background. Each card shows a colour-coded left border, large emoji icon (🌿 GFT / ♻️ PMD / 🗑️ Restafval), container name, and relative day label + date on the right. Shows "Geen ophaling deze week" when nothing is due.

**Backend cache:** 1 hour (collection dates change infrequently).

---

### `polestar`

Battery, range, charging status, and service data for a Polestar vehicle via the [pypolestar](https://github.com/pypolestar/pypolestar) library. Credentials are provided via environment variables — set them in `.env` at the repo root (see `.env.example`).

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

**Display:** "POLESTAR" title, large SOC percentage (colour-coded green/amber/red), range in km, battery progress bar, charging status with live kW and amps when charging, estimated time to full charge. Additional rows appear automatically when the API returns data: efficiency (kWh/100km), average speed, trip meters A/B. Service warning appears as an amber alert tag only when a warning is active (not during normal operation). Odometer in small muted text at the bottom.

**Backend cache:** 5 min. Shows last known data on API error.

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
      - type: garbage
        config: {}
      - type: polestar
        config: {}
```

**Notes:**
- Child widgets in `config.widgets` use the same `type` and `config` keys as top-level widgets, but do not need `id`, `col`, `row`, `col_span`, or `row_span` — they inherit the rotator's grid cell.
- The `info` widget type (plain key/value display) is also available as a child type.

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
Row 1 ├── clock (4×3) ──┤├──────── weather (8×7) ────────────────────┤
Row 2 │                 ││                                            │
Row 3 │                 ││                                            │
Row 4 ├── rain  (4×4) ──┤│                                            │
Row 5 │                 ││                                            │
Row 6 │                 ││                                            │
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
| Config (YAML) | Instant (SSE push on file save) |
| Breaking news (ntfy) | Instant (persistent SSE connection) |
