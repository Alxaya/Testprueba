"""Persistencia en SQLite: registro completo de todo lo que hace el bot.

Se guarda **todo**, incluidas las señales que el gestor de riesgo rechazó y el
motivo. Cuando dentro de tres meses te preguntes "¿por qué no entró aquí?", la
respuesta está en la tabla `signals`. Sin eso, depurar una estrategia en vivo es
adivinar.

Notas de implementación:

* **WAL** activado: el panel web puede leer mientras el motor escribe.
* `check_same_thread=False` + `Lock`: el servidor web corre en otro hilo.
* Índices por `(run_id, ts)`, que es como se consulta siempre.
* Escrituras agrupadas en transacción.
"""

from __future__ import annotations

import json
import sqlite3
import threading
from collections.abc import Iterable, Sequence
from pathlib import Path
from typing import Any

from bot.core.enums import RunMode
from bot.core.models import EquityPoint, Fill, Order, Signal, Trade, now_ms

_SCHEMA = """
CREATE TABLE IF NOT EXISTS runs (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    mode        TEXT    NOT NULL,
    started_ts  INTEGER NOT NULL,
    ended_ts    INTEGER,
    config      TEXT,
    notes       TEXT
);

CREATE TABLE IF NOT EXISTS orders (
    client_order_id   TEXT    PRIMARY KEY,
    run_id            INTEGER NOT NULL,
    ts                INTEGER NOT NULL,
    symbol            TEXT    NOT NULL,
    strategy_id       TEXT    NOT NULL,
    side              TEXT    NOT NULL,
    order_type        TEXT    NOT NULL,
    quantity          REAL    NOT NULL,
    price             REAL,
    status            TEXT    NOT NULL,
    filled_quantity   REAL    NOT NULL DEFAULT 0,
    average_price     REAL    NOT NULL DEFAULT 0,
    fee               REAL    NOT NULL DEFAULT 0,
    is_exit           INTEGER NOT NULL DEFAULT 0,
    exit_reason       TEXT,
    exchange_order_id TEXT,
    error             TEXT,
    meta              TEXT
);

CREATE TABLE IF NOT EXISTS fills (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id      INTEGER NOT NULL,
    order_id    TEXT    NOT NULL,
    ts          INTEGER NOT NULL,
    symbol      TEXT    NOT NULL,
    strategy_id TEXT    NOT NULL,
    side        TEXT    NOT NULL,
    quantity    REAL    NOT NULL,
    price       REAL    NOT NULL,
    fee         REAL    NOT NULL,
    is_exit     INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS trades (
    id           INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id       INTEGER NOT NULL,
    symbol       TEXT    NOT NULL,
    strategy_id  TEXT    NOT NULL,
    side         TEXT    NOT NULL,
    quantity     REAL    NOT NULL,
    entry_price  REAL    NOT NULL,
    exit_price   REAL    NOT NULL,
    entry_ts     INTEGER NOT NULL,
    exit_ts      INTEGER NOT NULL,
    pnl          REAL    NOT NULL,
    pnl_pct      REAL    NOT NULL,
    fees         REAL    NOT NULL,
    r_multiple   REAL,
    bars_held    INTEGER NOT NULL DEFAULT 0,
    exit_reason  TEXT    NOT NULL
);

CREATE TABLE IF NOT EXISTS equity (
    id              INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id          INTEGER NOT NULL,
    ts              INTEGER NOT NULL,
    equity          REAL    NOT NULL,
    cash            REAL    NOT NULL,
    positions_value REAL    NOT NULL,
    drawdown_pct    REAL    NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS signals (
    id          INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id      INTEGER NOT NULL,
    ts          INTEGER NOT NULL,
    symbol      TEXT    NOT NULL,
    strategy_id TEXT    NOT NULL,
    action      TEXT    NOT NULL,
    price       REAL    NOT NULL,
    accepted    INTEGER NOT NULL,
    reject_reason TEXT,
    detail      TEXT,
    reason      TEXT
);

CREATE TABLE IF NOT EXISTS events (
    id       INTEGER PRIMARY KEY AUTOINCREMENT,
    run_id   INTEGER NOT NULL,
    ts       INTEGER NOT NULL,
    level    TEXT    NOT NULL,
    category TEXT    NOT NULL,
    message  TEXT    NOT NULL,
    data     TEXT
);

CREATE INDEX IF NOT EXISTS idx_orders_run  ON orders  (run_id, ts);
CREATE INDEX IF NOT EXISTS idx_fills_run   ON fills   (run_id, ts);
CREATE INDEX IF NOT EXISTS idx_trades_run  ON trades  (run_id, exit_ts);
CREATE INDEX IF NOT EXISTS idx_equity_run  ON equity  (run_id, ts);
CREATE INDEX IF NOT EXISTS idx_signals_run ON signals (run_id, ts);
CREATE INDEX IF NOT EXISTS idx_events_run  ON events  (run_id, ts);
"""


