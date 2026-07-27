"""Modelos del dominio.

Todos son dataclasses con `slots=True`: menos memoria y acceso más rápido, algo
que se nota cuando un backtest recorre cientos de miles de velas.

Los timestamps son **milisegundos UTC** (entero), igual que devuelve ccxt. No se
usan `datetime` en las rutas calientes para evitar conversiones costosas; hay
propiedades `*_dt` para cuando hace falta legibilidad.
"""

from __future__ import annotations

import math
from dataclasses import dataclass, field
from datetime import UTC, datetime
from typing import Any

from bot.core.enums import (
    ExitReason,
    OrderStatus,
    OrderType,
    PositionSide,
    RejectReason,
    Side,
    SignalAction,
)


def ms_to_dt(ts_ms: int) -> datetime:
    """Convierte milisegundos epoch a `datetime` con zona UTC."""
    return datetime.fromtimestamp(ts_ms / 1000, tz=UTC)


def dt_to_ms(dt: datetime) -> int:
    """Convierte un `datetime` (asumido UTC si es naive) a milisegundos epoch."""
    if dt.tzinfo is None:
        dt = dt.replace(tzinfo=UTC)
    return int(dt.timestamp() * 1000)


def now_ms() -> int:
    """Instante actual en milisegundos epoch UTC."""
    return int(datetime.now(tz=UTC).timestamp() * 1000)


@dataclass(slots=True, frozen=True)
class Candle:
    """Una vela OHLCV cerrada."""

    ts: int  # milisegundos epoch del *inicio* de la vela
    open: float
    high: float
    low: float
    close: float
    volume: float

    @property
    def dt(self) -> datetime:
        return ms_to_dt(self.ts)

    def is_valid(self) -> bool:
        """Coherencia básica: sin NaN, precios positivos y OHLC consistente."""
        values = (self.open, self.high, self.low, self.close)
        if any(math.isnan(v) or v <= 0 for v in values):
            return False
        if self.volume < 0 or math.isnan(self.volume):
            return False
        return self.high >= max(self.open, self.close) and self.low <= min(self.open, self.close)


@dataclass(slots=True, frozen=True)
class MarketInfo:
    """Reglas del mercado tal y como las publica el exchange.

    Ignorarlas es la causa número uno de órdenes rechazadas en producción.
    """

    symbol: str
    base: str
    quote: str
    price_precision: int = 8
    amount_precision: int = 8
    min_amount: float = 0.0
    min_notional: float = 0.0
    maker_fee: float = 0.001
    taker_fee: float = 0.001

    def round_price(self, price: float) -> float:
        return round(price, self.price_precision)

    def round_amount(self, amount: float) -> float:
        """Trunca (nunca redondea al alza) para no exceder el saldo disponible."""
        factor = 10**self.amount_precision
        return math.floor(amount * factor) / factor


@dataclass(slots=True)
class Signal:
    """Intención de una estrategia.

    Nunca incluye tamaño: la estrategia dice *qué* y el `RiskManager` dice
    *cuánto* y *si* se permite.
    """

    action: SignalAction
    symbol: str
    strategy_id: str
    ts: int
    price: float  # precio de referencia (cierre de la vela que generó la señal)
    stop_price: float | None = None
    take_profit: float | None = None
    confidence: float = 1.0  # en [0, 1]; puede escalar el tamaño si se configura
    reason: str = ""
    meta: dict[str, Any] = field(default_factory=dict)


@dataclass(slots=True)
class OrderIntent:
    """Señal ya dimensionada y aprobada por el `RiskManager`.

    Es lo único que el `OrderRouter` acepta enviar.
    """

    symbol: str
    side: Side
    quantity: float
    order_type: OrderType
    strategy_id: str
    ts: int
    reference_price: float
    limit_price: float | None = None
    stop_price: float | None = None
    take_profit: float | None = None
    is_exit: bool = False
    exit_reason: ExitReason | None = None
    reason: str = ""
    meta: dict[str, Any] = field(default_factory=dict)

    @property
    def notional(self) -> float:
        return self.quantity * self.reference_price


@dataclass(slots=True)
class RiskDecision:
    """Resultado de evaluar una señal. O hay orden, o hay motivo de rechazo."""

    approved: bool
    intent: OrderIntent | None = None
    reason: RejectReason | None = None
    detail: str = ""


