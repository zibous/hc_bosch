import threading
import time
import json
from datetime import datetime, timezone
from typing import Optional

def _iso_now() -> str:
    return datetime.now(timezone.utc).astimezone().isoformat()

class Heartbeat:
    """
    Publisht periodisch einen retained Heartbeat via mqtt_client in Hintergrundthread.
    - mqtt_client.publish must accept keyword args: payload=..., topic=..., qos=..., retain=...
    - shutdown_mgr must implement is_set() and wait(timeout)
    """

    def __init__(self, mqtt_client, topic: str, logger, shutdown_mgr, interval_s: int = 60):
        self.mqtt_client = mqtt_client
        self.topic = topic
        self.logger = logger
        self.shutdown_mgr = shutdown_mgr
        self.interval_s = int(interval_s)
        self._thread: Optional[threading.Thread] = None
        self._start_ts: Optional[float] = None
        self._counter_lock = threading.Lock()
        self._readings_count = 0
        self._stop_flag = threading.Event()
        self._publish_lock = threading.Lock()

    def start(self) -> None:
        """Startet den Heartbeat-Worker (idempotent)."""
        if self._thread and self._thread.is_alive():
            return
        self._start_ts = time.time()
        self._thread = threading.Thread(target=self._worker, name="heartbeat", daemon=True)
        self._thread.start()
        # ensure stop() is called on shutdown
        try:
            self.shutdown_mgr.register(self.stop)
        except Exception:
            # best-effort: some shutdown_mgr implementations may not accept register
            self.logger.debug("shutdown_mgr.register failed (best-effort)", exc_info=True)

    def increment(self, n: int = 1) -> None:
        """Erhöht den Zähler der verarbeiteten Readings."""
        with self._counter_lock:
            self._readings_count += int(n)

    def _payload(self, status: str) -> dict:
        with self._counter_lock:
            rc = self._readings_count
        since = None
        if self._start_ts is not None:
            since = datetime.fromtimestamp(self._start_ts, timezone.utc).astimezone().isoformat()
        else:
            since = _iso_now()
        return {
            "status": status,
            "since": since,
            "uptime_s": int(time.time() - (self._start_ts or time.time())),
            "readings_count": rc,
            "interval_s": self.interval_s,
            "ts": _iso_now(),
        }

    def _publish_best_effort(self, payload_obj: dict, attempts: int = 3, backoff_s: float = 0.5) -> bool:
        """Publisht payload als JSON string mit retries; verwendet keyword-args für mqtt_client.publish."""
        payload_str = json.dumps(payload_obj)
        for attempt in range(1, attempts + 1):
            try:
                # protect publish calls from concurrent threads
                with self._publish_lock:
                    self.mqtt_client.publish(payload=payload_str, topic=self.topic, qos=1, retain=True)
                return True
            except Exception:
                self.logger.warning("Heartbeat publish failed (attempt %d/%d)", attempt, attempts, exc_info=True)
                if attempt < attempts:
                    time.sleep(backoff_s)
        return False

    def _worker(self) -> None:
        self.logger.info("Heartbeat thread started, interval=%s", self.interval_s)
        try:
            while not self.shutdown_mgr.is_set() and not self._stop_flag.is_set():
                try:
                    payload = self._payload("running")
                    ok = self._publish_best_effort(payload)
                    if ok:
                        self.logger.debug("Heartbeat published to %s", self.topic)
                    else:
                        self.logger.error("Heartbeat publish ultimately failed after retries")
                except Exception:
                    self.logger.exception("Heartbeat worker publish error")

                # Reagiere schnell auf Shutdown oder Stop-Flag
                if self.shutdown_mgr.wait(timeout=self.interval_s) or self._stop_flag.wait(timeout=0):
                    break
        except Exception:
            self.logger.exception("Unexpected error in heartbeat worker")
        finally:
            # publish offline (best-effort) on exit
            try:
                payload = self._payload("offline")
                ok = self._publish_best_effort(payload)
                if ok:
                    self.logger.debug("Heartbeat offline published")
                else:
                    self.logger.warning("Failed to publish heartbeat offline after retries")
            except Exception:
                self.logger.exception("Failed to publish heartbeat offline (exception)")

    def stop(self, join_timeout: float = 2.0) -> None:
        """Signalisiert dem Worker zu stoppen und wartet kurz auf Join (nicht-blockierend)."""
        self._stop_flag.set()
        if self._thread and self._thread.is_alive():
            self._thread.join(timeout=join_timeout)
            if self._thread.is_alive():
                self.logger.warning("Heartbeat thread did not stop within %ss", join_timeout)
