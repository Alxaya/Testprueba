"""Generador de series sintéticas.

Existe por dos motivos concretos:

1. **Tests sin red.** La suite completa debe poder ejecutarse en CI sin llamar a
   ningún exchange. Un test que depende de internet es un test que falla solo.
2. **Sanidad de estrategias.** Probar una estrategia sobre una serie con deriva
   conocida (tendencia pura, ruido puro, lateral) revela rápido si hace lo que
   dice hacer. Si una estrategia de tendencia pierde en una tendencia limpia,
   está rota.

**Advertencia importante:** un movimiento browniano geométrico NO es un mercado.
No tiene colas gruesas, ni agrupamiento de volatilidad, ni cambios de régimen, ni
huecos de fin de semana. Los resultados sobre datos sintéticos sirven para
detectar errores de programación, **jamás** para validar rentabilidad.
"""

from __future__ import annotations

import math
import random

from bot.core.models import Candle
from bot.core.timeframe import timeframe_to_ms


def generate_candles(
    *,
    count: int = 1_000,
    start_price: float = 30_000.0,
    timeframe: str = "1h",
    start_ts: int = 1_700_000_000_000,
    drift_per_bar: float = 0.0,
    volatility_per_bar: float = 0.01,
    seed: int | None = 42,
    regime_shift: bool = False,
) -> list[Candle]:
    """Genera velas con un GBM discreto.

    Args:
        count: número de velas.
        start_price: precio inicial.
        drift_per_bar: deriva media por vela (0.001 = +0,1 % por vela).
        volatility_per_bar: desviación típica del retorno logarítmico por vela.
        regime_shift: si es `True`, invierte la deriva a mitad de la serie, para
            probar cómo se comporta una estrategia cuando el régimen cambia.
        seed: semilla; fija por defecto para que los tests sean deterministas.
    """
    rng = random.Random(seed)
    step = timeframe_to_ms(timeframe)
    candles: list[Candle] = []
    price = start_price

    for i in range(count):
        drift = -drift_per_bar if (regime_shift and i > count // 2) else drift_per_bar
        shock = rng.gauss(0.0, volatility_per_bar)
        close = max(price * math.exp(drift + shock), 1e-8)

        open_price = price
        # El rango intravela se modela como una fracción de la volatilidad.
        wick = abs(rng.gauss(0.0, volatility_per_bar * 0.6))
        high = max(open_price, close) * (1.0 + wick)
        low = min(open_price, close) * (1.0 - wick)
        volume = abs(rng.gauss(100.0, 30.0)) + 1.0

        candles.append(
            Candle(
                ts=start_ts + i * step,
                open=round(open_price, 2),
                high=round(high, 2),
                low=round(low, 2),
                close=round(close, 2),
                volume=round(volume, 4),
            )
        )
        price = close

    return candles


def generate_trend(count: int = 500, timeframe: str = "1h", seed: int | None = 7) -> list[Candle]:
    """Tendencia alcista clara con poco ruido. Las estrategias de tendencia deben ganar aquí."""
    return generate_candles(
        count=count, timeframe=timeframe, drift_per_bar=0.003,
        volatility_per_bar=0.004, seed=seed,
    )


def generate_choppy(count: int = 500, timeframe: str = "1h", seed: int | None = 11) -> list[Candle]:
    """Lateral con ruido alto. Las estrategias de tendencia deben sufrir aquí."""
    return generate_candles(
        count=count, timeframe=timeframe, drift_per_bar=0.0,
        volatility_per_bar=0.02, seed=seed,
    )


class SyntheticDataProvider:
    """`DataProvider` en memoria sobre series sintéticas. Solo para tests."""

    def __init__(self, candles_by_symbol: dict[str, list[Candle]]) -> None:
        self._data = candles_by_symbol
        self.cursor: dict[str, int] = {}

    def fetch_ohlcv(
        self, symbol: str, timeframe: str, *, since: int | None = None, limit: int = 500
    ) -> list[Candle]:
        candles = self._data.get(symbol, [])
        if since is not None:
            candles = [c for c in candles if c.ts >= since]
        return candles[-limit:] if limit else list(candles)

    def close(self) -> None:  # pragma: no cover - nada que liberar
        return None
