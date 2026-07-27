"""Motor de backtesting dirigido por eventos.

## Por qué dirigido por eventos y no vectorizado

Un backtest vectorizado (calcular todas las señales de golpe con numpy) es mucho
más rápido, pero **no comparte código con el motor en vivo**. En cuanto ambos
divergen, el backtest empieza a contar mentiras sutiles y nadie se entera hasta
que se pierde dinero. Aquí se paga velocidad a cambio de que la estrategia, el
gestor de riesgo, la cartera y el broker sean literalmente los mismos objetos que
en producción.

## Orden de operaciones dentro de cada vela

Este orden es la parte más importante del fichero: cambiarlo introduce
look-ahead con facilidad.

1. **Ejecutar las órdenes pendientes** de la vela anterior al `open` actual.
   Una señal generada con el cierre de `t` no puede ejecutarse a ese cierre: en
   la realidad la orden sale después.
2. **Comprobar stops y take profits** contra el `high`/`low` de la vela.
3. **Actualizar el trailing stop.**
4. **Pedir señales** a las estrategias con la ventana que termina en el `close`.
5. **Encolar** las órdenes resultantes para el `open` de la vela siguiente.
6. **Registrar el equity** al cierre.

## Supuestos conservadores (declarados en el informe)

* Si en la misma vela se tocan stop y take profit, **se asume que saltó el stop**.
  Sin datos intravela no se puede saber cuál ocurrió antes, y equivocarse a favor
  infla los resultados.
* Si el precio abre con hueco más allá del stop, se ejecuta al `open`, no al
  stop: es lo que pasaría de verdad.
* Comisiones y slippage se aplican en **todas** las operaciones, incluidas las
  salidas.
* No se modela profundidad de libro: se asume que la orden es pequeña frente al
  volumen. Con tamaño grande, el resultado real será peor.
"""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

import numpy as np

from bot.backtest.metrics import PerformanceMetrics, buy_and_hold_return, compute_metrics
from bot.broker.paper import PaperBroker
from bot.config.schema import BotConfig
from bot.core.enums import ExitReason, PositionSide, SignalAction
from bot.core.logging_setup import get_logger
from bot.core.models import (
    Candle,
    EquityPoint,
    MarketInfo,
    OrderIntent,
    Position,
    Trade,
)
from bot.core.window import CandleSeries
from bot.execution.portfolio import Portfolio
from bot.execution.router import OrderRouter
from bot.risk.manager import RiskManager
from bot.strategies.base import Strategy, build_strategy

log = get_logger("backtest")


@dataclass(slots=True)
class RejectedSignal:
    """Señal vetada por el gestor de riesgo. Se guarda para poder auditar."""

    ts: int
    symbol: str
    strategy_id: str
    action: str
    reason: str
    detail: str


@dataclass(slots=True)
class BacktestResult:
    """Resultado completo de un backtest."""

    metrics: PerformanceMetrics
    trades: list[Trade]
    equity_curve: list[EquityPoint]
    rejected_signals: list[RejectedSignal]
    benchmark_return_pct: float
    symbols: list[str]
    timeframe: str
    start_ts: int
    end_ts: int
    strategy_ids: list[str]
    assumptions: list[str] = field(default_factory=list)

    def to_dict(self) -> dict[str, Any]:
        return {
            "metrics": self.metrics.to_dict(),
            "benchmark_return_pct": self.benchmark_return_pct,
            "symbols": self.symbols,
            "timeframe": self.timeframe,
            "start_ts": self.start_ts,
            "end_ts": self.end_ts,
            "strategy_ids": self.strategy_ids,
            "trades": len(self.trades),
            "rejected_signals": len(self.rejected_signals),
            "assumptions": self.assumptions,
        }

    @property
    def beats_benchmark(self) -> bool:
        return self.metrics.total_return_pct > self.benchmark_return_pct


ASSUMPTIONS = [
    "Las señales se calculan al cierre de la vela y se ejecutan al open de la siguiente.",
    "Si en la misma vela se tocan stop y take profit, se asume que saltó el stop.",
    "Si el precio abre con hueco más allá del stop, se ejecuta al open (peor precio).",
    "Comisiones y slippage aplicados en todas las operaciones, entradas y salidas.",
    "No se modela profundidad de libro ni impacto de mercado: válido solo para tamaños pequeños.",
    "Las órdenes de mercado se ejecutan completas; no se modelan ejecuciones parciales.",
]


