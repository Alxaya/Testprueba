"""Indicadores técnicos vectorizados con numpy.

Reglas que cumplen **todos** los indicadores de este módulo:

1. Devuelven un array del mismo tamaño que la entrada.
2. Las posiciones sin datos suficientes valen `NaN` (nunca ceros: un cero se
   confunde con un valor real y provoca señales fantasma).
3. El valor en la posición `i` usa **solo** datos de `0..i`. Ningún indicador
   mira al futuro. Esta es la garantía que hace que el backtest no mienta.

Las medias exponenciales se calculan con recursión (`adjust=False`), sembrando
con la SMA de los primeros `period` valores, que es la convención de TradingView
y de la mayoría de plataformas.
"""

from __future__ import annotations

import numpy as np
from numpy.typing import NDArray

Array = NDArray[np.float64]


def _empty_like(values: Array) -> Array:
    return np.full(values.shape, np.nan, dtype=np.float64)


def sma(values: Array, period: int) -> Array:
    """Media móvil simple.

    Implementada con suma acumulada: O(n) en lugar de O(n·period).
    """
    if period <= 0:
        raise ValueError("period debe ser > 0")
    out = _empty_like(values)
    n = values.size
    if n < period:
        return out
    cumsum = np.cumsum(np.insert(values, 0, 0.0))
    out[period - 1 :] = (cumsum[period:] - cumsum[:-period]) / period
    return out


def ema(values: Array, period: int) -> Array:
    """Media móvil exponencial, sembrada con la SMA de los primeros `period`.

    La recursión no se puede vectorizar de forma numéricamente estable, pero el
    bucle opera sobre ventanas cortas (unos cientos de velas), no sobre el
    histórico completo, así que el coste es despreciable.
    """
    if period <= 0:
        raise ValueError("period debe ser > 0")
    out = _empty_like(values)
    n = values.size
    if n < period:
        return out
    alpha = 2.0 / (period + 1.0)
    prev = float(values[:period].mean())
    out[period - 1] = prev
    for i in range(period, n):
        prev = alpha * values[i] + (1.0 - alpha) * prev
        out[i] = prev
    return out


def wilder_smooth(values: Array, period: int) -> Array:
    """Suavizado de Wilder (usado por RSI, ATR y ADX).

    Equivale a una EMA con `alpha = 1 / period`.
    """
    out = _empty_like(values)
    n = values.size
    if n < period:
        return out
    prev = float(values[:period].mean())
    out[period - 1] = prev
    for i in range(period, n):
        prev = (prev * (period - 1) + values[i]) / period
        out[i] = prev
    return out


def rsi(values: Array, period: int = 14) -> Array:
    """Índice de fuerza relativa (Wilder, 1978). Rango 0–100."""
    out = _empty_like(values)
    n = values.size
    if n <= period:
        return out
    delta = np.diff(values, prepend=values[0])
    delta[0] = 0.0
    gains = np.where(delta > 0, delta, 0.0)
    losses = np.where(delta < 0, -delta, 0.0)
    # El primer delta es artificial: se suaviza desde el índice 1.
    avg_gain = wilder_smooth(gains[1:], period)
    avg_loss = wilder_smooth(losses[1:], period)
    with np.errstate(divide="ignore", invalid="ignore"):
        rs = np.where(avg_loss > 0, avg_gain / avg_loss, np.inf)
        rsi_vals = 100.0 - (100.0 / (1.0 + rs))
    rsi_vals = np.where(avg_loss == 0, 100.0, rsi_vals)
    rsi_vals = np.where(np.isnan(avg_gain), np.nan, rsi_vals)
    out[1:] = rsi_vals
    return out


def true_range(high: Array, low: Array, close: Array) -> Array:
    """Rango verdadero: máximo entre rango de la vela y los huecos con el cierre previo."""
    prev_close = np.roll(close, 1)
    prev_close[0] = close[0]
    tr = np.maximum(
        high - low,
        np.maximum(np.abs(high - prev_close), np.abs(low - prev_close)),
    )
    return tr.astype(np.float64)


def atr(high: Array, low: Array, close: Array, period: int = 14) -> Array:
    """Average True Range (Wilder). Medida de volatilidad en unidades de precio.

    Es la base del dimensionado de posiciones y de los stops dinámicos: un stop
    fijo en porcentaje trata igual a un activo tranquilo y a uno frenético; un
    stop en múltiplos de ATR se adapta al régimen de volatilidad.
    """
    tr = true_range(high, low, close)
    return wilder_smooth(tr, period)


def rolling_max(values: Array, period: int) -> Array:
    """Máximo de las últimas `period` observaciones (incluye la actual)."""
    out = _empty_like(values)
    n = values.size
    if n < period:
        return out
    windows = np.lib.stride_tricks.sliding_window_view(values, period)
    out[period - 1 :] = windows.max(axis=1)
    return out


def rolling_min(values: Array, period: int) -> Array:
    """Mínimo de las últimas `period` observaciones (incluye la actual)."""
    out = _empty_like(values)
    n = values.size
    if n < period:
        return out
    windows = np.lib.stride_tricks.sliding_window_view(values, period)
    out[period - 1 :] = windows.min(axis=1)
    return out


