"""Session Writer: Schreibt Session-Readings als CSV in data/sessions/.

Pro Session eine Datei: session_YYYY-MM-DD_HH-MM.csv
Enthält alle Sensor-Readings + Phasen + State für Replay.

Konfiguration über .env:
    SAVE_SESSIONS=true          # Session-CSV aktivieren
    SESSIONS_DIR=./data/sessions  # Verzeichnis
    SESSIONS_KEEP=10            # Alte Sessions löschen (0=nie)
"""

import csv
import logging
from pathlib import Path
from typing import Optional

logger = logging.getLogger(__name__)

COLUMNS = [
    "timestamp",
    "phase",
    "state",
    "progress",
    "power_w",
    "energy_kwh",
    "water_m3",
    "program",
    "remaining",
]


class SessionWriter:
    """Schreibt Session-Readings als CSV-Dateien."""

    def __init__(
        self,
        sessions_dir: str = "./data/sessions",
        enabled: bool = True,
        keep: int = 10,
    ):
        self.enabled = enabled
        self.keep = keep
        self.sessions_dir = Path(sessions_dir)
        self._fh = None
        self._writer: Optional[csv.writer] = None
        self._current_file: Optional[str] = None

        if self.enabled:
            self.sessions_dir.mkdir(parents=True, exist_ok=True)
            logger.info("Session Writer aktiv: %s", self.sessions_dir)

    def start_session(self, start_time: str, program: str = "") -> None:
        """Öffnet eine neue CSV-Datei für eine Session."""
        if not self.enabled:
            return
        self.close()

        # Dateiname: session_2026-05-03_23-30.csv
        ts = start_time.replace(":", "-").replace("T", "_")[:16]
        filename = f"session_{ts}.csv"
        filepath = self.sessions_dir / filename

        try:
            self._fh = open(filepath, "w", newline="", encoding="utf-8")
            self._writer = csv.writer(self._fh, delimiter=";")
            self._writer.writerow(COLUMNS)
            self._fh.flush()
            self._current_file = filename
            logger.info("Session CSV gestartet: %s", filename)
        except Exception as e:
            logger.error("Session CSV Fehler: %s", e)
            self._fh = None
            self._writer = None

    def write(self, **kwargs) -> None:
        """Schreibt eine Zeile in die aktuelle Session-CSV."""
        if not self.enabled or not self._writer:
            return
        try:
            row = [kwargs.get(col, "") for col in COLUMNS]
            self._writer.writerow(row)
            self._fh.flush()
        except Exception as e:
            logger.error("Session write Fehler: %s", e)

    def end_session(self) -> None:
        """Schließt die aktuelle Session-CSV und bereinigt alte."""
        self.close()
        self.cleanup()

    def close(self) -> None:
        """Schließt die aktuelle Datei."""
        if self._fh:
            try:
                self._fh.close()
            except Exception:
                pass
            self._fh = None
            self._writer = None
            self._current_file = None

    def cleanup(self) -> int:
        """Löscht alte Session-Dateien über dem Limit."""
        if not self.enabled or self.keep <= 0:
            return 0
        files = sorted(self.sessions_dir.glob("session_*.csv"), reverse=True)
        deleted = 0
        for f in files[self.keep:]:
            try:
                f.unlink()
                logger.info("Session gelöscht: %s", f.name)
                deleted += 1
            except Exception:
                pass
        return deleted

    def list_files(self) -> list[str]:
        """Listet verfügbare Session-CSV-Dateien."""
        if not self.sessions_dir.exists():
            return []
        return sorted(
            [f.name for f in self.sessions_dir.glob("session_*.csv")],
            reverse=True,
        )
