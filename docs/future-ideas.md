# Future Ideas

Widget and data source additions that make sense for a Dutch family info board. Ordered by effort, lowest first.

---

## Summary

| # | Widget | API key needed | Effort |
|---|--------|---------------|--------|
| — | KNMI weather warnings | None | ✅ done |
| — | Air quality + pollen | None | ✅ done |
| — | Market overview | None | ✅ done |
| — | P2000 emergency alerts | None | ✅ done |
| 1 | Countdown / event timer | None | Very low |
| 2 | Energy prices (ENTSO-E) | None | Low |
| 3 | Photo slideshow | None | Low–medium |
| 4 | NS train departures | Free (register) | Medium |
| 5 | Home Assistant sensors | HA long-lived token | Medium |

---

## 1. Countdown / event timer

**Display:** "Vakantie over 12 dagen" — days until a configurable event.

**Why:** Universal family use case. Countdowns to holidays, school breaks, birthdays. Highly visible, always relevant.

**Data:** Pure client-side date math. Events defined in `wall-cast.yaml`:
```yaml
- type: countdown
  config:
    events:
      - label: Zomervakantie
        date: "2026-07-18"
      - label: Verjaardag Lotte
        date: "2026-04-03"
```
Only the nearest upcoming event is shown (or top-N if multi-line layout is used).

**Backend:** None required.

**Frontend:** Single component, minimal state. Could show progress bar (days elapsed / total days in window).

**Effort:** Very low — a few hours, no backend route.

---

## 2. Energy prices (ENTSO-E day-ahead market)

**Display:** Hourly electricity price curve for today, current price highlighted, cheap/expensive periods at a glance.

**Why:** Dynamic energy contracts are common in NL. "Is now a good time to charge the car / run the dishwasher?" is a daily question.

**Data:** [ENTSO-E Transparency Platform](https://transparency.entsoe.eu) — `/api?documentType=A44` (day-ahead prices). Free, no API key. Returns XML with hourly PT€/MWh prices for NL (bidding zone `10YNL----------L`). Prices published around 13:00 CET for the next day.

**Backend:** New router `backend/app/routers/energy.py`. Parse XML, return `[{hour, price_eur_kwh}]`. Cache 1 h (prices change once per day).

**Frontend:** SVG bar chart similar to rain widget. Accent colour for current hour. Optional thresholds (green below X ct, red above Y ct) configurable in YAML.

**Effort:** Low — XML parsing + chart rendering similar to rain widget. ~half day.

---

## 3. Photo slideshow

**Display:** Family photos filling a grid cell, crossfade every N seconds.

**Why:** Personal and warm. Turns the board into something more than data.

**Data:** Images from a mounted directory (e.g. `/photos` volume). No external API.

**Backend:** New router `backend/app/routers/photos.py`:
- `GET /api/photos` → returns list of filenames
- `GET /api/photos/{filename}` → serves static file

Photos directory added as a Docker volume in `docker-compose.yml`.

**Frontend:** Component cycles through photo list using TanStack Query for the file list, `<img>` with CSS crossfade transition. `object-fit: cover` to fill cell. Configurable interval in YAML.

**Config:**
```yaml
- type: photos
  config:
    interval_sec: 15
    shuffle: true
```

**Effort:** Low–medium. Backend is trivial; frontend needs smooth crossfade and correct aspect ratio handling. ~half to full day.

---

## Air quality + pollen ✅ Done

Implemented as the `airquality` widget. Shows European AQI, PM2.5/PM10/NO₂/O₃, and a 4-day pollen forecast (birch, grass, alder, mugwort, ragweed) — all from open-meteo CAMS, no API key needed.

---

## KNMI weather warnings ✅ Done

Implemented as the `warnings` widget. Shows active MeteoAlarm alerts for the Netherlands with colour-coded severity (geel / oranje / rood), phenomenon icon and Dutch label, region, and validity window.

Auto-skips in rotator when no warnings are active.

**Possible improvements:**
- Wind direction + speed on wind warnings
- Map overlay showing affected regions
- Sound/flash alert for code red

---

## 5. NS train departures

**Display:** Next 3–5 departures from a configured station. Platform, destination, delay in minutes.

**Why:** Useful for commuters. Real-time delay info makes it actionable.

**Data:** [NS API](https://apiportal.ns.nl) — `GET /reisinformatie-api/api/v2/departures?station=SMD`. Free but requires registration for an API key. Returns JSON with departure time, destination, track, and delay.

**Backend:** New router `backend/app/routers/trains.py`. Requires `NS_API_KEY` env var. Cache 60 s (data is real-time).

**Frontend:** Departure board style. Rows: time, destination, platform, optional delay badge (red if delayed). Could highlight trains departing within N minutes.

**Config:**
```yaml
- type: trains
  config:
    station: SMD        # NS station code
    max_departures: 4
    directions: []      # optional filter by destination
```

**Effort:** Medium — API key registration + backend route + departure board UI. ~1 day including key setup.

---

## 6. Home Assistant sensors

**Display:** Configurable grid of sensor values — indoor temp, humidity, energy consumption, door state, anything HA exposes.

**Why:** If HA is already running, this surfaces home data (room temps, energy use, open windows) that otherwise requires opening the HA app.

**Data:** [Home Assistant REST API](https://developers.home-assistant.io/docs/api/rest/) — `GET /api/states/<entity_id>`. Requires a long-lived access token. HA must be reachable from the Docker host.

**Backend:** New router `backend/app/routers/homeassistant.py`. Accepts list of entity IDs from config, fetches each, returns `{entity_id, name, state, unit, last_updated}`. Requires `HA_URL` and `HA_TOKEN` env vars. Cache 30 s.

**Frontend:** Flexible card layout — label + value + unit, optional icon. Configurable per-entity in YAML. Could use HA's icon slugs mapped to local SVGs, or just text.

**Config:**
```yaml
- type: homeassistant
  config:
    entities:
      - id: sensor.living_room_temperature
        label: Woonkamer
        unit: "°C"
      - id: binary_sensor.front_door
        label: Voordeur
      - id: sensor.daily_energy_usage
        label: Verbruik vandaag
        unit: kWh
```

**Effort:** Medium — flexible config schema + backend multi-entity fetch + frontend card layout. ~1 day. Higher if icon mapping is included.

---

## P2000 emergency alerts ✅ Done

Implemented as the `p2000` widget. Shows Dutch emergency services (P2000 paging network) alerts scoped to the user's safety region (derived from `shared.location` lat/lon). Filters: Brandweer all priorities, Ambulance A1 only, Politie P1 only. Deduplicates multi-unit dispatches within a 5-minute window. Auto-skips in the rotator when no recent incidents.

News ticker injection is also available: enable via Admin → General → P2000 Emergency Alerts. When enabled, the most recent incident is injected into the news ticker with an orange `P2000` badge.

Data source: [p2000.brandweer-berkel-enschot.nl](http://p2000.brandweer-berkel-enschot.nl/homeassistant/rss.asp) — public RSS, no API key, 30 s TTL.

---

## Market overview ✅ Done

Implemented as the `market` widget. Shows the crypto Fear & Greed gauge (alternative.me),
four stock indices (S&P 500, Dow Jones, AEX, FTSE 100), five stock tickers (AAPL, MSFT,
NVDA, TSLA, AMZN), and the top 10 crypto coins by market cap — all from free, unauthenticated
APIs (Yahoo Finance for equities, CoinGecko for crypto). Refreshes every 5 minutes. No API key required.