class BacktestEngine:
    """Ejecuta un backtest sobre series históricas ya cargadas."""

    def __init__(
        self,
        config: BotConfig,
        data: dict[str, list[Candle]],
        *,
        market_info: dict[str, MarketInfo] | None = None,
    ) -> None:
        self.config = config
        self.timeframe = config.market.timeframe
        self.series: dict[str, CandleSeries] = {
            symbol: CandleSeries.from_candles(symbol, self.timeframe, candles)
            for symbol, candles in data.items()
            if candles
        }
        if not self.series:
            raise ValueError("No hay datos para backtestear")

        self.broker = PaperBroker(
            initial_balance=config.portfolio.initial_balance,
            quote_currency=config.portfolio.base_currency,
            fees=config.exchange.fees,
            execution=config.execution,
            market_info=market_info,
        )
        self.portfolio = Portfolio(initial_equity=config.portfolio.initial_balance)
        self.risk = RiskManager(
            config.risk,
            kill_switch_file=None,  # en backtest no hay fichero centinela
            allow_shorting_broker=self.broker.supports_shorting,
        )
        self.router = OrderRouter(self.broker, config.execution)

        self.strategies = self._build_strategies()
        self.rejected: list[RejectedSignal] = []
        #: Órdenes aprobadas que se ejecutarán en la apertura de la vela siguiente.
        self._pending: list[OrderIntent] = []

    def _build_strategies(self) -> list[tuple[Strategy, float]]:
        """Instancia una estrategia por cada par (config de estrategia, símbolo)."""
        built: list[tuple[Strategy, float]] = []
        for strategy_config in self.config.enabled_strategies():
            for symbol in self.config.symbols_for(strategy_config):
                if symbol not in self.series:
                    continue
                strategy = build_strategy(
                    strategy_config.strategy,
                    strategy_id=f"{strategy_config.id}",
                    symbol=symbol,
                    timeframe=self.config.timeframe_for(strategy_config),
                    params=strategy_config.params,
                )
                built.append((strategy, strategy_config.risk_weight))
        if not built:
            raise ValueError("No hay estrategias habilitadas para los símbolos disponibles")
        return built

    # ---------------------------------------------------------------- ejecución

    def run(self) -> BacktestResult:
        """Recorre el histórico y devuelve el resultado."""
        timeline = self._build_timeline()
        index_maps = {
            symbol: {int(ts): i for i, ts in enumerate(series.ts)}
            for symbol, series in self.series.items()
        }
        max_warmup = max(strategy.warmup for strategy, _ in self.strategies)
        log.info(
            "Backtest: %d velas, %d símbolos, %d estrategias (warmup %d velas)",
            len(timeline), len(self.series), len(self.strategies), max_warmup,
        )

        for bar_number, ts in enumerate(timeline):
            active = {
                symbol: index_maps[symbol][ts]
                for symbol in self.series
                if ts in index_maps[symbol]
            }
            if not active:
                continue

            opens = {s: float(self.series[s].open[i]) for s, i in active.items()}
            closes = {s: float(self.series[s].close[i]) for s, i in active.items()}

            # 1. Órdenes pendientes de la vela anterior → se ejecutan al open.
            self.broker.set_prices(opens)
            self.portfolio.mark_prices(opens)
            self._execute_pending(opens)

            # Marcado a precios de cierre para el resto del ciclo.
            self.broker.set_prices(closes)
            self.portfolio.mark_prices(closes)
            self.risk.on_bar(ts, self.portfolio)

            for symbol, index in active.items():
                series = self.series[symbol]
                high = float(series.high[index])
                low = float(series.low[index])
                self.portfolio.update_extremes(symbol, high, low)

                # 2. Stops y objetivos, con el rango real de la vela.
                self._check_exit_levels(symbol, opens[symbol], high, low, closes[symbol], ts)

            self.portfolio.increment_bars_held()

            # 3-5. Trailing, señales y encolado para la vela siguiente.
            if bar_number >= max_warmup:
                self._generate_signals(active, ts)

            # 6. Snapshot de equity al cierre.
            self.portfolio.record_equity(ts, closes)

        self._close_open_positions(timeline[-1] if timeline else 0)
        return self._build_result(timeline)

    def _build_timeline(self) -> list[int]:
        """Unión ordenada de timestamps de todos los símbolos."""
        stamps: set[int] = set()
        for series in self.series.values():
            stamps.update(int(ts) for ts in series.ts)
        return sorted(stamps)

    def _execute_pending(self, opens: dict[str, float]) -> None:
        """Ejecuta al `open` las órdenes aprobadas en la vela anterior."""
        if not self._pending:
            return
        pending, self._pending = self._pending, []
        for intent in pending:
            if intent.symbol not in opens:
                continue  # el símbolo no cotiza en esta vela
            intent.reference_price = opens[intent.symbol]
            self._submit(intent)

    def _submit(self, intent: OrderIntent) -> None:
        """Envía la orden al broker simulado y aplica los fills a la cartera."""
        _, fills = self.router.submit(intent)
        for fill in fills:
            position_before = self.portfolio.position(fill.symbol, fill.strategy_id)
            trade = self.portfolio.apply_fill(fill)

            if trade is not None:
                self.risk.on_trade_closed(trade)
            elif position_before is None and not fill.is_exit:
                # Entrada nueva: se fijan stop y objetivo en la posición creada.
                position = self.portfolio.position(fill.symbol, fill.strategy_id)
                if position is not None:
                    position.stop_price = intent.stop_price
                    position.initial_stop = intent.stop_price
                    position.take_profit = intent.take_profit

    def _check_exit_levels(
        self, symbol: str, open_price: float, high: float, low: float, close: float, ts: int
    ) -> None:
        """Comprueba stop loss y take profit contra el rango de la vela."""
        for position in list(self.portfolio.positions.values()):
            if position.symbol != symbol:
                continue

            exit_price: float | None = None
            reason: ExitReason | None = None

            if position.side is PositionSide.LONG:
                if position.stop_price is not None and low <= position.stop_price:
                    # Hueco a la baja: la ejecución real sería al open, peor precio.
                    exit_price = min(open_price, position.stop_price)
                    reason = (
                        ExitReason.TRAILING_STOP
                        if position.initial_stop is not None and position.stop_price > position.initial_stop
                        else ExitReason.STOP_LOSS
                    )
                elif position.take_profit is not None and high >= position.take_profit:
                    exit_price = max(open_price, position.take_profit)
                    reason = ExitReason.TAKE_PROFIT
            else:
                if position.stop_price is not None and high >= position.stop_price:
                    exit_price = max(open_price, position.stop_price)
                    reason = ExitReason.STOP_LOSS
                elif position.take_profit is not None and low <= position.take_profit:
                    exit_price = min(open_price, position.take_profit)
                    reason = ExitReason.TAKE_PROFIT

            if exit_price is None or reason is None:
                continue

            self.broker.set_price(symbol, exit_price)
            intent = self._exit_intent(position, exit_price, ts, reason)
            self._submit(intent)
            self.broker.set_price(symbol, close)

    def _exit_intent(
        self, position: Position, price: float, ts: int, reason: ExitReason
    ) -> OrderIntent:
        from bot.core.enums import OrderType, Side  # import local: evita ciclo

        return OrderIntent(
            symbol=position.symbol,
            side=Side.SELL if position.side is PositionSide.LONG else Side.BUY,
            quantity=position.quantity,
            order_type=OrderType.MARKET,
            strategy_id=position.strategy_id,
            ts=ts,
            reference_price=price,
            is_exit=True,
            exit_reason=reason,
            reason=reason.value,
        )

    def _generate_signals(self, active: dict[str, int], ts: int) -> None:
        """Pide señales a cada estrategia y encola las aprobadas."""
        for strategy, risk_weight in self.strategies:
            index = active.get(strategy.symbol)
            if index is None:
                continue

            series = self.series[strategy.symbol]
            window = series.window(index, strategy.lookback)
            if len(window) < strategy.warmup:
                continue

            position = self.portfolio.position(strategy.symbol, strategy.strategy_id)

            if position is not None:
                self.risk.update_trailing_stop(position, window)

            try:
                signal = strategy.generate(window, position)
            except Exception:
                log.exception("Error en la estrategia %s; se ignora esta vela", strategy.strategy_id)
                continue

            if signal is None or signal.action is SignalAction.HOLD:
                continue

            market = self.broker.market_info(strategy.symbol)
            decision = self.risk.evaluate(
                signal, self.portfolio, window, market, risk_weight=risk_weight
            )
            if decision.approved and decision.intent is not None:
                self._pending.append(decision.intent)
            elif decision.reason is not None:
                self.rejected.append(
                    RejectedSignal(
                        ts=signal.ts,
                        symbol=signal.symbol,
                        strategy_id=signal.strategy_id,
                        action=signal.action.value,
                        reason=decision.reason.value,
                        detail=decision.detail,
                    )
                )

    def _close_open_positions(self, ts: int) -> None:
        """Cierra a mercado lo que quede abierto al final del histórico.

        Sin esto, una posición abierta con ganancia latente contaría como
        beneficio no realizado y maquillaría las métricas de operaciones.
        """
        for position in list(self.portfolio.positions.values()):
            series = self.series.get(position.symbol)
            if series is None:
                continue
            price = float(series.close[-1])
            self.broker.set_price(position.symbol, price)
            self._submit(self._exit_intent(position, price, ts, ExitReason.END_OF_BACKTEST))

    def _build_result(self, timeline: list[int]) -> BacktestResult:
        metrics = compute_metrics(
            self.portfolio.equity_curve,
            self.portfolio.trades,
            timeframe=self.timeframe,
            initial_equity=self.config.portfolio.initial_balance,
        )
        # Benchmark: media de comprar y mantener cada símbolo a peso igual.
        benchmarks = [
            buy_and_hold_return(series.close, fee_rate=self.config.exchange.fees.taker_rate)
            for series in self.series.values()
        ]
        benchmark = float(np.mean(benchmarks)) if benchmarks else 0.0

        return BacktestResult(
            metrics=metrics,
            trades=list(self.portfolio.trades),
            equity_curve=list(self.portfolio.equity_curve),
            rejected_signals=self.rejected,
            benchmark_return_pct=benchmark,
            symbols=sorted(self.series),
            timeframe=self.timeframe,
            start_ts=timeline[0] if timeline else 0,
            end_ts=timeline[-1] if timeline else 0,
            strategy_ids=[s.strategy_id for s, _ in self.strategies],
            assumptions=list(ASSUMPTIONS),
        )
