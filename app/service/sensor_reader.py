#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Read energy and water meter values from external sensors.

Supports:
- Water: ESPHome ESP32 water meter (HTTP text_sensor)
- Energy: Sonoff Pow (Tasmota HTTP API, STATUS 8)

Responses are cached briefly (default 5s) to avoid redundant HTTP requests
when multiple values are read from the same sensor within a short window.
"""

import time
from typing import Optional
import requests

import logging
logger = logging.getLogger(__name__) # Nutzt automatisch die Konfiguration aus app.py



class SensorReader:
    """Read current meter values from water and energy sensors."""

    CACHE_TTL = 5  # seconds – how long a cached response stays valid

    def __init__(self, water_url: str = "", energy_url: str = "", timeout: int = 10):
        """
        Args:
            water_url: ESPHome water meter URL, e.g. http://atom-watermeter.siebler.home/text_sensor/watermeterdata
            energy_url: Sonoff Pow URL, e.g. http://10.1.1.118/cm?cmnd=STATUS+8
            timeout: HTTP request timeout in seconds
        """
        self.water_url = water_url.strip() if water_url else ""
        self.energy_url = energy_url.strip() if energy_url else ""
        self.timeout = timeout

        # Response cache: {url: (timestamp, json_data)}
        self._cache: dict[str, tuple[float, dict]] = {}

    @property
    def has_water_sensor(self) -> bool:
        return bool(self.water_url)

    @property
    def has_energy_sensor(self) -> bool:
        return bool(self.energy_url)

    def _fetch_json(self, url: str) -> Optional[dict]:
        """Fetch JSON from URL with short-lived cache.

        Returns cached response if still valid (within CACHE_TTL seconds),
        otherwise makes a new HTTP request and caches the result.
        """
        now = time.monotonic()
        cached = self._cache.get(url)
        if cached:
            ts, data = cached
            if (now - ts) < self.CACHE_TTL:
                return data

        try:
            # NEU: Loggt den physischen HTTP-Aufruf an Tasmota / ESPHome
            logger.debug(f"Sensor-Polling gestartet: {url}")

            r = requests.get(url, timeout=self.timeout)
            r.raise_for_status()
            data = r.json()
            self._cache[url] = (now, data)

            # NEU: Bestätigt den erfolgreichen Empfang der Zählerdaten
            logger.debug(f"Sensor-Polling erfolgreich. Daten empfangen von: {url}")
            return data
        except Exception as e:
            # Invalidate cache on failure
            self._cache.pop(url, None)
            logger.warning(f"Sensor fetch failed ({url}): {e}")
            return None


    def invalidate_cache(self) -> None:
        """Force-clear the response cache (e.g. between sessions)."""
        self._cache.clear()

    def read_water_m3(self) -> Optional[float]:
        """Read current water meter value in m³ from ESPHome sensor.

        Supports both formats:
        - New: {"id": "...", "value": 171.858, "state": "171.858 m³"}
        - Legacy: {"value": "158.211│0.992│..."}

        Returns:
            Current meter reading in m³, or None on failure.
        """
        if not self.water_url:
            return None
        data = self._fetch_json(self.water_url)
        if data is None:
            return None
        try:
            value = data.get("value")
            # New ESPHome format: value is already a float
            if isinstance(value, (int, float)):
                return float(value)
            # Legacy text_sensor format: "158.211│0.992│..."
            if isinstance(value, str):
                if "│" in value:
                    return float(value.split("│")[0].strip())
                return float(value.strip())
            return None
        except (ValueError, AttributeError, TypeError) as e:
            logger.warning(f"Water sensor parse failed: {e}")
            return None

    def read_energy_kwh(self) -> Optional[float]:
        """Read current energy meter total in kWh from Sonoff Pow (Tasmota).

        Returns:
            Current total energy in kWh, or None on failure.
        """
        if not self.energy_url:
            return None
        data = self._fetch_json(self.energy_url)
        if data is None:
            return None
        try:
            # Tasmota STATUS 8: {"StatusSNS":{"ENERGY":{"Total":288.273,...}}}
            total = data.get("StatusSNS", {}).get("ENERGY", {}).get("Total")
            if total is not None:
                return float(total)
            return None
        except (ValueError, TypeError) as e:
            logger.warning(f"Energy kWh parse failed: {e}")
            return None

    def read_energy_power_w(self) -> Optional[float]:
        """Read current power consumption in Watts from Sonoff Pow.

        Returns:
            Current power in Watts, or None on failure.
        """
        if not self.energy_url:
            return None
        data = self._fetch_json(self.energy_url)
        if data is None:
            return None
        try:
            power = data.get("StatusSNS", {}).get("ENERGY", {}).get("Power")
            if power is not None:
                return float(power)
            return None
        except (ValueError, TypeError) as e:
            logger.warning(f"Energy power parse failed: {e}")
            return None

    def read_all(self) -> dict:
        """Read all available sensor values.

        Returns:
            Dict with water_m3 and energy_kwh (None if sensor not available/failed).
        """
        return {
            "water_m3": self.read_water_m3(),
            "energy_kwh": self.read_energy_kwh(),
        }
