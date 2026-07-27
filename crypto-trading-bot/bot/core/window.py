"""`Window`: la vista de mercado que reciben las estrategias.

Esta clase es la pieza que garantiza la **paridad entre backtest y live**:

* En backtest se construye con *vistas* numpy (slices sin copia) sobre los arrays
  del histórico completo. Recorrer 100.000 velas no copia memoria.
* En live se construye desde un `deque` de velas recientes.

La estrategia no puede distinguir un caso del otro, así que el código que se
prueba con datos históricos es literalmente el mismo que opera con dinero.

Incluye una caché de indicadores por ventana: si dos estrategias (o dos ramas de
la misma) piden `ema(close, 50)` sobre la misma vela, se calcula una sola vez.
"""

from __future__ import annotations

from collections.abc import Callable, Iterable, Sequence
from dataclasses import dataclass, field
from typing import Any

import numpy as np
from numpy.typing import NDArray

from bot.core import indicators as ind
from bot.core.models import Candle

Array = NDArray[np.float64]


@dataclass(slots=True)
class Window:
    """Ventana de velas cerradas que termina en la vela actual.

    El índice `-1` es siempre la **última vela cerrada**: sobre ella se decide, y
    la ejecución ocurrirá en la apertura de la siguiente.
    """

    symbol: str
    timeframe: str
    ts: NDArray[np.int64]
    open: Array
    high: Array
    low: Array
    close: Array
    volume: Array
    _cache: dict[tuple[Any, ...], Any] = field(default_factory=dict, repr=False)

    def __len__(self) -> int:
        return int(self.close.size)

    # ---------------------------------------------------------------- accesos

    @property
    def last_ts(self) -> int:
        """Timestamp de apertura de la última vela cerrada."""
        return int(self.ts[-1])

    @property
    def price(self) -> float:
        """Precio de referencia para decidir: el cierre de la última vela."""
        return float(self.close[-1])

    def candle(self, index: int = -1) -> Candle:
        """Reconstruye una vela concreta (para logs y persistencia)."""
        return Candle(
            ts=int(self.ts[index]),
            open=float(self.open[index]),
            high=float(self.high[index]),
            low=float(self.low[index]),
            close=float(self.close[index]),
            volume=float(self.volume[index]),
        )

    # ------------------------------------------------- indicadores cacheados

    def cached(self, key: tuple[Any, ...], compute: Callable[[], Any]) -> Any:
        """Devuelve el valor cacheado para `key`, calculándolo si hace falta."""
        if key not in self._cache:
            self._cache[key] = compute()
        return self._cache[key]

    def sma(self, period: int, source: str = "close") -> Array:
        return self.cached(("sma", period, source), lambda: ind.sma(self._src(source), period))

    def ema(self, period: int, source: str = "close") -> Array:
        return self.cached(("ema", period, source), lambda: ind.ema(self._src(source), period))

    def rsi(self, period: int = 14, source: str = "close") -> Array:
        return self.cached(("rsi", period, source), lambda: ind.rsi(self._src(source), period))

    def atr(self, period: int = 14) -> Array:
        return self.cached(("atr", period), lambda: ind.atr(self.high, self.low, self.close, period))

    def adx(self, period: int = 14) -> Array:
        return self.cached(("adx", period), lambda: ind.adx(self.high, self.low, self.close, period))

    def bollinger(self, period: int = 20, num_std: float = 2.0) -> tuple[Array, Array, Array]:
        return self.cached(
            ("bb", period, num_std), lambda: ind.bollinger(self.close, period, num_std)
        )

    def macd(self, fast: int = 12, slow: int = 26, signal: int = 9) -> tuple[Array, Array, Array]:
        return self.cached(
            ("macd", fast, slow, signal), lambda: ind.macd(self.close, fast, slow, signal)
        )

    def donchian(self, period: int = 20) -> tuple[Array, Array, Array]:
        return self.cached(("donchian", period), lambda: ind.donchian(self.high, self.low, period))

    def _src(self, source: str) -> Array:
        try:
            return getattr(self, source)  # type: ignore[no-any-return]
        except AttributeError as exc:  # pragma: no cover - error de programación
            raise ValueError(f"Fuente de precio desconocida: {source!r}") from exc

    # ----------------------------------------------------------- constructores

    @classmethod
    def from_candles(cls, symbol: str, timeframe: str, candles: Sequence[Candle]) -> Window:
        """Construye una ventana desde velas sueltas (ruta usada en live)."""
        size = len(candles)
        ts = np.empty(size, dtype=np.int64)
        arrays = {name: np.empty(size, dtype=np.float64) for name in ("o", "h", "l", "c", "v")}
        for i, candle in enumerate(candles):
            ts[i] = candle.ts
            arrays["o"][i] = candle.open
            arrays["h"][i] = candle.high
            arrays["l"][i] = candle.low
            arrays["c"][i] = candle.close
            arrays["v"][i] = candle.volume
        return cls(
            symbol=symbol,
            timeframe=timeframe,
            ts=ts,
            open=arrays["o"],
            high=arrays["h"],
            low=arrays["l"],
            close=arrays["c"],
            volume=arrays["v"],
        )


@dataclass(slots=True)
class CandleSeries:
    """Histórico completo de un símbolo, con arrays contiguos.

    Sirve de almacén para el backtest: se materializa una vez y después cada vela
    genera una `Window` que son solo *vistas* sobre estos arrays.
    """

    symbol: str
    timeframe: str
    ts: NDArray[np.int64]
    open: Array
    high: Array
    low: Array
    close: Array
    volume: Array

    def __len__(self) -> int:
        return int(self.close.size)

    @classmethod
    def from_candles(cls, symbol: str, timeframe: str, candles: Iterable[Candle]) -> CandleSeries:
        window = Window.from_candles(symbol, timeframe, list(candles))
        return cls(
            symbol=symbol,
            timeframe=timeframe,
            ts=window.ts,
            open=window.open,
            high=window.high,
            low=window.low,
            close=window.close,
            volume=window.volume,
        )

    def window(self, end: int, lookback: int) -> Window:
        """Ventana de como mucho `lookback` velas que **termina** en el índice `end`.

        `end` es inclusivo. Los arrays devueltos son vistas: coste O(1) y cero
        copias, que es lo que permite backtestear cientos de miles de velas.
        """
        start = max(0, end - lookback + 1)
        stop = end + 1
        return Window(
            symbol=self.symbol,
            timeframe=self.timeframe,
            ts=self.ts[start:stop],
            open=self.open[start:stop],
            high=self.high[start:stop],
            low=self.low[start:stop],
            close=self.close[start:stop],
            volume=self.volume[start:stop],
        )

    def candle(self, index: int) -> Candle:
        return Candle(
            ts=int(self.ts[index]),
            open=float(self.open[index]),
            high=float(self.high[index]),
            low=float(self.low[index]),
            close=float(self.close[index]),
            volume=float(self.volume[index]),
        )
