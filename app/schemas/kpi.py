# app/schemas/kpi.py
"""Einheitliches KPI-Schema für das Übersichts-Dashboard."""

from typing import Any
from pydantic import BaseModel


class KpiIndicator(BaseModel):
    type: str
    min: float | None = None
    max: float | None = None
    value: float | None = None
    values: list[float] | None = None
    zones: list[dict[str, Any]] | None = None
    trend_pct: float | None = None


class KpiHero(BaseModel):
    value: float | int | str
    unit: str = ""
    label: str = ""


class KpiMetric(BaseModel):
    """Einzelne Kennzahl für die Detailansicht."""
    label: str
    value: str | float | int
    unit: str = ""


class KpiResponse(BaseModel):
    app_id: str
    app_name: str
    icon: str = ""
    url: str = ""
    status: str = "ok"
    ts: str
    hero: KpiHero
    detail: str = ""
    indicator: KpiIndicator | None = None
    metrics: list[KpiMetric] | None = None