@dataclass(slots=True)
class Order:
    """Orden enviada (o por enviar) a un broker."""

    client_order_id: str
    symbol: str
    side: Side
    order_type: OrderType
    quantity: float
    strategy_id: str
    ts_created: int
    price: float | None = None
    status: OrderStatus = OrderStatus.PENDING
    filled_quantity: float = 0.0
    average_price: float = 0.0
    fee: float = 0.0
    exchange_order_id: str | None = None
    ts_updated: int = 0
    is_exit: bool = False
    exit_reason: ExitReason | None = None
    error: str | None = None
    meta: dict[str, Any] = field(default_factory=dict)

    @property
    def is_filled(self) -> bool:
        return self.status is OrderStatus.FILLED


@dataclass(slots=True, frozen=True)
class Fill:
    """Ejecución (total o parcial) de una orden."""

    order_id: str
    symbol: str
    side: Side
    quantity: float
    price: float
    fee: float
    ts: int
    strategy_id: str = ""
    is_exit: bool = False
    exit_reason: ExitReason | None = None

    @property
    def notional(self) -> float:
        return self.quantity * self.price


@dataclass(slots=True)
class Position:
    """Posición abierta sobre un símbolo para una estrategia concreta.

    Se identifica por `(symbol, strategy_id)`: dos estrategias pueden tener
    posiciones lógicas independientes sobre el mismo par.
    """

    symbol: str
    strategy_id: str
    side: PositionSide
    quantity: float
    entry_price: float
    opened_ts: int
    stop_price: float | None = None
    take_profit: float | None = None
    initial_stop: float | None = None
    fees_paid: float = 0.0
    bars_held: int = 0
    max_favorable_price: float = 0.0
    max_adverse_price: float = 0.0
    meta: dict[str, Any] = field(default_factory=dict)

    def __post_init__(self) -> None:
        if self.max_favorable_price == 0.0:
            self.max_favorable_price = self.entry_price
        if self.max_adverse_price == 0.0:
            self.max_adverse_price = self.entry_price
        if self.initial_stop is None:
            self.initial_stop = self.stop_price

    @property
    def key(self) -> tuple[str, str]:
        return (self.symbol, self.strategy_id)

    @property
    def notional(self) -> float:
        return self.quantity * self.entry_price

    def unrealized_pnl(self, price: float) -> float:
        """PnL no realizado a `price`, sin descontar la comisión de salida."""
        return (price - self.entry_price) * self.quantity * self.side.sign

    def unrealized_pnl_pct(self, price: float) -> float:
        if self.entry_price == 0:
            return 0.0
        return (price / self.entry_price - 1.0) * 100.0 * self.side.sign

    def risk_per_unit(self) -> float | None:
        """Distancia al stop inicial: el denominador del R-múltiplo."""
        if self.initial_stop is None:
            return None
        distance = abs(self.entry_price - self.initial_stop)
        return distance if distance > 0 else None

    def update_extremes(self, high: float, low: float) -> None:
        """Actualiza las excursiones máximas favorable y adversa."""
        if self.side is PositionSide.LONG:
            self.max_favorable_price = max(self.max_favorable_price, high)
            self.max_adverse_price = min(self.max_adverse_price, low)
        else:
            self.max_favorable_price = min(self.max_favorable_price, low)
            self.max_adverse_price = max(self.max_adverse_price, high)


@dataclass(slots=True)
class Trade:
    """Operación cerrada: el registro que de verdad importa para evaluar."""

    symbol: str
    strategy_id: str
    side: PositionSide
    quantity: float
    entry_price: float
    exit_price: float
    entry_ts: int
    exit_ts: int
    pnl: float  # neto, comisiones incluidas
    fees: float
    exit_reason: ExitReason
    r_multiple: float | None = None
    bars_held: int = 0
    max_favorable_price: float = 0.0
    max_adverse_price: float = 0.0

    @property
    def pnl_pct(self) -> float:
        cost = self.entry_price * self.quantity
        return (self.pnl / cost * 100.0) if cost else 0.0

    @property
    def is_win(self) -> bool:
        return self.pnl > 0

    @property
    def duration_ms(self) -> int:
        return self.exit_ts - self.entry_ts


@dataclass(slots=True, frozen=True)
class EquityPoint:
    """Punto de la curva de equity."""

    ts: int
    equity: float
    cash: float
    positions_value: float
    drawdown_pct: float = 0.0


@dataclass(slots=True, frozen=True)
class Balance:
    """Saldo de la cuenta en la divisa de cotización."""

    currency: str
    free: float
    used: float

    @property
    def total(self) -> float:
        return self.free + self.used


@dataclass(slots=True, frozen=True)
class Ticker:
    """Precio actual de un símbolo."""

    symbol: str
    last: float
    bid: float
    ask: float
    ts: int

    @property
    def mid(self) -> float:
        if self.bid > 0 and self.ask > 0:
            return (self.bid + self.ask) / 2
        return self.last
