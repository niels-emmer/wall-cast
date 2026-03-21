# wall-cast

**A self-hosted home display that casts personalised information to Chromecast-connected screens around your house.**

Put the weather, family calendar, bin collection schedule, and live travel times on the TV in the living room. Put a different mix — with the kids' school schedule, the rain radar, and bus departures — on the screen in their room. All from one Docker stack, hot-reloading, no cloud, no subscription.

**This is not a digital signage system.** It's a lightweight, family-oriented display: *my* weather, *our* schedule, *the* waste collection. It runs entirely on a Docker host on your home LAN — a Raspberry Pi, a NAS, a spare PC — and casts the display to whichever Chromecasts or Google TVs you point it at.

> **Requirement:** A Linux Docker host on your home network (a Raspberry Pi 4 works well). The Chromecasts must be on the same LAN segment as the host.

It is fully AI-coded and designed to be extended. Fork it, tell Claude what you want, and iterate from there.

---

## What it looks like

<p align="center">
  <img src="docs/screenshots/screenshot-1.png" width="49%" alt="Clock, 7-day weather forecast and rain radar" />
  <img src="docs/screenshots/screenshot-2.png" width="49%" alt="Clock, family calendar and waste collection schedule" />
</p>
<p align="center">
  <img src="docs/screenshots/screenshot-3.png" width="49%" alt="Clock, live traffic jams and Polestar EV status" />
  <img src="docs/screenshots/screenshot-4.png" width="49%" alt="Clock, KNMI weather warning and live bus departures" />
</p>
<p align="center">
  <img src="docs/screenshots/screenshot-5.png" width="49%" alt="Clock, 7-day weather and bus departures side by side" />
  <img src="docs/screenshots/screenshot-6.png" width="49%" alt="Admin panel — Screens tab with per-screen settings and Chromecast discovery" />
</p>

## Features

- **Multi-screen** — one installation drives multiple Chromecasts, each with its own layout and content
- **Widget layout via YAML** — positions, spans, and widget config in one file; auto-created on first run
- **Hot reload** — save the config, every screen updates within ~1 second (no container restart)
- **Admin panel** — browser-based UI at `/#admin`: configure screens, people, feeds, and Chromecast IPs; built-in LAN scanner to discover devices
- **People & Calendars** — assign household members to screens; family-flagged members appear everywhere automatically
- **Dark theme** — pure black background, bold white type, cyan accent
- **Dutch / English** — all widget labels switch with `language: en/nl` in the config
- **Breaking news via ntfy** — push any message to a self-hosted ntfy topic; it appears instantly as a `BREAKING` ticker item
- **Fully auto-refreshing** — weather every 15 min, rain every 5 min, news every 10 min, real-time bus departures
- **Mostly no API keys** — most data sources are free and unauthenticated; optional widgets (Polestar, Calendar, Traffic, Bus) require free or personal keys
- **Rotate widget** — cycle multiple widgets in one grid cell, with configurable intervals
- **Modular** — add new widgets without touching core code; [step-by-step guide](docs/adding-a-widget.md) included

## Widgets

