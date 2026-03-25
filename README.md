# wall-cast

**A self-hosted home display that casts personalised information to Android TV sets, Android TV boxes, and Chromecast-connected screens around your house.**

Put the weather, family calendar, bin collection schedule, and live travel times on the TV in the living room. Put a different mix — with the kids' school schedule, the rain radar, and bus / tram departures — on the screen in their room. All from one Docker stack, hot-reloading, no cloud, no subscription.

**This is not a digital signage system.** It's a lightweight, family-oriented display: *my* weather, *our* schedule, *the* waste collection. It runs entirely on a Docker host on your home LAN — a Raspberry Pi, a NAS, a spare PC — and casts the display to whichever Chromecasts or Google TVs you point it at.

It is fully AI-coded and designed to be extended. Fork it, [tell Claude what you want](docs/prompt-a-feature.md), and iterate from there.

---

## What it looks like

<p align="center">
  <img src="docs/screenshots/screenshot-1.png" width="49%" alt="Clock, 7-day weather forecast and rain radar" />
  <img src="docs/screenshots/screenshot-2.png" width="49%" alt="Clock, family calendar and waste collection schedule" />
</p>
<p align="center">
  <img src="docs/screenshots/screenshot-3.png" width="49%" alt="Clock, live traffic jams and Polestar EV status" />
  <img src="docs/screenshots/screenshot-4.png" width="49%" alt="Clock, KNMI weather warning and live bus / tram departures" />
</p>
<p align="center">
  <img src="docs/screenshots/screenshot-5.png" width="49%" alt="Home page / screen selector" />
  <img src="docs/screenshots/screenshot-6.png" width="49%" alt="Admin panel — Assistant tab with rules list and notification settings" />
</p>

## Features

- **Multi-screen** — one installation drives multiple Chromecasts, each with its own layout and content
- **Hot-reload config** — save the YAML, every screen updates within ~1 second; no container restart needed
- **Widget system** — mix and match widgets per screen; layout, spans, and config all in one YAML file
- **People & Calendars** — assign household members to screens; family members appear on all screens automatically
- **Admin panel** — browser-based UI at `/#admin`: configure screens, people, feeds, assistant, and Chromecast IPs; built-in LAN scanner to discover devices
- **Assistant** — proactive push notifications via ntfy: bin day reminders, bus delay alerts cross-correlated with your calendar, commute delay warnings, and weather alerts; optional AI (Ollama/OpenAI) rewrites messages into natural language
- **Dark theme** — pure black background, bold white type, cyan accent
- **Dutch / English** — all widget labels switch with `language: en/nl`
- **Rotate widget** — cycle multiple widgets in one grid cell on a configurable interval
- **Mostly no API keys** — most data sources are free and unauthenticated
- **Modular** — add new widgets without touching core code; [step-by-step guide](docs/adding-a-widget.md) included

## Widgets

