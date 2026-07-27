"""Caché en disco de velas OHLCV (SQLite).

Descargar tres años de BTC/USDT en 1h son ~26.000 velas y decenas de peticiones
paginadas. Hacerlo una vez y reutilizarlo es la diferencia entre un backtest de
4 segundos y uno de 4 minutos, y evita castigar el rate limit del exchange
mientras se iteran parámetros.

Detalles de implementación relevantes:

* Clave primaria `(symbol, timeframe, ts)` → los reinsertados son idempotentes
  (`INSERT OR REPLACE`), así que se puede re-descargar sin duplicar.
* Modo WAL → lecturas concurrentes mientras se escribe.
* Inserción por lotes con `executemany` dentro de una transacción.
"""

from __future__ import annotations

import sqlite3
from collections.abc import Iterable
from pathlib import Path

from bot.core.models import Candle

_SCHEMA = """
CREATE TABLE IF NOT EXISTS ohlcv (
    symbol    TEXT    NOT NULL,
    timeframe TEXT    NOT NULL,
    ts        INTEGER NOT NULL,
    open      REAL    NOT NULL,
    high      REAL    NOT NULL,
    low       REAL    NOT NULL,
    close     REAL    NOT NULL,
    volume    REAL    NOT NULL,
    PRIMARY KEY (symbol, timeframe, ts)
) WITHOUT ROWID;

CREATE INDEX IF NOT EXISTS idx_ohlcv_lookup ON ohlcv (symbol, timeframe, ts);
"""


class OHLCVStore:
    """Almacén local de velas."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._conn = sqlite3.connect(str(self.path), check_same_thread=False)
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._conn.executescript(_SCHEMA)
        self._conn.commit()

    # ------------------------------------------------------------- escritura

    def save(self, symbol: str, timeframe: str, candles: Iterable[Candle]) -> int:
        """Guarda velas de forma idempotente. Devuelve cuántas se escribieron."""
        rows = [
            (symbol, timeframe, c.ts, c.open, c.high, c.low, c.close, c.volume)
            for c in candles
            if c.is_valid()
        ]
        if not rows:
            return 0
        with self._conn:
            self._conn.executemany(
                "INSERT OR REPLACE INTO ohlcv "
                "(symbol, timeframe, ts, open, high, low, close, volume) "
                "VALUES (?, ?, ?, ?, ?, ?, ?, ?)",
                rows,
            )
        return len(rows)

    # -------------------------------------------------------------- lectura

    def load(
        self,
        symbol: str,
        timeframe: str,
        *,
        since: int | None = None,
        until: int | None = None,
        limit: int | None = None,
    ) -> list[Candle]:
        """Carga velas ordenadas ascendentemente.

        Con `limit` se devuelven las **últimas** `limit` velas del rango, que es
        lo que hace falta para preparar una ventana en vivo.
        """
        query = "SELECT ts, open, high, low, close, volume FROM ohlcv WHERE symbol = ? AND timeframe = ?"
        params: list[object] = [symbol, timeframe]
        if since is not None:
            query += " AND ts >= ?"
            params.append(since)
        if until is not None:
            query += " AND ts <= ?"
            params.append(until)

        if limit is not None:
            query += " ORDER BY ts DESC LIMIT ?"
            params.append(limit)
            rows = self._conn.execute(query, params).fetchall()
            rows.reverse()
        else:
            query += " ORDER BY ts ASC"
            rows = self._conn.execute(query, params).fetchall()

        return [Candle(ts=r[0], open=r[1], high=r[2], low=r[3], close=r[4], volume=r[5]) for r in rows]

    def range(self, symbol: str, timeframe: str) -> tuple[int | None, int | None]:
        """Primer y último timestamp almacenados. `(None, None)` si no hay nada."""
        row = self._conn.execute(
            "SELECT MIN(ts), MAX(ts) FROM ohlcv WHERE symbol = ? AND timeframe = ?",
            (symbol, timeframe),
        ).fetchone()
        return (row[0], row[1]) if row else (None, None)

    def count(self, symbol: str, timeframe: str) -> int:
        row = self._conn.execute(
            "SELECT COUNT(*) FROM ohlcv WHERE symbol = ? AND timeframe = ?",
            (symbol, timeframe),
        ).fetchone()
        return int(row[0]) if row else 0

    def inventory(self) -> list[tuple[str, str, int, int, int]]:
        """`(símbolo, timeframe, nº velas, primer ts, último ts)` de todo lo guardado."""
        return list(
            self._conn.execute(
                "SELECT symbol, timeframe, COUNT(*), MIN(ts), MAX(ts) "
                "FROM ohlcv GROUP BY symbol, timeframe ORDER BY symbol, timeframe"
            ).fetchall()
        )

    def close(self) -> None:
        self._conn.close()

    def __enter__(self) -> "OHLCVStore":
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()
