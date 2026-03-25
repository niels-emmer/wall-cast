# People & Calendars

The **People** system lets you assign household members to screens so each screen shows the right calendars. Family members (marked as such) appear on every screen; everyone else only on the screens they're assigned to.

## Step 1 — Add people

Open `http://<host-ip>/#admin` → **People** tab → **+ Add person**.

For each person, enter their name, optionally tick **Family (all screens)**, and add their Google Calendar IDs. Then go to **Screens**, select a screen, and tick which people belong on it.

## Step 2 — Find the Google Calendar ID

| Calendar type | Where to find the ID |
|---|---|
| **Primary Gmail calendar** | Simply your Gmail address, e.g. `yourname@gmail.com` |
| **Shared / group calendar** | Google Calendar → Settings → click the calendar → *Integrate calendar* → copy the **Calendar ID** |

## Step 3 — Share the calendar with the service account

The backend reads calendars via a Google service account. It can only read calendars that have been explicitly shared with it.

1. Open [Google Calendar](https://calendar.google.com) → Settings → click the calendar
2. Scroll to **Share with specific people and groups** → **+ Add people**
3. Enter the **service account email** — find it in **Admin → General → Calendar** (it ends in `@...iam.gserviceaccount.com`)
4. Set permission to **See all event details** (read-only is sufficient)
5. Click **Send**

Repeat for every calendar you want to display.

> Changes take effect on the next calendar fetch (up to 10 minutes, or restart the backend to force an immediate refresh).

## Service account setup

The calendar widget requires a Google service account JSON key. Create one at [console.cloud.google.com](https://console.cloud.google.com):

1. APIs & Services → Credentials → **+ Create Credentials** → Service account
2. Enable the **Google Calendar API** for the project
3. Download the JSON key and save it to `config/google-sa.json`
4. Set `GOOGLE_SA_KEY_FILE=/config/google-sa.json` in `.env` (this is the default)
5. Set `GOOGLE_CALENDAR_ID` in `.env` if you want a primary calendar

The service account email (shown on the credentials page) is what you use in Step 3 above.
