"""Configuración de logging.

Incluye un filtro que **enmascara secretos** antes de escribir. Las librerías de
exchange tienden a incluir la API key en los mensajes de error; sin este filtro
acabarían en un fichero de log, en un backup, y algún día en un pastebin.
"""

from __future__ import annotations

import json
import logging
import logging.handlers
import os
import re
import sys
from pathlib import Path

from bot.config.schema import LoggingConfig

#: Patrones de cosas que nunca deben aparecer en un log.
_SECRET_PATTERNS = [
    re.compile(r"(api[_-]?key\"?\s*[:=]\s*\"?)([A-Za-z0-9_\-]{8,})", re.IGNORECASE),
    re.compile(r"(secret\"?\s*[:=]\s*\"?)([A-Za-z0-9_\-/+]{8,})", re.IGNORECASE),
    re.compile(r"(signature\"?\s*[:=]\s*\"?)([A-Za-z0-9_\-/+=]{8,})", re.IGNORECASE),
    re.compile(r"(token\"?\s*[:=]\s*\"?)([A-Za-z0-9_\-:]{8,})", re.IGNORECASE),
    re.compile(r"(bot)(\d{6,}):([A-Za-z0-9_\-]{20,})", re.IGNORECASE),  # token de Telegram
]


class SecretMaskingFilter(logging.Filter):
    """Sustituye secretos por `***` en el mensaje y en los argumentos."""

    def __init__(self, extra_values: tuple[str, ...] = ()) -> None:
        super().__init__()
        # Valores literales conocidos (los de las variables de entorno cargadas).
        self._literals = tuple(v for v in extra_values if v and len(v) >= 8)

    def filter(self, record: logging.LogRecord) -> bool:
        try:
            message = record.getMessage()
        except Exception:  # pragma: no cover - formato roto
            return True
        masked = self.mask(message, self._literals)
        if masked != message:
            record.msg = masked
            record.args = ()
        return True

    @staticmethod
    def mask(text: str, literals: tuple[str, ...] = ()) -> str:
        for literal in literals:
            text = text.replace(literal, "***")
        for pattern in _SECRET_PATTERNS:
            # Los patrones de 3 grupos (token de Telegram) llevan dos partes
            # sensibles; el resto, solo una.
            replacement = r"\1***:***" if pattern.groups >= 3 else r"\1***"
            text = pattern.sub(replacement, text)
        return text


class JsonFormatter(logging.Formatter):
    """Formato JSON por línea, para ingestión en herramientas de logs."""

    def format(self, record: logging.LogRecord) -> str:
        payload = {
            "ts": self.formatTime(record, "%Y-%m-%dT%H:%M:%S%z"),
            "level": record.levelname,
            "logger": record.name,
            "message": record.getMessage(),
        }
        if record.exc_info:
            payload["exception"] = self.formatException(record.exc_info)
        for key, value in getattr(record, "__dict__", {}).items():
            if key.startswith("ctx_"):
                payload[key[4:]] = value
        return json.dumps(payload, ensure_ascii=False, default=str)


def _collect_env_secrets() -> tuple[str, ...]:
    """Valores de entorno que parecen secretos, para enmascarado literal."""
    keys = ("KEY", "SECRET", "TOKEN", "PASSWORD", "PASSPHRASE")
    return tuple(
        value
        for name, value in os.environ.items()
        if any(k in name.upper() for k in keys) and value and len(value) >= 8
    )


def setup_logging(config: LoggingConfig, *, run_name: str = "bot") -> logging.Logger:
    """Configura logging a consola y a fichero rotativo.

    Devuelve el logger raíz del bot. Idempotente: llamarlo dos veces no duplica
    los manejadores.
    """
    root = logging.getLogger("bot")
    root.setLevel(getattr(logging, config.level))
    root.propagate = False
    for handler in list(root.handlers):
        root.removeHandler(handler)
        handler.close()

    secret_filter = SecretMaskingFilter(_collect_env_secrets())

    if config.json_format:
        formatter: logging.Formatter = JsonFormatter()
    else:
        formatter = logging.Formatter(
            "%(asctime)s │ %(levelname)-8s │ %(name)-28s │ %(message)s",
            datefmt="%Y-%m-%d %H:%M:%S",
        )

    console = logging.StreamHandler(stream=sys.stdout)
    console.setFormatter(formatter)
    console.addFilter(secret_filter)
    root.addHandler(console)

    log_dir = Path(config.directory)
    try:
        log_dir.mkdir(parents=True, exist_ok=True)
        file_handler = logging.handlers.RotatingFileHandler(
            log_dir / f"{run_name}.log",
            maxBytes=config.max_bytes,
            backupCount=config.backup_count,
            encoding="utf-8",
        )
        file_handler.setFormatter(formatter)
        file_handler.addFilter(secret_filter)
        root.addHandler(file_handler)
    except OSError as exc:  # pragma: no cover - permisos del sistema de ficheros
        root.warning("No se pudo abrir el fichero de log (%s). Solo consola.", exc)

    # ccxt y urllib3 son extremadamente locuaces en DEBUG.
    for noisy in ("ccxt", "urllib3", "asyncio", "httpx", "httpcore"):
        logging.getLogger(noisy).setLevel(logging.WARNING)

    return root


def get_logger(name: str) -> logging.Logger:
    """Logger hijo del árbol `bot.*`."""
    return logging.getLogger(f"bot.{name}" if not name.startswith("bot") else name)
