# Assistant & Notifications

The assistant is a standalone sidecar service that watches your data and pushes proactive notifications to your phone via [ntfy](https://ntfy.sh). It runs entirely on the Docker host — no cloud connection required beyond your ntfy instance.

## Breaking news

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

## How the assistant works

Rules are defined in the admin panel (or directly in YAML). Each rule has a single condition: a variable, an operator, and a threshold. When the condition is met, a notification is pushed to ntfy.

**Family rules** fire for the whole household — notifications go to the shared system topic and are fanned out to every person's individual topic as well.
**Personal rules** (variables marked *personal* below) require a person context and fire per-person — notifications go only to that person's ntfy topic.

## Available variables

| Variable | Type | Scope | Description |
|----------|------|-------|-------------|
| `garbage.hours_until_pickup` | number | family | Hours until the next collection |
| `weather.warning_level` | enum | family | Active KNMI warning level: `geel` / `oranje` / `rood` |
| `weather.temperature` | number | family | Current temperature (°C) |
| `weather.wind_speed` | number | family | Current wind speed (km/h) |
| `rain.mm_now` | number | family | Current rain intensity (mm/hour) |
| `rain.minutes_until_rain` | number | family | Minutes until rain starts (0 = raining now, 999 = none in 3 h) |
| `polestar.battery_pct` | number | family | Battery level (%) |
| `polestar.range_km` | number | family | Estimated range (km) |
| `polestar.is_plugged_in` | boolean | family | Whether the car is plugged in |
| `airquality.aqi` | number | family | European AQI (good ≤20 · fair ≤40 · moderate ≤60 · poor ≤80) |
| `airquality.pollen_birch` | enum | family | Birch pollen level: `none` / `low` / `moderate` / `high` / `very_high` |
| `airquality.pollen_grass` | enum | family | Grass pollen level: `none` / `low` / `moderate` / `high` / `very_high` |
| `calendar.minutes_until_event` | number | personal | Minutes until that person's next calendar event |
| `bus.delay_minutes` | number | personal | Bus delay (minutes) — only fires when person has a calendar event within 90 min |
| `bus.cancelled` | boolean | personal | Bus service cancelled — cross-correlated with calendar |
| `bus.minutes_until_departure` | number | personal | Minutes until that person's next bus departure |
| `traffic.delay_minutes` | number | personal | Commute delay (minutes above normal) |
| `traffic.delay_pct` | number | personal | Commute delay as percentage above normal travel time |

## Setup

### 1. Install ntfy

Install the [ntfy app](https://ntfy.sh) (Android / iOS) and subscribe to your topic. Self-hosted ntfy works fine — point `ntfy_url` at your instance.

### 2. Enable in the admin panel

Open `/#admin` → **Assistant** tab:

- Tick **Enable assistant**
- Enter your **ntfy server URL** and **topic** under Notifications
- Add rules under **Rules** using the condition builder — these are family-wide rules sent to all registered people
- Click **Save**

For personal rules, go to the **People** tab → select a person → **Assistant** section:
- Enter that person's **ntfy topic** (they subscribe to this on their phone)
- Add personal rules (bus, traffic, calendar)

### 3. Configure YAML directly (optional)

```yaml
shared:
  assistant:
    enabled: true
    check_interval: 300          # seconds between rule evaluation cycles

    notify:
      ntfy_url: https://ntfy.example.com
      ntfy_topic: wall-cast-alerts   # system topic; global rules fan out here too

    rules:
      - id: garbage-reminder
        title: Garbage pickup reminder
        enabled: true
        condition:
          variable: garbage.hours_until_pickup
          operator: "<="
          value: 18
          unit: h
      - id: heavy-rain
        title: Heavy rain alert
        enabled: true
        condition:
          variable: rain.mm_now
          operator: ">="
          value: 5
          unit: mm/h

  people:
    - id: niels
      name: Niels
      notify:
        ntfy_topic: wall-cast-niels   # personal topic; global rules are also delivered here
      rules:
        - id: niels-bus-delay
          title: Bus delay alert
          enabled: true
          condition:
            variable: bus.delay_minutes
            operator: ">="
            value: 5
            unit: min
```

### 4. Start the service

```bash
docker compose up --build assistant -d
```

The assistant logs each notification it sends:

```
[assistant] ntfy → wall-cast-alerts: 'Garbage collection'
[assistant] ntfy → wall-cast-niels: 'Bus delay — Leidseplein'
```

## AI formatting (optional)

By default the assistant sends concise template messages. Enable an AI provider to rewrite them into natural language.

| Provider | Config |
|----------|--------|
| **None** (default) | Template strings — no extra setup |
| **Ollama** (self-hosted) | Set `provider: ollama`, `ollama_url`, and `ollama_model` (e.g. `llama3.2:3b`) |
| **OpenAI** | Set `provider: openai`, `OPENAI_API_KEY` in `.env`, optionally `openai_model` |

```yaml
    ai:
      provider: ollama
      ollama_url: http://host.docker.internal:11434
      ollama_model: llama3.2:3b
```

With AI enabled, a bus delay notification might become:

> *"Heads up Niels — the line 2 at 08:45 is running 8 minutes late, and you've got your dentist appointment at 09:30."*

AI is **additive only** — if the AI call fails the assistant falls back to the template automatically.

## Deduplication

The assistant tracks sent notifications in `/config/assistant-state.json`. Each rule fires at most once per event — you won't get the same bin-day reminder every 5 minutes. State survives container restarts. Old entries are pruned automatically after 7 days.
