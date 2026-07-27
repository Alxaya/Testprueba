"""Carga de configuración: YAML + variables de entorno.

Orden de precedencia (de menor a mayor):

1. Valores por defecto del esquema.
2. Fichero YAML.
3. Variables de entorno con prefijo `BOT__` (doble guion bajo = nivel anidado).
   Ejemplo: `BOT__RISK__RISK_PER_TRADE_PCT=0.25`.
4. Overrides pasados por CLI.

Los **secretos nunca** siguen esta ruta: se leen directamente del entorno en las
propiedades del esquema, para que no acaben en un volcado de configuración ni en
un log.
"""

from __future__ import annotations

import json
import os
from pathlib import Path
from typing import Any

import yaml
from pydantic import ValidationError

from bot.config.schema import BotConfig
from bot.core.errors import ConfigError

ENV_PREFIX = "BOT__"


def load_dotenv(path: str | Path = ".env", *, override: bool = False) -> None:
    """Carga un `.env` sencillo en `os.environ`.

    Implementación mínima a propósito: evita una dependencia más para algo que
    son quince líneas. No soporta multilínea ni interpolación.
    """
    env_path = Path(path)
    if not env_path.is_file():
        return
    for raw_line in env_path.read_text(encoding="utf-8").splitlines():
        line = raw_line.strip()
        if not line or line.startswith("#") or "=" not in line:
            continue
        key, _, value = line.partition("=")
        key = key.strip()
        value = value.strip().strip("'\"")
        if override or key not in os.environ:
            os.environ[key] = value


def _deep_merge(base: dict[str, Any], overlay: dict[str, Any]) -> dict[str, Any]:
    """Mezcla recursiva. `overlay` gana; las listas se sustituyen, no se concatenan."""
    result = dict(base)
    for key, value in overlay.items():
        if isinstance(value, dict) and isinstance(result.get(key), dict):
            result[key] = _deep_merge(result[key], value)
        else:
            result[key] = value
    return result


def _coerce(value: str) -> Any:
    """Interpreta un valor de entorno como JSON y, si falla, lo deja como texto."""
    try:
        return json.loads(value)
    except (json.JSONDecodeError, ValueError):
        return value


def env_overrides(environ: dict[str, str] | None = None) -> dict[str, Any]:
    """Convierte `BOT__RISK__MAX_DRAWDOWN_PCT=10` en `{"risk": {"max_drawdown_pct": 10}}`."""
    source = environ if environ is not None else dict(os.environ)
    overrides: dict[str, Any] = {}
    for key, raw in source.items():
        if not key.startswith(ENV_PREFIX):
            continue
        path = key[len(ENV_PREFIX) :].lower().split("__")
        if not path or not path[0]:
            continue
        cursor = overrides
        for part in path[:-1]:
            cursor = cursor.setdefault(part, {})
        cursor[path[-1]] = _coerce(raw)
    return overrides


def load_config(
    path: str | Path | None = None,
    *,
    overrides: dict[str, Any] | None = None,
    use_env: bool = True,
    dotenv: str | Path | None = ".env",
) -> BotConfig:
    """Carga y valida la configuración completa.

    Lanza `ConfigError` con un mensaje legible: los errores de configuración se
    descubren al arrancar, no en producción.
    """
    if dotenv is not None:
        load_dotenv(dotenv)

    data: dict[str, Any] = {}
    if path is not None:
        config_path = Path(path)
        if not config_path.is_file():
            raise ConfigError(f"No existe el fichero de configuración: {config_path}")
        try:
            loaded = yaml.safe_load(config_path.read_text(encoding="utf-8")) or {}
        except yaml.YAMLError as exc:
            raise ConfigError(f"YAML inválido en {config_path}: {exc}") from exc
        if not isinstance(loaded, dict):
            raise ConfigError(f"El YAML de {config_path} debe ser un mapa en la raíz")
        data = loaded

    if use_env:
        data = _deep_merge(data, env_overrides())
    if overrides:
        data = _deep_merge(data, overrides)

    try:
        return BotConfig.model_validate(data)
    except ValidationError as exc:
        raise ConfigError(_format_validation_error(exc, path)) from exc


def _format_validation_error(exc: ValidationError, path: str | Path | None) -> str:
    """Convierte el error de pydantic en algo que se lee sin llorar."""
    lines = [f"Configuración inválida{f' en {path}' if path else ''}:"]
    for error in exc.errors():
        location = ".".join(str(part) for part in error["loc"]) or "(raíz)"
        lines.append(f"  · {location}: {error['msg']}")
    return "\n".join(lines)


def redacted_dump(config: BotConfig) -> dict[str, Any]:
    """Volcado de la configuración apto para logs y para el panel web.

    Los secretos nunca están en el objeto de configuración (solo los nombres de
    las variables), pero se filtra igualmente por si alguien añade un campo
    sensible en el futuro.
    """
    data = config.model_dump(mode="json")
    sensitive = ("key", "secret", "token", "password", "passphrase")

    def scrub(node: Any) -> Any:
        if isinstance(node, dict):
            return {
                k: ("***" if any(s in k.lower() for s in sensitive) and not k.endswith("_env") else scrub(v))
                for k, v in node.items()
            }
        if isinstance(node, list):
            return [scrub(v) for v in node]
        return node

    return scrub(data)  # type: ignore[no-any-return]
