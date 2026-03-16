"""
Google Calendar proxy.

Reads GOOGLE_CALENDAR_ID and GOOGLE_SA_KEY_FILE (path to service-account JSON)
from environment. Returns today's events and the next 7 days grouped by date.
Cache TTL: 10 minutes.
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from app.config import settings
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(tags=["calendar"])

_cache: dict[str, Any] = {}
_cache_ts: float = 0.0

_TZ = ZoneInfo("Europe/Amsterdam")

# Google Calendar colorId → hex (matches Google UI palette)
_COLOR_MAP: dict[str, str] = {
    "1":  "#D50000",  # Tomato
    "2":  "#E67C73",  # Flamingo
    "3":  "#F4511E",  # Tangerine
    "4":  "#F6BF26",  # Banana
    "5":  "#33B679",  # Sage
    "6":  "#0B8043",  # Basil
    "7":  "#039BE5",  # Peacock
    "8":  "#3F51B5",  # Blueberry
    "9":  "#7986CB",  # Lavender
    "10": "#8E24AA",  # Grape
    "11": "#616161",  # Graphite
}

_NL_DAYS   = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"]
_NL_MONTHS = ["", "jan", "feb", "mrt", "apr", "mei", "jun",
               "jul", "aug", "sep", "okt", "nov", "dec"]


def _fetch_events() -> dict:
    """Synchronous Google API call — run via asyncio.to_thread."""
    from google.oauth2 import service_account          # type: ignore
    from googleapiclient.discovery import build        # type: ignore

    now = datetime.now(_TZ)
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_window      = start_of_today + timedelta(days=8)

    creds = service_account.Credentials.from_service_account_file(
        settings.google_sa_key_file,
        scopes=["https://www.googleapis.com/auth/calendar.readonly"],
    )
    service = build("calendar", "v3", credentials=creds, cache_discovery=False)

    result = service.events().list(
        calendarId=settings.google_calendar_id,
        timeMin=start_of_today.isoformat(),
        timeMax=end_window.isoformat(),
        singleEvents=True,
        orderBy="startTime",
        maxResults=50,
    ).execute()

    items = result.get("items", [])

    def _parse(item: dict) -> dict:
        start_raw = item.get("start", {})
        end_raw   = item.get("end",   {})
        all_day   = "dateTime" not in start_raw

        color_id = item.get("colorId")
        color    = _COLOR_MAP.get(color_id) if color_id else None

        if all_day:
            date_str   = start_raw["date"]
            start_time = None
            end_time   = None
        else:
            start_dt   = datetime.fromisoformat(start_raw["dateTime"]).astimezone(_TZ)
            end_dt     = datetime.fromisoformat(end_raw["dateTime"]).astimezone(_TZ)
            date_str   = start_dt.strftime("%Y-%m-%d")
            start_time = start_dt.strftime("%H:%M")
            end_time   = end_dt.strftime("%H:%M")

        return {
            "id":         item.get("id", ""),
            "title":      item.get("summary", "(geen titel)"),
            "all_day":    all_day,
            "start_time": start_time,
            "end_time":   end_time,
            "date":       date_str,
            "color":      color,
            "location":   item.get("location"),
        }

    today_str    = now.strftime("%Y-%m-%d")
    today_events: list[dict] = []
    week_by_date: dict[str, list[dict]] = {}

    for item in items:
        ev = _parse(item)
        if ev["date"] == today_str:
            today_events.append(ev)
        elif ev["date"] > today_str:
            week_by_date.setdefault(ev["date"], []).append(ev)

    week_days = []
    for date_str in sorted(week_by_date):
        dt = datetime.fromisoformat(date_str)
        week_days.append({
            "date":       date_str,
            "day_label":  _NL_DAYS[dt.weekday()],
            "date_label": f"{dt.day} {_NL_MONTHS[dt.month]}",
            "events":     week_by_date[date_str],
        })

    return {
        "today":       today_events,
        "week":        week_days,
        "today_label": f"{_NL_DAYS[now.weekday()]} {now.day} {_NL_MONTHS[now.month]}",
    }


@router.get("/calendar")
async def get_calendar() -> dict:
    global _cache, _cache_ts

    if not settings.google_calendar_id or not settings.google_sa_key_file:
        raise HTTPException(status_code=503, detail="Calendar not configured")

    if _cache and (time.monotonic() - _cache_ts) < settings.calendar_cache_ttl:
        return _cache

    try:
        data = await asyncio.to_thread(_fetch_events)
        _cache = data
        _cache_ts = time.monotonic()
        return _cache

    except ImportError:
        logger.error("google-api-python-client is not installed")
        raise HTTPException(status_code=503, detail="google-api-python-client not installed")
    except Exception as exc:
        logger.error("Calendar fetch failed: %s", exc)
        if _cache:
            return _cache
        raise HTTPException(status_code=502, detail=f"Calendar error: {exc}")
