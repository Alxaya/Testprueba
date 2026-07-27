"""Alertas por Telegram.

## Cómo configurarlo (5 minutos)

1. Abre Telegram y habla con [@BotFather](https://t.me/BotFather) → `/newbot`.
   Te dará un token con el formato `123456789:AAG...`.
2. Escribe cualquier cosa a tu bot recién creado (si no, no puede responderte).
3. Abre `https://api.telegram.org/bot<TOKEN>/getUpdates` y copia el `chat.id`.
4. Ponlos en el `.env`:

       TELEGRAM_BOT_TOKEN=123456789:AAG...
       TELEGRAM_CHAT_ID=987654321

5. Activa `notifications.telegram.enabled: true` en el YAML.

## Decisiones de implementación

* **Cola en un hilo aparte.** El trading nunca espera a la red de Telegram.
* **Deduplicación.** Un bot en bucle de error podría mandar cientos de mensajes
  idénticos y hacer que Telegram te limite justo cuando llegue la alerta buena.
* **Respeto del rate limit** (~30 mensajes/segundo global, 1/segundo por chat).
* **El token nunca se registra en logs**: el filtro de secretos lo enmascara.
"""

from __future__ import annotations

import contextlib
import html
import queue
import threading
import time

from bot.core.enums import AlertLevel
from bot.core.logging_setup import get_logger
from bot.notifications.base import Deduplicator, Notifier

log = get_logger("notifications.telegram")

_API_URL = "https://api.telegram.org/bot{token}/sendMessage"
#: Telegram corta los mensajes en 4096 caracteres.
_MAX_LENGTH = 4000


class TelegramNotifier(Notifier):
    """Envía alertas a un chat de Telegram desde un hilo en segundo plano."""

    def __init__(
        self,
        token: str,
        chat_id: str,
        *,
        min_level: AlertLevel = AlertLevel.INFO,
        dedupe_window_s: float = 300.0,
        timeout: float = 10.0,
        max_queue: int = 500,
    ) -> None:
        super().__init__(min_level)
        self._token = token
        self._chat_id = chat_id
        self._timeout = timeout
        self._dedupe = Deduplicator(dedupe_window_s)
        self._queue: queue.Queue[tuple[str, AlertLevel] | None] = queue.Queue(maxsize=max_queue)
        self._stop = threading.Event()
        self._last_send = 0.0
        self._worker = threading.Thread(target=self._run, name="telegram-notifier", daemon=True)
        self._worker.start()

    # ------------------------------------------------------------- interfaz

    def send(self, message: str, level: AlertLevel = AlertLevel.INFO, *, title: str = "") -> bool:
        """Encola el mensaje. Devuelve `False` si se filtró o la cola está llena."""
        if not self.should_send(level):
            return False

        key = f"{level.value}:{title}:{message[:120]}"
        if self._dedupe.is_duplicate(key):
            log.debug("Alerta duplicada, no se reenvía: %s", key[:60])
            return False

        body = self._format(message, level, title)
        try:
            self._queue.put_nowait((body, level))
            return True
        except queue.Full:
            # Perder una alerta es malo; bloquear el bucle de trading es peor.
            log.warning("Cola de Telegram llena: alerta descartada")
            return False

    def close(self) -> None:
        """Espera a que se vacíe la cola (con límite) y para el hilo."""
        with contextlib.suppress(queue.Full):
            self._queue.put_nowait(None)
        self._stop.set()
        self._worker.join(timeout=10.0)

    # -------------------------------------------------------------- interno

    def _format(self, message: str, level: AlertLevel, title: str) -> str:
        """Formato HTML de Telegram, escapando el contenido para no romper el parseo."""
        parts = [f"{level.emoji} <b>{html.escape(title)}</b>"] if title else [level.emoji]
        parts.append(html.escape(message))
        text = "\n".join(parts)
        if len(text) > _MAX_LENGTH:
            text = text[: _MAX_LENGTH - 20] + "\n… (truncado)"
        return text

    def _run(self) -> None:
        """Bucle del hilo emisor."""
        while not (self._stop.is_set() and self._queue.empty()):
            try:
                item = self._queue.get(timeout=0.5)
            except queue.Empty:
                continue
            if item is None:
                self._queue.task_done()
                break
            text, level = item
            try:
                self._deliver(text, level)
            except Exception:
                log.exception("Fallo enviando alerta a Telegram")
            finally:
                self._queue.task_done()

    def _deliver(self, text: str, level: AlertLevel, attempts: int = 3) -> None:
        """Envía con reintentos y respetando el rate limit del chat (1 msg/s)."""
        import httpx

        elapsed = time.monotonic() - self._last_send
        if elapsed < 1.05:
            time.sleep(1.05 - elapsed)

        url = _API_URL.format(token=self._token)
        payload = {
            "chat_id": self._chat_id,
            "text": text,
            "parse_mode": "HTML",
            "disable_web_page_preview": True,
            # Las alertas informativas no vibran el teléfono de madrugada.
            "disable_notification": level.rank < AlertLevel.WARNING.rank,
        }

        for attempt in range(attempts):
            try:
                response = httpx.post(url, json=payload, timeout=self._timeout)
                self._last_send = time.monotonic()
                if response.status_code == 200:
                    return
                if response.status_code == 429:
                    retry_after = float(response.json().get("parameters", {}).get("retry_after", 5))
                    log.warning("Telegram rate limit: esperando %.0fs", retry_after)
                    time.sleep(min(retry_after, 60))
                    continue
                log.warning("Telegram devolvió %d: %s", response.status_code, response.text[:200])
            except Exception as exc:
                log.warning("Error de red al enviar a Telegram (intento %d): %s", attempt + 1, exc)
            time.sleep(2**attempt)


def build_notifier(config: object) -> Notifier:
    """Construye el notificador a partir de la configuración.

    Si Telegram está activado pero faltan credenciales, se avisa y se devuelve un
    notificador nulo: **nunca** se impide arrancar el bot por un problema de
    notificaciones.
    """
    from bot.config.schema import NotificationsConfig
    from bot.notifications.base import NullNotifier

    if not isinstance(config, NotificationsConfig):
        return NullNotifier()

    telegram = config.telegram
    if not telegram.enabled:
        return NullNotifier()

    token, chat_id = telegram.bot_token, telegram.chat_id
    if not token or not chat_id:
        log.warning(
            "Telegram activado pero faltan %s o %s en el entorno. Alertas desactivadas.",
            telegram.bot_token_env, telegram.chat_id_env,
        )
        return NullNotifier()

    log.info("Alertas de Telegram activadas (nivel mínimo: %s)", telegram.min_level.value)
    return TelegramNotifier(
        token, chat_id,
        min_level=telegram.min_level,
        dedupe_window_s=telegram.dedupe_window_s,
    )
