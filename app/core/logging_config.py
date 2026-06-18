import os
import sys
import logging
from logging.handlers import RotatingFileHandler
from app.core.config import settings

def setup_logging():
    """Konfiguriert das Standard-Python-Logging (Größen-Rotation & Ausgabe)."""
    level = getattr(logging, settings.LOG_LEVEL.upper(), logging.INFO)
    log_mode = os.getenv("LOG_MODE", "console").lower()
    log_file = os.getenv("LOG_FILE", "logs/app.log")
    max_bytes = int(os.getenv("LOG_MAX_BYTES", 1_000_000))
    backup_count = int(os.getenv("LOG_BACKUP_COUNT", 3))

    root_logger = logging.getLogger()
    root_logger.setLevel(level)

    if root_logger.hasHandlers():
        root_logger.handlers.clear()

    formatter = logging.Formatter(
        fmt="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
        datefmt="%Y-%m-%d %H:%M:%S"
    )

    if log_mode in ("console", "both"):
        console_handler = logging.StreamHandler(sys.stderr)
        console_handler.setFormatter(formatter)
        root_logger.addHandler(console_handler)

    if log_mode in ("file", "both"):
        os.makedirs(os.path.dirname(log_file) or ".", exist_ok=True)
        file_handler = RotatingFileHandler(
            log_file, maxBytes=max_bytes, backupCount=backup_count, encoding="utf-8"
        )
        file_handler.setFormatter(formatter)
        root_logger.addHandler(file_handler)

    return logging.getLogger("app")
