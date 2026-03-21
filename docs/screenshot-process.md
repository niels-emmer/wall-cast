# How to retake README screenshots

This documents the exact steps to regenerate the six screenshots used in the README (`docs/screenshots/screenshot-1.png` through `screenshot-6.png`).

## Prerequisites

- Docker running locally
- Node.js available (for `npx playwright`)
- The dev stack started (see below)

## Step 1 — Write a screenshot config

Create `config/wall-cast.yaml` (gitignored) with representative fake data. The config used for the current screenshots is documented here for reference:

```yaml
shared:
  location:
    lat: 52.3731
    lon: 4.8922
    name: Amsterdam
  language: en
  people:
    - id: alice
      name: Alice
      family: true
      calendar_ids: []    # add real IDs here for populated calendar screenshots
    - id: bob
      name: Bob
      family: false
      calendar_ids: []
    - id: emma
      name: Emma
      family: false
      calendar_ids: []
  widgets:
    - id: news
      type: news
      col: 1
      row: 8
      col_span: 12
      row_span: 1
      config:
        feeds:
          - url: https://www.dutchnews.nl/rss
            label: DutchNews
          - url: https://news.ycombinator.com/rss
            label: HackerNews
        scroll_speed_px_per_sec: 80

screens:
  - id: living-room
    name: Living Room
    chromecast_ip: "192.168.1.42"
    people: [alice, bob]
    layout: {columns: 12, rows: 8}
    widgets:
      - {id: clock, type: clock, col: 1, row: 1, col_span: 4, row_span: 3, config: {show_seconds: true, show_date: true}}
      - {id: rain, type: rain, col: 1, row: 4, col_span: 4, row_span: 4}
      - {id: weather, type: weather, col: 5, row: 1, col_span: 8, row_span: 7, config: {show_hourly: true, show_daily: true}}

  - id: kids-room
    name: Kids Room
    chromecast_ip: ""
    people: [emma]
    layout: {columns: 12, rows: 8}
    widgets:
      - {id: clock, type: clock, col: 1, row: 1, col_span: 4, row_span: 3, config: {show_seconds: true, show_date: true}}
      - {id: garbage, type: garbage, col: 1, row: 4, col_span: 4, row_span: 4, config: {postcode: "1012AB", huisnummer: "1", days_ahead: 14}}
      - {id: calendar, type: calendar, col: 5, row: 1, col_span: 8, row_span: 7}

  - id: office
    name: Office
    chromecast_ip: ""
    people: [alice]
    layout: {columns: 12, rows: 8}
    widgets:
      - {id: clock, type: clock, col: 1, row: 1, col_span: 4, row_span: 3, config: {show_seconds: true, show_date: true}}
      - {id: polestar, type: polestar, col: 1, row: 4, col_span: 4, row_span: 4}
      - {id: traffic, type: traffic, col: 5, row: 1, col_span: 8, row_span: 7, config: {home_address: "Leidseplein 1, 1017 PS Amsterdam, NL", work_address: "Zuidas, Amsterdam, NL", route_roads: "A10"}}

  - id: bedroom
    name: Bedroom
    chromecast_ip: ""
    people: [bob]
    layout: {columns: 12, rows: 8}
    widgets:
      - {id: clock, type: clock, col: 1, row: 1, col_span: 4, row_span: 3, config: {show_seconds: true, show_date: true}}
      - {id: warnings, type: warnings, col: 1, row: 4, col_span: 4, row_span: 2}
      - {id: rain, type: rain, col: 1, row: 6, col_span: 4, row_span: 2}
      - {id: weather, type: weather, col: 5, row: 1, col_span: 8, row_span: 7, config: {show_hourly: true, show_daily: true}}

  - id: kitchen
    name: Kitchen
    chromecast_ip: ""
    people: [alice, bob, emma]
    layout: {columns: 12, rows: 8}
    widgets:
      - {id: clock, type: clock, col: 1, row: 1, col_span: 4, row_span: 3, config: {show_seconds: true, show_date: true}}
      - {id: bus, type: bus, col: 1, row: 4, col_span: 4, row_span: 4, config: {stop_city: "Amsterdam", stop_name: "Leidseplein"}}
      - {id: weather, type: weather, col: 5, row: 1, col_span: 8, row_span: 7, config: {show_hourly: true, show_daily: true}}
```

