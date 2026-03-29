# Assistant & Notifications

The assistant is a standalone sidecar service that watches your data and pushes proactive notifications to your phone. It supports **ntfy** and **Matrix** simultaneously — configure one or both. It runs entirely on the Docker host — no cloud connection required beyond your own ntfy/Matrix instance.

## Breaking news (ntfy only)

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

Rules are defined in the admin panel (or directly in YAML). Each rule has **1–3 conditions** with an optional AND/OR logic toggle. When the condition(s) are met, a notification is dispatched on all configured channels.

**Family rules** fire for the whole household — notifications go to every person's configured ntfy topic and/or Matrix room.
**Personal rules** (variables marked *personal* below) require a person context and fire per-person — notifications go only to that person's own channels.

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

---

## Notification channels

### ntfy

[ntfy](https://ntfy.sh) is a lightweight pub/sub notification service. Self-hosted or cloud.

- Install the ntfy app (Android / iOS) and subscribe to your personal topic
- Each person configures their own topic — notifications land in their own notification feed
- Global (family-wide) alerts fan out to **every person's ntfy topic** — there is no shared system topic

### Matrix

[Matrix](https://matrix.org) is a decentralised open messaging protocol. Self-hosted (e.g. [Dendrite](https://matrix-org.github.io/dendrite/), [Synapse](https://matrix-org.github.io/synapse/)) or hosted (e.g. matrix.org).

- The assistant sends messages via the Matrix Client-Server API using a bot account
- A **system room** can be configured for global (family-wide) alerts
- Each person can configure their own private Matrix room for personal alerts
- The access token lives in `.env` only — never in the YAML

Both channels are **independent** — a failure on one doesn't affect the other.

---

## Setup

### 1. Choose your channel(s)

You can use ntfy, Matrix, or both at the same time. Configure only what you need.

---

### 2a. ntfy setup

Install the [ntfy app](https://ntfy.sh) (Android / iOS) and subscribe to a topic. Self-hosted ntfy works fine.

Open `/#admin` → **Assistant** tab → **Notifications** → **ntfy**:
- Tick **Enable ntfy**
- Enter your **ntfy server URL** (e.g. `https://ntfy.example.com`)
- Click **Save**

Then open the **People** tab → select each person → **Assistant** → **Notifications**:
- Enter their personal **ntfy topic** (they subscribe to this on their phone)

---

### 2b. Matrix setup

#### Step 1 — Create a bot account

On your Matrix homeserver, create a dedicated bot user. On **Dendrite**:

```bash
docker exec -it <dendrite-container> /usr/bin/create-account \
  -config /etc/dendrite/dendrite.yaml \
  -username wallbot
```

Copy the `AccessToken` from the output — this is your `MATRIX_TOKEN`.

On **Synapse**:
```bash
docker exec -it <synapse-container> register_new_matrix_user \
  -c /data/homeserver.yaml http://localhost:8008
```
Then retrieve a token via `curl` or the Synapse admin API.

#### Step 2 — Add the token to `.env`

```
MATRIX_TOKEN=your_access_token_here
```

Restart the containers: `docker compose up -d`

#### Step 3 — Create a room and invite the bot

In your Matrix client (Element, etc.):
1. Create a **private, unencrypted** room
2. Copy the room ID (format: `!roomid:yourhomeserver.com`) from room settings
3. Invite `@wallbot:yourhomeserver.com` to the room

#### Step 4 — Have the bot accept the invite (one time only)

The bot has no running client to auto-accept invites. Accept manually via the API:

```bash
curl -X POST 'https://yourhomeserver.com/_matrix/client/v3/join/!ROOMID:yourhomeserver.com' \
  -H 'Authorization: Bearer your_access_token_here' \
  -H 'Content-Type: application/json' \
  -d '{}'
```

> **Note**: use single quotes around the URL — bash history expansion treats `!` as a history command in double-quoted strings.

A successful response looks like: `{"room_id":"!ROOMID:yourhomeserver.com"}`. Membership persists; this step is only needed once per room.

#### Step 5 — Configure in the admin panel

Open `/#admin` → **Assistant** tab → **Notifications** → **Matrix**:
- Tick **Enable Matrix**
- Enter the **homeserver URL** (e.g. `https://matrix.example.com`)
- Enter the **system room ID** — global alerts go here (e.g. `!roomid:example.com`)
- Click **Save**

For personal Matrix rooms, open the **People** tab → select each person → **Assistant** → **Notifications**:
- Enter their **Matrix room ID** — personal alerts go here instead of (or in addition to) the system room

---

### 3. Configure YAML directly (optional)

```yaml
shared:
  assistant:
    enabled: true
    check_interval: 300          # seconds between rule evaluation cycles

    notify:
      ntfy:
        enabled: true
        url: https://ntfy.example.com
        # Topics are per-person — see people[].notify.ntfy_topic below
      matrix:
        enabled: true
        homeserver: https://matrix.example.com
        room_id: "!systemroom:example.com"   # global alerts go here
        # MATRIX_TOKEN must be set in .env — never in YAML

    rules:
      - id: garbage-reminder
        title: Garbage pickup reminder
        enabled: true
        conditions:
          - variable: garbage.hours_until_pickup
            operator: "<="
            value: 18
            unit: h
      - id: heavy-rain
        title: Heavy rain alert
        enabled: true
        conditions:
          - variable: rain.mm_now
            operator: ">="
            value: 5
            unit: mm/h
      # Multi-condition example: alert when bus is late AND you have a meeting soon
      - id: bus-late-and-meeting
        title: Late bus before a meeting
        enabled: false
        condition_logic: and    # 'and' (default) or 'or'
        conditions:
          - variable: bus.delay_minutes
            operator: ">="
            value: 5
            unit: min
          - variable: calendar.minutes_until_event
            operator: "<="
            value: 60
            unit: min

  people:
    - id: niels
      name: Niels
      notify:
        ntfy_topic: wall-cast-niels        # personal ntfy topic
        matrix_room_id: "!nielsroom:example.com"   # personal Matrix room (optional)
      rules:
        - id: niels-bus-delay
          title: Bus delay alert
          enabled: true
          conditions:
            - variable: bus.delay_minutes
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
[assistant] ntfy → wall-cast-niels: 'Bus delay — Leidseplein'
[assistant] matrix → !nielsroom:example.com: 'Bus delay — Leidseplein'
```

---

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

---

## Deduplication

The assistant tracks sent notifications in `/config/assistant-state.json`. Each rule fires at most once per event — you won't get the same bin-day reminder every 5 minutes. State survives container restarts. Old entries are pruned automatically after 7 days.
