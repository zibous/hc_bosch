# app/api/routes_combined.py
"""Merged alldata-Endpoint + KPI"""

import threading
from fastapi import APIRouter, Depends, Query, Request, HTTPException
from datetime import datetime
from typing import Optional

from app.models.db_manager import DbManager
from app.service.dishwasher_analytics import DishwasherAnalytics
from app.service.sensor_reader import SensorReader
from app.core.config import settings
from app.api.dependencies import get_db, get_analytics, get_sensors, get_state

router = APIRouter()


@router.get("/alldata")
def api_all_data(
    days: int = Query(default=14),
    limit: int = Query(default=50),
    year: Optional[int] = None,
    db: DbManager = Depends(get_db),
    analytics: DishwasherAnalytics = Depends(get_analytics),
    sensors: Optional[SensorReader] = Depends(get_sensors),
    state: dict = Depends(get_state)
):
    query_year = year or datetime.now().year
    stats = db.get_stats()
    all_costs = analytics.load_costs()
    costs = analytics.get_costs_for_year(datetime.now().year, all_costs)
    last_session_raw = db.get_last_session()

    health = {
        "status": "ok",
        "device_connected": bool(state.get("state")),
        "total_sessions": stats["total_sessions"],
        "last_update": state.get("lastupdate", "")
    }

    live = {"state": state, "today": db.get_today_stats()}
    if state.get("state") in ("Run", "DelayedStart", "Pause") and sensors and sensors.has_energy_sensor:
        live["current_power_w"] = sensors.read_energy_power_w()
    live["last_session"] = analytics.enrich_single_session(dict(last_session_raw) if last_session_raw else {}, all_costs)

    session_id = db.get_current_session_id()
    active = session_id is not None
    s_data = last_session_raw if not session_id else None
    if not session_id and s_data:
        session_id = s_data.get("id")

    readings = db.get_session_readings(session_id) if session_id else []
    session_live = {"active": active, "session_id": session_id, "readings": analytics.process_live_session_readings(readings, s_data, active)}

    sessions_list = [analytics.enrich_single_session(s, all_costs) for s in db.get_sessions(limit=limit)]
    monthly = analytics.enrich_monthly(db.get_monthly_summary(year=str(query_year)), costs)

    return {
        "health": health,
        "status": state if state else {"error": "No data yet"},
        "live": live,
        "session_live": session_live,
        "stats": analytics.process_period_stats(stats, costs),
        "sessions": sessions_list,
        "daily": db.get_daily_summary(days=days),
        "monthly": monthly,
        "years": db.get_available_years(),
        "costs": all_costs,
        "config": {"lang": analytics.load_lang()}
    }


from app.schemas.kpi import KpiHero, KpiIndicator, KpiResponse

@router.get("/kpidata", response_model=KpiResponse, response_model_exclude_none=True)
def api_kpidata(db: DbManager = Depends(get_db), state: dict = Depends(get_state)):
    """KPI-Daten für das zentrale Übersichts-Dashboard."""

    now = datetime.now()

    try:
        today = db.get_today_stats()
        last_session = db.get_last_session()
        stats = db.get_stats()

        device_state = state.get("state", "") if state else ""
        is_running = device_state in ("Run", "DelayedStart", "Pause")

        # Label zusammenbauen
        label_parts = []
        if is_running:
            program = state.get("programm", "")
            progress = state.get("progress", 0)
            label_parts.append(f"{program} {progress}%")
        else:
            label_parts.append("Standby")

        if today.get("sessions", 0) > 0:
            label_parts.append(f"{today['sessions']} Spülgang{'e' if today['sessions'] > 1 else ''} heute")

        label = " · ".join(label_parts)

        # Hero: Monat Sessions
        month_sessions = stats.get("month_sessions", 0)

        # Detail: letzte Session
        detail = ""
        if last_session:
            ls_time = last_session.get("start_time", "")[:10]
            ls_program = last_session.get("program", "")
            detail = f"Letzter: {ls_program} · {ls_time}"

        # Sparkline: Sessions pro Tag letzte 7 Tage
        daily = db.get_daily_summary(days=7)
        sparkline = [d.get("sessions_count", 0) for d in daily] if daily else []

        indicator = KpiIndicator(type="sparkline", values=sparkline) if sparkline else None

        return KpiResponse(
            app_id="hc_bosch",
            app_name="Geschirrspüler",
            icon="dishwasher",
            url=f"http://nuc:{settings.DASHBOARD_PORT}",
            status="ok",
            ts=now.isoformat(timespec="seconds"),
            hero=KpiHero(
                value=month_sessions,
                unit="Spülgänge",
                label=label,
            ),
            detail=detail,
            indicator=indicator,
        )
    except Exception as e:
        return KpiResponse(
            app_id="hc_bosch",
            app_name="Geschirrspüler",
            icon="dishwasher",
            url=f"http://nuc:{settings.DASHBOARD_PORT}",
            status="error",
            ts=datetime.now().isoformat(timespec="seconds"),
            hero=KpiHero(value="–", unit="", label=str(e)),
        )


@router.get("/threads")
def api_threads(request: Request):
    """Diagnose: Listet alle aktiven Hintergrund-Threads."""
    active_threads = []
    for thread in threading.enumerate():
        active_threads.append({
            "name": thread.name,
            "id": thread.ident,
            "is_alive": thread.is_alive(),
            "is_daemon": thread.daemon
        })

    sensors = request.app.state.sensors
    get_state_fn = request.app.state.get_state_fn
    current_state = get_state_fn() if get_state_fn else {}

    return {
        "total_active_threads": len(active_threads),
        "threads": active_threads,
        "monitored_hardware": {
            "bosch_machine_connected": bool(current_state.get("state")),
            "bosch_current_phase": current_state.get("phase", "Standby"),
            "polling_interval_active": "30s" if current_state.get("state") in ("Run", "DelayedStart", "Pause") else "120s",
            "energy_sensor_configured": sensors.has_energy_sensor if sensors else False,
            "water_sensor_configured": sensors.has_water_sensor if sensors else False
        }
    }
