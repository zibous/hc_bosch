#!/usr/bin/python3
# -*- coding: utf-8 -*-

"""MQTT client wrapper using paho publish.single() with retry and backoff."""

import json
import time
import threading
from typing import Any

import paho.mqtt.publish as publish
import logging
logger = logging.getLogger(__name__) # Nutzt automatisch die Konfiguration aus app.py


class MqttClient:
    """MQTT client that publishes messages via publish.single() with retry."""

    def __init__(self, host: str, port: int, client_id: str, auth: dict[str, str] | None = None):
        self.host = host
        self.port = int(port)
        self.client_id = client_id
        self.auth: Any = auth  # paho 2.x accepts dict, typed as Any to avoid Pyright warnings
        self._connected = False
        self._lock = threading.Lock()

    @property
    def is_connected(self) -> bool:
        return self._connected

    def publish(
        self,
        payload: Any,
        topic: str,
        qos: int = 0,
        retain: bool = False,
        keepalive: int = 60,
        max_retries: int = 3,
    ) -> bool:
        """Publish a message to the MQTT broker with retry and exponential backoff.

        Returns:
            True on success, False on failure.
        """
        if not self.host:
            return False

        if isinstance(payload, (dict, list)):
            payload_str = json.dumps(payload, ensure_ascii=True)
        else:
            payload_str = str(payload)

        for attempt in range(max_retries):
            try:
                with self._lock:
                    publish.single(
                        topic=topic,
                        payload=payload_str,
                        qos=qos,
                        retain=retain,
                        hostname=self.host,
                        port=self.port,
                        keepalive=keepalive,
                        auth=self.auth,
                    )
                self._connected = True
                return True
            except Exception as e:
                self._connected = False
                if attempt < max_retries - 1:
                    wait = min(2 ** attempt, 10)
                    time.sleep(wait)
                else:
                    logger.error(f"MQTT publish failed [{topic}]: {e}")
        return False
