#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Session tracker for dishwasher wash cycles.

Detects OperationState transitions to track start/end of wash cycles.
Reads external sensors (water meter, energy meter) at start/end for
real consumption measurement.
"""

import os

import logging
from app.models.db_manager import DbManager
from app.service.sensor_reader import SensorReader
from app.core.config import settings as app_config

logger = logging.getLogger(__name__)


class SessionTracker:
    """Track dishwasher wash cycles based on state changes."""

    _RUNNING_STATES = {"Run", "DelayedStart", "Pause", "ActionRequired"}
    _FINISHED_STATES = {"Finished", "Ready", "Inactive"}

    def __init__(self, db: DbManager, sensors: SensorReader | None = None,
                 session_writer=None):
        self.db = db
        self.sensors = sensors
        self.session_writer = session_writer
        self._current_session_id: int | None = None
        self._last_state: str | None = None
        self._was_running = False
        self._on_session_end_cb = None

    def on_session_end(self, callback) -> None:
        """Register a callback for session end events.

        Callback receives (session_id: int, result: str, session_data: dict).
        """
        self._on_session_end_cb = callback

    @property
    def is_running(self) -> bool:
        """True if a session is currently active."""
        return self._was_running

    def update(self, state: dict) -> None:
        """Process a state update and track session transitions."""
        op_state = state.get("state")
        if not op_state:
            return

        # Log state to DB
        self.db.log_state(state)

        # Detect transitions
        if op_state in self._RUNNING_STATES and not self._was_running:
            self._start_session(state)

        elif op_state in self._FINISHED_STATES and self._was_running:
            self._end_session(state, op_state)

        self._last_state = op_state

    def _start_session(self, state: dict) -> None:
        """Handle session start – read sensor values and create DB record."""
        self._was_running = True

        # Read sensor start values
        energy_start = None
        water_start = None
        if self.sensors:
            if self.sensors.has_energy_sensor:
                energy_start = self.sensors.read_energy_kwh()
            if self.sensors.has_water_sensor:
                water_start = self.sensors.read_water_m3()

        self._current_session_id = self.db.start_session(
            energy_forecast=_int(state.get("energyforecast", 0)),
            water_forecast=_int(state.get("waterforecast", 0)),
            program=state.get("programm", ""),
            energy_kwh_start=energy_start,
            water_m3_start=water_start,
        )
        logger.info(f"Session started (id={self._current_session_id})")

        # Session CSV starten
        if self.session_writer:
            from datetime import datetime
            self.session_writer.start_session(
                start_time=datetime.now().isoformat(timespec="seconds"),
                program=state.get("programm", ""),
            )

    def _end_session(self, state: dict, op_state: str) -> None:
        """Handle session end – read sensor values and update DB record."""
        self._was_running = False

        if not self._current_session_id:
            return

        # Read sensor end values
        energy_end = None
        water_end = None
        if self.sensors:
            if self.sensors.has_energy_sensor:
                energy_end = self.sensors.read_energy_kwh()
            if self.sensors.has_water_sensor:
                water_end = self.sensors.read_water_m3()

        result = "finished" if op_state == "Finished" else "aborted"
        self.db.end_session(
            self._current_session_id,
            result=result,
            phase=state.get("programm", ""),
            energy_kwh_end=energy_end,
            water_m3_end=water_end,
        )
        logger.info(f"Session ended (id={self._current_session_id}, result={result})")

        # Session CSV beenden
        if self.session_writer:
            self.session_writer.end_session()

        # Export sessions to CSV
        try:
            csv_path = os.path.join(app_config.DATA_DIR, "history", "sessions.csv")
            self.db.export_sessions_csv(csv_path)
        except Exception as e:
            logger.error(f"CSV export error: {e}")

        # Send webhook to Home Assistant (if configured)
        self._send_webhook(result, energy_end, water_end)

        # Fire callback so data2mqtt can reset the shared state
        if self._on_session_end_cb:
            try:
                session_data = self.db.get_last_session() or {}
                self._on_session_end_cb(self._current_session_id, result, session_data)
            except Exception as e:
                logger.warning(f"Session end callback error: {e}")

        self._current_session_id = None

    def _send_webhook(self, result: str, energy_end=None, water_end=None) -> None:
        """Send session data + summary to Home Assistant via webhook."""
        try:
            from app.infrastructure.webhooks import notify_ha, notify_session_summary
            from app.device.data2mqtt import _tabs_remaining

            session = self.db.get_last_session()
            if not session:
                return

            # Event: session_end (raw data)
            notify_ha(
                "session_end",
                result=result,
                program=session.get("program", ""),
                duration_min=session.get("duration_min", 0),
                energy_kwh=session.get("energy_kwh", 0),
                water_liters=session.get("water_liters", 0),
                tabs_remaining=_tabs_remaining,
            )

            # Event: session_summary (with costs)
            try:
                import yaml
                from pathlib import Path
                from datetime import datetime
                costs_file = Path(__file__).parent.parent / "config" / "costs.yaml"
                costs = {}
                if costs_file.is_file():
                    with open(costs_file, "r", encoding="utf8") as f:
                        all_costs = yaml.safe_load(f) or {}
                    year = datetime.now().year
                    costs = all_costs.get(year, {})
                    if not costs and all_costs:
                        costs = all_costs[max(all_costs.keys())]
                notify_session_summary(session, costs)
            except Exception:
                pass

        except Exception as e:
            logger.warning(f"Webhook error: {e}")


def _int(val) -> int:
    try:
        return int(val)
    except (TypeError, ValueError):
        return 0