| Widget | Size | Data source | Refresh |
|--------|------|-------------|---------|
| **Clock** | L | Client-side | Every second |
| **Weather** | L | [open-meteo.com](https://open-meteo.com) — current, hourly, 7-day | 15 min |
| **Rain forecast** | S | [open-meteo.com](https://open-meteo.com) — rain chart for next 3 h | 5 min |
| **News ticker** | Full | RSS feeds (configurable list) | 10 min |
| **Sunrise/sunset** | — | [sunrise-sunset.org](https://sunrise-sunset.org/api) — embedded in weather widget | 6 h |
| **Garbage** | S | [mijnafvalwijzer.nl](https://mijnafvalwijzer.nl) — upcoming collection (NL) | 1 h |
| **Polestar** | S | [pypolestar](https://github.com/pypolestar/pypolestar) — SOC, range, charging, service | 5 min |
| **Calendar** | L | Google Calendar (service account) | 10 min |
| **Traffic** | L | ANWB (jams) + TomTom (travel time) | 5 min |
| **KNMI warnings** | L | [MeteoAlarm](https://meteoalarm.org) — active NL weather warnings; hidden when none | 15 min |
| **Air quality** | L | [open-meteo.com](https://open-meteo.com) — European AQI, PM2.5/PM10/NO₂/O₃, 4-day pollen forecast | 1 h |
| **Bus / tram departures** | S | [vertrektijd.info](https://vertrektijd.info) — live departures, cancelled services shown | 30 s |
| **Network** | S | Router DAL API + Cloudflare speedtest — WAN status, connectivity, LAN hosts, speed | 30 s |
| **Rotate** | Any | Container — cycles child widgets in one grid cell | — |

*Size guide — **S**: designed for the small bottom slot (~4×4 cells); **L**: designed for the large main slot (~8×7 cells); **Full**: full-width single-row strip; **Any**: container, inherits size from its grid position.*

---

## Quick start

### 1. Clone

```bash
git clone https://github.com/niels-emmer/wall-cast
cd wall-cast
```

### 2. Create your `.env`

```bash
cp .env.example .env
```

Edit `.env` and set the required values:

**`UID` / `GID`** — file ownership for config files written by the backend. Run `id -u && id -g` on the host. Default `1000` is fine on most Linux installs.

**`SERVER_URL`** — the LAN address of this Docker host, as seen from the Chromecasts. Use `ip addr` to find it. Must be an IP, not `localhost`.

```
SERVER_URL=http://192.168.1.10
```

**`TIMEZONE`** — IANA timezone name, e.g. `Europe/Amsterdam`. [Full list](https://en.wikipedia.org/wiki/List_of_tz_database_time_zones).

Optional — only fill in what you need:

| Variable | Widget | Where to get it |
|---|---|---|
| `GOOGLE_SA_KEY_FILE` / `GOOGLE_CALENDAR_ID` | Calendar | [Service account setup](docs/people-and-calendars.md#service-account-setup) |
| `TOMTOM_API_KEY` | Traffic | Free key at [developer.tomtom.com](https://developer.tomtom.com) (no credit card) |
| `VERTREKTIJD_API_KEY` | Bus / tram | Free account at [vertrektijd.info/starten.html](https://vertrektijd.info/starten.html) |
| `POLESTAR_USERNAME` / `POLESTAR_PASSWORD` | Polestar | Your [my.polestar.com](https://my.polestar.com) credentials |
| `ROUTER_PASSWORD` | Network | Zyxel VMG8825 admin password (optional) |

### 3. Run

```bash
docker compose up -d --build
```

The config file (`config/wall-cast.yaml`) is created automatically on first run with sensible defaults.

### 4. Configure

The casting server is now available at **`http://<host-ip>`**. Click **Configure** (or go to **`http://<host-ip>/#admin`**) to open the admin panel.

### 5. Enable casting

**Screens** → select a screen → **Screen settings** → **Scan network** → click a device row to pre-fill the IP → **Save**.

The display is cast to the TV within ~15 seconds of startup and re-casts automatically if the session drops.

To stop: `docker compose down`

## Updating

```bash
git pull && docker compose up --build -d
```

Check [Releases](https://github.com/niels-emmer/wall-cast/releases) for what changed.

---

## Configuration

All settings live in **`config/wall-cast.yaml`** — gitignored, auto-created on first run, hot-reloads within ~1 second of saving. It will never block a `git pull`.

The config uses a `shared + screens[]` schema. `shared` settings apply to every screen; each screen can override or extend them. See [`config/wall-cast.example.yaml`](config/wall-cast.example.yaml) for an annotated template and [`docs/config-reference.md`](docs/config-reference.md) for the full field reference.

### Admin panel

Open `/#admin`. Four tabs:

- **General** — location, garbage address, language, news feeds, network widget settings
- **Screens** — add/rename/delete/enable screens; set Chromecast IP; assign people; configure layout and widget options
- **People** — add household members; mark as family; add calendar IDs; set commute and bus stop; add per-person notification rules
- **Assistant** — ntfy server/topic; AI provider; family-wide notification rules

Changes are written back to `wall-cast.yaml` immediately and hot-reload onto the display.

---

## People & Calendars

Assign household members to screens so each screen shows the right calendars. Family members appear on all screens automatically; others only on screens they're assigned to.

→ **[Full setup guide: docs/people-and-calendars.md](docs/people-and-calendars.md)**

---

## Assistant & Notifications

The assistant watches your data and pushes proactive notifications to your phone via [ntfy](https://ntfy.sh). Rules are configured in the admin panel or YAML. Supports family-wide and per-person rules, optional AI message formatting (Ollama / OpenAI), and deduplication.

ntfy also powers **breaking news**: push a message from your phone or a script and it appears instantly on screen in the news ticker.

```bash
curl -H "Title: Power outage" \
     -d "Grid restored at 14:32" \
     https://ntfy.example.com/wall-cast
```

→ **[Full docs: docs/assistant.md](docs/assistant.md)**

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
│                                                 │                    │
│  ┌──────────────────┐ host net  ┌───────────────┴───────────────┐   │
│  │  caster          │           │  scanner                      │   │
│  │  reads config    │           │  HTTP :8765                   │   │
│  │  catt cast_site  │           │  catt scan (mDNS)             │   │
│  │  → each screen   │           └───────────────────────────────┘   │
│  └────────┬─────────┘                                                │
│                                                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │  assistant                                                   │   │
│  │  polls GET /api/garbage, /api/calendar, /api/bus, …         │   │
│  │  runs rules → deduplicates → pushes ntfy notifications  ────┼───┼──▶ ntfy / phone
│  └──────────────────────────────────────────────────────────────┘   │
└───────────┼──────────────────────────────────────────────────────────┘
            │ DashCast receiver
            ▼
   Chromecast / Google TV  (same LAN)
   loads /?screen=<id>  ←  SSE keeps page live
   browser subscribes to ntfy SSE directly (no proxy)
```

Five Docker services: **frontend** (nginx, port 80), **backend** (FastAPI, internal), **caster** (host network, `catt cast_site`), **scanner** (host network, mDNS), **assistant** (ntfy notifications, opt-in).

---

## Development

```bash
docker compose -f docker-compose.dev.yml up --build
```

- **Frontend** (Vite HMR): http://localhost:5173
- **Backend** (FastAPI + live reload): http://localhost:8000
- **API docs** (Swagger): http://localhost:8000/api/docs

Or run the frontend standalone (fastest — requires backend on port 8000):

```bash
cd frontend && npm install && npm run dev
```

## Extending the project

This project is fully AI-coded and designed to be extended by prompting. See [docs/prompt-a-feature.md](docs/prompt-a-feature.md) for a prompt structure that lets you describe a feature in plain language and have Claude implement it end-to-end.

- Adding a widget: [docs/adding-a-widget.md](docs/adding-a-widget.md)
- Widget design system: [docs/widget-style-guide.md](docs/widget-style-guide.md)

## Security

- **nginx is the only public port** — the backend is never exposed on the host
- No authentication by design — intended for local networks only
- Backend runs as your host UID/GID so config files are always owned by the right user

If your host is internet-facing, add `allow`/`deny` rules in `nginx.conf` to restrict by IP range.

## Project layout

```
wall-cast/
├── config/
│   ├── wall-cast.yaml          ← gitignored; auto-created on first run
│   └── wall-cast.example.yaml  ← annotated template (tracked in git)
├── backend/app/
│   ├── main.py                 FastAPI app + lifespan
│   ├── wall_config.py          YAML loader + SSE broadcaster
│   └── routers/                one file per API endpoint
├── frontend/src/
│   ├── App.tsx                 CSS grid layout + admin routing
│   ├── admin/                  admin panel UI (/#admin)
│   ├── widgets/
│   │   ├── index.ts            ← widget registry
│   │   └── styles.ts           ← design token system
│   └── hooks/                  one hook per data source
├── caster/
│   ├── cast.py                 multi-screen caster + keepalive loop
│   └── scanner.py              HTTP :8765; mDNS Chromecast discovery
├── assistant/
│   ├── assistant.py            polling loop; runs rules; dispatches
│   ├── rules/                  engine + one file per data domain
│   ├── notify/ntfy.py          push to ntfy via HTTP POST
│   ├── ai/formatter.py         optional AI message rewriting
│   └── state.py                deduplication (JSON, persisted)
├── docs/
├── docker-compose.yml          production
└── docker-compose.dev.yml      development
```

---

## Credits

### Data sources

| Source | Used for |
|--------|----------|
| [open-meteo.com](https://open-meteo.com) | Weather forecasts, rain, air quality / pollen |
| [sunrise-sunset.org](https://sunrise-sunset.org/api) | Sunrise, sunset, daylight duration |
| [mijnafvalwijzer.nl](https://mijnafvalwijzer.nl) | Waste collection schedule (NL) |
| [vertrektijd.info](https://vertrektijd.info) | Real-time bus / tram departures (NL) |
| [ANWB](https://anwb.nl) | Traffic incidents |
| [TomTom Routing API](https://developer.tomtom.com) | Travel time |
| [MeteoAlarm](https://meteoalarm.org) | KNMI weather warnings |
| [pypolestar](https://github.com/pypolestar/pypolestar) | Polestar vehicle data |
| [ntfy.sh](https://ntfy.sh) | Push notifications |

### Built with

| | |
|---|---|
| [FastAPI](https://fastapi.tiangolo.com) | Backend framework + SSE |
| [React](https://react.dev) + [Vite](https://vitejs.dev) | Frontend |
| [TanStack Query](https://tanstack.com/query) | Data fetching |
| [Mantine](https://mantine.dev) | Admin panel components |
| [catt](https://github.com/skorokithakis/catt) | Cast to Chromecast via DashCast |
| [nginx:alpine](https://nginx.org) | Static serving + API proxy |
| [Claude](https://claude.ai) + [Claude Code](https://claude.ai/claude-code) | Everything above |

---

## License

MIT
