"""Cartera: posiciones, PnL y curva de equity.

Es contabilidad pura, sin I/O y sin red, así que se puede testear de forma
exhaustiva — que es exactamente lo que uno quiere del componente que dice cuánto
dinero tienes.

Decisión de diseño importante: las posiciones se identifican por
`(símbolo, estrategia)`. Dos estrategias pueden mantener posiciones lógicas
independientes sobre BTC/USDT; a nivel de exchange hay un único saldo de BTC, y
esa diferencia se reconcilia en el `TradingEngine`. La alternativa (una única
posición global por símbolo) impediría saber qué estrategia gana y cuál pierde,
que es la información que hace falta para decidir cuál apagar.
"""

from __future__ import annotations

from dataclasses import dataclass, field

from bot.core.enums import ExitReason, PositionSide, Side
from bot.core.logging_setup import get_logger
from bot.core.models import EquityPoint, Fill, Position, Trade

log = get_logger("execution.portfolio")

#: Fracción de la posición por debajo de la cual el resto se considera "polvo".
#: Al enviar una salida, la cantidad se trunca a la precisión del mercado (p. ej.
#: 8 decimales), así que vender una posición de 0.123456789 deja un residuo de
#: ~1e-9. Sin este umbral esa nano-posición quedaría abierta para siempre y el
#: bot intentaría cerrarla en cada vela, generando un rechazo por vela.
#: El polvo real se queda en el saldo del exchange, que es lo que pasa de verdad.
_DUST_RELATIVE = 1e-6
_DUST_ABSOLUTE = 1e-12


def _dust_threshold(quantity: float) -> float:
    return max(_DUST_ABSOLUTE, abs(quantity) * _DUST_RELATIVE)


