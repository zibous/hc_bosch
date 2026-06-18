#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Parse messages from a Home Connect WebSocket (HCSocket)
and keep the connection alive.

Based on: https://github.com/osresearch/hcpy
"""

import json
import re
import sys
import time
from datetime import datetime
from typing import Optional
from base64 import urlsafe_b64encode as base64url_encode

from Crypto.Random import get_random_bytes

import logging

_log = logging.getLogger(__name__)


def now() -> str:
    """Current timestamp string."""
    return datetime.now().strftime("%Y-%m-%d %H:%M:%S.%f")


class HCDevice:
    """Home Connect device message handler."""

    def __init__(self, ws, features: Optional[dict] = None):
        self.ws = ws
        self.features = features
        self.session_id: Optional[int] = None
        self.tx_msg_id: Optional[int] = None
        self.device_name = "hcpy"
        self.device_id = "0dishwa"
        self.debug = False
        self.services: dict = {}

    def parse_values(self, values: list) -> dict:
        """Parse device values using the feature mapping."""
        if not self.features:
            return values  # type: ignore[return-value]

        result: dict = {}

        for msg in values:
            uid = str(msg["uid"])
            value = msg["value"]
            value_str = str(value)

            name = uid
            status = self.features.get(uid)

            if status:
                name = status["name"]
                if "values" in status and value_str in status["values"]:
                    value = status["values"][value_str]

            # Trim everything off the name except the last part
            name = re.sub(r"^.*\.", "", name)
            result[name] = value

        return result

    _last_recv_error: float = 0
    _recv_error_count: int = 0

    def recv(self) -> Optional[dict]:
        """Receive and parse a message from the device."""
        try:
            buf = self.ws.recv()
            if buf is None:
                return None
            # Reset error counter on success
            HCDevice._recv_error_count = 0
        except Exception as e:
            HCDevice._recv_error_count += 1
            now_t = time.monotonic()
            # Log max once per 5 minutes when idle, every 60s when running
            interval = 60 if HCDevice._recv_error_count > 5 else 300
            if now_t - HCDevice._last_recv_error >= interval:
                if HCDevice._recv_error_count > 5:
                    _log.warning("receive error (%dx): %s", HCDevice._recv_error_count, e)
                else:
                    _log.debug("receive error (%dx): %s", HCDevice._recv_error_count, e)
                HCDevice._last_recv_error = now_t
                HCDevice._recv_error_count = 0
            return None

        try:
            return self.handle_message(buf)
        except Exception as e:
            print(f"{__name__}: error handling msg {e}", file=sys.stderr)
            return None

    def reply(self, msg: dict, reply_data: dict) -> None:
        """Reply to a POST or GET message with new data."""
        self.ws.send({
            "sID": msg["sID"],
            "msgID": msg["msgID"],
            "resource": msg["resource"],
            "version": msg["version"],
            "action": "RESPONSE",
            "data": [reply_data],
        })

    def get(self, resource: str, version: int = 1, action: str = "GET",
            data: Optional[dict] = None) -> None:
        """Send a GET/NOTIFY message to the device."""
        msg: dict = {
            "sID": self.session_id,
            "msgID": self.tx_msg_id,
            "resource": resource,
            "version": version,
            "action": action,
        }

        if data is not None:
            msg["data"] = [data]

        self.ws.send(msg)
        if self.tx_msg_id is not None:
            self.tx_msg_id += 1

    def handle_message(self, buf) -> dict:
        """Parse a raw message and return extracted values."""
        msg = json.loads(buf)
        if self.debug:
            print(now(), __name__, "RX:", msg)
        sys.stdout.flush()

        resource = msg["resource"]
        action = msg["action"]
        values: dict = {}

        if "code" in msg:
            values = {
                "error": msg["code"],
                "resource": msg.get("resource", ""),
            }

        elif action == "POST":
            if resource == "/ei/initialValues":
                self.session_id = msg["sID"]
                self.tx_msg_id = msg["data"][0]["edMsgID"]

                self.reply(msg, {
                    "deviceType": "Application",
                    "deviceName": self.device_name,
                    "deviceID": self.device_id,
                })

                self.get("/ci/services")

                token = base64url_encode(get_random_bytes(32)).decode("UTF-8")
                token = re.sub(r"=", "", token)
                self.get("/ci/authentication", version=2, data={"nonce": token})

                self.get("/ci/info", version=2)
                self.get("/iz/info")
                self.get("/ni/info")
                self.get("/ei/deviceReady", version=2, action="NOTIFY")
                self.get("/ro/allDescriptionChanges")
                self.get("/ro/allDescriptionChanges")
                self.get("/ro/allMandatoryValues")
            else:
                print(now(), __name__, "Unknown resource", resource, file=sys.stderr)

        elif action in ("RESPONSE", "NOTIFY"):
            if resource in ("/iz/info", "/ci/info"):
                pass
            elif resource in ("/ro/descriptionChange", "/ro/allDescriptionChanges"):
                pass
            elif resource == "/ni/info":
                pass
            elif resource in ("/ro/allMandatoryValues", "/ro/values"):
                values = self.parse_values(msg["data"])
            elif resource == "/ci/registeredDevices":
                pass
            elif resource == "/ci/services":
                self.services = {}
                for service in msg["data"]:
                    self.services[service["service"]] = {
                        "version": service["version"],
                    }
            else:
                print(now(), __name__, "Unknown message", msg, file=sys.stderr)

        return values
