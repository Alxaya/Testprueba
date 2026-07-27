"""Utilidades de temporalidad.

Toda la alineación de velas del bot pasa por aquí. Es código aburrido pero
crítico: procesar una vela a destiempo o dos veces produce operaciones
duplicadas.
"""

from __future__ import annotations

import re

_UNIT_MS = {
    "s": 1_000,
    "m": 60_000,
    "h": 3_600_000,
    "d": 86_400_000,
    "w": 604_800_000,
}

_PATTERN = re.compile(r"^(\d+)([smhdw])$")

#: Velas por año, para anualizar métricas (365 días, mercado cripto 24/7).
_MS_PER_YEAR = 365 * 86_400_000


def timeframe_to_ms(timeframe: str) -> int:
    """Convierte `"1h"`, `"15m"`, `"1d"`... a milisegundos.

    >>> timeframe_to_ms("4h")
    14400000
    """
    match = _PATTERN.match(timeframe.strip().lower())
    if not match:
        raise ValueError(
            f"Timeframe no válido: {timeframe!r}. Formatos válidos: 1m, 5m, 1h, 4h, 1d, 1w"
        )
    amount, unit = match.groups()
    return int(amount) * _UNIT_MS[unit]


def periods_per_year(timeframe: str) -> float:
    """Número de velas por año. Base para anualizar Sharpe, volatilidad y CAGR."""
    return _MS_PER_YEAR / timeframe_to_ms(timeframe)


def floor_to_timeframe(ts_ms: int, timeframe: str) -> int:
    """Instante de inicio de la vela que contiene `ts_ms`."""
    step = timeframe_to_ms(timeframe)
    return (ts_ms // step) * step


def next_close_ms(ts_ms: int, timeframe: str) -> int:
    """Instante en el que cierra la vela en curso (= apertura de la siguiente)."""
    return floor_to_timeframe(ts_ms, timeframe) + timeframe_to_ms(timeframe)


def last_closed_open_ms(ts_ms: int, timeframe: str) -> int:
    """Apertura de la última vela **ya cerrada** en el instante `ts_ms`.

    Es la única vela sobre la que se puede decidir sin mirar al futuro: la vela
    en curso todavía puede cambiar.
    """
    return floor_to_timeframe(ts_ms, timeframe) - timeframe_to_ms(timeframe)


def bars_between(start_ms: int, end_ms: int, timeframe: str) -> int:
    """Número de velas entre dos instantes."""
    step = timeframe_to_ms(timeframe)
    return max(0, (end_ms - start_ms) // step)
