# app/api/endpoints.py
"""API Router-Aggregator – bindet alle Sub-Router zusammen."""

from fastapi import APIRouter

from app.api.routes_live import router as live_router
from app.api.routes_history import router as history_router
from app.api.routes_combined import router as combined_router

router = APIRouter()

router.include_router(live_router)
router.include_router(history_router)
router.include_router(combined_router)
