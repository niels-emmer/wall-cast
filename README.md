# wall-cast

A self-hosted wall display for Chromecast-connected screens. Dark-themed, widget-based, live-updating — runs entirely in Docker on your local network. No cloud, no subscriptions, no API keys.

## What it looks like

```
┌──────────────────┬──────────────────────────────────────────────────────┐
│  15:42  37       │  ☀ 11°  Clear          🌅 SUNRISE  🌇 SUNSET         │
│  ────────        │  Wind: 12 km/h          05:46       17:39            │
│  SUNDAY          │  ✦ 05:46–06:46 · 16:39–17:39 ✦  ☀ 11h 53m          │
│  15 March 2026   ├──────────┬──────────┬──────────┬───────────────────  │
│                  │  16:00   │  17:00   │  18:00   │  …                  │
├──────────────────│  ☀ 11°   │  ☀ 10°   │  ☀ 9°    │                    │
│  RAIN — NEXT 2H  │  0%      │  0%      │  0%      │                    │
│  ___________     ├──────────┼──────────┼──────────┼───────────────────  │
│  no rain exp.    │  Today   │  Mon     │  Tue     │  …                  │
│                  │  ☁ 11°   │  🌧 9°   │  🌦 10°  │                    │
└──────────────────┴──────────┴──────────┴──────────┴────────────────────┘
  NOS  Auto met gezin beschoten op Westelijke Jordaanoever ·  NU.NL  …
```

## Features

- **Polestar-style dark UI** — pure black background, bold white type, cyan accent
- **Widget layout via YAML** — positions, spans, and widget options all in one file
- **Hot reload** — save the config, the screen updates within ~1 second (no container restart)
- **Breaking news via ntfy** — push any message to a self-hosted ntfy topic and it appears instantly as a `BREAKING` ticker item
- **Fully auto-refreshing** — weather every 15 min, rain every 5 min, news every 10 min, sun data every 6 h
- **No API keys** — all data sources are free and unauthenticated
- **Modular** — add new widgets without touching core code

### Widgets

