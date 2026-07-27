"""Descarga incremental de histórico.

La regla es simple: **no descargar dos veces lo mismo**. Se mira qué hay ya en la
caché y solo se pide lo que falta. Rellenar 3 años de velas la primera vez es
lento; las veces siguientes es instantáneo.
"""

from __future__ import annotations

from dataclasses import dataclass

from bot.core.logging_setup import get_logger
from bot.core.models import now_ms
from bot.core.timeframe import timeframe_to_ms
from bot.data.base import check_integrity
from bot.data.ccxt_provider import CCXTDataProvider
from bot.data.store import OHLCVStore

log = get_logger("data.downloader")


@dataclass(slots=True)
class DownloadResult:
    symbol: str
    timeframe: str
    downloaded: int
    total_in_store: int
    first_ts: int | None
    last_ts: int | None
    gaps: int


class HistoricalDownloader:
    """Orquesta proveedor + caché."""

    def __init__(self, provider: CCXTDataProvider, store: OHLCVStore) -> None:
        self.provider = provider
        self.store = store

    def download(
        self,
        symbol: str,
        timeframe: str,
        *,
        since: int,
        until: int | None = None,
        force: bool = False,
    ) -> DownloadResult:
        """Descarga el rango `[since, until]`, saltándose lo ya cacheado.

        Con `force=True` se re-descarga todo (útil si se sospecha corrupción; la
        escritura es idempotente, así que nunca duplica).
        """
        until = until or now_ms()
        step = timeframe_to_ms(timeframe)
        fetch_from = since

        if not force:
            _, last_cached = self.store.range(symbol, timeframe)
            if last_cached is not None and last_cached >= since:
                # Retrocedemos una vela por si la última guardada quedó incompleta.
                fetch_from = max(since, last_cached - step)
                log.info(
                    "%s %s: caché hasta %d, descargando solo lo que falta",
                    symbol, timeframe, last_cached,
                )

        downloaded = 0
        if fetch_from < until:
            candles = self.provider.fetch_range(
                symbol, timeframe, since=fetch_from, until=until,
                progress=lambda n, ts: log.debug("%s %s: %d velas (cursor %d)", symbol, timeframe, n, ts),
            )
            downloaded = self.store.save(symbol, timeframe, candles)
            log.info("%s %s: %d velas nuevas guardadas", symbol, timeframe, downloaded)

        stored = self.store.load(symbol, timeframe, since=since, until=until)
        report = check_integrity(stored, symbol, timeframe)
        if not report.is_clean:
            log.warning("Integridad: %s", report.summary())

        first_ts, last_ts = self.store.range(symbol, timeframe)
        return DownloadResult(
            symbol=symbol,
            timeframe=timeframe,
            downloaded=downloaded,
            total_in_store=self.store.count(symbol, timeframe),
            first_ts=first_ts,
            last_ts=last_ts,
            gaps=report.gaps,
        )