@dataclass(slots=True)
class Portfolio:
    """Estado de la cartera para un run (backtest, paper o live)."""

    initial_equity: float
    cash: float = 0.0
    positions: dict[tuple[str, str], Position] = field(default_factory=dict)
    trades: list[Trade] = field(default_factory=list)
    equity_curve: list[EquityPoint] = field(default_factory=list)
    total_fees: float = 0.0
    peak_equity: float = 0.0
    _last_prices: dict[str, float] = field(default_factory=dict, repr=False)

    def __post_init__(self) -> None:
        if self.cash == 0.0:
            self.cash = self.initial_equity
        if self.peak_equity == 0.0:
            self.peak_equity = self.initial_equity

    # ------------------------------------------------------------- consultas

    @property
    def last_prices(self) -> dict[str, float]:
        """Últimos precios de marcado conocidos (copia de solo lectura)."""
        return dict(self._last_prices)

    def price_of(self, symbol: str, default: float = 0.0) -> float:
        return self._last_prices.get(symbol, default)

    def position(self, symbol: str, strategy_id: str) -> Position | None:
        return self.positions.get((symbol, strategy_id))

    def has_position(self, symbol: str, strategy_id: str) -> bool:
        return (symbol, strategy_id) in self.positions

    def open_positions(self) -> list[Position]:
        return list(self.positions.values())

    def exposure(self, prices: dict[str, float] | None = None) -> float:
        """Valor de mercado de todas las posiciones abiertas."""
        marks = prices or self._last_prices
        return sum(
            pos.quantity * marks.get(pos.symbol, pos.entry_price) for pos in self.positions.values()
        )

    def equity(self, prices: dict[str, float] | None = None) -> float:
        """Efectivo + valor de mercado de las posiciones."""
        return self.cash + self.exposure(prices)

    def unrealized_pnl(self, prices: dict[str, float] | None = None) -> float:
        marks = prices or self._last_prices
        return sum(
            pos.unrealized_pnl(marks.get(pos.symbol, pos.entry_price)) for pos in self.positions.values()
        )

    def realized_pnl(self) -> float:
        return sum(t.pnl for t in self.trades)

    def drawdown_pct(self, equity: float | None = None) -> float:
        """Caída porcentual actual desde el máximo histórico de equity."""
        current = equity if equity is not None else self.equity()
        if self.peak_equity <= 0:
            return 0.0
        return max(0.0, (self.peak_equity - current) / self.peak_equity * 100.0)

    # ------------------------------------------------------------ mutaciones

    def mark_prices(self, prices: dict[str, float]) -> None:
        """Actualiza los precios de referencia para valorar la cartera."""
        self._last_prices.update(prices)

    def apply_fill(self, fill: Fill) -> Trade | None:
        """Aplica una ejecución. Devuelve el `Trade` si la posición se cerró.

        No conoce el motivo económico: se limita a hacer la contabilidad. Quien
        llama decide si era entrada o salida (`fill.is_exit`).
        """
        key = (fill.symbol, fill.strategy_id)
        self.total_fees += fill.fee

        if fill.side is Side.BUY:
            self.cash -= fill.notional + fill.fee
        else:
            self.cash += fill.notional - fill.fee

        existing = self.positions.get(key)

        if existing is None:
            if fill.is_exit:
                log.warning("Fill de salida sin posición abierta: %s %s", fill.symbol, fill.strategy_id)
                return None
            self.positions[key] = Position(
                symbol=fill.symbol,
                strategy_id=fill.strategy_id,
                side=PositionSide.LONG if fill.side is Side.BUY else PositionSide.SHORT,
                quantity=fill.quantity,
                entry_price=fill.price,
                opened_ts=fill.ts,
                fees_paid=fill.fee,
            )
            return None

        closing = (existing.side is PositionSide.LONG and fill.side is Side.SELL) or (
            existing.side is PositionSide.SHORT and fill.side is Side.BUY
        )

        if not closing:
            # Aumento de posición: precio medio ponderado.
            total_qty = existing.quantity + fill.quantity
            existing.entry_price = (
                existing.entry_price * existing.quantity + fill.price * fill.quantity
            ) / total_qty
            existing.quantity = total_qty
            existing.fees_paid += fill.fee
            return None

        closed_qty = min(existing.quantity, fill.quantity)
        # Se imputa la parte proporcional de la comisión de entrada.
        entry_fee_share = existing.fees_paid * (closed_qty / existing.quantity)
        gross = (fill.price - existing.entry_price) * closed_qty * existing.side.sign
        net = gross - entry_fee_share - fill.fee

        risk_per_unit = existing.risk_per_unit()
        r_multiple = (gross / (risk_per_unit * closed_qty)) if risk_per_unit else None

        trade = Trade(
            symbol=existing.symbol,
            strategy_id=existing.strategy_id,
            side=existing.side,
            quantity=closed_qty,
            entry_price=existing.entry_price,
            exit_price=fill.price,
            entry_ts=existing.opened_ts,
            exit_ts=fill.ts,
            pnl=net,
            fees=entry_fee_share + fill.fee,
            exit_reason=fill.exit_reason or ExitReason.SIGNAL,
            r_multiple=r_multiple,
            bars_held=existing.bars_held,
            max_favorable_price=existing.max_favorable_price,
            max_adverse_price=existing.max_adverse_price,
        )
        self.trades.append(trade)

        remaining = existing.quantity - closed_qty
        if remaining <= _dust_threshold(existing.quantity):
            del self.positions[key]
        else:
            existing.fees_paid -= entry_fee_share
            existing.quantity = remaining

        return trade

    def record_equity(self, ts: int, prices: dict[str, float] | None = None) -> EquityPoint:
        """Registra un punto de la curva de equity y actualiza el máximo histórico."""
        if prices:
            self.mark_prices(prices)
        positions_value = self.exposure()
        equity = self.cash + positions_value
        self.peak_equity = max(self.peak_equity, equity)
        point = EquityPoint(
            ts=ts,
            equity=equity,
            cash=self.cash,
            positions_value=positions_value,
            drawdown_pct=self.drawdown_pct(equity),
        )
        self.equity_curve.append(point)
        return point

    def increment_bars_held(self, symbol: str | None = None) -> None:
        """Suma una vela a las posiciones abiertas (para salidas por tiempo)."""
        for pos in self.positions.values():
            if symbol is None or pos.symbol == symbol:
                pos.bars_held += 1

    def update_extremes(self, symbol: str, high: float, low: float) -> None:
        for pos in self.positions.values():
            if pos.symbol == symbol:
                pos.update_extremes(high, low)

    # -------------------------------------------------------------- resumen

    def summary(self, prices: dict[str, float] | None = None) -> dict[str, float | int]:
        equity = self.equity(prices)
        return {
            "initial_equity": self.initial_equity,
            "equity": equity,
            "cash": self.cash,
            "exposure": self.exposure(prices),
            "return_pct": (equity / self.initial_equity - 1.0) * 100.0 if self.initial_equity else 0.0,
            "realized_pnl": self.realized_pnl(),
            "unrealized_pnl": self.unrealized_pnl(prices),
            "total_fees": self.total_fees,
            "open_positions": len(self.positions),
            "closed_trades": len(self.trades),
            "peak_equity": self.peak_equity,
            "drawdown_pct": self.drawdown_pct(equity),
        }
