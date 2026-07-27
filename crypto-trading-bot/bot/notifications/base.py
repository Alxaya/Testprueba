"""Sistema de alertas.

Regla de oro: **una notificación lenta jamás puede bloquear el trading**. Por eso
todo notificador que haga red encola y envía en segundo plano, y cualquier fallo
al notificar se registra pero nunca se propaga.

La segunda regla es la deduplicación: un bot que se cae en bucle puede generar
cientos de alertas idénticas y hacer que Telegram te silencie justo cuando llegue
la alerta que sí importaba.
"""

from __future__ import annotations

import time
from abc import ABC, abstractmethod
from collections.abc import Sequence

from bot.core.enums import AlertLevel
from bot.core.logging_setup import get_logger

log = get_logger("notifications")


class Notifier(ABC):
    """Canal de notificación."""

    def __init__(self, min_level: AlertLevel = AlertLevel.INFO) -> None:
        self.min_level = min_level

    def should_send(self, level: AlertLevel) -> bool:
        return level.rank >= self.min_level.rank

    @abstractmethod
    def send(self, message: str, level: AlertLevel = AlertLevel.INFO, *, title: str = "") -> bool:
        """Envía el mensaje. Devuelve `True` si se envió. **Nunca debe lanzar.**"""

    def info(self, message: str, *, title: str = "") -> bool:
        return self.send(message, AlertLevel.INFO, title=title)

    def warning(self, message: str, *, title: str = "") -> bool:
        return self.send(message, AlertLevel.WARNING, title=title)

    def error(self, message: str, *, title: str = "") -> bool:
        return self.send(message, AlertLevel.ERROR, title=title)

    def critical(self, message: str, *, title: str = "") -> bool:
        return self.send(message, AlertLevel.CRITICAL, title=title)

    def close(self) -> None:
        """Vacía la cola pendiente y libera recursos."""


class NullNotifier(Notifier):
    """No envía nada. Es el valor por defecto y el que se usa en tests."""

    def send(self, message: str, level: AlertLevel = AlertLevel.INFO, *, title: str = "") -> bool:
        log.debug("[alerta ignorada][%s] %s %s", level.value, title, message)
        return True


class ConsoleNotifier(Notifier):
    """Escribe las alertas por consola. Útil en desarrollo."""

    def send(self, message: str, level: AlertLevel = AlertLevel.INFO, *, title: str = "") -> bool:
        if not self.should_send(level):
            return False
        header = f"{level.emoji} {title}" if title else level.emoji
        print(f"{header} {message}")
        return True


class CompositeNotifier(Notifier):
    """Reenvía a varios canales. El fallo de uno no afecta a los demás."""

    def __init__(self, notifiers: Sequence[Notifier], min_level: AlertLevel = AlertLevel.DEBUG) -> None:
        super().__init__(min_level)
        self.notifiers = list(notifiers)

    def send(self, message: str, level: AlertLevel = AlertLevel.INFO, *, title: str = "") -> bool:
        sent = False
        for notifier in self.notifiers:
            try:
                sent = notifier.send(message, level, title=title) or sent
            except Exception:
                log.exception("Fallo en el notificador %s", type(notifier).__name__)
        return sent

    def close(self) -> None:
        for notifier in self.notifiers:
            try:
                notifier.close()
            except Exception:
                log.debug("Fallo al cerrar %s", type(notifier).__name__, exc_info=True)


class Deduplicator:
    """Evita repetir el mismo mensaje dentro de una ventana temporal."""

    def __init__(self, window_seconds: float = 300.0) -> None:
        self.window = window_seconds
        self._seen: dict[str, float] = {}

    def is_duplicate(self, key: str) -> bool:
        if self.window <= 0:
            return False
        now = time.monotonic()
        last = self._seen.get(key)
        if last is not None and now - last < self.window:
            return True
        self._seen[key] = now
        if len(self._seen) > 1000:  # poda perezosa
            cutoff = now - self.window
            self._seen = {k: v for k, v in self._seen.items() if v > cutoff}
        return False
