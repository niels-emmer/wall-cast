"""
Polestar car data proxy via the pypolestar library.
Returns battery SOC, range, charging status and odometer.

Credentials are read from env vars POLESTAR_USERNAME / POLESTAR_PASSWORD.
If credentials are not set the endpoint returns a 503 (not configured).
Cache TTL: 5 minutes.
"""

import logging
import time
from typing import Any

from app.config import settings
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(tags=["polestar"])

_cache: dict[str, Any] = {}
_cache_ts: float = 0.0


@router.get("/polestar")
async def get_polestar() -> dict:
    global _cache, _cache_ts

    if not settings.polestar_username or not settings.polestar_password:
        raise HTTPException(status_code=503, detail="Polestar credentials not configured")

    if _cache and (time.monotonic() - _cache_ts) < settings.polestar_cache_ttl:
        return _cache

    try:
        from pypolestar import PolestarApi  # type: ignore

        api = PolestarApi(
            username=settings.polestar_username,
            password=settings.polestar_password,
        )
        await api.async_init()

        vins = api.get_available_vins()
        if not vins:
            raise ValueError("No vehicles found on this Polestar account")

        vin = vins[0]

        # Must call update_latest_data before the getter has anything to return
        await api.update_latest_data(vin=vin, update_telematics=True)

        telematics = api.get_car_telematics(vin)
        if telematics is None:
            raise ValueError("Telematics returned None after update")

        battery = telematics.battery
        odometer = telematics.odometer

        charging_status = None
        if battery and battery.charging_status is not None:
            charging_status = battery.charging_status.name

        connection_status = None
        if battery and battery.charger_connection_status is not None:
            connection_status = battery.charger_connection_status.name

        odometer_km = None
        if odometer and odometer.odometer_meters is not None:
            odometer_km = round(odometer.odometer_meters / 1000)

        health = telematics.health

        service_warning = None
        days_to_service = None
        distance_to_service_km = None
        if health:
            if health.service_warning is not None:
                sw = health.service_warning.name
                if sw not in ("SERVICE_WARNING_NO_WARNING", "SERVICE_WARNING_UNSPECIFIED", "NO_WARNING", "UNSPECIFIED"):
                    service_warning = sw
            if health.days_to_service is not None:
                days_to_service = health.days_to_service
            if health.distance_to_service_km is not None:
                distance_to_service_km = round(health.distance_to_service_km)

        _cache = {
            "soc": battery.battery_charge_level_percentage if battery else None,
            "range_km": battery.estimated_distance_to_empty_km if battery else None,
            "charging_status": charging_status,
            "charging_connection_status": connection_status,
            "charging_time_min": battery.estimated_charging_time_to_full_minutes if battery else None,
            "charging_power_watts": battery.charging_power_watts if battery else None,
            "charging_current_amps": battery.charging_current_amps if battery else None,
            "odometer_km": odometer_km,
            "avg_consumption_kwh_per_100km": battery.average_energy_consumption_kwh_per_100km if battery else None,
            "avg_speed_kmh": odometer.average_speed_km_per_hour if odometer else None,
            "trip_auto_km": odometer.trip_meter_automatic_km if odometer else None,
            "trip_manual_km": odometer.trip_meter_manual_km if odometer else None,
            "days_to_service": days_to_service,
            "distance_to_service_km": distance_to_service_km,
            "service_warning": service_warning,
        }
        _cache_ts = time.monotonic()

        try:
            await api.async_logout()
        except Exception:
            pass

        return _cache

    except ImportError:
        logger.error("pypolestar is not installed")
        raise HTTPException(status_code=503, detail="pypolestar not installed")
    except Exception as exc:
        logger.error("Polestar fetch failed: %s", exc)
        if _cache:
            return _cache
        raise HTTPException(status_code=502, detail=f"Polestar API error: {exc}")
