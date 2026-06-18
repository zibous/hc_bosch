import threading
import signal
import sys
import faulthandler
from typing import Callable, List, Optional

class ShutdownManager:
    """
    Koordiniert sauberen, robusten Shutdown.
    - Callbacks werden parallel ausgeführt und mit Timeout gejoint.
    - Signalhandler für SIGINT/SIGTERM sind enthalten.
    - Methoden: register(callback), initiate(per_callback_timeout), is_set(), wait(timeout).
    """

    def __init__(self, logger):
        self.logger = logger
        self._event = threading.Event()
        self._completed = False
        self._lock = threading.Lock()
        self._callbacks: List[Callable[[], None]] = []

    def register(self, callback: Callable[[], None]) -> None:
        """Registriert eine Callback-Funktion, die beim Shutdown aufgerufen wird."""
        if not callable(callback):
            raise TypeError("callback must be callable")
        self._callbacks.append(callback)

    def initiate(self, per_callback_timeout: float = 5.0, dump_threads_on_start: bool = False) -> None:
        """
        Startet den Shutdown:
        - setzt das interne Event
        - startet jede Callback in einem eigenen Thread (daemon)
        - wartet pro Callback maximal `per_callback_timeout` Sekunden
        - optional: Thread-Stacks ausgeben (dump_threads_on_start=True)
        """
        with self._lock:
            if self._completed:
                self.logger.debug("ShutdownManager: initiate called but already completed")
                return
            self._completed = True
            self._event.set()

        self.logger.info("ShutdownManager: initiating graceful shutdown")

        if dump_threads_on_start:
            try:
                faulthandler.dump_traceback(file=sys.stderr, all_threads=True)
            except Exception:
                self.logger.exception("Failed to dump thread tracebacks")

        def _safe_call(cb: Callable[[], None]) -> None:
            name = getattr(cb, "__name__", repr(cb))
            try:
                self.logger.info(f"Shutdown callback start: {name}")
                cb()
                self.logger.info(f"Shutdown callback finished: {name}")
            except Exception:
                self.logger.exception("Shutdown callback failed: %s", name)

        threads: list[tuple[threading.Thread, Callable[[], None]]] = []
        for cb in self._callbacks:
            t = threading.Thread(target=_safe_call, args=(cb,), daemon=True)
            t.start()
            threads.append((t, cb))

        # join each thread with timeout so a stuck callback can't hang shutdown
        for t, cb in threads:
            try:
                t.join(per_callback_timeout)
            except Exception:
                self.logger.exception("Error while joining shutdown callback thread")
            if t.is_alive():
                self.logger.warning(
                    f"Shutdown callback {getattr(cb, '__name__', repr(cb))} did not finish within {per_callback_timeout}s"
                )

    def is_set(self) -> bool:
        """Gibt True zurück, wenn Shutdown angefordert wurde."""
        return self._event.is_set()

    def wait(self, timeout: Optional[float] = None) -> bool:
        """Wartet auf das Shutdown-Event (oder Timeout)."""
        return self._event.wait(timeout)

    def install_signal_handlers(self) -> None:
        """Installiert SIGINT/SIGTERM Handler, die initiate() aufrufen.
        Zweites Signal erzwingt sofortigen Exit."""
        self._signal_count = 0

        def _handler(signum, frame):
            self._signal_count += 1
            if self._signal_count > 1:
                self.logger.warning("Zweites Signal – erzwinge Exit")
                sys.exit(1)
            try:
                self.logger.info(f"Signal empfangen {signum}, starte Shutdown")
                self.initiate()
            except Exception:
                sys.exit(1)

        signal.signal(signal.SIGINT, _handler)
        signal.signal(signal.SIGTERM, _handler)
