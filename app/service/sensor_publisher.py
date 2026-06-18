#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Publish sensor data and session stats to MQTT.

Publishes to {MQTT_TOPIC_BASE}/sensors with current power,
today's consumption, and last session data.
Also publishes HA Discovery entities for all sensor values.

Sensor polling only runs when dishwasher is ACTIVE.
In STANDBY, only DB-based stats are published at a reduced interval.
"""

import json
import threading
from typing import Any

import paho.mqtt.publish as publish
import logging


from app.core.config import settings as app_config
from app.service.sensor_reader import SensorReader
from app.models.db_manager import DbManager


logger = logging.getLogger(__name__) # Nutzt automatisch die Konfiguration aus app.py

class SensorPublisher:
    """Periodically publish sensor data and stats to MQTT."""

    # Intervals
    ACTIVE_INTERVAL = 30    # seconds – poll sensors when running
    STANDBY_INTERVAL = 120  # seconds – only DB stats when idle

    def __init__(self, sensors: SensorReader, db: DbManager, shutdown_mgr,
                 interval: int = 30, session_writer=None):
        self.sensors = sensors
        self.db = db
        self.shutdown_mgr = shutdown_mgr
        self.interval = interval
        self.session_writer = session_writer
        self._topic = f"{app_config.MQTT_TOPIC_BASE}/sensors"
        self._thread = None
        self._discovery_published = False

    def start(self) -> None:
        """Start the sensor publisher thread."""
        if not self._is_mqtt_enabled():
            return
        if not self.sensors.has_energy_sensor and not self.sensors.has_water_sensor:
            return

        self._thread = threading.Thread(
            target=self._worker,
            name="sensor-publisher",
            daemon=True,
        )
        self._thread.start()
        logger.info("Sensor publisher started")

    def _worker(self) -> None:
        """Worker loop: publish sensor data periodically."""
        self._publish_discovery()

        while not self.shutdown_mgr.is_set():
            try:
                is_active = self._is_session_active()
                self._publish_sensors(poll_sensors=is_active)

                # Store live readings during active session
                if is_active:
                    self._store_session_reading()
            except Exception as e:
                logger.error(f"Sensor publish error: {e}")

            wait = self.ACTIVE_INTERVAL if is_active else self.STANDBY_INTERVAL
            self.shutdown_mgr.wait(timeout=wait)

    def _publish_sensors(self, poll_sensors: bool = True) -> None:
        """Read sensors and publish to MQTT."""
        from datetime import date as _date

        payload: dict[str, object] = {
            "timestamp": app_config.getDate(),
        }

        costs = self._get_costs()
        strom_preis = costs.get("strom", 0)
        wasser_preis = costs.get("wasser", 0)

        # Current power – only poll sensor when active
        if poll_sensors and self.sensors.has_energy_sensor:
            power = self.sensors.read_energy_power_w()
            if power is not None:
                payload["power_w"] = round(power, 1)

        # Today stats from DB (always available)
        today = self.db.get_today_stats()
        today_kwh = today.get("kwh", 0)
        today_liters = today.get("liters", 0)
        payload["today_date"] = _date.today().isoformat()
        payload["today_sessions"] = today.get("sessions", 0)
        payload["today_kwh"] = today_kwh
        payload["today_liters"] = today_liters
        payload["today_duration_min"] = today.get("duration_min", 0)
        cost_strom = round(today_kwh * strom_preis, 3)
        cost_wasser = round((today_liters / 1000) * wasser_preis, 3)
        payload["today_cost_strom"] = cost_strom
        payload["today_cost_wasser"] = cost_wasser
        payload["today_cost_total"] = round(cost_strom + cost_wasser, 3)

        # Last completed session
        last = self.db.get_last_session()
        if last:
            last_kwh = last.get("energy_kwh") or 0
            last_liters = last.get("water_liters") or 0
            payload["prev_session_time"] = last.get("start_time", "")
            payload["prev_session_program"] = last.get("program", "")
            payload["prev_session_kwh"] = last_kwh
            payload["prev_session_liters"] = last_liters
            payload["prev_session_duration"] = last.get("duration_min") or 0
            payload["prev_session_result"] = last.get("result", "")
            payload["prev_session_cost"] = round(
                last_kwh * strom_preis + (last_liters / 1000) * wasser_preis, 3
            )

        payload["session_active"] = "ON" if self._is_session_active() else "OFF"

        try:
            publish.single(
                topic=self._topic,
                payload=json.dumps(payload, ensure_ascii=True),
                qos=0,
                retain=True,
                hostname=app_config.MQTT_HOST,
                port=int(app_config.MQTT_PORT),
                keepalive=60,
                auth=app_config.MQTT_AUTH,
            )
        except Exception as e:
            logger.error(f"Sensor MQTT publish failed: {e}")

    def _store_session_reading(self) -> None:
        """Store current sensor values for the running session's live chart."""
        try:
            session_id = self.db.get_current_session_id()
            if not session_id:
                return
            power_w = None
            energy_kwh = None
            water_m3 = None
            phase = None
            if self.sensors.has_energy_sensor:
                power_w = self.sensors.read_energy_power_w()
                energy_kwh = self.sensors.read_energy_kwh()
            if self.sensors.has_water_sensor:
                water_m3 = self.sensors.read_water_m3()
            # Phase + State aus dem aktuellen HC-State
            from app.device.data2mqtt import get_current_state
            state = get_current_state()
            phase = state.get("phase")
            self.db.add_session_reading(session_id, power_w=power_w,
                                        energy_kwh=energy_kwh, water_m3=water_m3,
                                        phase=phase)
            # Session CSV schreiben
            if self.session_writer:
                from datetime import datetime
                self.session_writer.write(
                    timestamp=datetime.now().isoformat(timespec="seconds"),
                    phase=phase or "",
                    state=state.get("state", ""),
                    progress=state.get("progress", ""),
                    power_w=power_w,
                    energy_kwh=energy_kwh,
                    water_m3=water_m3,
                    program=state.get("programm", ""),
                    remaining=state.get("remaining", ""),
                )
        except Exception as e:
            logger.debug(f"Session reading store error: {e}")

    def _is_session_active(self) -> bool:
        """Check if a session is currently running."""
        from app.device.data2mqtt import get_current_state
        state = get_current_state()
        return state.get("state") in ("Run", "DelayedStart", "Pause")

    def _get_costs(self) -> dict:
        """Load costs for current year from costs.yaml."""
        import yaml
        from datetime import datetime
        from pathlib import Path
        costs_file = Path(__file__).parent.parent / "config" / "costs.yaml"
        try:
            if costs_file.is_file():
                with open(costs_file, "r", encoding="utf8") as f:
                    all_costs = yaml.safe_load(f) or {}
                year = datetime.now().year
                if year in all_costs:
                    return all_costs[year]
                if all_costs:
                    return all_costs[max(all_costs.keys())]
        except Exception:
            pass
        return {"strom": 0.23, "wasser": 6.97}

    def _get_lang(self) -> dict:
        """Load language file."""
        import yaml
        from pathlib import Path
        lang_file = Path(__file__).parent.parent / "config" / "lang" / "de.yaml"
        try:
            if lang_file.is_file():
                with open(lang_file, "r", encoding="utf8") as f:
                    return yaml.safe_load(f) or {}
        except Exception:
            pass
        return {}

    def _is_mqtt_enabled(self) -> bool:
        """Prüft, ob MQTT aktiv genutzt werden soll."""
        if not app_config.MQTT_HOST:
            return False
        if str(app_config.MQTT_HOST).lower() in ("", "none", "false", "disabled", "0"):
            return False
        return True

    def _publish_discovery(self) -> None:
        """Publish HA Discovery entities for sensor data."""

        if not self._is_mqtt_enabled():
            return

        if self._discovery_published:
            return

        lang = self._get_lang()
        ha = lang.get("ha_sensors", {})

        prefix = app_config.HA_DISCOVERY_PREFIX
        device_id = "bosch-dishwasher-sensors"
        base = app_config.MQTT_TOPIC_BASE

        dev = {
            "ids": [device_id],
            "name": ha.get("device_name", "Dishwasher Sensors"),
            "mf": "DIY",
            "mdl": ha.get("device_model", "Sonoff Pow + ESP32 Watermeter"),
            "via_device": "bosch-dishwasher",
        }

        sensors = [
            ("power_w", ha.get("power_w", "Power"), "W", "power", "measurement", "mdi:flash"),
            ("today_sessions", ha.get("today_sessions", "Sessions today"), None, None, "total", "mdi:counter"),
            ("today_kwh", ha.get("today_kwh", "Energy today"), "kWh", "energy", "total", None),
            ("today_liters", ha.get("today_liters", "Water today"), "L", "water", "total", "mdi:water"),
            ("today_duration_min", ha.get("today_duration_min", "Duration today"), "min", "duration", "total", "mdi:timer"),
            ("today_cost_strom", ha.get("today_cost_strom", "Energy cost today"), "€", "monetary", "total", "mdi:currency-eur"),
            ("today_cost_wasser", ha.get("today_cost_wasser", "Water cost today"), "€", "monetary", "total", "mdi:currency-eur"),
            ("today_cost_total", ha.get("today_cost_total", "Total cost today"), "€", "monetary", "total", "mdi:currency-eur"),
            ("prev_session_kwh", ha.get("prev_session_kwh", "Last session kWh"), "kWh", "energy", "measurement", None),
            ("prev_session_liters", ha.get("prev_session_liters", "Last session liters"), "L", "water", "measurement", "mdi:water"),
            ("prev_session_duration", ha.get("prev_session_duration", "Last session duration"), "min", "duration", "measurement", "mdi:timer"),
            ("prev_session_cost", ha.get("prev_session_cost", "Last session cost"), "€", "monetary", "measurement", "mdi:currency-eur"),
            ("prev_session_program", ha.get("prev_session_program", "Last program"), None, None, None, "mdi:dishwasher"),
            ("prev_session_result", ha.get("prev_session_result", "Last result"), None, None, None, "mdi:check-circle"),
        ]

        for field, name, unit, dev_class, state_class, icon in sensors:
            entity_id = field.replace("_", "-")
            topic = f"{prefix}/sensor/{device_id}/{entity_id}/config"

            payload: dict[str, Any] = {
                "name": name,
                "uniq_id": f"{device_id}_{field}",
                "stat_t": f"{base}/sensors",
                "val_tpl": f"{{{{value_json.{field}}}}}",
                "dev": dev,
                "availability_topic": f"{base}/LWT",
                "payload_available": "Online",
                "payload_not_available": "Offline",
            }
            if unit:
                payload["unit_of_meas"] = unit
            if dev_class:
                payload["device_class"] = dev_class
            if state_class:
                payload["state_class"] = state_class
            if icon:
                payload["ic"] = icon

            try:
                publish.single(
                    topic=topic,
                    payload=json.dumps(payload, ensure_ascii=True),
                    qos=0,
                    retain=True,
                    hostname=app_config.MQTT_HOST,
                    port=int(app_config.MQTT_PORT),
                    keepalive=60,
                    auth=app_config.MQTT_AUTH,
                )
            except Exception as e:
                logger.error(f"Sensor discovery publish failed for {field}: {e}")

        # Binary sensor: session active
        topic = f"{prefix}/binary_sensor/{device_id}/session-active/config"
        payload_bs: dict[str, Any] = {
            "name": ha.get("session_active", "Session active"),
            "uniq_id": f"{device_id}_session_active",
            "stat_t": f"{base}/sensors",
            "val_tpl": "{{value_json.session_active}}",
            "payload_on": "ON",
            "payload_off": "OFF",
            "device_class": "running",
            "dev": dev,
            "availability_topic": f"{base}/LWT",
            "payload_available": "Online",
            "payload_not_available": "Offline",
            "ic": "mdi:dishwasher",
        }
        try:
            publish.single(
                topic=topic,
                payload=json.dumps(payload_bs, ensure_ascii=True),
                qos=0,
                retain=True,
                hostname=app_config.MQTT_HOST,
                port=int(app_config.MQTT_PORT),
                keepalive=60,
                auth=app_config.MQTT_AUTH,
            )
        except Exception as e:
            logger.error(f"Sensor discovery publish failed for session_active: {e}")

        self._discovery_published = True
        logger.info(f"Published {len(sensors) + 1} sensor discovery entities")
