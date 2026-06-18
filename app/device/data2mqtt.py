#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Contact Bosch-Siemens Home Connect devices
and publish their messages to the MQTT broker.
"""

import os
import sys
import json
import time
import threading

import websocket

_rootdir = os.path.dirname(os.path.realpath(__file__))
_hcdir = "{}/lib/hc".format(_rootdir)
_hadir = "{}/lib/ha".format(_rootdir)
_libdir = "{}/lib".format(_rootdir)

sys.path.append(_rootdir)
sys.path.append(_libdir)
sys.path.append(_hcdir)
sys.path.append(_hadir)

import logging
import paho.mqtt.publish as publish

logger = logging.getLogger(__name__)

from app.device.socket import HCSocket
from app.device.device import HCDevice
from app.infrastructure.ha_discoveryitems import haDiscoveryItems
from app.core import utils
from app.core.config import settings as app_config


# -----------------------------------------------
# Shared state – accessible by dashboard
# -----------------------------------------------
current_state: dict = {}
_state_lock = threading.Lock()
_session_tracker = None
_tabs_remaining: int | None = None
_tabs_total: int = 0
_tabs_min: int = 0
_service_start_time: str = ""


def set_session_tracker(tracker) -> None:
    """Set the session tracker instance (called from app.py)."""
    global _session_tracker
    _session_tracker = tracker
    # Register callback to reset state when session ends
    tracker.on_session_end(_on_session_end)

    # Start recording if SIMULATE_RECORD is enabled
    if os.environ.get("SIMULATE_RECORD", "").lower() in ("true", "1", "yes"):
        global _recording_armed
        _recording_armed = True
        logger.info("SIMULATE_RECORD enabled – will record next session")


def _on_session_end(session_id: int, result: str, session_data: dict) -> None:
    """Called when a session ends – reset running state fields."""
    global _tabs_remaining
    with _state_lock:
        current_state["progress"] = 0
        current_state["remaining"] = "0:00"
        current_state["remainingseconds"] = 0
        current_state["phase"] = "In Bereitschaft"
        current_state["phase_raw"] = "None"
        current_state["lastupdate"] = app_config.getDate()
    # Decrement tabs counter
    if _tabs_remaining is not None and result == "finished":
        _tabs_remaining -= 1
        if _tabs_remaining < 0:
            _tabs_remaining = 0
        logger.info(f"Tabs remaining: {_tabs_remaining}")
    logger.info(f"State reset after session end (id={session_id}, result={result})")

    # Save recording if active
    if _recording is not None:
        _stop_recording()


# -----------------------------------------------
# Session recording for simulation replay
# -----------------------------------------------
_recording: list | None = None
_recording_last_ts: float = 0
_recording_armed: bool = False  # True = start recording when next session begins


def _start_recording() -> None:
    """Start recording state updates for simulation replay."""
    global _recording, _recording_last_ts
    _recording = []
    _recording_last_ts = time.time()
    logger.info("Simulation recording started")


def _stop_recording() -> None:
    """Stop recording and save to disk (per-session file + last_session symlink)."""
    global _recording
    if not _recording:
        _recording = None
        return
    rec_dir = os.path.join(app_config.DATA_DIR, "simulate")
    os.makedirs(rec_dir, exist_ok=True)

    # Per-session filename with timestamp
    ts = time.strftime("%Y-%m-%d_%H%M%S")
    rec_file = os.path.join(rec_dir, f"session_{ts}.json")

    try:
        with open(rec_file, "w") as f:
            json.dump(_recording, f, ensure_ascii=False)
        logger.info(f"Simulation recording saved: {rec_file} ({len(_recording)} states)")

        # Update last_session.json symlink for easy access
        link_path = os.path.join(rec_dir, "last_session.json")
        if os.path.islink(link_path) or os.path.isfile(link_path):
            os.remove(link_path)
        os.symlink(os.path.basename(rec_file), link_path)
    except Exception as e:
        logger.warning(f"Failed to save recording: {e}")
    _recording = None


def get_current_state() -> dict:
    """Return a copy of the current device state (thread-safe).

    Falls back to data/status.json if no live state available.
    """
    with _state_lock:
        if current_state:
            return dict(current_state)

    # Fallback: letzten bekannten State aus Datei laden
    try:
        status_file = os.path.join(app_config.DATA_DIR, "status.json")
        if os.path.isfile(status_file):
            with open(status_file, "r", encoding="utf-8") as f:
                return json.load(f)
    except Exception:
        pass
    return {}


def _update_state(new_data: dict) -> None:
    """Update the shared state dict and track sessions (thread-safe)."""
    global _recording_last_ts, _recording_armed
    with _state_lock:
        current_state.update(new_data)

    # Persist state to file (always, regardless of MQTT)
    try:
        status_file = os.path.join(app_config.DATA_DIR, "status.json")
        with open(status_file, "w", encoding="utf-8") as f:
            json.dump(current_state, f, ensure_ascii=False, indent=4)
    except Exception:
        pass

    # Start recording when session begins (armed via SIMULATE_RECORD)
    if _recording_armed and new_data.get("state") == "Run" and _recording is None:
        _recording_armed = False
        _start_recording()

    # Record for simulation replay
    if _recording is not None:
        now = time.time()
        delay = round(now - _recording_last_ts, 1) if _recording_last_ts else 0
        _recording_last_ts = now
        # Store a clean copy without metadata
        snap = {k: v for k, v in new_data.items()
                if k not in ("device", "lastupdate", "dataprovider", "version", "attribution")}
        _recording.append([delay, snap])

    # Track session state changes
    if _session_tracker:
        try:
            _session_tracker.update(new_data)
        except Exception as e:
            logger.warning(f"Session tracker error: {e}")


# -----------------------------------------------
# Internal helpers
# -----------------------------------------------

def _calc_running_time(sdat: str) -> str:
    """Calculate human-readable running time from a date string."""
    try:
        d1 = utils.strToDate(sdat, "%Y-%m-%d %H:%M:%S")
        d2 = utils.now()
        if d1:
            return utils.runningTime((d2 - d1).total_seconds())
    except Exception as e:
        logger.error(f"_calc_running_time error: {e}")
    return ""


def _calc_operating_hours(sdat: str) -> float:
    """Calculate operating hours from a date string."""
    try:
        d1 = utils.strToDate(sdat, "%Y-%m-%d %H:%M:%S")
        d2 = utils.now()
        if d1:
            return round(((d2 - d1).total_seconds()) / 3600, 2)
    except Exception as e:
        logger.error(f"_calc_operating_hours error: {e}")
    return 0.0


def _calc_tabs_order(config: dict) -> str:
    """Check if tabs need to be reordered and return warning message."""
    global _tabs_remaining, _tabs_total, _tabs_min
    taps = config.get("taps", 0)
    taps_min = config.get("taps_min", 0)
    _tabs_total = taps
    _tabs_min = taps_min

    # Initialize remaining tabs on first call
    if _tabs_remaining is None:
        _tabs_remaining = taps

    remaining = int(_tabs_remaining or 0)
    if remaining <= 0:
        _tabs_remaining = taps  # Auto-reset
        return f"Tabs aufgefüllt ({taps})"
    if remaining <= taps_min:
        return f"Tabs nachbestellen! Nur noch {remaining} von {taps}"
    return ""


# -----------------------------------------------
# Program name resolver
# -----------------------------------------------

_lang_data: dict | None = None


def _load_lang() -> dict:
    """Load language file (cached)."""
    global _lang_data
    if _lang_data is not None:
        return _lang_data
    import yaml
    lang_file = os.path.join(app_config.CONFIG_DIR, "lang", "de.yaml")
    try:
        if os.path.isfile(lang_file):
            with open(lang_file, "r", encoding="utf8") as f:
                data = yaml.safe_load(f)
                _lang_data = data if isinstance(data, dict) else {}
                return _lang_data
    except Exception as e:
        logger.warning(f"Failed to load language file: {e}")
    _lang_data = {}
    return _lang_data


def _resolve_program(value) -> str:
    """Resolve a program UID to a localized name."""
    lang = _load_lang()
    programs = lang.get("programs", {})
    try:
        uid = int(value)
        if uid in programs:
            return programs[uid]
        return f"Programm {uid}" if uid > 0 else ""
    except (TypeError, ValueError):
        if isinstance(value, str) and value != "0":
            return value
        return ""


def _resolve_phase(value) -> str:
    """Resolve a phase name to a localized name."""
    lang = _load_lang()
    phases = lang.get("phases", {})
    if value in phases:
        return phases[value]
    return value or ""


# -----------------------------------------------
# Heartbeat publisher
# -----------------------------------------------

def _publish_heartbeat(device: dict, shutdown_mgr) -> None:
    """Publish periodic heartbeat for a device. Runs in its own thread."""
    try:
        if not app_config.MQTT_HOST:
            logger.debug("MQTT not enabled, skipping heartbeat")
            return

        if not device or "config" not in device or "name" not in device:
            logger.warning("Heartbeat: device config incomplete")
            return

        _settings = device["config"]
        _brandname = device.get("brand", device.get("description", {}).get("brand", "unknown")).lower()
        _topic = f"{app_config.MQTT_TOPIC_BASE}/heartbeat"

        logger.info(f"Heartbeat thread started for {device['name']}")

        while not shutdown_mgr.is_set():
            _payload = {
                "state": "on",
                "device": device["name"],
                "uptime": _calc_running_time(_service_start_time),
                "totalrunning": _calc_running_time(_settings["installed"]),
                "operatingtime": _calc_operating_hours(_settings["installed"]),
                "tabs": _settings.get("taps", 0),
                "tabsmin": _settings.get("taps_min", 0),
                "tabs_remaining": _tabs_remaining if _tabs_remaining is not None else _settings.get("taps", 0),
                "timestamp": app_config.getDate(),
                "dataprovider": app_config.DATA_HOSTNAME,
                "version": app_config.APPS_VERSION,
                "attribution": app_config.ATTRIBUTION,
            }

            try:
                publish.single(
                    topic=_topic,
                    payload=json.dumps(_payload, ensure_ascii=True),
                    qos=0,
                    retain=True,
                    hostname=app_config.MQTT_HOST,
                    port=int(app_config.MQTT_PORT),
                    keepalive=60,
                    auth=app_config.MQTT_AUTH,
                )
                logger.debug(f"Heartbeat published to {_topic}")
            except Exception as e:
                logger.error(f"Heartbeat publish failed: {e}")

            # Send heartbeat webhook (every 5th cycle to avoid spam)
            if not hasattr(_publish_heartbeat, '_hb_count'):
                _publish_heartbeat._hb_count = 0  # type: ignore
            _publish_heartbeat._hb_count += 1  # type: ignore
            if _publish_heartbeat._hb_count % 5 == 0:  # type: ignore
                try:
                    from app.infrastructure.webhooks import notify_ha
                    notify_ha("heartbeat",
                              uptime=_payload["uptime"],
                              status="running")
                except Exception:
                    pass

            # Wait for interval or shutdown signal
            shutdown_mgr.wait(timeout=app_config.HEARTBEAT_TIME)

        # Publish offline heartbeat on shutdown
        try:
            _payload = {
                "state": "off",
                "device": device["name"],
                "timestamp": app_config.getDate(),
            }
            publish.single(
                topic=_topic,
                payload=json.dumps(_payload, ensure_ascii=True),
                qos=0,
                retain=True,
                hostname=app_config.MQTT_HOST,
                port=int(app_config.MQTT_PORT),
                keepalive=60,
                auth=app_config.MQTT_AUTH,
            )
            logger.info(f"Heartbeat offline published for {device['name']}")
        except Exception:
            logger.warning("Failed to publish offline heartbeat")

    except Exception as e:
        logger.error(f"Heartbeat thread error: {e}")


# -----------------------------------------------
# Device connection & data publishing
# -----------------------------------------------

def client_connect(device: dict, shutdown_mgr) -> None:
    """Connect to a device and publish its data via MQTT.

    Runs in its own thread. Reconnects automatically on failure.
    Stops when shutdown_mgr signals shutdown.
    """
    if not device:
        logger.warning("No device found!")
        return

    if "name" not in device or "config" not in device:
        logger.warning("No device name or config found!")
        return

    _devicename = device["name"]
    _device_config = device["config"]
    _hostname = _device_config.get("hostname", device.get("host", ""))
    _brandname = device.get("brand", device.get("description", {}).get("brand", "unknown")).lower()

    _debugMode = app_config.DEBUG

    topics = _device_config["topics"]
    state: dict = {topics[t]: None for t in topics}
    _timeout_count = 0
    _TIMEOUT_WARN_THRESHOLD = 5  # Warn after 5 consecutive timeouts

    while not shutdown_mgr.is_set():
        try:
            logger.debug(f"Connect to device: {_hostname}")

            ws = HCSocket(_hostname, device["key"], device.get("iv", None))
            dev = HCDevice(ws, device.get("features", None))
            ws.debug = _debugMode

            logger.debug(f"Reconnect to {_hostname}")
            ws.reconnect()
            _timeout_count = 0  # Reset on successful connect

            # Register WebSocket close for clean shutdown
            def _close_ws():
                try:
                    if ws.ws:
                        ws.ws.close()
                except Exception:
                    pass
            shutdown_mgr.register(_close_ws)

            while not shutdown_mgr.is_set():
                msg = dev.recv()

                if msg is None:
                    logger.debug(f"No message from {_hostname}")
                    break

                if len(msg) == 0:
                    continue

                # Debug: publish raw message
                if app_config.MQTT_HOST and _debugMode:
                    _topic = f"{app_config.MQTT_TOPIC_BASE}/message"
                    publish.single(
                        topic=_topic,
                        payload=json.dumps(msg, ensure_ascii=True),
                        qos=0,
                        retain=False,
                        hostname=app_config.MQTT_HOST,
                        port=int(app_config.MQTT_PORT),
                        keepalive=int(app_config.MQTT_KEEPALIVE),
                        auth=app_config.MQTT_AUTH,
                    )

                # Map incoming values to configured topics
                update = False
                for topic in topics:
                    value = msg.get(topic, None)
                    if value is None:
                        continue
                    new_topic = topics[topic]
                    if new_topic == "remaining":
                        state["remainingseconds"] = value
                        value = "%d:%02d" % (value / 60 / 60, (value / 60) % 60)
                    elif new_topic in ("selectedprogram", "activeprogram"):
                        # Resolve program UID to name
                        state[new_topic + "_raw"] = value
                        value = _resolve_program(value)
                    elif new_topic == "phase":
                        # Resolve phase to localized name
                        state["phase_raw"] = value
                        value = _resolve_phase(value)
                    state[new_topic] = value
                    update = True

                # Derive "programm" from selected/active program for backward compatibility
                if state.get("activeprogram") and state["activeprogram"] != "0":
                    state["programm"] = state["activeprogram"]
                elif state.get("selectedprogram"):
                    state["programm"] = state["selectedprogram"]

                if not update:
                    continue

                # Optional tabs calculation
                if "taps" in _device_config and "taps_min" in _device_config:
                    state["tabs_remaining"] = _tabs_remaining if _tabs_remaining is not None else _device_config["taps"]
                    state["tapsorder"] = _calc_tabs_order({
                        "taps": _device_config["taps"],
                        "taps_min": _device_config["taps_min"],
                    })

                # Add metadata
                state["device"] = device.get("host", _hostname)
                state["lastupdate"] = app_config.getDate()
                state["dataprovider"] = app_config.DATA_HOSTNAME
                state["version"] = app_config.APPS_VERSION
                state["attribution"] = app_config.ATTRIBUTION

                # Update shared state for dashboard
                _update_state(state)

                # Publish to MQTT
                if app_config.MQTT_HOST:
                    _topic = f"{app_config.MQTT_TOPIC_BASE}/status"
                    logger.debug(f"State update → {_topic}")
                    publish.single(
                        topic=_topic,
                        payload=json.dumps(state, ensure_ascii=True),
                        qos=0,
                        retain=True,
                        hostname=app_config.MQTT_HOST,
                        port=int(app_config.MQTT_PORT),
                        keepalive=int(app_config.MQTT_KEEPALIVE),
                        auth=app_config.MQTT_AUTH,
                    )
                else:
                    logger.warning("MQTT disabled, skip publish")

                time.sleep(2)

        except websocket.WebSocketTimeoutException:
            _timeout_count += 1
            if _timeout_count >= _TIMEOUT_WARN_THRESHOLD:
                logger.warning(f"Connection timeout ({_timeout_count}x consecutive)")
                from app.infrastructure.webhooks import notify_ha
                notify_ha("error", message=f"Connection timeout ({_timeout_count}x)", severity="warning")
                _timeout_count = 0
            if not shutdown_mgr.is_set():
                continue
        except Exception as e:
            _timeout_count = 0
            if shutdown_mgr.is_set():
                break
            # Alten WebSocket sauber schließen
            try:
                if ws and ws.ws:
                    ws.ws.close()
                    ws.ws = None
            except Exception:
                pass
            logger.error(f"Connection error: {e}")
            from app.infrastructure.webhooks import notify_ha
            notify_ha("error", message=str(e), severity="critical")
            # Exponential backoff: 5s, 10s, 20s, 40s, max 60s
            _reconnect_delay = min(5 * (2 ** min(_timeout_count, 4)), 60)
            _timeout_count += 1
            logger.info(f"Reconnecting in {_reconnect_delay}s...")
            shutdown_mgr.wait(timeout=_reconnect_delay)


# -----------------------------------------------
# HA Discovery
# -----------------------------------------------

def publishHADiscovery(brand: str, device: dict) -> bool:
    """Publish Home Assistant MQTT Discovery for a device."""
    try:
        # Always resolve paths relative to CONFIG_DIR (not from cached devices.json)
        device_name = device.get("name", "")
        ha_schema = os.path.join(app_config.CONFIG_DIR, brand, device_name, app_config.HA_SCHEMA_FILE)
        ha_items = os.path.join(app_config.CONFIG_DIR, brand, device_name, app_config.HA_DISCOVERY_FILE)
        device["ha_schema"] = ha_schema
        device["ha_items"] = ha_items

        if not os.path.isfile(ha_schema) or not os.path.isfile(ha_items):
            logger.warning(f"No HA-Discovery YAML files found: {ha_schema}")
            return True

        hadis = haDiscoveryItems(device)
        hadis.publish()
        return True

    except Exception as e:
        logger.error(f"HA Discovery error: {e}")
        return True


# -----------------------------------------------
# LWT helpers
# -----------------------------------------------

def _publish_lwt(brand: str, device_name: str, status: str) -> None:
    """Publish Last Will and Testament message."""
    if not app_config.MQTT_HOST:
        return
    _topic = f"{app_config.MQTT_TOPIC_BASE}/LWT"
    try:
        publish.single(
            topic=_topic,
            payload=status,
            qos=0,
            retain=True,
            hostname=app_config.MQTT_HOST,
            port=int(app_config.MQTT_PORT),
            keepalive=int(app_config.MQTT_KEEPALIVE),
            auth=app_config.MQTT_AUTH,
        )
        logger.info(f"LWT published: {_topic} = {status}")
    except Exception as e:
        logger.error(f"LWT publish failed: {e}")


# -----------------------------------------------
# Main service entry point
# -----------------------------------------------

def runMqttService(brand: str, shutdown_mgr) -> bool:
    """Run MQTT service for the selected brand.

    Starts HA Discovery, then spawns threads for device connection and heartbeat.
    Blocks until shutdown is signaled.
    """
    app_config.APPS_VERSION = app_config.APPS_VERSION or "2.2.0"
    global _service_start_time
    _service_start_time = app_config.getDate()
    _filename = os.path.join(app_config.CONFIG_DIR, brand, app_config.DEVICES_FILENAME)

    if not os.path.isfile(_filename):
        logger.warning(f"Config file {_filename} not found. Run cloud login first!")
        return False

    logger.info("Loading brand configuration file")
    devices = utils.loadjsondata(_filename)

    if not devices:
        logger.warning("No devices found in config")
        return False

    # Merge local config from devices.yaml into each device
    # devices.yaml is the single source of truth for hostname, topics, taps, device_info
    yaml_config = app_config.DEVICES.get(brand, {})
    for device in devices:
        if "config" not in device:
            # Find matching config by identifier or name
            for dev_id, dev_cfg in yaml_config.items():
                if isinstance(dev_cfg, dict) and "hostname" in dev_cfg:
                    device["config"] = dev_cfg
                    logger.debug(f"Merged config from devices.yaml for {device.get('name', '?')} (id={dev_id})")
                    break
            if "config" not in device:
                logger.warning(f"No config block found for device {device.get('name', '?')} – check devices.yaml")
                continue

    threads: list[threading.Thread] = []

    for device in devices:
        device_name = device.get("name", "unknown")
        _brandname = brand.lower()

        # HA Discovery
        logger.info(f"Start HA Discovery for {_brandname}/{device_name}")
        publishHADiscovery(brand, device)
        time.sleep(1)

        # LWT Online
        _publish_lwt(_brandname, device_name, "Online")

        # Device connection thread
        t1 = threading.Thread(
            target=client_connect,
            args=(device, shutdown_mgr),
            name=f"device-{device_name}",
            daemon=True,
        )
        t1.start()
        threads.append(t1)

        # Heartbeat thread
        t2 = threading.Thread(
            target=_publish_heartbeat,
            args=(device, shutdown_mgr),
            name=f"heartbeat-{device_name}",
            daemon=True,
        )
        t2.start()
        threads.append(t2)

        time.sleep(0.5)

    # Register LWT offline callback for shutdown
    def _send_offline_lwt():
        for device in devices:
            _publish_lwt(brand.lower(), device.get("name", "unknown"), "Offline")

    shutdown_mgr.register(_send_offline_lwt)

    # Block until shutdown
    logger.info(f"Service running with {len(threads)} threads")
    shutdown_mgr.wait()

    # Wait for threads to finish
    for t in threads:
        t.join(timeout=5)
        if t.is_alive():
            logger.warning(f"Thread {t.name} did not stop in time")

    logger.info("data2mqtt service stopped")
    return True
