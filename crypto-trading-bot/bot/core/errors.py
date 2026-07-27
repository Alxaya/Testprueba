"""Jerarquía de excepciones.

La distinción importante es entre errores **recuperables** (la red falló, el
exchange devolvió un 502: reintentar) y **fatales** (la configuración es
inválida, el estado es incoherente: parar y avisar). El motor trata cada familia
de forma distinta.
"""

from __future__ import annotations


class BotError(Exception):
    """Raíz de todos los errores del bot."""


class ConfigError(BotError):
    """Configuración inválida. Siempre fatal: se detecta al arrancar."""


class RecoverableError(BotError):
    """Error transitorio. El motor reintenta con backoff."""


class ExchangeError(BotError):
    """Error genérico del exchange."""


class NetworkError(RecoverableError):
    """Fallo de red o timeout."""


class RateLimitError(RecoverableError):
    """Rate limit del exchange. Exige esperar más que un error normal."""


class InsufficientFunds(ExchangeError):
    """Saldo insuficiente. No es recuperable reintentando lo mismo."""


class OrderRejected(ExchangeError):
    """El exchange rechazó la orden (precisión, mínimos, mercado cerrado...)."""


class DataIntegrityError(BotError):
    """Los datos de mercado no superan la validación (huecos, OHLC incoherente).

    Fatal por diseño: operar con datos corruptos es peor que no operar.
    """


class StateError(BotError):
    """El estado interno no cuadra con el del exchange."""


class KillSwitchActive(BotError):
    """El kill switch está activo: no se admite ninguna operación nueva."""
