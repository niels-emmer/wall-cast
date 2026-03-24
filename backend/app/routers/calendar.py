"""
Google Calendar proxy.

Accepts calendar_ids as a repeated query param (?calendar_ids=id1&calendar_ids=id2).
Falls back to GOOGLE_CALENDAR_ID env var if no IDs supplied.

For each calendar ID:
  - Fetches the calendar's background color from calendarList (used as per-event fallback)
  - Lists events for the next 60 days

Events are merged across all calendars and deduplicated by event ID.
Cache TTL: 10 minutes, keyed by sorted calendar_ids.
"""

import asyncio
import logging
import time
from datetime import datetime, timedelta
from typing import Any
from zoneinfo import ZoneInfo

from app.config import settings
from fastapi import APIRouter, HTTPException, Query

logger = logging.getLogger(__name__)
router = APIRouter(tags=["calendar"])

# The Google API client library logs 403s at WARNING before raising them.
# We handle these exceptions ourselves (shared calendars often 403 on calendarList
# but still allow events.list), so suppress the library's own noise.
logging.getLogger("googleapiclient.http").setLevel(logging.ERROR)

_cache: dict[str, Any] = {}      # keyed by sorted-ids string
_cache_ts: dict[str, float] = {}

_TZ = ZoneInfo(settings.timezone)

# Populated at runtime from colors.list() — keyed by colorId string → hex background.
_event_colors: dict[str, str] = {}

_NL_DAYS   = ["Ma", "Di", "Wo", "Do", "Vr", "Za", "Zo"]
_NL_MONTHS = ["", "jan", "feb", "mrt", "apr", "mei", "jun",
               "jul", "aug", "sep", "okt", "nov", "dec"]


def _fetch_events(calendar_ids: list[str]) -> dict:
    """Synchronous Google API call — run via asyncio.to_thread."""
    from google.oauth2 import service_account          # type: ignore
    from googleapiclient.discovery import build        # type: ignore

    now = datetime.now(_TZ)
    start_of_today = now.replace(hour=0, minute=0, second=0, microsecond=0)
    end_window      = start_of_today + timedelta(days=60)

    creds = service_account.Credentials.from_service_account_file(
        settings.google_sa_key_file,
        scopes=["https://www.googleapis.com/auth/calendar.readonly"],
    )
    service = build("calendar", "v3", credentials=creds, cache_discovery=False)

    # Fetch the authoritative event color palette once.
    global _event_colors
    try:
        colors_resp = service.colors().get().execute()
        _event_colors = {
            cid: meta["background"]
            for cid, meta in colors_resp.get("event", {}).items()
        }
        logger.info("Fetched %d event colors from Google", len(_event_colors))
    except Exception as exc:
        logger.warning("Could not fetch color palette: %s", exc)

    # For each calendar: get background color + list events.
    cal_colors: dict[str, str | None] = {}
    all_items: list[dict] = []

    for cal_id in calendar_ids:
        # Background color from calendarList entry (used as per-event fallback).
        # Service accounts need the calendar in their list; insert it if missing.
        cal_color: str | None = None
        try:
            entry = service.calendarList().get(calendarId=cal_id).execute()
            cal_color = entry.get("backgroundColor")
            logger.info("Calendar %s backgroundColor: %s", cal_id, cal_color)
        except Exception:
            try:
                service.calendarList().insert(body={"id": cal_id}).execute()
                entry = service.calendarList().get(calendarId=cal_id).execute()
                cal_color = entry.get("backgroundColor")
                logger.info("Subscribed service account to %s, backgroundColor: %s", cal_id, cal_color)
            except Exception as exc2:
                logger.debug("Could not get calendar color for %s: %s", cal_id, exc2)
        cal_colors[cal_id] = cal_color

        # Fetch events
        try:
            result = service.events().list(
                calendarId=cal_id,
                timeMin=start_of_today.isoformat(),
                timeMax=end_window.isoformat(),
                singleEvents=True,
                orderBy="startTime",
                maxResults=50,
            ).execute()
            items = result.get("items", [])
            # Tag each item with its source calendar ID for color resolution
            for item in items:
                item["_calendar_id"] = cal_id
            all_items.extend(items)
            logger.info("Fetched %d events from calendar %s", len(items), cal_id)
        except Exception as exc:
            logger.error("Events fetch failed for calendar %s: %s", cal_id, exc)

    # Deduplicate by event ID — first occurrence wins (preserves order).
    seen_ids: set[str] = set()
    deduped: list[dict] = []
    for item in all_items:
        event_id = item.get("id", "")
        if event_id and event_id in seen_ids:
            continue
        seen_ids.add(event_id)
        deduped.append(item)

    # Sort chronologically so personal-calendar events on earlier dates
    # are not crowded out by family-calendar events on later dates.
    deduped.sort(key=lambda item: (
        item.get("start", {}).get("dateTime")
        or item.get("start", {}).get("date")
        or ""
    ))

    def _parse(item: dict) -> dict:
        start_raw = item.get("start", {})
        end_raw   = item.get("end",   {})
        all_day   = "dateTime" not in start_raw

        color_id = item.get("colorId")
        cal_id   = item.get("_calendar_id", "")
        # Prefer event's own colorId; fall back to this calendar's background color.
        color = _event_colors.get(str(color_id)) if color_id else cal_colors.get(cal_id)
        logger.debug("Event %r colorId=%r → %s", item.get("summary", "?"), color_id, color)

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
    upcoming_count = 0

    for item in deduped:
        ev = _parse(item)
        if ev["date"] == today_str:
            # Drop timed events that have already finished today.
            if not ev["all_day"]:
                end_raw = item.get("end", {}).get("dateTime")
                if end_raw:
                    end_dt = datetime.fromisoformat(end_raw).astimezone(_TZ)
                    if end_dt <= now:
                        continue
            today_events.append(ev)
        elif ev["date"] > today_str:
            if upcoming_count >= 8:
                continue
            week_by_date.setdefault(ev["date"], []).append(ev)
            upcoming_count += 1

    # Sort today's events: timed first (by start time), then all-day
    today_events.sort(key=lambda e: (e["start_time"] is None, e["start_time"] or ""))

    week_days = []
    for date_str in sorted(week_by_date)[:3]:
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
async def get_calendar(
    calendar_ids: list[str] = Query(default=[]),
) -> dict:
    global _cache, _cache_ts

    ids = calendar_ids if calendar_ids else (
        [settings.google_calendar_id] if settings.google_calendar_id else []
    )

    if not ids or not settings.google_sa_key_file:
        raise HTTPException(status_code=503, detail="Calendar not configured")

    cache_key = ":".join(sorted(ids))

    if cache_key in _cache and (time.monotonic() - _cache_ts.get(cache_key, 0)) < settings.calendar_cache_ttl:
        return _cache[cache_key]

    try:
        data = await asyncio.to_thread(_fetch_events, ids)
        _cache[cache_key] = data
        _cache_ts[cache_key] = time.monotonic()
        return _cache[cache_key]

    except ImportError:
        logger.error("google-api-python-client is not installed")
        raise HTTPException(status_code=503, detail="google-api-python-client not installed")
    except Exception as exc:
        logger.error("Calendar fetch failed: %s", exc)
        if cache_key in _cache:
            return _cache[cache_key]
        raise HTTPException(status_code=502, detail=f"Calendar error: {exc}")
