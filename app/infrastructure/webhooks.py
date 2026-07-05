#!/usr/bin/env python3
# -*- coding: utf-8 -*-

"""
Webhook notifications to Home Assistant.

Events: app_start, app_stop, session_end, session_summary, heartbeat, error
"""

import requests
from typing import Optional, Dict, Any
import logging
logger = logging.getLogger(__name__) # Nutzt automatisch die Konfiguration aus app.py



class Webhook:
    def __init__(self, base_url: str, webhook_id: str, timeout: int = 5, log_file: str = None):
        self.base_url = base_url.rstrip("/")
        self.webhook_id = webhook_id
        self.timeout = timeout
        self.log_file = log_file

    @property
    def url(self) -> str:
        return f"{self.base_url}/api/webhook/{self.webhook_id}"

    def send(self, data: Optional[Dict[str, Any]] = None) -> bool:
        try:
            response = requests.post(
                self.url,
                json=data or {},
                timeout=self.timeout
            )
            response.raise_for_status()
            # self._log_payload(data, ok=True)
            return True
        except requests.RequestException as e:
            logger.debug(f"Webhook send failed: {e}")
            self._log_payload(data, ok=False, error=str(e))
            return False

    def _log_payload(self, data: Optional[Dict[str, Any]], ok: bool, error: str = None):
        """Schreibt jeden Webhook-Payload in eine JSONL-Datei."""
        if not self.log_file:
            return
        try:
            import json, os
            from datetime import datetime
            os.makedirs(os.path.dirname(self.log_file), exist_ok=True)
            entry = {
                "ts": datetime.now().isoformat(timespec="seconds"),
                "webhook_id": self.webhook_id,
                "ok": ok,
            }
            if data:
                entry.update(data)
            if error:
                entry["error"] = error
            with open(self.log_file, "a", encoding="utf-8") as f:
                f.write(json.dumps(entry, ensure_ascii=False) + "\n")
        except Exception:
            pass  # Logging darf nie die App crashen


_webhook: Optional[Webhook] = None


def _get_webhook() -> Optional[Webhook]:
    """Lazy-init webhook from app_config."""
    global _webhook
    if _webhook is not None:
        return _webhook
    try:
        from app.core.config import settings as app_config
        url = app_config.HA_WEBHOOK_URL
        wid = app_config.HA_WEBHOOK_ID
        if url and wid:
            log_file = getattr(app_config, "WEBHOOK_LOG_FILE", None) or "logs/webhooks.jsonl"
            _webhook = Webhook(base_url=url, webhook_id=wid, log_file=log_file)
            return _webhook
    except Exception:
        pass
    _webhook = None  # type: ignore
    return None


def notify_ha(event: str, **kwargs: Any) -> bool:
    """Send a webhook event to Home Assistant (if configured).

    Supported events:
        app_start    – version
        app_stop     – version, uptime
        session_end  – result, program, duration_min, energy_kwh, water_liters, tabs_remaining
        session_summary – program, duration_min, energy_kwh, water_liters, cost_total
        heartbeat    – uptime, status
        error        – message, severity
    """
    wh = _get_webhook()
    if not wh:
        return False
    try:
        from app.core.config import settings as app_config
        payload: Dict[str, Any] = {
            "event": event,
            "device": "dishwasher",
            "timestamp": app_config.getTimestamp(),
        }
        payload.update(kwargs)
        return wh.send(payload)
    except Exception as e:
        logger.debug(f"Webhook error: {e}")
        return False


def notify_session_summary(session_data: dict, costs: dict | None = None) -> bool:
    """Send a session summary webhook with cost calculation.

    Args:
        session_data: Dict from db.get_last_session()
        costs: Dict with 'strom' and 'wasser' keys (€/kWh, €/m³)
    """
    if not session_data:
        return False

    kwh = session_data.get("energy_kwh") or 0
    liters = session_data.get("water_liters") or 0
    cost_total = 0.0
    if costs:
        cost_total = round(
            kwh * costs.get("strom", 0) + (liters / 1000) * costs.get("wasser", 0), 3
        )

    return notify_ha(
        "session_summary",
        program=session_data.get("program", ""),
        duration_min=session_data.get("duration_min", 0),
        energy_kwh=round(kwh, 4),
        water_liters=round(liters, 2),
        cost_strom=round(kwh * (costs or {}).get("strom", 0), 3) if costs else 0,
        cost_wasser=round((liters / 1000) * (costs or {}).get("wasser", 0), 3) if costs else 0,
        cost_total=cost_total,
        result=session_data.get("result", ""),
        start_time=session_data.get("start_time", ""),
        end_time=session_data.get("end_time", ""),
    )
