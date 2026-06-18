from pydantic import BaseModel
from datetime import datetime
from typing import Optional

class CurrentStateSchema(BaseModel):
    state: str
    program: str
    phase: str
    progress: int
    remaining_time: str
    tabs_remaining: int
    door_closed: bool

class SessionSummarySchema(BaseModel):
    id: int
    date: datetime
    program: str
    duration_min: float
    cost_total: float
    energy_kwh: float
    water_liters: float
