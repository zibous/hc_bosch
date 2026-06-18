#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Home Assistant MQTT Discovery for Home Connect devices.

Reads entity definitions from YAML files and publishes
MQTT Discovery messages to Home Assistant.
"""

import json
import os

import paho.mqtt.publish as publish
import logging
from app.core import utils
from app.core.config import settings as app_config


logger = logging.getLogger(__name__) # Nutzt automatisch die Konfiguration aus app.py

# Optional attributes that may be present in discovery items
_OPTIONAL_ATTRS = [
    "ic", "device_class", "unit_of_meas", "state_class",
    "payload_on", "payload_off", "ent_cat", "sa", "command_topic",
]


class haDiscoveryItems:
    """Generate and publish Home Assistant MQTT Discovery items."""

    def __init__(self, config: dict):
        self.cd = config
        # Derive HA fields from existing data – no need to store in devices.json
        self.brand = config.get("brand", config.get("description", {}).get("brand", "unknown"))
        brand_lower = self.brand.lower()
        name = config.get("name", "unknown")
        if "brandname" not in self.cd:
            self.cd["brandname"] = brand_lower
        if "deviceid" not in self.cd:
            self.cd["deviceid"] = f"{brand_lower}-{name}"
        if "discovery_prefix" not in self.cd:
            self.cd["discovery_prefix"] = app_config.HA_DISCOVERY_PREFIX
        # Device info for HA Discovery "dev" block – from devices.yaml
        self.device_info = self._build_device_info()

    def _build_device_info(self) -> dict | None:
        """Build the HA Discovery device info block from config."""
        device_config = self.cd.get("config", {})
        dev_info = device_config.get("device_info")
        if dev_info and isinstance(dev_info, dict):
            return dict(dev_info)
        return None

    def publish(self) -> int:
        """Publish all HA Discovery items based on YAML configuration.

        Returns:
            Number of published items, or 0 on failure.
        """
        try:
            ha_schema = self.cd.get("ha_schema", "")
            ha_items = self.cd.get("ha_items", "")

            if not os.path.isfile(ha_schema) or not os.path.isfile(ha_items):
                logger.debug("HA Discovery YAML files not found")
                return 0

            data = utils.loadYaml(ha_items)
            payloads = utils.loadYaml(ha_schema)

            if data is None or payloads is None:
                logger.debug(f"No data found in {ha_schema} or {ha_items}")
                return 0

            logger.debug(f"Loaded HA Discovery files: {ha_schema}, {ha_items}")

            items = data.get("items", [])
            counter = 0

            for item in items:
                if not item.get("enabled") or "schema" not in item:
                    continue

                item_type = item["type"]
                schema_key = item["schema"]

                if schema_key not in payloads:
                    logger.warning(f"Schema '{schema_key}' not found in {ha_schema}")
                    continue

                # Build payload from schema template
                payload = dict(payloads[schema_key])

                # GUI name and entity IDs
                payload["name"] = f"{self.cd.get('brand', '')} {item['name']}"

                uniq_id = f"{self.cd.get('deviceid', '')}.{item['field']}".replace("-", "_")
                payload["uniq_id"] = uniq_id.replace(".", "_")
                payload["object_id"] = f"{self.cd.get('brandname', '')}_{uniq_id}"

                # Value template
                val_tpl = item.get("val_tpl", f"{{{{value_json.{item['field']}}}}}")
                payload["val_tpl"] = val_tpl

                # Copy optional fields from item
                for key in ("json_attr_t", "~", "stat_t", "ent_cat"):
                    if key in item:
                        payload[key] = item[key]

                # Update/remove optional attributes
                for tag in _OPTIONAL_ATTRS:
                    if tag in item:
                        payload[tag] = item[tag]
                    elif tag in payload:
                        del payload[tag]

                # Inject device info block
                if self.device_info:
                    payload["dev"] = self.device_info

                # Build topic
                topic_name = item["field"].replace(".", "_").lower()
                discovery_prefix = self.cd.get("discovery_prefix")

                if not discovery_prefix:
                    continue

                topic = f"{discovery_prefix}/{item_type}/{self.cd.get('deviceid', '')}/{topic_name}/config"

                if app_config.DEBUG:
                    logger.debug(f"Publish discovery: {topic_name} → {topic}")

                # Publish to MQTT
                if app_config.MQTT_HOST:
                    try:
                        publish.single(
                            topic=topic,
                            payload=json.dumps(payload, ensure_ascii=True),
                            qos=0,
                            retain=True,
                            hostname=app_config.MQTT_HOST,
                            port=int(app_config.MQTT_PORT),
                            keepalive=int(app_config.MQTT_KEEPALIVE),
                            auth=app_config.MQTT_AUTH,
                        )
                    except Exception as e:
                        logger.error(f"Failed to publish discovery for {topic_name}: {e}")
                        continue

                # Save payload in developer mode
                if app_config.DEBUG:
                    path = os.path.join(app_config.DATA_DIR, "ha", self.cd.get("brandname", ""), item_type)
                    os.makedirs(path, exist_ok=True)
                    ha_file = os.path.join(path, f"{counter + 1}-{topic_name}.json")
                    try:
                        with open(ha_file, "w", encoding="utf-8") as f:
                            json.dump(payload, f, indent=4, ensure_ascii=False)
                    except Exception as e:
                        logger.warning(f"Failed to save discovery payload: {e}")

                counter += 1

            logger.info(f"Published {counter} HA Discovery items")
            return counter

        except Exception as e:
            logger.error(f"HA Discovery error: {e}")
            return 0
