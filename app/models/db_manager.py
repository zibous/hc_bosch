#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
SQLite database manager for dishwasher session tracking.

Tracks wash cycles (sessions), energy/water forecasts, and daily summaries.
"""

import sqlite3
import os
import threading
from datetime import datetime, date

import logging
logger = logging.getLogger(__name__) # Nutzt automatisch die Konfiguration aus app.py



class DbManager:
    """SQLite database for dishwasher session and usage tracking."""

    def __init__(self, db_path: str):
        self.db_path = db_path
        self._lock = threading.Lock()
        self._init_db()

    def _get_conn(self) -> sqlite3.Connection:
        conn = sqlite3.connect(self.db_path, check_same_thread=False)
        conn.row_factory = sqlite3.Row
        conn.execute("PRAGMA journal_mode=WAL")
        return conn

    def _init_db(self) -> None:
        """Create tables if they don't exist."""
        os.makedirs(os.path.dirname(self.db_path), exist_ok=True)
        with self._lock:
            conn = self._get_conn()
            try:
                conn.executescript("""
                    CREATE TABLE IF NOT EXISTS sessions (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        start_time TEXT NOT NULL,
                        end_time TEXT,
                        program TEXT,
                        phase TEXT,
                        duration_min REAL,
                        energy_forecast INTEGER,
                        water_forecast INTEGER,
                        energy_kwh_start REAL,
                        energy_kwh_end REAL,
                        energy_kwh REAL,
                        water_m3_start REAL,
                        water_m3_end REAL,
                        water_liters REAL,
                        result TEXT DEFAULT 'unknown'
                    );

                    CREATE TABLE IF NOT EXISTS daily_summary (
                        date TEXT PRIMARY KEY,
                        sessions_count INTEGER DEFAULT 0,
                        total_duration_min REAL DEFAULT 0,
                        avg_energy_forecast REAL DEFAULT 0,
                        avg_water_forecast REAL DEFAULT 0,
                        total_energy_kwh REAL DEFAULT 0,
                        total_water_liters REAL DEFAULT 0
                    );

                    CREATE TABLE IF NOT EXISTS state_log (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        timestamp TEXT NOT NULL,
                        state TEXT,
                        door TEXT,
                        power TEXT,
                        program TEXT,
                        phase TEXT,
                        progress INTEGER,
                        remaining TEXT,
                        energy_forecast INTEGER,
                        water_forecast INTEGER
                    );

                    CREATE TABLE IF NOT EXISTS session_readings (
                        id INTEGER PRIMARY KEY AUTOINCREMENT,
                        session_id INTEGER NOT NULL,
                        timestamp TEXT NOT NULL,
                        power_w REAL,
                        energy_kwh REAL,
                        water_m3 REAL
                    );
                """)

                # Migrate existing tables – add columns if missing
                self._migrate(conn)
                conn.commit()
            finally:
                conn.close()

    def _migrate(self, conn: sqlite3.Connection) -> None:
        """Add missing columns to existing tables."""
        existing = {row[1] for row in conn.execute("PRAGMA table_info(sessions)").fetchall()}
        new_cols = [
            ("energy_kwh_start", "REAL"),
            ("energy_kwh_end", "REAL"),
            ("energy_kwh", "REAL"),
            ("water_m3_start", "REAL"),
            ("water_m3_end", "REAL"),
            ("water_liters", "REAL"),
            ("water_estimated", "INTEGER DEFAULT 0"),
        ]
        for col, typ in new_cols:
            if col not in existing:
                conn.execute(f"ALTER TABLE sessions ADD COLUMN {col} {typ}")

        existing_ds = {row[1] for row in conn.execute("PRAGMA table_info(daily_summary)").fetchall()}
        for col, typ in [("total_energy_kwh", "REAL DEFAULT 0"), ("total_water_liters", "REAL DEFAULT 0")]:
            if col not in existing_ds:
                conn.execute(f"ALTER TABLE daily_summary ADD COLUMN {col} {typ}")

        # session_readings: phase column
        existing_sr = {row[1] for row in conn.execute("PRAGMA table_info(session_readings)").fetchall()}
        if "phase" not in existing_sr:
            conn.execute("ALTER TABLE session_readings ADD COLUMN phase TEXT")

        conn.commit()

    def log_state(self, state: dict) -> None:
        """Log a state snapshot."""
        with self._lock:
            conn = self._get_conn()
            try:
                conn.execute("""
                    INSERT INTO state_log
                    (timestamp, state, door, power, program, phase, progress, remaining, energy_forecast, water_forecast)
                    VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
                """, (
                    datetime.now().isoformat(timespec="seconds"),
                    state.get("state"),
                    state.get("door"),
                    state.get("power"),
                    state.get("programm"),
                    state.get("phase"),
                    state.get("progress"),
                    state.get("remaining"),
                    state.get("energyforecast"),
                    state.get("waterforecast"),
                ))
                conn.commit()
            finally:
                conn.close()

    def start_session(self, energy_forecast: int = 0, water_forecast: int = 0,
                      program: str = "", energy_kwh_start: float | None = None,
                      water_m3_start: float | None = None) -> int:
        """Record the start of a wash cycle. Returns session ID."""
        with self._lock:
            conn = self._get_conn()
            try:
                cur = conn.execute("""
                    INSERT INTO sessions (start_time, program, energy_forecast, water_forecast,
                        energy_kwh_start, water_m3_start, result)
                    VALUES (?, ?, ?, ?, ?, ?, 'running')
                """, (
                    datetime.now().isoformat(timespec="seconds"),
                    program,
                    energy_forecast,
                    water_forecast,
                    energy_kwh_start,
                    water_m3_start,
                ))
                conn.commit()
                return cur.lastrowid or 0
            finally:
                conn.close()

    # Hard upper limit – no dishwasher uses more than this
    WATER_MAX_LITERS = 20.0
    # Minimum plausible sessions needed to use program median
    WATER_MIN_HISTORY = 5
    # Factor above median that is still considered plausible
    WATER_PLAUSIBILITY_FACTOR = 2.0

    def _get_water_median(self, conn: sqlite3.Connection, program: str) -> float | None:
        """Get median water consumption for a program from plausible historical data."""
        rows = conn.execute("""
            SELECT water_liters FROM sessions
            WHERE program = ? AND result = 'finished'
              AND water_liters IS NOT NULL
              AND water_estimated = 0
              AND water_liters <= ?
            ORDER BY water_liters
        """, (program, self.WATER_MAX_LITERS)).fetchall()

        if not rows:
            return None

        # Use median if enough data, otherwise use average of available values
        values = [r[0] for r in rows]
        if len(values) >= self.WATER_MIN_HISTORY:
            mid = len(values) // 2
            if len(values) % 2 == 0:
                return (values[mid - 1] + values[mid]) / 2
            return values[mid]

        # Less than MIN_HISTORY but at least 1 plausible value – use average
        return sum(values) / len(values)

    def _get_water_plausible_count(self, conn: sqlite3.Connection, program: str) -> int:
        """Count plausible (non-estimated, within limit) water readings for a program."""
        row = conn.execute("""
            SELECT COUNT(*) as cnt FROM sessions
            WHERE program = ? AND result = 'finished'
              AND water_liters IS NOT NULL
              AND water_estimated = 0
              AND water_liters <= ?
        """, (program, self.WATER_MAX_LITERS)).fetchone()
        return row["cnt"] if row else 0

    def end_session(self, session_id: int, result: str = "finished", phase: str = "",
                    energy_kwh_end: float | None = None, water_m3_end: float | None = None) -> None:
        """Record the end of a wash cycle with sensor readings."""
        with self._lock:
            conn = self._get_conn()
            try:
                row = conn.execute(
                    "SELECT start_time, program, energy_kwh_start, water_m3_start FROM sessions WHERE id = ?",
                    (session_id,)
                ).fetchone()
                duration = 0.0
                energy_kwh = None
                water_liters = None
                water_estimated = False

                if row:
                    start = datetime.fromisoformat(row["start_time"])
                    duration = round((datetime.now() - start).total_seconds() / 60, 1)
                    program = row["program"] or ""

                    # Calculate real consumption from sensor readings
                    if energy_kwh_end is not None and row["energy_kwh_start"] is not None:
                        diff = energy_kwh_end - row["energy_kwh_start"]
                        if diff < 0:
                            # Sensor reset – use end value as absolute consumption
                            # (only if it's a plausible single-cycle value)
                            if energy_kwh_end < 5.0:
                                energy_kwh = round(energy_kwh_end, 4)
                            else:
                                energy_kwh = None
                        elif diff > 10.0:
                            # Implausible spike – discard
                            energy_kwh = None
                        else:
                            energy_kwh = round(diff, 4)

                    if water_m3_end is not None and row["water_m3_start"] is not None:
                        diff_w = water_m3_end - row["water_m3_start"]
                        liters = round(diff_w * 1000, 2)
                        if liters < 0:
                            # Sensor reset – use end value as absolute
                            if water_m3_end < 0.05:
                                water_liters = round(water_m3_end * 1000, 2)
                            else:
                                water_liters = None
                        elif liters > self.WATER_MAX_LITERS:
                            # Over hard limit – use program median as estimate
                            median = self._get_water_median(conn, program)
                            if median is not None:
                                water_liters = round(median, 2)
                                water_estimated = True
                                logger.info(
                                    f"Water {liters}L exceeds max ({self.WATER_MAX_LITERS}L), "
                                    f"using median {water_liters}L for '{program}'"
                                )
                            else:
                                water_liters = None
                                logger.warning(
                                    f"Water {liters}L exceeds max, no history for '{program}' – discarded"
                                )
                        else:
                            # Check against program median (if enough history)
                            median = self._get_water_median(conn, program)
                            plausible_count = self._get_water_plausible_count(conn, program)
                            if (median and plausible_count >= self.WATER_MIN_HISTORY
                                    and liters > median * self.WATER_PLAUSIBILITY_FACTOR):
                                # Measured value implausibly high – use median
                                water_liters = round(median, 2)
                                water_estimated = True
                                logger.info(
                                    f"Water {liters}L > {self.WATER_PLAUSIBILITY_FACTOR}x median "
                                    f"({median:.1f}L), using median {water_liters}L for '{program}'"
                                )
                            else:
                                water_liters = liters

                conn.execute("""
                    UPDATE sessions
                    SET end_time = ?, duration_min = ?, result = ?, phase = ?,
                        energy_kwh_end = ?, energy_kwh = ?, water_m3_end = ?,
                        water_liters = ?, water_estimated = ?
                    WHERE id = ?
                """, (
                    datetime.now().isoformat(timespec="seconds"),
                    duration,
                    result,
                    phase,
                    energy_kwh_end,
                    energy_kwh,
                    water_m3_end,
                    water_liters,
                    1 if water_estimated else 0,
                    session_id,
                ))
                conn.commit()

                # Update daily summary
                self._update_daily_summary(conn, date.today().isoformat())
                conn.commit()
            finally:
                conn.close()

    def _update_daily_summary(self, conn: sqlite3.Connection, day: str) -> None:
        """Recalculate daily summary for a given date."""
        row = conn.execute("""
            SELECT
                COUNT(*) as cnt,
                COALESCE(SUM(duration_min), 0) as total_dur,
                COALESCE(AVG(energy_forecast), 0) as avg_energy,
                COALESCE(AVG(water_forecast), 0) as avg_water,
                COALESCE(SUM(energy_kwh), 0) as total_kwh,
                COALESCE(SUM(water_liters), 0) as total_liters
            FROM sessions
            WHERE date(start_time) = ? AND result != 'running'
        """, (day,)).fetchone()

        conn.execute("""
            INSERT OR REPLACE INTO daily_summary
            (date, sessions_count, total_duration_min, avg_energy_forecast, avg_water_forecast,
             total_energy_kwh, total_water_liters)
            VALUES (?, ?, ?, ?, ?, ?, ?)
        """, (day, row["cnt"], row["total_dur"], row["avg_energy"], row["avg_water"],
              row["total_kwh"], row["total_liters"]))

    def get_sessions(self, limit: int = 50) -> list[dict]:
        """Get recent sessions."""
        with self._lock:
            conn = self._get_conn()
            try:
                rows = conn.execute("""
                    SELECT * FROM sessions ORDER BY start_time DESC LIMIT ?
                """, (limit,)).fetchall()
                return [dict(r) for r in rows]
            finally:
                conn.close()

    def get_daily_summary(self, days: int = 30) -> list[dict]:
        """Get daily summaries for the last N calendar days.

        Rebuilds missing summaries on the fly from sessions table.
        """
        with self._lock:
            conn = self._get_conn()
            try:
                cutoff = (date.today() - __import__('datetime').timedelta(days=days)).isoformat()

                # Rebuild missing daily summaries for this range
                missing = conn.execute("""
                    SELECT DISTINCT date(start_time) as d FROM sessions
                    WHERE date(start_time) >= ? AND result != 'running'
                    AND date(start_time) NOT IN (SELECT date FROM daily_summary)
                """, (cutoff,)).fetchall()
                for row in missing:
                    self._update_daily_summary(conn, row[0])
                if missing:
                    conn.commit()

                rows = conn.execute("""
                    SELECT * FROM daily_summary
                    WHERE date >= ?
                    ORDER BY date DESC
                """, (cutoff,)).fetchall()
                return [dict(r) for r in rows]
            finally:
                conn.close()

    def get_daily_summary_range(self, from_date: str, to_date: str) -> list[dict]:
        """Get daily summaries for a specific date range (from/to as YYYY-MM-DD)."""
        with self._lock:
            conn = self._get_conn()
            try:
                # Rebuild missing daily summaries for this range
                missing = conn.execute("""
                    SELECT DISTINCT date(start_time) as d FROM sessions
                    WHERE date(start_time) >= ? AND date(start_time) <= ? AND result != 'running'
                    AND date(start_time) NOT IN (SELECT date FROM daily_summary)
                """, (from_date, to_date)).fetchall()
                for row in missing:
                    self._update_daily_summary(conn, row[0])
                if missing:
                    conn.commit()

                rows = conn.execute("""
                    SELECT * FROM daily_summary
                    WHERE date >= ? AND date <= ?
                    ORDER BY date DESC
                """, (from_date, to_date)).fetchall()
                return [dict(r) for r in rows]
            finally:
                conn.close()

    def get_stats(self) -> dict:
        """Get overall statistics."""
        with self._lock:
            conn = self._get_conn()
            try:
                today = date.today().isoformat()
                month = datetime.now().strftime("%Y-%m")
                year = str(datetime.now().year)

                total = conn.execute("SELECT COUNT(*) as c FROM sessions WHERE result != 'running'").fetchone()
                today_r = conn.execute("SELECT COUNT(*) as c FROM sessions WHERE date(start_time) = ? AND result != 'running'", (today,)).fetchone()
                month_r = conn.execute("SELECT COUNT(*) as c FROM sessions WHERE substr(start_time,1,7) = ? AND result != 'running'", (month,)).fetchone()
                year_r = conn.execute("SELECT COUNT(*) as c FROM sessions WHERE substr(start_time,1,4) = ? AND result != 'running'", (year,)).fetchone()
                avg_dur = conn.execute("SELECT COALESCE(AVG(duration_min),0) as a, COALESCE(SUM(duration_min),0) as total FROM sessions WHERE result = 'finished'").fetchone()
                avg_energy = conn.execute("SELECT COALESCE(AVG(energy_forecast),0) as a FROM sessions WHERE result = 'finished'").fetchone()
                avg_water = conn.execute("SELECT COALESCE(AVG(water_forecast),0) as a FROM sessions WHERE result = 'finished'").fetchone()

                # Aggregated forecasts for cost calculation
                month_agg = conn.execute("""
                    SELECT COALESCE(SUM(energy_forecast),0) as sum_e,
                           COALESCE(SUM(water_forecast),0) as sum_w,
                           COALESCE(SUM(energy_kwh),0) as real_kwh,
                           COALESCE(SUM(water_liters),0) as real_liters
                    FROM sessions WHERE substr(start_time,1,7) = ? AND result = 'finished'
                """, (month,)).fetchone()
                year_agg = conn.execute("""
                    SELECT COALESCE(SUM(energy_forecast),0) as sum_e,
                           COALESCE(SUM(water_forecast),0) as sum_w,
                           COALESCE(SUM(energy_kwh),0) as real_kwh,
                           COALESCE(SUM(water_liters),0) as real_liters
                    FROM sessions WHERE substr(start_time,1,4) = ? AND result = 'finished'
                """, (year,)).fetchone()

                return {
                    "total_sessions": total["c"],
                    "today_sessions": today_r["c"],
                    "month_sessions": month_r["c"],
                    "year_sessions": year_r["c"],
                    "avg_duration_min": round(avg_dur["a"], 1),
                    "total_duration_min": round(avg_dur["total"], 1),
                    "avg_energy_forecast": round(avg_energy["a"], 1),
                    "avg_water_forecast": round(avg_water["a"], 1),
                    "month_sum_energy": month_agg["sum_e"],
                    "month_sum_water": month_agg["sum_w"],
                    "month_real_kwh": round(month_agg["real_kwh"], 3),
                    "month_real_liters": round(month_agg["real_liters"], 1),
                    "year_sum_energy": year_agg["sum_e"],
                    "year_sum_water": year_agg["sum_w"],
                    "year_real_kwh": round(year_agg["real_kwh"], 3),
                    "year_real_liters": round(year_agg["real_liters"], 1),
                }
            finally:
                conn.close()

    def get_monthly_summary(self, year: str = "") -> list[dict]:
        """Get monthly aggregated data for a given year."""
        if not year:
            year = str(datetime.now().year)
        with self._lock:
            conn = self._get_conn()
            try:
                rows = conn.execute("""
                    SELECT substr(start_time,1,7) as month,
                           COUNT(*) as sessions_count,
                           COALESCE(SUM(duration_min), 0) as total_duration_min,
                           COALESCE(SUM(energy_forecast), 0) as sum_energy_forecast,
                           COALESCE(SUM(water_forecast), 0) as sum_water_forecast,
                           COALESCE(AVG(energy_forecast), 0) as avg_energy_forecast,
                           COALESCE(AVG(water_forecast), 0) as avg_water_forecast,
                           COALESCE(SUM(energy_kwh), 0) as total_energy_kwh,
                           COALESCE(SUM(water_liters), 0) as total_water_liters
                    FROM sessions
                    WHERE substr(start_time,1,4) = ? AND result = 'finished'
                    GROUP BY substr(start_time,1,7)
                    ORDER BY month
                """, (year,)).fetchall()
                return [dict(r) for r in rows]
            finally:
                conn.close()

    def get_available_years(self) -> list[str]:
        """Get list of years that have session data."""
        with self._lock:
            conn = self._get_conn()
            try:
                rows = conn.execute("""
                    SELECT DISTINCT substr(start_time,1,4) as year
                    FROM sessions
                    ORDER BY year DESC
                """).fetchall()
                return [r["year"] for r in rows]
            finally:
                conn.close()

    def get_today_stats(self) -> dict:
        """Get today's aggregated session stats."""
        with self._lock:
            conn = self._get_conn()
            try:
                today = date.today().isoformat()
                row = conn.execute("""
                    SELECT COUNT(*) as sessions,
                           COALESCE(SUM(duration_min), 0) as duration,
                           COALESCE(SUM(energy_kwh), 0) as kwh,
                           COALESCE(SUM(water_liters), 0) as liters
                    FROM sessions
                    WHERE date(start_time) = ? AND result != 'running'
                """, (today,)).fetchone()
                return {
                    "sessions": row["sessions"],
                    "duration_min": round(row["duration"], 1),
                    "kwh": round(row["kwh"], 3),
                    "liters": round(row["liters"], 1),
                }
            finally:
                conn.close()

    def get_last_session(self) -> dict | None:
        """Get the last completed session."""
        with self._lock:
            conn = self._get_conn()
            try:
                row = conn.execute("""
                    SELECT * FROM sessions
                    WHERE result != 'running'
                    ORDER BY start_time DESC LIMIT 1
                """).fetchone()
                return dict(row) if row else None
            finally:
                conn.close()

    def export_sessions_csv(self, filepath: str) -> int:
        """Export all completed sessions to a CSV file.

        Returns:
            Number of exported sessions.
        """
        import csv
        with self._lock:
            conn = self._get_conn()
            try:
                rows = conn.execute("""
                    SELECT start_time, end_time, program, duration_min,
                           energy_forecast, water_forecast, energy_kwh, water_liters, result
                    FROM sessions
                    WHERE result != 'running'
                    ORDER BY start_time ASC
                """).fetchall()

                os.makedirs(os.path.dirname(filepath), exist_ok=True)
                with open(filepath, "w", newline="", encoding="utf-8") as f:
                    writer = csv.writer(f, delimiter=";")
                    writer.writerow([
                        "date", "end_time", "program", "duration_min",
                        "energy_forecast", "water_forecast", "energy_kwh", "water_liters", "result"
                    ])
                    for r in rows:
                        writer.writerow([
                            r["start_time"], r["end_time"], r["program"],
                            r["duration_min"], r["energy_forecast"], r["water_forecast"],
                            r["energy_kwh"], r["water_liters"], r["result"],
                        ])
                return len(rows)
            finally:
                conn.close()

    # --------------------------------------------------
    # Live session readings (for real-time chart)
    # --------------------------------------------------

    def add_session_reading(self, session_id: int, power_w: float | None = None,
                            energy_kwh: float | None = None, water_m3: float | None = None,
                            phase: str | None = None) -> None:
        """Store a sensor reading for the current session."""
        if not session_id:
            return
        with self._lock:
            conn = self._get_conn()
            try:
                conn.execute("""
                    INSERT INTO session_readings (session_id, timestamp, power_w, energy_kwh, water_m3, phase)
                    VALUES (?, ?, ?, ?, ?, ?)
                """, (session_id, datetime.now().isoformat(timespec="seconds"), power_w, energy_kwh, water_m3, phase))
                conn.commit()
            finally:
                conn.close()

    def get_session_readings(self, session_id: int) -> list[dict]:
        """Get all readings for a session (for live chart)."""
        with self._lock:
            conn = self._get_conn()
            try:
                rows = conn.execute("""
                    SELECT timestamp, power_w, energy_kwh, water_m3, phase
                    FROM session_readings
                    WHERE session_id = ?
                    ORDER BY timestamp ASC
                """, (session_id,)).fetchall()
                return [dict(r) for r in rows]
            finally:
                conn.close()

    def get_current_session_id(self) -> int | None:
        """Get the ID of the currently running session."""
        with self._lock:
            conn = self._get_conn()
            try:
                row = conn.execute(
                    "SELECT id FROM sessions WHERE result = 'running' ORDER BY start_time DESC LIMIT 1"
                ).fetchone()
                return row["id"] if row else None
            finally:
                conn.close()

    def cleanup_old_readings(self, keep_last_n_sessions: int = 5) -> None:
        """Delete readings from old sessions to save space."""
        with self._lock:
            conn = self._get_conn()
            try:
                conn.execute("""
                    DELETE FROM session_readings
                    WHERE session_id NOT IN (
                        SELECT id FROM sessions ORDER BY start_time DESC LIMIT ?
                    )
                """, (keep_last_n_sessions,))
                conn.commit()
            finally:
                conn.close()
