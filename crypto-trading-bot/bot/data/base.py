"""Interfaz de proveedores de datos de mercado y validación de integridad.

Operar con datos corruptos es peor que no operar: un hueco de velas puede
disparar un falso cruce de medias, y una vela duplicada puede provocar una orden
duplicada. Por eso la validación vive aquí, en la frontera, y es obligatoria.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from dataclasses import dataclass

from bot.core.errors import DataIntegrityError
from bot.core.models import Candle
from bot.core.timeframe import timeframe_to_ms


class DataProvider(ABC):
    """Fuente de velas OHLCV."""

    @abstractmethod
    def fetch_ohlcv(
        self,
        symbol: str,
        timeframe: str,
        *,
        since: int | None = None,
        limit: int = 500,
    ) -> list[Candle]:
        """Devuelve velas ordenadas por tiempo ascendente.

        La implementación **debe** excluir la vela en curso (no cerrada).
        """

    def close(self) -> None:
        """Libera recursos (sesiones HTTP, conexiones). Opcional."""


@dataclass(slots=True, frozen=True)
class IntegrityReport:
    """Resultado de validar una serie de velas."""

    symbol: str
    timeframe: str
    count: int
    gaps: int
    duplicates: int
    invalid: int
    first_ts: int | None
    last_ts: int | None

    @property
    def is_clean(self) -> bool:
        return self.gaps == 0 and self.duplicates == 0 and self.invalid == 0

    def summary(self) -> str:
        if self.count == 0:
            return f"{self.symbol} {self.timeframe}: sin datos"
        status = "OK" if self.is_clean else "CON PROBLEMAS"
        return (
            f"{self.symbol} {self.timeframe}: {self.count} velas [{status}] "
            f"huecos={self.gaps} duplicadas={self.duplicates} inválidas={self.invalid}"
        )


def check_integrity(candles: list[Candle], symbol: str, timeframe: str) -> IntegrityReport:
    """Comprueba monotonía, huecos, duplicados y coherencia OHLC.

    No lanza: devuelve un informe. Quien lo consume decide si aborta (backtest) o
    si intenta rellenar (descarga).
    """
    if not candles:
        return IntegrityReport(symbol, timeframe, 0, 0, 0, 0, None, None)

    step = timeframe_to_ms(timeframe)
    gaps = duplicates = invalid = 0
    previous_ts: int | None = None

    for candle in candles:
        if not candle.is_valid():
            invalid += 1
        if previous_ts is not None:
            delta = candle.ts - previous_ts
            if delta == 0:
                duplicates += 1
            elif delta > step:
                gaps += int(delta // step) - 1
            elif delta < 0:
                # Serie desordenada: se cuenta como duplicado/anomalía grave.
                duplicates += 1
        previous_ts = candle.ts

    return IntegrityReport(
        symbol=symbol,
        timeframe=timeframe,
        count=len(candles),
        gaps=gaps,
        duplicates=duplicates,
        invalid=invalid,
        first_ts=candles[0].ts,
        last_ts=candles[-1].ts,
    )


def sanitize(candles: list[Candle], symbol: str, timeframe: str) -> list[Candle]:
    """Ordena, elimina duplicados y descarta velas incoherentes.

    Los huecos **no** se rellenan: inventar precios que no existieron es
    exactamente el tipo de mentira que arruina un backtest. Se dejan como están y
    los indicadores los verán como lo que son.
    """
    unique: dict[int, Candle] = {}
    for candle in candles:
        if candle.is_valid():
            unique[candle.ts] = candle
    return [unique[ts] for ts in sorted(unique)]


def require_clean(candles: list[Candle], symbol: str, timeframe: str, *, max_gap_ratio: float = 0.01) -> None:
    """Aborta si la serie tiene demasiados huecos para ser fiable.

    Un hueco aislado (mantenimiento del exchange) es tolerable; un 5 % de velas
    ausentes significa que el histórico no sirve para decidir nada.
    """
    report = check_integrity(candles, symbol, timeframe)
    if report.count == 0:
        raise DataIntegrityError(f"Sin velas para {symbol} {timeframe}")
    if report.invalid:
        raise DataIntegrityError(f"{report.invalid} velas incoherentes en {symbol} {timeframe}")
    if report.duplicates:
        raise DataIntegrityError(f"{report.duplicates} velas duplicadas en {symbol} {timeframe}")
    if report.gaps > report.count * max_gap_ratio:
        raise DataIntegrityError(
            f"{report.gaps} velas ausentes de {report.count} en {symbol} {timeframe} "
            f"(> {max_gap_ratio:.1%}). Vuelve a descargar el histórico."
        )
