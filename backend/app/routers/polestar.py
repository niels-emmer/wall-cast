"""
Polestar car data proxy via the unofficial-polestar-api library (gRPC/C3 backend).
Returns battery SOC, range, charging status, odometer, tyre pressures, exterior
status and health warnings.

Credentials are read from env vars POLESTAR_USERNAME / POLESTAR_PASSWORD.
If credentials are not set the endpoint returns a 503 (not configured).
Cache TTL: 5 minutes.
"""

import logging
import time
from typing import Any

from app import cache_registry
from app.config import settings
from fastapi import APIRouter, HTTPException

logger = logging.getLogger(__name__)
router = APIRouter(tags=["polestar"])

_cache: dict[str, Any] = {}
_cache_ts: float = 0.0


def _enum_name(value) -> str | None:
    """Return the .name of an IntEnum, or None if it is UNSPECIFIED / 0."""
    if value is None or value == 0:
        return None
    return value.name


def _no_warn(name: str | None) -> bool:
    return name is None or name in ("NO_WARNING", "UNSPECIFIED")


@router.get("/polestar")
async def get_polestar() -> dict:
    global _cache, _cache_ts

    if not settings.polestar_username or not settings.polestar_password:
        raise HTTPException(status_code=503, detail="Polestar credentials not configured")

    if _cache and (time.monotonic() - _cache_ts) < settings.polestar_cache_ttl:
        return _cache

    try:
        from polestar_api import PolestarApi  # type: ignore

        async with PolestarApi(
            email=settings.polestar_username,
            password=settings.polestar_password,
        ) as api:
            vehicles = await api.get_vehicles()
            if not vehicles:
                raise ValueError("No vehicles found on this Polestar account")

            car = vehicles[0]

            # Fetch all data concurrently where possible
            import asyncio

            battery, odometer, health, exterior, availability, dashboard = await asyncio.gather(
                car.get_battery(),
                car.get_odometer(),
                car.get_health(),
                car.get_exterior(),
                car.get_availability(),
                car.get_dashboard(),
                return_exceptions=True,
            )

            # Replace exceptions with None so partial data still works
            if isinstance(battery, Exception):
                logger.warning("Polestar battery fetch failed: %s", battery)
                battery = None
            if isinstance(odometer, Exception):
                logger.warning("Polestar odometer fetch failed: %s", odometer)
                odometer = None
            if isinstance(health, Exception):
                logger.warning("Polestar health fetch failed: %s", health)
                health = None
            if isinstance(exterior, Exception):
                logger.warning("Polestar exterior fetch failed: %s", exterior)
                exterior = None
            if isinstance(availability, Exception):
                logger.warning("Polestar availability fetch failed: %s", availability)
                availability = None
            if isinstance(dashboard, Exception):
                logger.warning("Polestar dashboard fetch failed: %s", dashboard)
                dashboard = None

            # --- Battery ---
            charging_status = _enum_name(battery.charging_status) if battery else None
            connection_status = _enum_name(battery.charger_connection_status) if battery else None
            charging_type = _enum_name(battery.charging_type) if battery else None

            # --- Odometer ---
            odometer_km = round(odometer.odometer_km) if odometer else None

            # avg speed comes from dashboard when odometer doesn't carry it
            avg_speed_kmh = None
            if dashboard and dashboard.dashboard_data:
                avg_speed_kmh = dashboard.dashboard_data.avg_speed_auto or dashboard.dashboard_data.avg_speed_manual or None

            # --- Health ---
            service_warning = None
            days_to_service = None
            distance_to_service_km = None
            brake_fluid_warning = None
            coolant_warning = None
            oil_warning = None
            washer_fluid_warning = None
            low_12v_battery = False
            any_light_failure = False
            tyre_warnings: dict[str, str | None] = {"fl": None, "fr": None, "rl": None, "rr": None}
            tyre_pressure_kpa: dict[str, float | None] = {"fl": None, "fr": None, "rl": None, "rr": None}

            if health:
                sw = _enum_name(health.service_warning)
                if not _no_warn(sw):
                    service_warning = sw
                days_to_service = health.days_to_service or None
                distance_to_service_km = round(health.distance_to_service_km) if health.distance_to_service_km else None

                bfw = _enum_name(health.brake_fluid_level_warning)
                if not _no_warn(bfw):
                    brake_fluid_warning = bfw

                ecw = _enum_name(health.engine_coolant_level_warning)
                if not _no_warn(ecw):
                    coolant_warning = ecw

                olw = _enum_name(health.oil_level_warning)
                if not _no_warn(olw):
                    oil_warning = olw

                wfw = _enum_name(health.washer_fluid_level_warning)
                if not _no_warn(wfw):
                    washer_fluid_warning = wfw

                # 12V battery
                b12 = _enum_name(health.low_voltage_battery_warning)
                low_12v_battery = b12 is not None and b12 != "NO_WARNING"

                # Light bulb failures (uses library helper)
                any_light_failure = health.any_light_failure

                # Tyre pressure warnings
                for side, attr in (
                    ("fl", "front_left_tyre_pressure_warning"),
                    ("fr", "front_right_tyre_pressure_warning"),
                    ("rl", "rear_left_tyre_pressure_warning"),
                    ("rr", "rear_right_tyre_pressure_warning"),
                ):
                    tw = _enum_name(getattr(health, attr, None))
                    if not _no_warn(tw):
                        tyre_warnings[side] = tw

                # Tyre pressure kPa values (0.0 means not available)
                for side, attr in (
                    ("fl", "front_left_tyre_pressure_kpa"),
                    ("fr", "front_right_tyre_pressure_kpa"),
                    ("rl", "rear_left_tyre_pressure_kpa"),
                    ("rr", "rear_right_tyre_pressure_kpa"),
                ):
                    kpa = getattr(health, attr, 0.0)
                    tyre_pressure_kpa[side] = round(kpa, 1) if kpa and kpa > 0 else None

            # --- Exterior ---
            is_locked = None
            any_door_open = False
            if exterior:
                is_locked = exterior.is_locked
                any_door_open = exterior.any_door_open

            # --- Availability ---
            is_online = None
            if availability is not None:
                try:
                    # Availability model has an `available` bool or similar
                    is_online = bool(getattr(availability, "available", None))
                except Exception:
                    pass

            _cache = {
                # --- existing fields (same semantics, remapped names) ---
                "soc": battery.charge_level if battery else None,
                "range_km": battery.range_km if battery else None,
                "charging_status": charging_status,
                "charging_connection_status": connection_status,
                "charging_time_min": battery.time_to_full if battery else None,
                "charging_power_watts": battery.power_watts if battery else None,
                "charging_current_amps": battery.current_amps if battery else None,
                "odometer_km": odometer_km,
                "avg_consumption_kwh_per_100km": battery.avg_consumption if battery else None,
                "avg_speed_kmh": avg_speed_kmh,
                "trip_auto_km": odometer.trip_meter_automatic_km if odometer else None,
                "trip_manual_km": odometer.trip_meter_manual_km if odometer else None,
                "days_to_service": days_to_service,
                "distance_to_service_km": distance_to_service_km,
                "service_warning": service_warning,
                "brake_fluid_warning": brake_fluid_warning,
                "coolant_warning": coolant_warning,
                "oil_warning": oil_warning,
                # --- new fields ---
                "charging_type": charging_type,
                "voltage_volts": battery.voltage_volts if battery else None,
                "washer_fluid_warning": washer_fluid_warning,
                "low_12v_battery": low_12v_battery,
                "any_light_failure": any_light_failure,
                "tyre_warnings": tyre_warnings,
                "tyre_pressure_kpa": tyre_pressure_kpa,
                "is_locked": is_locked,
                "any_door_open": any_door_open,
                "is_online": is_online,
            }
            _cache_ts = time.monotonic()
            cache_registry.update("polestar", ok=True)
            return _cache

    except ImportError:
        logger.error("unofficial-polestar-api is not installed")
        raise HTTPException(status_code=503, detail="polestar_api not installed")
    except Exception as exc:
        logger.error("Polestar fetch failed: %s", exc)
        cache_registry.update("polestar", ok=False)
        if _cache:
            return _cache
        raise HTTPException(status_code=502, detail=f"Polestar API error: {exc}")
