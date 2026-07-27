"""Enumeraciones del dominio.

Se usan enums de `str` para que serialicen de forma legible en JSON, en SQLite y
en los logs sin conversiones manuales.
"""

from __future__ import annotations

# `enum.StrEnum` (Python 3.11+) serializa como texto en JSON, SQLite y logs sin
# conversiones manuales, que es justo lo que necesitan los modelos del dominio.
from enum import StrEnum


class Side(StrEnum):
    """Lado de una orden."""

    BUY = "buy"
    SELL = "sell"

    @property
    def opposite(self) -> Side:
        return Side.SELL if self is Side.BUY else Side.BUY

    @property
    def sign(self) -> int:
        """+1 para compras, -1 para ventas."""
        return 1 if self is Side.BUY else -1


class PositionSide(StrEnum):
    """Dirección de una posición abierta."""

    LONG = "long"
    SHORT = "short"

    @property
    def sign(self) -> int:
        return 1 if self is PositionSide.LONG else -1


class OrderType(StrEnum):
    MARKET = "market"
    LIMIT = "limit"


class OrderStatus(StrEnum):
    PENDING = "pending"  # creada localmente, aún no confirmada por el exchange
    OPEN = "open"
    FILLED = "filled"
    PARTIALLY_FILLED = "partially_filled"
    CANCELED = "canceled"
    REJECTED = "rejected"

    @property
    def is_terminal(self) -> bool:
        return self in (OrderStatus.FILLED, OrderStatus.CANCELED, OrderStatus.REJECTED)


class SignalAction(StrEnum):
    """Qué quiere hacer una estrategia.

    La estrategia expresa *intención*, nunca tamaño ni dinero: de eso se encarga
    el `RiskManager`. Esta separación es deliberada.
    """

    ENTER_LONG = "enter_long"
    EXIT_LONG = "exit_long"
    ENTER_SHORT = "enter_short"
    EXIT_SHORT = "exit_short"
    HOLD = "hold"

    @property
    def is_entry(self) -> bool:
        return self in (SignalAction.ENTER_LONG, SignalAction.ENTER_SHORT)

    @property
    def is_exit(self) -> bool:
        return self in (SignalAction.EXIT_LONG, SignalAction.EXIT_SHORT)


class ExitReason(StrEnum):
    """Por qué se cerró una posición. Imprescindible para analizar resultados."""

    SIGNAL = "signal"
    STOP_LOSS = "stop_loss"
    TAKE_PROFIT = "take_profit"
    TRAILING_STOP = "trailing_stop"
    KILL_SWITCH = "kill_switch"
    CIRCUIT_BREAKER = "circuit_breaker"
    END_OF_BACKTEST = "end_of_backtest"
    MANUAL = "manual"


class RunMode(StrEnum):
    BACKTEST = "backtest"
    PAPER = "paper"
    LIVE = "live"


class AlertLevel(StrEnum):
    DEBUG = "debug"
    INFO = "info"
    WARNING = "warning"
    ERROR = "error"
    CRITICAL = "critical"

    @property
    def rank(self) -> int:
        return _ALERT_RANK[self]

    @property
    def emoji(self) -> str:
        return _ALERT_EMOJI[self]


_ALERT_RANK = {
    AlertLevel.DEBUG: 10,
    AlertLevel.INFO: 20,
    AlertLevel.WARNING: 30,
    AlertLevel.ERROR: 40,
    AlertLevel.CRITICAL: 50,
}

_ALERT_EMOJI = {
    AlertLevel.DEBUG: "🔍",
    AlertLevel.INFO: "ℹ️",
    AlertLevel.WARNING: "⚠️",
    AlertLevel.ERROR: "❌",
    AlertLevel.CRITICAL: "🚨",
}


class RejectReason(StrEnum):
    """Motivos por los que el `RiskManager` puede vetar una señal.

    Se persisten para poder responder meses después a "¿por qué no entró aquí?".
    """

    KILL_SWITCH = "kill_switch"
    DAILY_LOSS_LIMIT = "daily_loss_limit"
    MAX_DRAWDOWN = "max_drawdown"
    MAX_POSITIONS = "max_positions"
    MAX_EXPOSURE = "max_exposure"
    COOLDOWN = "cooldown"
    ALREADY_IN_POSITION = "already_in_position"
    NO_POSITION_TO_EXIT = "no_position_to_exit"
    INSUFFICIENT_CASH = "insufficient_cash"
    BELOW_MIN_NOTIONAL = "below_min_notional"
    INVALID_STOP = "invalid_stop"
    SHORTING_DISABLED = "shorting_disabled"
    ZERO_QUANTITY = "zero_quantity"
    STALE_DATA = "stale_data"