> **Tip:** Set `calendar_ids` to real Google Calendar IDs and include `config/google-sa.json` to get a populated calendar widget in the screenshots. Otherwise the calendar will load from any cached data or show an empty state.

## Step 2 — Start the dev stack

```bash
docker compose -f docker-compose.dev.yml up -d --build
```

Wait ~10 seconds for the backend to start and fetch initial API data.

## Step 3 — Take the wall screenshots with Playwright

Use `npx playwright screenshot` with a 6-second wait to allow all widgets to load their data from external APIs:

```bash
# Find where npx cached playwright — use this path in the node script below
PW=$(find ~/.npm/_npx -name "index.js" -path "*/playwright/index.js" | head -1 | sed 's|/index.js||')

for screen in living-room kids-room office bedroom kitchen; do
  npx playwright screenshot \
    --browser chromium \
    --viewport-size=1920,1080 \
    --wait-for-timeout=6000 \
    "http://localhost:5173/?screen=$screen" \
    "/tmp/wc-${screen}.png"
done
```

> **Note:** The `--wait-for-timeout` controls how long Playwright waits after navigation before taking the screenshot. 6000ms is enough for weather, rain, traffic, and bus to all resolve. Increase to 8000–10000ms on a slow connection.

## Step 4 — Take the admin screenshot

The admin screenshot requires clicking the **Screens** tab, which `npx playwright screenshot` can't do directly. Use this node script instead:

```javascript
// pw-admin.cjs — run with: node pw-admin.cjs
const { chromium } = require('/path/to/playwright');  // use $PW from step 3

(async () => {
  const browser = await chromium.launch();
  const page = await browser.newPage();
  await page.setViewportSize({ width: 1920, height: 1080 });
  await page.goto('http://localhost:5173/#admin');
  await page.waitForTimeout(2500);
  await page.click('text=Screens');
  await page.waitForTimeout(1500);
  await page.screenshot({ path: '/tmp/wc-admin.png' });
  await browser.close();
})();
```

## Step 5 — Copy to docs/screenshots/

```bash
cp /tmp/wc-living-room.png  docs/screenshots/screenshot-1.png
cp /tmp/wc-kids-room.png    docs/screenshots/screenshot-2.png
cp /tmp/wc-office.png       docs/screenshots/screenshot-3.png
cp /tmp/wc-bedroom.png      docs/screenshots/screenshot-4.png
cp /tmp/wc-kitchen.png      docs/screenshots/screenshot-5.png
cp /tmp/wc-admin.png        docs/screenshots/screenshot-6.png
```

Then commit: `git add docs/screenshots/ && git commit -m "docs: refresh README screenshots"`

## Troubleshooting

| Symptom | Cause | Fix |
|---------|-------|-----|
| "Cannot reach wall-cast backend" on display | Vite proxy misconfigured | Check `VITE_BACKEND_URL=http://backend:8000` in docker-compose.dev.yml |
| Widgets show "loading" / blank | Wait time too short | Increase `--wait-for-timeout` to 8000–10000ms |
| Calendar shows no events | No `calendar_ids` set or service account not shared | Add real IDs and share each calendar with the service account email |
| Garbage shows "Unavailable" | Postcode not found by mijnafvalwijzer.nl | Use a valid NL postcode; Amsterdam 1012AB works |
| Weather icons missing | CORS issue in headless browser | Switch to `chromium` (not `firefox`) and ensure `--disable-web-security` isn't needed |
