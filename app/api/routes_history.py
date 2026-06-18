# app/api/routes_history.py
"""Historien-Endpoints: stats, sessions, daily, monthly, years, costs, export"""

import tempfile
from fastapi import APIRouter, Depends, Query, HTTPException
from fastapi.responses import FileResponse
from datetime import datetime
from typing import Optional

from app.models.db_manager import DbManager
from app.service.dishwasher_analytics import DishwasherAnalytics
from app.api.dependencies import get_db, get_analytics

router = APIRouter()


@router.get("/stats")
def api_stats(analytics: DishwasherAnalytics = Depends(get_analytics), db: DbManager = Depends(get_db)):
    costs = analytics.get_costs_for_year(datetime.now().year)
    return analytics.process_period_stats(db.get_stats(), costs)


@router.get("/sessions")
def api_sessions(
    limit: int = Query(default=50),
    db: DbManager = Depends(get_db),
    analytics: DishwasherAnalytics = Depends(get_analytics)
):
    all_costs = analytics.load_costs()
    return [analytics.enrich_single_session(s, all_costs) for s in db.get_sessions(limit=limit)]


@router.get("/daily")
def api_daily(
    days: int = Query(default=30),
    from_date: Optional[str] = Query(default=None, alias="from"),
    to_date: Optional[str] = Query(default=None, alias="to"),
    db: DbManager = Depends(get_db)
):
    if from_date and to_date:
        return db.get_daily_summary_range(from_date, to_date)
    return db.get_daily_summary(days=days)


@router.get("/monthly")
def api_monthly(
    year: Optional[str] = None,
    db: DbManager = Depends(get_db),
    analytics: DishwasherAnalytics = Depends(get_analytics)
):
    query_year = year or str(datetime.now().year)
    costs = analytics.get_costs_for_year(int(query_year))
    monthly = db.get_monthly_summary(year=query_year)
    return analytics.enrich_monthly(monthly, costs)


@router.get("/years")
def api_years(db: DbManager = Depends(get_db)):
    return db.get_available_years()


@router.get("/costs")
def api_costs(analytics: DishwasherAnalytics = Depends(get_analytics)):
    return analytics.load_costs()


@router.get("/export/csv")
def api_export_csv(db: DbManager = Depends(get_db)):
    """Export aller abgeschlossenen Sessions als CSV-Download."""
    tmp = tempfile.NamedTemporaryFile(delete=False, suffix=".csv")
    tmp.close()
    count = db.export_sessions_csv(tmp.name)
    if count == 0:
        raise HTTPException(status_code=404, detail="No sessions to export")
    filename = f"dishwasher_sessions_{datetime.now().strftime('%Y-%m-%d')}.csv"
    return FileResponse(tmp.name, media_type="text/csv", filename=filename)


@router.get("/config")
def api_config(analytics: DishwasherAnalytics = Depends(get_analytics)):
    return {"lang": analytics.load_lang()}
