# wall-cast Memory Index

## Project Status

**Phase**: Initial scaffold — all core files created, not yet tested.
**Next**: Docker build + first cast test, then widget polish.

## Quick Context

- Repo: `/Users/nemmer/repositories/wall-cast`
- Stack: FastAPI backend + React/Vite/Tailwind frontend, Docker Compose
- Casting: Chromecast on local LAN fetches `http://<vps-ip>/` — no Cast SDK needed
- Config: `config/wall-cast.yaml` hot-reloads via SSE without container restart
- Location default: Amsterdam (lat 52.3676, lon 4.9041) — user should update in YAML

## Decision Log

See `records/decision-log.md` for all architectural decisions with rationale.

## Open Items

- [ ] Confirm VPS IP and update `config/wall-cast.yaml` location
- [ ] Test Docker build on VPS
- [ ] Initial cast via Chrome browser (one-time manual step)
- [ ] Tune widget layout for actual screen resolution
- [ ] Push to GitHub — name: `wall-cast` (or user preference)

## Widget Status

| Widget | Backend Route | Frontend Component | Status |
|--------|--------------|-------------------|--------|
| clock | n/a (client-side) | ClockWidget.tsx | scaffold |
| weather | /api/weather | WeatherWidget.tsx | scaffold |
| rain | /api/rain | RainWidget.tsx | scaffold |
| news | /api/news | NewsTickerWidget.tsx | scaffold |
