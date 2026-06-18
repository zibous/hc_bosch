# app/api/dependencies.py
"""Shared FastAPI Dependencies für alle Router."""

from typing import Optional
from app.core.config import settings
from app.models.db_manager import DbManager
from app.service.dishwasher_analytics import DishwasherAnalytics
from app.service.sensor_reader import SensorReader


def get_db() -> DbManager:
    return DbManager(settings.DB_PATH)


def get_analytics() -> DishwasherAnalytics:
    return DishwasherAnalytics()


def get_sensors() -> Optional[SensorReader]:
    if settings.SENSOR_ENERGY_URL or settings.SENSOR_WATER_URL:
        return SensorReader(water_url=settings.SENSOR_WATER_URL, energy_url=settings.SENSOR_ENERGY_URL)
    return None


def get_state() -> dict:
    """Holt den aktuellen Gerätezustand aus data2mqtt."""
    from app.device.data2mqtt import get_current_state
    return get_current_state()