| Widget | Data source | Refresh |
|--------|-------------|---------|
| **Clock** | Client-side | Every second |
| **Weather** | [open-meteo.com](https://open-meteo.com) — current, hourly, 7-day | 15 min |
| **Rain forecast** | [buienalarm.nl](https://buienalarm.nl) — rain chart for next 2 h | 5 min |
| **News ticker** | RSS feeds (configurable list) | 10 min |
| **Sunrise/sunset** | [sunrise-sunset.org](https://sunrise-sunset.org/api) — embedded in weather widget | 6 h |
| **Garbage** | [mijnafvalwijzer.nl](https://mijnafvalwijzer.nl) — upcoming collection (NL) | 1 h |
| **Polestar** | [pypolestar](https://github.com/pypolestar/pypolestar) — SOC, range, charging, service | 5 min |
| **Calendar** | Google Calendar (service account) | 10 min |
| **Traffic** | ANWB (jams) + TomTom (travel time) | 5 min |
| **KNMI warnings** | [MeteoAlarm](https://meteoalarm.org) — active NL weather warnings; hidden when none | 15 min |
| **Bus departures** | [vertrektijd.info](https://vertrektijd.info) — live departures, cancelled services shown | 30 s |
| **Rotate** | Container — cycles child widgets in one grid cell | — |

## Quick start

### 1. Clone

```bash
git clone https://github.com/niels-emmer/wall-cast
cd wall-cast
```

### 2. Create your `.env`

Copy the example and fill in your values:

```bash
cp .env.example .env
```

Then edit `.env`:

**`UID` / `GID`** — file ownership for config files written by the backend. Run `id -u && id -g` on the host to get your values. Default `1000` is fine on most Linux installs.

**`SERVER_URL`** — the LAN address of this Docker host, as seen from the Chromecasts. Use `ip addr` (Linux) or `ipconfig` (Windows) to find it. Must be an IP, not `localhost` — the TV resolves localhost as itself.

```bash
SERVER_URL=http://192.168.1.10
```

**`TIMEZONE`** — IANA timezone name, e.g. `Europe/Amsterdam`. Used for calendar event times. [Full list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

The remaining settings are **optional** — only fill in the ones for widgets you plan to use:

**`GOOGLE_SA_KEY_FILE` / `GOOGLE_CALENDAR_ID`** *(calendar widget)* — requires a Google service account. Create one at [console.cloud.google.com](https://console.cloud.google.com) → APIs & Services → Credentials, enable the Calendar API, download the JSON key to `config/google-sa.json`, and share your calendar with the service account email. The Calendar ID is found under Settings → your calendar → *Integrate calendar*.

**`TOMTOM_API_KEY`** *(traffic widget)* — free key from [developer.tomtom.com](https://developer.tomtom.com) (no credit card). Home/work address and route roads are set in the admin panel.

**`VERTREKTIJD_API_KEY`** *(bus widget, Netherlands only)* — free account at [vertrektijd.info/starten.html](https://vertrektijd.info/starten.html). Stop city and name are set in the admin panel.

**`POLESTAR_USERNAME` / `POLESTAR_PASSWORD`** *(Polestar widget)* — the credentials you use to log in to the Polestar app or [my.polestar.com](https://my.polestar.com).

### 3. Run

```bash
docker compose up -d --build
```

The config file (`config/wall-cast.yaml`) is created automatically on first run with sensible defaults.

### 4. Configure

Open **`http://<host-ip>/#admin`** in a browser. At minimum, set your location in the **General** tab.

### 5. Enable casting

In the admin panel, go to **Screens** → select a screen → **Screen settings**. Click **Scan network** to discover Chromecast devices on your LAN, then click a device row to pre-fill the IP. Hit **Save**.

> **Tip:** Set DHCP reservations for the host machine and all Chromecast devices in your router so their IPs never change across reboots.

The display is cast to the TV within ~15 seconds of startup and re-casts automatically if the session drops.

To stop: `docker compose down`

## Configuration

All settings live in **`config/wall-cast.yaml`**. The file is gitignored and auto-created on first run — it will never block a `git pull`. Edit and save; the display reacts within ~1 second with no restart required.

See [`config/wall-cast.example.yaml`](config/wall-cast.example.yaml) for an annotated template with all options.

Full reference: [docs/config-reference.md](docs/config-reference.md)

### Via admin panel

Open **`http://<host-ip>/#admin`** to use the point-and-click admin panel. It has three tabs:

- **General** — display language, location, and news feed URLs
- **Screens** — add/rename/delete screens; set Chromecast IP (use the **Scan network** button to discover devices); edit the screen ID used in the cast URL; assign people; configure rotation slots and intervals
- **People** — add household members with their Google Calendar IDs; mark family members whose calendars should appear on every screen

Changes are written back to `wall-cast.yaml` immediately and hot-reload onto the display.

### Via YAML

The config uses a `shared + screens[]` schema. Settings in `shared` apply to every screen; each screen can override or extend them.

```yaml
shared:
  location:
    lat: 52.37         # latitude for weather and rain
    lon: 4.90          # longitude
    name: Amsterdam    # display name (cosmetic only)

  language: en         # en (English) or nl (Dutch)

  people:
    - id: alice
      name: Alice
      family: true     # family members' calendars show on every screen
      calendar_ids:
        - alice@gmail.com
        - shared-family-cal@group.calendar.google.com
    - id: bob
      name: Bob
      family: false    # only appears on screens where bob is listed
      calendar_ids:
        - bob@gmail.com

  widgets:
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
        ntfy_url: https://ntfy.example.com
        ntfy_topic: wall-cast

screens:
  - id: living-room
    name: Living Room
    chromecast_ip: "192.168.1.42"
    people: [alice, bob]
    layout:
      columns: 12
      rows: 8
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

      - id: rotator
        type: rotate
        col: 1
        row: 4
        col_span: 4
        row_span: 4
        config:
          interval_sec: 20
          widgets:
            - type: rain
              config: {}
            - type: calendar
              config: {}
            - type: garbage
              config:
                postcode: "1234AB"
                huisnummer: "1"
                days_ahead: 7
```

Each screen is accessible at `/?screen=<id>`. The caster service opens this URL on the Chromecast automatically.

## People & Calendars

The **People** system lets you assign household members to screens so each screen shows the right calendars. Family members (marked as such) appear on every screen; everyone else only on the screens they're assigned to.

### Step 1 — Add people

Open `http://<host-ip>/#admin` → **People** tab → **+ Add person**.

For each person, enter their name, optionally tick **Family (all screens)**, and add their Google Calendar IDs. Then go to **Screens**, select a screen, and tick which people belong on it.

### Step 2 — Find the Google Calendar ID

| Calendar type | Where to find the ID |
|---|---|
| **Primary Gmail calendar** | Simply your Gmail address, e.g. `yourname@gmail.com` |
| **Shared / group calendar** | Google Calendar → Settings → click the calendar → *Integrate calendar* → copy the **Calendar ID** |

### Step 3 — Share the calendar with the service account

The backend reads calendars via a Google service account. It can only read calendars that have been explicitly shared with it.

1. Open [Google Calendar](https://calendar.google.com) → Settings → click the calendar
2. Scroll to **Share with specific people and groups** → **+ Add people**
3. Enter the **service account email** — find it in `config/google-sa.json` under `"client_email"` (ends in `@...iam.gserviceaccount.com`)
4. Set permission to **See all event details** (read-only is sufficient)
5. Click **Send**

Repeat for every calendar you want to display.

> Changes take effect on the next calendar fetch (up to 10 minutes, or restart the backend to force an immediate refresh).

---

## Breaking news (ntfy)

If you run a [ntfy](https://ntfy.sh) instance, you can push messages directly onto the screen from anywhere — phone, script, or automation.

```bash
# Basic message
curl -d "Server is back online" https://ntfy.example.com/wall-cast

# With a headline title
curl -H "Title: Power outage" \
     -d "Grid restored at 14:32 after 47-minute outage" \
     https://ntfy.example.com/wall-cast
```

The message appears as a **`BREAKING`** item (red badge, amber title, blinking dot) interspersed in the news ticker every ~3 items. It stays visible until a new message arrives.

Configure in the news widget:
```yaml
ntfy_url: https://ntfy.example.com
ntfy_topic: wall-cast
```

The browser subscribes directly to the ntfy SSE endpoint — no backend proxy needed.

---

## Architecture

```
┌─── Docker host ──────────────────────────────────────────────────────┐
│                                                                       │
│  ┌──────────────────┐  /api/*   ┌───────────────────────────────┐   │
│  │  frontend        │──────────▶│  backend  (FastAPI :8000)     │   │
│  │  nginx :80       │           │                               │   │
│  │  React SPA       │           │  GET /api/config?screen=      │   │
│  └──────────────────┘           │  GET /api/config/stream (SSE) │   │
│                                 │  PUT /api/admin/config        │   │
│                                 │  GET /api/admin/scan ────────▶│───┼──▶ scanner :8765
│                                 │  GET /api/weather, rain, …    │   │
│                                 └───────────────┬───────────────┘   │
│                                                 │ reads/writes       │
│                                        config/wall-cast.yaml         │
│                                                                       │
│  ┌──────────────────┐ host net  ┌───────────────────────────────┐   │
│  │  caster          │           │  scanner                      │   │
│  │  reads config    │           │  HTTP :8765                   │   │
│  │  catt cast_site  │           │  ARP table + port 8009 probe  │   │
│  │  → each screen   │           └───────────────────────────────┘   │
│  └────────┬─────────┘                                                │
└───────────┼──────────────────────────────────────────────────────────┘
            │ DashCast receiver
            ▼
   Chromecast / Google TV  (same LAN)
   loads /?screen=<id>  ←  SSE keeps page live
   browser subscribes to ntfy SSE directly (no proxy)
```

**Four Docker services:**

- **frontend** — nginx:alpine on port 80; serves the Vite-built React SPA; proxies `/api/*` to the backend with `proxy_buffering off` for SSE
- **backend** — python:3.12-slim (internal, not exposed on the host); FastAPI; reads/writes `config/wall-cast.yaml`; proxies all external API calls with caching
- **caster** — python:3.12-slim with `network_mode: host` (required to reach Chromecasts on the LAN); reads `chromecast_ip` from each screen in the config; uses `catt cast_site` with the DashCast receiver; polls every 60 s and re-casts if the session drops
- **scanner** — python:3.12-slim with `network_mode: host` on port 8765; reads the host ARP table and TCP-probes port 8009 to discover Chromecast devices without mDNS; backend proxies `GET /api/admin/scan` to it via `host.docker.internal`

---

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

(Requires the backend running on port 8000.)

## Adding widgets

See [docs/adding-a-widget.md](docs/adding-a-widget.md) for a step-by-step guide and the [docs/widget-style-guide.md](docs/widget-style-guide.md) for the design token system used across all widgets.

The widget registry is in `frontend/src/widgets/index.ts`. Any component registered there is immediately available in the YAML config.

## Security

- The **backend is never exposed** on the host — only nginx is reachable from the network
- All external API calls are **proxied server-side** — no CORS leakage, responses cached
- **No authentication by design** — intended for local networks only
- `server_tokens off` and standard security headers set in nginx
- Backend runs as your host UID/GID (set via `.env`) so config files are always owned by the right user

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
│   ├── wall-cast.yaml          ← gitignored; auto-created on first run
│   └── wall-cast.example.yaml  ← annotated template (tracked in git)
├── backend/
│   ├── app/
│   │   ├── main.py             FastAPI app + lifespan
│   │   ├── wall_config.py      YAML loader + auto-create/migrate + SSE broadcaster
│   │   └── routers/            one file per API endpoint
│   └── requirements.txt
├── frontend/
│   └── src/
│       ├── App.tsx             CSS grid layout + admin routing
│       ├── admin/              admin panel UI (/#admin)
│       ├── i18n/               translations (nl/en) + useLang() hook
│       ├── widgets/            one directory per widget type
│       │   ├── index.ts        ← widget registry
│       │   └── styles.ts       ← design token system (font sizes, spacing, colour)
│       └── hooks/              one hook per data source
├── caster/
│   ├── Dockerfile              python:3.12-slim + catt
│   ├── cast.py                 smart multi-screen caster + keepalive loop
│   └── scanner.py              HTTP :8765; ARP-based Chromecast discovery
├── docs/
│   ├── config-reference.md
│   ├── adding-a-widget.md
│   ├── widget-style-guide.md
│   └── memory/                 project decisions and state
├── docker-compose.yml          production
└── docker-compose.dev.yml      development
```

---

## Credits

### Built with AI

This project was conceived, architected, and coded in collaboration with [Claude](https://claude.ai) (Anthropic) using [Claude Code](https://claude.ai/claude-code). Architecture, widget implementation, backend routing, CSS layout, debugging, and documentation — all prompted into existence.

### Data sources

| Source | Used for |
|--------|----------|
| [open-meteo.com](https://open-meteo.com) | Weather forecasts — free, no API key |
| [buienalarm.nl](https://buienalarm.nl) | Rain intensity forecast (2 h) |
| [sunrise-sunset.org](https://sunrise-sunset.org/api) | Sunrise, sunset, and daylight duration |
| [mijnafvalwijzer.nl](https://mijnafvalwijzer.nl) | Waste collection schedule (NL) |
| [vertrektijd.info](https://vertrektijd.info) | Real-time bus departures (NL) |
| [ANWB](https://anwb.nl) | Traffic incidents |
| [TomTom Routing API](https://developer.tomtom.com) | Travel time |
| [MeteoAlarm](https://meteoalarm.org) | KNMI weather warnings |
| [pypolestar](https://github.com/pypolestar/pypolestar) | Polestar vehicle data |
| [ntfy.sh](https://ntfy.sh) | Self-hosted push notifications (breaking news) |

### Libraries and tools

**Backend**

| Library | Role |
|---------|------|
| [FastAPI](https://fastapi.tiangolo.com) | Web framework + SSE |
| [pydantic-settings](https://docs.pydantic.dev/latest/concepts/pydantic_settings/) | Settings management |
| [pyyaml](https://pyyaml.org) | YAML config loading |
| [watchfiles](https://watchfiles.helpmanual.io) | Config file watcher |
| [httpx](https://www.python-httpx.org) | Async HTTP client |
| [feedparser](https://feedparser.readthedocs.io) | RSS feed parsing |
| [catt](https://github.com/skorokithakis/catt) | Cast any URL to Chromecast via DashCast |

**Frontend**

| Library | Role |
|---------|------|
| [React](https://react.dev) | UI framework |
| [Vite](https://vitejs.dev) | Build tool + dev server |
| [TypeScript](https://www.typescriptlang.org) | Type safety |
| [TanStack Query](https://tanstack.com/query) | Data fetching and caching |
| [Mantine](https://mantine.dev) | Admin panel UI components |
| [Tailwind CSS](https://tailwindcss.com) | Utility CSS (non-layout) |

**Infrastructure**

| Tool | Role |
|------|------|
| [nginx:alpine](https://nginx.org) | Static file serving + API proxy |
| [Docker Compose](https://docs.docker.com/compose/) | Multi-service orchestration |

---

## License

MIT
