# app/api/routes_live.py
"""Live-Status-Endpoints: health, status, live, session/live"""

from fastapi import APIRouter, Depends, HTTPException
from typing import Optional

from app.models.db_manager import DbManager
from app.service.dishwasher_analytics import DishwasherAnalytics
from app.service.sensor_reader import SensorReader
from app.api.dependencies import get_db, get_analytics, get_sensors, get_state

router = APIRouter()


@router.get("/health")
def api_health(db: DbManager = Depends(get_db), state: dict = Depends(get_state)):
    stats = db.get_stats()
    return {
        "status": "ok",
        "device_connected": bool(state.get("state")),
        "total_sessions": stats["total_sessions"],
        "last_update": state.get("lastupdate", ""),
    }


@router.get("/status")
def api_status(state: dict = Depends(get_state)):
    if not state:
        raise HTTPException(status_code=404, detail="No data yet")
    return state


@router.get("/session/live")
def api_session_live(
    db: DbManager = Depends(get_db),
    analytics: DishwasherAnalytics = Depends(get_analytics)
):
    session_id = db.get_current_session_id()
    active = session_id is not None
    session_data = db.get_last_session() if not session_id else None

    if not session_id and session_data:
        session_id = session_data.get("id")
    if not session_id:
        return {"active": False, "readings": []}

    readings = db.get_session_readings(session_id)
    processed_readings = analytics.process_live_session_readings(readings, session_data, active)
    return {"active": active, "session_id": session_id, "readings": processed_readings}


@router.get("/live")
def api_live(
    db: DbManager = Depends(get_db),
    analytics: DishwasherAnalytics = Depends(get_analytics),
    sensors: Optional[SensorReader] = Depends(get_sensors),
    state: dict = Depends(get_state)
):
    result = {"state": state}
    if state.get("state") in ("Run", "DelayedStart", "Pause") and sensors and sensors.has_energy_sensor:
        result["current_power_w"] = sensors.read_energy_power_w()

    result["today"] = db.get_today_stats()
    result["last_session"] = analytics.enrich_single_session(db.get_last_session())
    return result
