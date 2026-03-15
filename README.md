# wall-cast

A self-hosted wall display for Chromecast-connected screens. Dark-themed, widget-based, hot-reloading — runs entirely in Docker on your local network.

![Dark, large-text dashboard showing clock, weather, rain forecast, and news ticker](.github/preview.png)

## Features

- **Polestar-style dark UI** — pure black background, bold white typography, accent highlights
- **Widget layout** — configure widget positions via a YAML file
- **Hot reload** — edit the config on your VPS, the display updates within 1 second (no restarts)
- **Widgets**: clock/date, weather (open-meteo.com), rain forecast (buienradar.nl), news ticker (RSS)
- **Modular** — add new widgets without touching core code
- **No API keys** — open-meteo and buienradar are free and unauthenticated

## Requirements

- Docker + Docker Compose on your VPS (local network)
- A Chromecast connected to a screen on the same network
- A web browser on any device to do the initial cast (one-time)

## Quick Start

### 1. Clone and configure

```bash
git clone https://github.com/yourname/wall-cast
cd wall-cast
```

Edit `config/wall-cast.yaml` to set your location and preferred layout.

### 2. Start

```bash
docker compose up -d --build
```

The display will be available at `http://<vps-ip>/`.

### 3. Cast to your screen

1. Open `http://<vps-ip>/` in Chrome on any device on your network
2. Click ⋮ → Cast → Cast to... → select your Chromecast
3. Done — the display stays running on the TV

To stop: `docker compose down`

## Configuration

Edit `config/wall-cast.yaml`. The display auto-updates within ~1 second of saving. See [docs/config-reference.md](docs/config-reference.md) for all options.

```yaml
location:
  lat: 52.3676
  lon: 4.9041
  name: Amsterdam

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
```

## Development

```bash
docker compose -f docker-compose.dev.yml up --build
```

- Frontend: http://localhost:5173 (Vite HMR)
- Backend API: http://localhost:8000
- API docs: http://localhost:8000/docs

## Adding Widgets

See [docs/adding-a-widget.md](docs/adding-a-widget.md) for a step-by-step guide.

The widget registry is in `frontend/src/widgets/index.ts`. Any component registered there is immediately available in the YAML config.

## Architecture

```
VPS (Docker)
├── frontend  nginx:alpine, port 80
│             Vite-built React app, served as static files
│             Proxies /api/* → backend
│
└── backend   python:3.12-slim, internal only
              FastAPI, proxies external APIs, serves config
              Watches wall-cast.yaml, pushes SSE on change

Chromecast (same LAN)
└── Fetches http://<vps-ip>/ — stays live via SSE keepalive
```

## Security

- The backend is not exposed on the host — only nginx is accessible
- The config file is mounted read-only into the backend container
- All external API calls are proxied server-side (CORS, caching)
- No authentication by design — local network only
- If your VPS is internet-facing, restrict access in nginx:

```nginx
location / {
    allow 192.168.0.0/16;
    allow 10.0.0.0/8;
    deny all;
    try_files $uri $uri/ /index.html;
}
```

## Data Sources

| Widget | Source | API key |
|--------|--------|---------|
| Weather | [open-meteo.com](https://open-meteo.com) | None |
| Rain | [buienradar.nl](https://gpsgadget.buienradar.nl) | None |
| News | RSS feeds (configurable) | None |

## License

MIT