| Widget | Data source | Refresh |
|--------|-------------|---------|
| **Clock** | Client-side JS | Every second |
| **Weather** | [open-meteo.com](https://open-meteo.com) — current, hourly, 7-day | 15 min |
| **Rain forecast** | [buienalarm.nl](https://buienalarm.nl) — SVG rain chart for next 2 h | 5 min |
| **News ticker** | RSS feeds (configurable) | 10 min |
| **Sunrise/sunset** | [sunrise-sunset.org](https://sunrise-sunset.org/api) — golden hour windows | 6 h |

## Requirements

- Docker + Docker Compose on the machine that will host the display
- A Chromecast or Google TV on the same local network

## Quick Start

### 1. Clone

```bash
git clone https://github.com/yourname/wall-cast
cd wall-cast
```

### 2. Configure

Edit `config/wall-cast.yaml` — at minimum, set your location:

```yaml
location:
  lat: 52.5257
  lon: 6.4510
  name: Smilde
```

See [docs/config-reference.md](docs/config-reference.md) for all options.

### 3. Enable auto-cast

The caster service casts the display to your Chromecast/Google TV automatically on startup and keeps it alive — no browser needed.

**Find your device IPs:**

```bash
# Chromecast/Google TV IP:
docker run --rm --network=host python:3.12-slim \
  sh -c 'pip install -q catt && catt scan'

# This machine's LAN IP (macOS/Linux):
ipconfig getifaddr en0   # macOS
hostname -I | awk '{print $1}'  # Linux
```

**Edit `docker-compose.yml`** and fill in the `caster` environment block:

```yaml
CHROMECAST_IP: "192.168.1.42"    # your Chromecast/Google TV
DISPLAY_URL: "http://192.168.1.10/"  # this machine's LAN IP — must be reachable from the TV
```

> ⚠ Use the **LAN IP** for `DISPLAY_URL`, not `http://localhost/`. The TV resolves `localhost` as itself, which results in a blank page and the cast session immediately closing.

**Tip:** Set DHCP reservations for both IPs in your router so they never change across reboots.

### 4. Run

```bash
docker compose up -d --build
```

The display is cast to the TV within ~15 seconds of startup and will re-cast automatically if the session drops (e.g. if someone accidentally presses a button on the remote).

To stop: `docker compose down`

## Configuration

All display settings live in **`config/wall-cast.yaml`**. Edit and save the file — the display reacts within ~1 second with no restart required.

```yaml
location:
  lat: 52.5257       # latitude for weather and rain
  lon: 6.4510        # longitude
  name: Smilde       # display name (cosmetic only)

layout:
  columns: 12        # CSS grid columns
  rows: 8            # CSS grid rows

widgets:
  - id: clock
    type: clock
    col: 1
    row: 1
    col_span: 4
    row_span: 3
    config:
      show_seconds: true
      show_date: true

  - id: weather
    type: weather
    col: 5
    row: 1
    col_span: 8
    row_span: 7

  - id: rain
    type: rain
    col: 1
    row: 4
    col_span: 4
    row_span: 4

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
      scroll_speed_px_per_sec: 80
      ntfy_url: https://ntfy.example.com   # optional — see Breaking News below
      ntfy_topic: wall-cast
```

Full reference: [docs/config-reference.md](docs/config-reference.md)

## Breaking News (ntfy)

If you run a [ntfy](https://ntfy.sh) instance, you can push messages directly onto the screen from anywhere — phone, script, or automation.

```bash
# Basic message
curl -d "Server is back online" https://ntfy.example.com/wall-cast

# With a headline title
curl -H "Title: Power outage" \
     -d "Grid restored at 14:32 after 47-minute outage" \
     https://ntfy.example.com/wall-cast
```

The message appears as a **`BREAKING`** item (red badge, amber title, blinking dot) interspersed throughout the news ticker every ~3 items. It stays visible until a new message arrives.

Configure in the news widget:
```yaml
ntfy_url: https://ntfy.example.com
ntfy_topic: wall-cast
```

The browser subscribes directly to the ntfy SSE endpoint — no backend proxy needed.

## Development

For fast iteration without rebuilding Docker images:

```bash
docker compose -f docker-compose.dev.yml up --build
```

- **Frontend** (Vite HMR): http://localhost:5173
- **Backend** (FastAPI + live reload): http://localhost:8000
- **API docs** (Swagger): http://localhost:8000/docs

Or run the frontend standalone (fastest):

```bash
cd frontend && npm install && npm run dev
```

(Requires the backend to be running on port 8000.)

## Adding Widgets

See [docs/adding-a-widget.md](docs/adding-a-widget.md) for a step-by-step guide.

The widget registry is in `frontend/src/widgets/index.ts`. Any component registered there is immediately available in the YAML config.

## Architecture

```
Host (Docker)
├── frontend   nginx:alpine, port 80 (public)
│              Serves Vite-built React app
│              Proxies /api/* → backend:8000
│              proxy_buffering off for SSE
│
├── backend    python:3.12-slim (internal only)
│              FastAPI
│              ├── GET /api/config          parsed YAML as JSON
│              ├── GET /api/config/stream   SSE — pushes on YAML save
│              ├── GET /api/weather         open-meteo proxy, 15 min cache
│              ├── GET /api/rain            buienalarm proxy, 5 min cache
│              ├── GET /api/news            RSS aggregator, 10 min cache
│              └── GET /api/sun             sunrise-sunset.org proxy, 6 h cache
│
└── caster     python:3.12-slim (network_mode: host)
               catt cast_site → Chromecast via DashCast receiver
               Polls every 60 s, re-casts if session drops

Chromecast / Google TV (same LAN)
└── Loads http://<host-lan-ip>/ via DashCast receiver
    Stays live via SSE keepalive
    Breaking news: browser connects directly to ntfy SSE endpoint
```

## Security

- The **backend is never exposed** on the host — only nginx is reachable from the network
- The config file is mounted **read-only** into the backend container
- All external API calls are **proxied server-side** — no CORS leakage, cached responses
- **No authentication by design** — intended for local networks only
- `server_tokens off` and standard security headers set in nginx

If your host is internet-facing, restrict access in nginx:

```nginx
location / {
    allow 192.168.0.0/16;
    allow 10.0.0.0/8;
    deny all;
}
```

## Project layout

```
wall-cast/
├── config/
│   └── wall-cast.yaml          ← edit this to configure the display
├── backend/
│   ├── app/
│   │   ├── main.py             FastAPI app + lifespan
│   │   ├── wall_config.py      YAML loader + SSE broadcaster
│   │   └── routers/            one file per API endpoint
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx             CSS grid layout
│       ├── widgets/            one directory per widget type
│       │   └── index.ts        ← widget registry
│       └── hooks/              one hook per data source
├── caster/
│   ├── Dockerfile              python:3.12-slim + catt
│   └── cast.sh                 cast + keepalive loop
├── docs/
│   ├── config-reference.md
│   ├── adding-a-widget.md
│   └── memory/                 project decisions and state
├── docker-compose.yml          production
└── docker-compose.dev.yml      development
```

## License

MIT
