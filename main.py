#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
HC_BOSCH Application

Copyright © 2026 Peter. All rights reserved.

THIS SOFTWARE IS PROPRIETARY AND CONFIDENTIAL.
No part of this software may be reproduced, distributed, or transmitted
in any form or by any means without prior written permission.
"""

import os
import sys
import threading

# 1. Core-Infrastruktur laden
from app.core.config import settings
from app.core.logging_config import setup_logging
from app.core.shutdown_manager import ShutdownManager

# Logger zentral aktivieren
logger = setup_logging()

# Pfade für ältere Submodule erweitern
_rootdir = os.path.dirname(os.path.realpath(__file__))
sys.path.extend([_rootdir, f"{_rootdir}/app"])

__APPLICATION_NAME__ = os.path.basename(_rootdir)
__version__ = "2.2.0"
settings.APPS_VERSION = __version__

from app.models.db_manager import DbManager
from app.service.sensor_reader import SensorReader
from app.service.session_writer import SessionWriter
from app.service.session_tracker import SessionTracker
from app.service.sensor_publisher import SensorPublisher
import app.device.login as hclogin
import app.device.data2mqtt as hcdata
from app.infrastructure.webhooks import notify_ha

def run_fastapi_server(db, get_state_fn, sensors):
    """Startet das FastAPI-Dashboard im Hintergrund-Thread."""
    import uvicorn
    from app.core.fastapi_app import app

    app.state.db = db
    app.state.get_state_fn = get_state_fn
    app.state.sensors = sensors

    logger.info(f"Starte Dashboard-Server auf Port {settings.DASHBOARD_PORT}")
    try:
        # Docker- und Protokoll-Optimierung für saubere Log-Ausgaben
        uvicorn.run(
            app,
            host="0.0.0.0",
            port=settings.DASHBOARD_PORT,
            log_level="info",
            loop="asyncio"
        )

    except Exception as e:
        logger.error(f"Fehler im FastAPI Thread: {e}")


def main():
    shutdown_mgr = ShutdownManager(logger)
    shutdown_mgr.install_signal_handlers()

    db = DbManager(settings.DB_PATH)
    sensors = SensorReader(water_url=settings.SENSOR_WATER_URL, energy_url=settings.SENSOR_ENERGY_URL)

    session_writer = SessionWriter(sessions_dir=settings.SESSIONS_DIR, enabled=settings.SAVE_SESSIONS, keep=settings.SESSIONS_KEEP)
    tracker = SessionTracker(db, sensors=sensors, session_writer=session_writer)
    hcdata.set_session_tracker(tracker)

    api_thread = threading.Thread(target=run_fastapi_server, args=(db, hcdata.get_current_state, sensors), name="fastapi-api", daemon=True)
    api_thread.start()

    has_mqtt = settings.MQTT_HOST and str(settings.MQTT_HOST).lower() not in ("", "none", "false", "disabled", "0")
    has_sensors = sensors.has_energy_sensor or sensors.has_water_sensor

    if has_mqtt and has_sensors:
        publisher = SensorPublisher(
            sensors=sensors,
            db=db,
            shutdown_mgr=shutdown_mgr,
            interval=30,
            session_writer=session_writer,
        )
        publisher.start()
    elif has_sensors:
        logger.info("Sensoren aktiv, aber kein MQTT-Broker – Sensor-Publisher deaktiviert.")
    else:
        logger.info("Weder MQTT noch Sensoren konfiguriert – Sensor-Publisher deaktiviert.")

    try:
        notify_ha("app_start", version=settings.APPS_VERSION)
    except Exception as e:
        logger.warning(f"HA Start-Webhook fehlgeschlagen: {e}")

    _brandname = "bosch"
    devices_config = settings.load_devices()

    if has_mqtt:
        # Cloud-Login und MQTT-Service nur wenn MQTT aktiv
        if _brandname not in devices_config or not devices_config[_brandname]:
            logger.error(f"Gerätekonfiguration für '{_brandname}' fehlt oder ist leer.")
            return

        if not hclogin.getConfig(_brandname, devices_config[_brandname]):
            logger.error(f"Fehler beim Laden der Cloud-Konfiguration.")
            return

        logger.info(f"Starte blockierenden MQTT-Service für '{_brandname}'...")
        hcdata.runMqttService(_brandname, shutdown_mgr)
    else:
        logger.info("Reiner Offline-Web-Dashboard-Modus aktiv (MQTT_HOST=disabled).")
        logger.info("Dashboard erreichbar auf Port %s – warte auf Container-Stopp...", settings.DASHBOARD_PORT)
        while not shutdown_mgr.is_set():
            shutdown_mgr.wait(timeout=1)


if __name__ == "__main__":
    try:
        main()
    except Exception as e:
        logger.error(f"Fataler Fehler: {e}")
    finally:
        try:
            notify_ha("app_stop", version=settings.APPS_VERSION)
        except Exception:
            pass
        logger.info("Anwendung beendet.")
