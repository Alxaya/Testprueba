"""Gestor de riesgo.

Es el componente con más autoridad del sistema: **puede vetar cualquier orden** y
es el único que decide tamaños. Ninguna estrategia puede saltárselo, porque
ninguna estrategia sabe cuánto dinero hay.

## Orden de evaluación

Los controles se aplican de más global a más local, y el primero que falla corta:

1. Kill switch (manual o automático).
2. Cortacircuitos de cartera (pérdida diaria, drawdown máximo).
3. Enfriamiento por racha de pérdidas.
4. Coherencia de la señal (¿hay posición? ¿se permite el corto?).
5. Cálculo del stop → cálculo del tamaño.
6. Topes de exposición, efectivo y mínimos del mercado.

## Filosofía del dimensionado

Se usa **fracción fija de riesgo**: se arriesga un porcentaje del capital por
operación, medido sobre la **distancia al stop**, no sobre el nocional.

    cantidad = (equity × riesgo_por_operación) / |precio_entrada − stop|

La diferencia es fundamental. "Invertir el 10 % del capital" significa cosas
radicalmente distintas según lo lejos que esté el stop. Con esta fórmula, todas
las operaciones arriesgan lo mismo, y por tanto una racha de pérdidas es
predecible: 10 pérdidas seguidas al 0,5 % son un −5 %, no una sorpresa.

Los criterios de tipo Kelly se descartan a propósito: maximizan el crecimiento
esperado suponiendo que conoces tu ventaja real, cosa que nunca ocurre, y
producen tamaños que hacen inviable psicológicamente operar el sistema.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from datetime import UTC, datetime
from pathlib import Path

from bot.config.schema import RiskConfig
from bot.core.enums import (
    ExitReason,
    OrderType,
    PositionSide,
    RejectReason,
    Side,
    SignalAction,
)
from bot.core.indicators import last_valid
from bot.core.logging_setup import get_logger
from bot.core.models import (
    MarketInfo,
    OrderIntent,
    Position,
    RiskDecision,
    Signal,
    Trade,
)
from bot.core.window import Window
from bot.execution.portfolio import Portfolio

log = get_logger("risk")


@dataclass(slots=True)
class RiskState:
    """Estado mutable del gestor de riesgo. Se persiste para sobrevivir a reinicios."""

    day_start_equity: float = 0.0
    current_day: str = ""
    consecutive_losses: int = 0
    cooldown_until_bar: int = 0
    bars_elapsed: int = 0
    kill_switch_engaged: bool = False
    kill_switch_reason: str = ""
    daily_pnl: float = 0.0
    rejections: dict[str, int] = field(default_factory=dict)


class RiskManager:
    """Aplica los límites de riesgo y dimensiona las órdenes."""

    def __init__(
        self,
        config: RiskConfig,
        *,
        kill_switch_file: str | Path | None = None,
        allow_shorting_broker: bool = False,
    ) -> None:
        self.config = config
        self.state = RiskState()
        self.kill_switch_file = Path(kill_switch_file) if kill_switch_file else None
        self.allow_shorting = config.allow_shorting and allow_shorting_broker

    # ----------------------------------------------------------- ciclo de vela

    def on_bar(self, ts: int, portfolio: Portfolio) -> None:
        """Se llama una vez por vela, antes de evaluar señales.

        Actualiza contadores y comprueba cortacircuitos de cartera.
        """
        self.state.bars_elapsed += 1
        equity = portfolio.equity()

        day = datetime.fromtimestamp(ts / 1000, tz=UTC).strftime("%Y-%m-%d")
        if day != self.state.current_day:
            self.state.current_day = day
            self.state.day_start_equity = equity
            self.state.daily_pnl = 0.0
        else:
            self.state.daily_pnl = equity - self.state.day_start_equity

        self._check_circuit_breakers(portfolio, equity)

    def _check_circuit_breakers(self, portfolio: Portfolio, equity: float) -> None:
        """Dispara el kill switch automático si se cruzan los límites duros."""
        if self.state.kill_switch_engaged:
            return

        drawdown = portfolio.drawdown_pct(equity)
        if drawdown >= self.config.max_drawdown_pct:
            self.engage_kill_switch(
                f"Drawdown máximo superado: {drawdown:.2f}% >= {self.config.max_drawdown_pct}%"
            )
            return

        if self.state.day_start_equity > 0:
            daily_loss_pct = -self.state.daily_pnl / self.state.day_start_equity * 100.0
            if daily_loss_pct >= self.config.max_daily_loss_pct:
                log.warning(
                    "Límite de pérdida diaria alcanzado (%.2f%%). No se abren posiciones nuevas hoy.",
                    daily_loss_pct,
                )

    def on_trade_closed(self, trade: Trade) -> None:
        """Actualiza rachas y enfriamiento al cerrar una operación."""
        if trade.pnl < 0:
            self.state.consecutive_losses += 1
            if self.state.consecutive_losses >= self.config.max_consecutive_losses:
                self.state.cooldown_until_bar = self.state.bars_elapsed + self.config.cooldown_bars
                log.warning(
                    "%d pérdidas consecutivas: enfriamiento durante %d velas",
                    self.state.consecutive_losses, self.config.cooldown_bars,
                )
                self.state.consecutive_losses = 0
        else:
            self.state.consecutive_losses = 0

    # ------------------------------------------------------------ kill switch

    def engage_kill_switch(self, reason: str) -> None:
        """Activa el kill switch: no se abre nada más hasta reiniciarlo a mano."""
        if not self.state.kill_switch_engaged:
            self.state.kill_switch_engaged = True
            self.state.kill_switch_reason = reason
            log.critical("KILL SWITCH ACTIVADO: %s", reason)

    def release_kill_switch(self) -> None:
        """Desactiva el kill switch. Deliberadamente manual."""
        self.state.kill_switch_engaged = False
        self.state.kill_switch_reason = ""
        if self.kill_switch_file and self.kill_switch_file.exists():
            self.kill_switch_file.unlink()
        log.warning("Kill switch desactivado manualmente")

    def kill_switch_active(self) -> bool:
        """Comprueba el kill switch interno y el fichero centinela.

        El fichero permite pararlo todo desde fuera del proceso (`touch data/KILL`),
        que es lo que quieres tener cuando algo va mal y no hay tiempo de nada más.
        """
        if self.state.kill_switch_engaged:
            return True
        if self.kill_switch_file and self.kill_switch_file.exists():
            self.engage_kill_switch(f"Fichero centinela presente: {self.kill_switch_file}")
            return True
        return False

    # ------------------------------------------------------------- evaluación

    def evaluate(
        self,
        signal: Signal,
        portfolio: Portfolio,
        window: Window,
        market: MarketInfo,
        *,
        risk_weight: float = 1.0,
    ) -> RiskDecision:
        """Convierte una señal en una orden dimensionada, o la rechaza con motivo."""
        position = portfolio.position(signal.symbol, signal.strategy_id)

        if signal.action is SignalAction.HOLD:
            return self._reject(RejectReason.ZERO_QUANTITY, "señal HOLD")

        if signal.action.is_exit:
            return self._build_exit(signal, position, market)

        # --- A partir de aquí, solo entradas ---------------------------------

        if self.kill_switch_active():
            return self._reject(RejectReason.KILL_SWITCH, self.state.kill_switch_reason)

        if position is not None:
            return self._reject(
                RejectReason.ALREADY_IN_POSITION,
                f"ya hay posición abierta en {signal.symbol} para {signal.strategy_id}",
            )

        if signal.action is SignalAction.ENTER_SHORT and not self.allow_shorting:
            return self._reject(
                RejectReason.SHORTING_DISABLED,
                "los cortos están desactivados (spot y/o allow_shorting=false)",
            )

        if self.state.bars_elapsed < self.state.cooldown_until_bar:
            remaining = self.state.cooldown_until_bar - self.state.bars_elapsed
            return self._reject(RejectReason.COOLDOWN, f"enfriamiento activo, {remaining} velas restantes")

        equity = portfolio.equity()

        if self.state.day_start_equity > 0:
            daily_loss_pct = -self.state.daily_pnl / self.state.day_start_equity * 100.0
            if daily_loss_pct >= self.config.max_daily_loss_pct:
                return self._reject(
                    RejectReason.DAILY_LOSS_LIMIT,
                    f"pérdida diaria {daily_loss_pct:.2f}% >= {self.config.max_daily_loss_pct}%",
                )

        drawdown = portfolio.drawdown_pct(equity)
        if drawdown >= self.config.max_drawdown_pct:
            return self._reject(
                RejectReason.MAX_DRAWDOWN,
                f"drawdown {drawdown:.2f}% >= {self.config.max_drawdown_pct}%",
            )

        if len(portfolio.positions) >= self.config.max_concurrent_positions:
            return self._reject(
                RejectReason.MAX_POSITIONS,
                f"{len(portfolio.positions)} posiciones abiertas (máx. {self.config.max_concurrent_positions})",
            )

        entry_price = signal.price
        if entry_price <= 0:
            return self._reject(RejectReason.INVALID_STOP, "precio de entrada no válido")

        stop_price = self._resolve_stop(signal, window, entry_price)
        if stop_price is None:
            return self._reject(RejectReason.INVALID_STOP, "no se pudo determinar un stop válido")

        stop_distance = abs(entry_price - stop_price)
        if stop_distance <= 0:
            return self._reject(RejectReason.INVALID_STOP, "distancia al stop nula")

        # --- Dimensionado ----------------------------------------------------

        risk_fraction = self.config.risk_per_trade_pct / 100.0 * risk_weight
        if self.config.scale_by_confidence:
            risk_fraction *= max(0.1, signal.confidence)

        risk_amount = equity * risk_fraction
        quantity = risk_amount / stop_distance

        # Tope por posición.
        max_position_value = equity * self.config.max_position_pct / 100.0
        quantity = min(quantity, max_position_value / entry_price)

        # Tope de exposición agregada.
        current_exposure = portfolio.exposure()
        max_total = equity * self.config.max_total_exposure_pct / 100.0
        available_exposure = max_total - current_exposure
        if available_exposure <= 0:
            return self._reject(
                RejectReason.MAX_EXPOSURE,
                f"exposición {current_exposure:.2f} ya en el máximo {max_total:.2f}",
            )
        quantity = min(quantity, available_exposure / entry_price)

        # Efectivo disponible, reservando margen para la comisión.
        affordable = portfolio.cash / (entry_price * (1.0 + market.taker_fee))
        if affordable <= 0:
            return self._reject(RejectReason.INSUFFICIENT_CASH, f"efectivo {portfolio.cash:.2f}")
        quantity = min(quantity, affordable * 0.999)  # colchón por movimientos de precio

        quantity = market.round_amount(quantity)
        if quantity <= 0:
            return self._reject(RejectReason.ZERO_QUANTITY, "cantidad cero tras aplicar la precisión")

        notional = quantity * entry_price
        min_notional = max(self.config.min_notional, market.min_notional)
        if notional < min_notional:
            return self._reject(
                RejectReason.BELOW_MIN_NOTIONAL,
                f"nocional {notional:.2f} < mínimo {min_notional:.2f}",
            )
        if market.min_amount and quantity < market.min_amount:
            return self._reject(
                RejectReason.BELOW_MIN_NOTIONAL,
                f"cantidad {quantity} < mínimo del mercado {market.min_amount}",
            )

        take_profit = self._resolve_take_profit(signal, entry_price, stop_distance)

        intent = OrderIntent(
            symbol=signal.symbol,
            side=Side.BUY if signal.action is SignalAction.ENTER_LONG else Side.SELL,
            quantity=quantity,
            order_type=OrderType.MARKET,
            strategy_id=signal.strategy_id,
            ts=signal.ts,
            reference_price=entry_price,
            stop_price=stop_price,
            take_profit=take_profit,
            is_exit=False,
            reason=signal.reason,
            meta={
                "risk_amount": risk_amount,
                "stop_distance": stop_distance,
                "risk_pct_of_equity": risk_fraction * 100.0,
                "confidence": signal.confidence,
            },
        )
        return RiskDecision(approved=True, intent=intent)

    def _build_exit(
        self, signal: Signal, position: Position | None, market: MarketInfo
    ) -> RiskDecision:
        """Las salidas casi nunca se vetan: cerrar riesgo siempre está permitido."""
        if position is None:
            return self._reject(
                RejectReason.NO_POSITION_TO_EXIT,
                f"no hay posición abierta en {signal.symbol} para {signal.strategy_id}",
            )
        quantity = market.round_amount(position.quantity)
        if quantity <= 0:
            return self._reject(RejectReason.ZERO_QUANTITY, "cantidad de salida cero")

        intent = OrderIntent(
            symbol=signal.symbol,
            side=Side.SELL if position.side is PositionSide.LONG else Side.BUY,
            quantity=quantity,
            order_type=OrderType.MARKET,
            strategy_id=signal.strategy_id,
            ts=signal.ts,
            reference_price=signal.price,
            is_exit=True,
            exit_reason=ExitReason(signal.meta.get("exit_reason", ExitReason.SIGNAL)),
            reason=signal.reason,
        )
        return RiskDecision(approved=True, intent=intent)

    # ------------------------------------------------------- stops y objetivos

    def _resolve_stop(self, signal: Signal, window: Window, entry_price: float) -> float | None:
        """Stop de la estrategia si lo hay; si no, ATR; si no, porcentaje fijo.

        Nunca se devuelve `None` salvo que el precio sea absurdo: **una entrada sin
        stop no se ejecuta**. Es la regla que impide que un fallo de la estrategia
        se convierta en una pérdida sin fondo.
        """
        is_long = signal.action is SignalAction.ENTER_LONG

        if signal.stop_price is not None and signal.stop_price > 0:
            valid = signal.stop_price < entry_price if is_long else signal.stop_price > entry_price
            if valid:
                return float(signal.stop_price)
            log.warning(
                "Stop incoherente de %s (%.4f frente a entrada %.4f): se usa el de respaldo",
                signal.strategy_id, signal.stop_price, entry_price,
            )

        atr_value = last_valid(window.atr(self.config.stop_atr_period))
        if atr_value and atr_value > 0:
            distance = atr_value * self.config.stop_atr_multiplier
            stop = entry_price - distance if is_long else entry_price + distance
            if stop > 0:
                return stop

        pct = self.config.fallback_stop_pct / 100.0
        stop = entry_price * (1.0 - pct) if is_long else entry_price * (1.0 + pct)
        return stop if stop > 0 else None

    def _resolve_take_profit(
        self, signal: Signal, entry_price: float, stop_distance: float
    ) -> float | None:
        if signal.take_profit is not None and signal.take_profit > 0:
            return float(signal.take_profit)
        multiple = self.config.take_profit_r_multiple
        if multiple <= 0:
            return None
        is_long = signal.action is SignalAction.ENTER_LONG
        return (
            entry_price + stop_distance * multiple if is_long
            else entry_price - stop_distance * multiple
        )

    def update_trailing_stop(self, position: Position, window: Window) -> bool:
        """Sube el stop siguiendo al precio. Devuelve `True` si lo movió.

        El trailing **solo se mueve a favor**: nunca se aleja del precio, porque
        eso sería aumentar el riesgo de una operación ya abierta, que es la forma
        más común de convertir una pérdida pequeña en una grande.
        """
        if not self.config.trailing_stop_enabled:
            return False

        atr_value = last_valid(window.atr(self.config.stop_atr_period))
        if not atr_value or atr_value <= 0:
            return False

        distance = atr_value * self.config.trailing_stop_atr_multiplier
        price = window.price

        if position.side is PositionSide.LONG:
            candidate = price - distance
            if position.stop_price is None or candidate > position.stop_price:
                position.stop_price = candidate
                return True
        else:
            candidate = price + distance
            if position.stop_price is None or candidate < position.stop_price:
                position.stop_price = candidate
                return True
        return False

    # ------------------------------------------------------------------ utils

    def _reject(self, reason: RejectReason, detail: str) -> RiskDecision:
        self.state.rejections[reason.value] = self.state.rejections.get(reason.value, 0) + 1
        log.debug("Señal rechazada [%s]: %s", reason.value, detail)
        return RiskDecision(approved=False, reason=reason, detail=detail)

    def snapshot(self) -> dict[str, object]:
        """Estado del riesgo para el panel web y las alertas."""
        return {
            "kill_switch": self.state.kill_switch_engaged,
            "kill_switch_reason": self.state.kill_switch_reason,
            "daily_pnl": self.state.daily_pnl,
            "day_start_equity": self.state.day_start_equity,
            "current_day": self.state.current_day,
            "consecutive_losses": self.state.consecutive_losses,
            "cooldown_active": self.state.bars_elapsed < self.state.cooldown_until_bar,
            "rejections": dict(self.state.rejections),
            "limits": {
                "risk_per_trade_pct": self.config.risk_per_trade_pct,
                "max_position_pct": self.config.max_position_pct,
                "max_total_exposure_pct": self.config.max_total_exposure_pct,
                "max_concurrent_positions": self.config.max_concurrent_positions,
                "max_daily_loss_pct": self.config.max_daily_loss_pct,
                "max_drawdown_pct": self.config.max_drawdown_pct,
            },
        }
