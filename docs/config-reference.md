# Config Reference

The display is fully controlled by `config/wall-cast.yaml`. Save the file — the display updates within ~1 second without any restart.

## Top-level keys

| Key | Type | Description |
|-----|------|-------------|
| `location` | object | Geographic location for weather and rain data |
| `location.lat` | float | Latitude |
| `location.lon` | float | Longitude |
| `location.name` | string | Display name (cosmetic) |
| `layout.columns` | int | Number of CSS grid columns (default: 12) |
| `layout.rows` | int | Number of CSS grid rows (default: 8) |
| `widgets` | list | Ordered list of widget definitions |

## Widget fields (all types)

| Field | Type | Description |
|-------|------|-------------|
| `id` | string | Unique identifier |
| `type` | string | Widget type (see below) |
| `col` | int | Starting grid column (1-based) |
| `row` | int | Starting grid row (1-based) |
| `col_span` | int | Number of columns to span |
| `row_span` | int | Number of rows to span |
| `config` | object | Widget-specific configuration |

## Widget types

### `clock`

Displays current time and date. No external API calls — purely client-side.

```yaml
config:
  show_seconds: true    # show seconds (default: true)
  show_date: true       # show date below time (default: true)
```

### `weather`

Fetches data from [open-meteo.com](https://open-meteo.com) — no API key needed.

```yaml
config:
  show_hourly: true     # show hourly forecast row (default: true)
  show_daily: true      # show daily forecast row (default: true)
  hourly_count: 6       # number of hourly slots shown (default: 6)
  daily_count: 5        # number of daily slots shown (default: 5)
```

### `rain`

2-hour rain forecast in 5-minute intervals from [buienradar.nl](https://buienradar.nl).

```yaml
config: {}  # no configuration options currently
```

### `news`

Scrolling news ticker from RSS feeds.

```yaml
config:
  feeds:
    - url: https://feeds.nos.nl/nosnieuwsalgemeen
      label: NOS
    - url: https://www.nu.nl/rss/Algemeen
      label: NU.nl
  scroll_speed_px_per_sec: 80   # ticker scroll speed (default: 80)
```

## Layout tips

- The default layout is 12 columns × 8 rows, like a dashboard grid.
- Widgets can overlap if you want layered effects (rare but possible).
- For 720p: keep `col_span` >= 3 for any readable content area.
- The news ticker works best at `row_span: 1` spanning all 12 columns in the last row.