def rolling_std(values: Array, period: int, ddof: int = 0) -> Array:
    """Desviación típica móvil."""
    out = _empty_like(values)
    n = values.size
    if n < period:
        return out
    windows = np.lib.stride_tricks.sliding_window_view(values, period)
    out[period - 1 :] = windows.std(axis=1, ddof=ddof)
    return out


def bollinger(
    values: Array, period: int = 20, num_std: float = 2.0
) -> tuple[Array, Array, Array]:
    """Bandas de Bollinger. Devuelve `(inferior, media, superior)`."""
    middle = sma(values, period)
    std = rolling_std(values, period)
    return middle - num_std * std, middle, middle + num_std * std


def macd(
    values: Array, fast: int = 12, slow: int = 26, signal: int = 9
) -> tuple[Array, Array, Array]:
    """MACD. Devuelve `(macd, señal, histograma)`.

    La línea de señal se calcula sobre la parte válida del MACD para que su
    siembra no quede contaminada por los `NaN` iniciales.
    """
    ema_fast = ema(values, fast)
    ema_slow = ema(values, slow)
    macd_line = ema_fast - ema_slow

    signal_line = _empty_like(values)
    valid = ~np.isnan(macd_line)
    if valid.any():
        first = int(np.argmax(valid))
        tail = macd_line[first:]
        if tail.size >= signal:
            signal_line[first:] = ema(tail, signal)
    return macd_line, signal_line, macd_line - signal_line


def donchian(
    high: Array, low: Array, period: int = 20
) -> tuple[Array, Array, Array]:
    """Canal de Donchian. Devuelve `(inferior, medio, superior)`.

    Importante: se calcula sobre las velas **anteriores** a la actual
    (`shift(1)`), porque comparar el máximo de N velas con el precio de la propia
    vela que forma ese máximo es un look-ahead clásico y hace que cualquier
    estrategia de ruptura parezca genial.
    """
    upper = rolling_max(high, period)
    lower = rolling_min(low, period)
    upper_shift = np.roll(upper, 1)
    lower_shift = np.roll(lower, 1)
    upper_shift[0] = np.nan
    lower_shift[0] = np.nan
    return lower_shift, (upper_shift + lower_shift) / 2.0, upper_shift


def adx(high: Array, low: Array, close: Array, period: int = 14) -> Array:
    """Average Directional Index: fuerza de la tendencia (no su dirección).

    Se usa como filtro de régimen: las estrategias de reversión a la media
    funcionan peor cuando el ADX es alto (tendencia fuerte) y las de tendencia
    funcionan peor cuando es bajo (mercado lateral).
    """
    n = close.size
    out = _empty_like(close)
    if n < 2 * period:
        return out

    up_move = np.diff(high, prepend=high[0])
    down_move = -np.diff(low, prepend=low[0])
    plus_dm = np.where((up_move > down_move) & (up_move > 0), up_move, 0.0)
    minus_dm = np.where((down_move > up_move) & (down_move > 0), down_move, 0.0)

    tr_smooth = wilder_smooth(true_range(high, low, close), period)
    plus_smooth = wilder_smooth(plus_dm, period)
    minus_smooth = wilder_smooth(minus_dm, period)

    with np.errstate(divide="ignore", invalid="ignore"):
        plus_di = 100.0 * plus_smooth / tr_smooth
        minus_di = 100.0 * minus_smooth / tr_smooth
        dx = 100.0 * np.abs(plus_di - minus_di) / (plus_di + minus_di)
    dx = np.nan_to_num(dx, nan=np.nan, posinf=np.nan, neginf=np.nan)

    valid = ~np.isnan(dx)
    if not valid.any():
        return out
    first = int(np.argmax(valid))
    tail = dx[first:]
    if tail.size >= period:
        out[first:] = wilder_smooth(tail, period)
    return out


def slope(values: Array, period: int) -> Array:
    """Pendiente normalizada: variación relativa en `period` velas.

    Útil como filtro de tendencia sin añadir otro indicador con retardo.
    """
    out = _empty_like(values)
    if values.size <= period:
        return out
    past = values[:-period]
    with np.errstate(divide="ignore", invalid="ignore"):
        out[period:] = np.where(past != 0, (values[period:] - past) / past, np.nan)
    return out


def crossed_above(fast: Array, slow: Array, index: int = -1) -> bool:
    """`True` si `fast` cruzó por encima de `slow` justo en `index`."""
    if fast.size < 2 or slow.size < 2:
        return False
    i = index if index >= 0 else fast.size + index
    if i < 1:
        return False
    values = (fast[i], slow[i], fast[i - 1], slow[i - 1])
    if any(np.isnan(v) for v in values):
        return False
    return bool(fast[i - 1] <= slow[i - 1] and fast[i] > slow[i])


def crossed_below(fast: Array, slow: Array, index: int = -1) -> bool:
    """`True` si `fast` cruzó por debajo de `slow` justo en `index`."""
    return crossed_above(slow, fast, index)


def last_valid(values: Array) -> float | None:
    """Último valor no-NaN del array, o `None` si no hay ninguno."""
    if values.size == 0:
        return None
    value = values[-1]
    return None if np.isnan(value) else float(value)