class Repository:
    """Acceso a la base de datos del bot."""

    def __init__(self, path: str | Path) -> None:
        self.path = Path(path)
        self.path.parent.mkdir(parents=True, exist_ok=True)
        self._lock = threading.Lock()
        self._conn = sqlite3.connect(str(self.path), check_same_thread=False)
        self._conn.row_factory = sqlite3.Row
        self._conn.execute("PRAGMA journal_mode=WAL")
        self._conn.execute("PRAGMA synchronous=NORMAL")
        self._conn.execute("PRAGMA foreign_keys=ON")
        self._conn.executescript(_SCHEMA)
        self._conn.commit()
        self.run_id: int = 0

    # ----------------------------------------------------------------- runs

    def start_run(self, mode: RunMode, config: dict[str, Any] | None = None, notes: str = "") -> int:
        with self._lock, self._conn:
            cursor = self._conn.execute(
                "INSERT INTO runs (mode, started_ts, config, notes) VALUES (?, ?, ?, ?)",
                (mode.value, now_ms(), json.dumps(config or {}, default=str), notes),
            )
        self.run_id = int(cursor.lastrowid or 0)
        return self.run_id

    def end_run(self, run_id: int | None = None) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                "UPDATE runs SET ended_ts = ? WHERE id = ?", (now_ms(), run_id or self.run_id)
            )

    def last_run(self, mode: RunMode | None = None) -> dict[str, Any] | None:
        query = "SELECT * FROM runs"
        params: tuple[Any, ...] = ()
        if mode is not None:
            query += " WHERE mode = ?"
            params = (mode.value,)
        query += " ORDER BY id DESC LIMIT 1"
        row = self._conn.execute(query, params).fetchone()
        return dict(row) if row else None

    # --------------------------------------------------------------- escritura

    def save_order(self, order: Order) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                """INSERT OR REPLACE INTO orders
                   (client_order_id, run_id, ts, symbol, strategy_id, side, order_type,
                    quantity, price, status, filled_quantity, average_price, fee,
                    is_exit, exit_reason, exchange_order_id, error, meta)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    order.client_order_id, self.run_id, order.ts_created, order.symbol,
                    order.strategy_id, order.side.value, order.order_type.value,
                    order.quantity, order.price, order.status.value, order.filled_quantity,
                    order.average_price, order.fee, int(order.is_exit),
                    order.exit_reason.value if order.exit_reason else None,
                    order.exchange_order_id, order.error,
                    json.dumps(order.meta, default=str),
                ),
            )

    def save_fill(self, fill: Fill) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                """INSERT INTO fills
                   (run_id, order_id, ts, symbol, strategy_id, side, quantity, price, fee, is_exit)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (
                    self.run_id, fill.order_id, fill.ts, fill.symbol, fill.strategy_id,
                    fill.side.value, fill.quantity, fill.price, fill.fee, int(fill.is_exit),
                ),
            )

    def save_trade(self, trade: Trade) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                """INSERT INTO trades
                   (run_id, symbol, strategy_id, side, quantity, entry_price, exit_price,
                    entry_ts, exit_ts, pnl, pnl_pct, fees, r_multiple, bars_held, exit_reason)
                   VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?,?,?)""",
                (
                    self.run_id, trade.symbol, trade.strategy_id, trade.side.value,
                    trade.quantity, trade.entry_price, trade.exit_price, trade.entry_ts,
                    trade.exit_ts, trade.pnl, trade.pnl_pct, trade.fees, trade.r_multiple,
                    trade.bars_held, trade.exit_reason.value,
                ),
            )

    def save_equity(self, point: EquityPoint) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO equity (run_id, ts, equity, cash, positions_value, drawdown_pct) "
                "VALUES (?,?,?,?,?,?)",
                (self.run_id, point.ts, point.equity, point.cash, point.positions_value, point.drawdown_pct),
            )

    def save_equity_batch(self, points: Sequence[EquityPoint]) -> None:
        """Inserción por lotes: una transacción en lugar de N."""
        if not points:
            return
        with self._lock, self._conn:
            self._conn.executemany(
                "INSERT INTO equity (run_id, ts, equity, cash, positions_value, drawdown_pct) "
                "VALUES (?,?,?,?,?,?)",
                [(self.run_id, p.ts, p.equity, p.cash, p.positions_value, p.drawdown_pct) for p in points],
            )

    def save_signal(
        self, signal: Signal, *, accepted: bool, reject_reason: str | None = None, detail: str = ""
    ) -> None:
        """Guarda la señal, aceptada o rechazada. Las rechazadas son las más útiles."""
        with self._lock, self._conn:
            self._conn.execute(
                """INSERT INTO signals
                   (run_id, ts, symbol, strategy_id, action, price, accepted, reject_reason, detail, reason)
                   VALUES (?,?,?,?,?,?,?,?,?,?)""",
                (
                    self.run_id, signal.ts, signal.symbol, signal.strategy_id,
                    signal.action.value, signal.price, int(accepted), reject_reason,
                    detail, signal.reason,
                ),
            )

    def log_event(
        self, level: str, category: str, message: str, data: dict[str, Any] | None = None
    ) -> None:
        with self._lock, self._conn:
            self._conn.execute(
                "INSERT INTO events (run_id, ts, level, category, message, data) VALUES (?,?,?,?,?,?)",
                (self.run_id, now_ms(), level, category, message, json.dumps(data or {}, default=str)),
            )

    # ---------------------------------------------------------------- lectura

    def recent_trades(self, limit: int = 100, run_id: int | None = None) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            "SELECT * FROM trades WHERE run_id = ? ORDER BY exit_ts DESC LIMIT ?",
            (run_id or self.run_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    def equity_series(self, limit: int = 2000, run_id: int | None = None) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            "SELECT ts, equity, cash, positions_value, drawdown_pct FROM equity "
            "WHERE run_id = ? ORDER BY ts DESC LIMIT ?",
            (run_id or self.run_id, limit),
        ).fetchall()
        return [dict(r) for r in reversed(rows)]

    def recent_orders(self, limit: int = 100, run_id: int | None = None) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            "SELECT * FROM orders WHERE run_id = ? ORDER BY ts DESC LIMIT ?",
            (run_id or self.run_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    def recent_signals(self, limit: int = 100, run_id: int | None = None) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            "SELECT * FROM signals WHERE run_id = ? ORDER BY ts DESC LIMIT ?",
            (run_id or self.run_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    def recent_events(self, limit: int = 100, run_id: int | None = None) -> list[dict[str, Any]]:
        rows = self._conn.execute(
            "SELECT * FROM events WHERE run_id = ? ORDER BY ts DESC LIMIT ?",
            (run_id or self.run_id, limit),
        ).fetchall()
        return [dict(r) for r in rows]

    def rejection_stats(self, run_id: int | None = None) -> dict[str, int]:
        rows = self._conn.execute(
            "SELECT reject_reason, COUNT(*) AS n FROM signals "
            "WHERE run_id = ? AND accepted = 0 GROUP BY reject_reason ORDER BY n DESC",
            (run_id or self.run_id,),
        ).fetchall()
        return {r["reject_reason"] or "desconocido": r["n"] for r in rows}

    # ---------------------------------------------------------------- ayudas

    def save_backtest(
        self, trades: Iterable[Trade], equity: Sequence[EquityPoint], orders: Iterable[Order] = ()
    ) -> None:
        """Vuelca de golpe el resultado de un backtest."""
        for trade in trades:
            self.save_trade(trade)
        self.save_equity_batch(equity)
        for order in orders:
            self.save_order(order)

    def close(self) -> None:
        with self._lock:
            self._conn.close()

    def __enter__(self) -> Repository:
        return self

    def __exit__(self, *exc_info: object) -> None:
        self.close()
