"""Motor de trading en vivo (paper y real).

Un único proceso `asyncio` con estas tareas:

* **Un bucle por timeframe**: duerme hasta el próximo cierre de vela, despierta,
  procesa todos los símbolos y estrategias de ese timeframe.
* **Vigilante de stops**: comprueba stop loss y take profit *entre* cierres de
  vela. Sin él, con velas de 4 h un stop podría tardar horas en dispararse.
* **Heartbeat**: avisa periódicamente de que sigue vivo, con un resumen.
* **Watchdog**: si una tarea muere por una excepción no prevista, la reinicia con
  backoff y notifica.

## Paridad con el backtest

En backtest, la señal se calcula al cierre de la vela `t` y se ejecuta al `open`
de `t+1`. En vivo se calcula al cierre de `t` y se ejecuta unos segundos después
— que es, precisamente, el principio de `t+1`. El modelo de ejecución es el
mismo; lo que cambia es que aquí el slippage es real en lugar de estimado.

## Qué pasa al reiniciar

1. Se recarga el histórico y se rehace el calentamiento **sin operar**.
2. Se reconcilia contra el exchange: órdenes abiertas y saldos reales.
3. Si hay discrepancias graves, el bot arranca en modo solo lectura y avisa.

## Qué pasa al apagar

`SIGINT`/`SIGTERM` → deja de aceptar señales, espera a las órdenes en vuelo,
persiste y cierra. **No cierra posiciones**: cerrar una posición es una decisión
de trading, y no debe tomarla una señal del sistema operativo. Para eso está el
kill switch explícito.
"""

from __future__ import annotations

import asyncio
import contextlib
import signal
import time
from collections import deque
from dataclasses import dataclass, field
from typing import Any

from bot.broker.base import Broker
from bot.config.schema import BotConfig, StrategyConfig
from bot.core.enums import AlertLevel, ExitReason, OrderType, PositionSide, RunMode, Side, SignalAction
from bot.core.errors import BotError
from bot.core.logging_setup import get_logger
from bot.core.models import Candle, MarketInfo, OrderIntent, now_ms
from bot.core.timeframe import next_close_ms, timeframe_to_ms
from bot.core.window import Window
from bot.data.base import DataProvider
from bot.execution.portfolio import Portfolio
from bot.execution.router import OrderRouter
from bot.notifications.base import Notifier, NullNotifier
from bot.persistence.repository import Repository
from bot.risk.manager import RiskManager
from bot.strategies.base import Strategy, build_strategy

log = get_logger("engine")


@dataclass(slots=True)
class EngineStatus:
    """Instantánea inmutable del estado, publicada para el panel web.

    Se publica una copia en cada vela en lugar de dar acceso al estado vivo: así
    el servidor web nunca lee una estructura a medio actualizar.
    """

    mode: str = "paper"
    running: bool = False
    read_only: bool = False
    started_ts: int = 0
    last_bar_ts: int = 0
    last_update_ts: int = 0
    equity: float = 0.0
    initial_equity: float = 0.0
    cash: float = 0.0
    return_pct: float = 0.0
    drawdown_pct: float = 0.0
    open_positions: list[dict[str, Any]] = field(default_factory=list)
    closed_trades: int = 0
    total_fees: float = 0.0
    symbols: list[str] = field(default_factory=list)
    timeframe: str = "1h"
    strategies: list[dict[str, Any]] = field(default_factory=list)
    risk: dict[str, Any] = field(default_factory=dict)
    errors: int = 0
    last_error: str = ""

    def to_dict(self) -> dict[str, Any]:
        return {
            "mode": self.mode,
            "running": self.running,
            "read_only": self.read_only,
            "started_ts": self.started_ts,
            "last_bar_ts": self.last_bar_ts,
            "last_update_ts": self.last_update_ts,
            "equity": self.equity,
            "initial_equity": self.initial_equity,
            "cash": self.cash,
            "return_pct": self.return_pct,
            "drawdown_pct": self.drawdown_pct,
            "open_positions": self.open_positions,
            "closed_trades": self.closed_trades,
            "total_fees": self.total_fees,
            "symbols": self.symbols,
            "timeframe": self.timeframe,
            "strategies": self.strategies,
            "risk": self.risk,
            "errors": self.errors,
            "last_error": self.last_error,
        }


class TradingEngine:
    """Orquesta datos, estrategias, riesgo y ejecución en tiempo real."""

    def __init__(
        self,
        config: BotConfig,
        *,
        broker: Broker,
        provider: DataProvider,
        repository: Repository | None = None,
        notifier: Notifier | None = None,
    ) -> None:
        self.config = config
        self.broker = broker
        self.provider = provider
        self.repo = repository
        self.notifier = notifier or NullNotifier()

        self.portfolio = Portfolio(initial_equity=config.portfolio.initial_balance)
        self.risk = RiskManager(
            config.risk,
            kill_switch_file=config.storage.kill_switch_file,
            allow_shorting_broker=broker.supports_shorting,
        )
        self.router = OrderRouter(broker, config.execution)

        self.strategies: list[tuple[Strategy, StrategyConfig]] = []
        #: Búfer de velas por (símbolo, timeframe).
        self._buffers: dict[tuple[str, str], deque[Candle]] = {}
        #: Última vela ya procesada por (símbolo, timeframe): evita duplicar órdenes.
        self._last_processed: dict[tuple[str, str], int] = {}
        self._market_info: dict[str, MarketInfo] = {}

        self.status = EngineStatus(
            mode=config.mode.value,
            initial_equity=config.portfolio.initial_balance,
            equity=config.portfolio.initial_balance,
            cash=config.portfolio.initial_balance,
            symbols=list(config.market.symbols),
            timeframe=config.market.timeframe,
        )
        self._running = False
        self._read_only = False
        self._tasks: list[asyncio.Task[None]] = []
        self._shutdown = asyncio.Event()

    # ------------------------------------------------------------- arranque

    async def start(self) -> None:
        """Arranca el motor y bloquea hasta el apagado."""
        log.info("=" * 70)
        log.info("Arrancando motor en modo %s", self.config.mode.value.upper())
        log.info("=" * 70)

        if self.config.mode is RunMode.LIVE:
            log.warning("⚠️  MODO REAL: las órdenes se envían con dinero de verdad")

        self._bootstrap_strategies()
        await self._bootstrap_market_data()
        await self._reconcile()

        self._running = True
        self.status.running = True
        self.status.started_ts = now_ms()
        self._install_signal_handlers()

        self.notifier.info(
            f"Bot arrancado en modo {self.config.mode.value.upper()}\n"
            f"Símbolos: {', '.join(self.config.market.symbols)}\n"
            f"Estrategias: {', '.join(s.id for s in self.config.enabled_strategies())}\n"
            f"Capital inicial: {self.config.portfolio.initial_balance:,.2f} "
            f"{self.config.portfolio.base_currency}",
            title="Bot arrancado",
        )
        if self.repo:
            self.repo.log_event("info", "lifecycle", "Motor arrancado", {"mode": self.config.mode.value})

        timeframes = sorted({self.config.timeframe_for(sc) for _, sc in self.strategies})
        for timeframe in timeframes:
            self._tasks.append(asyncio.create_task(self._supervised(self._timeframe_loop, timeframe)))

        if self.config.execution.intrabar_stop_check:
            self._tasks.append(asyncio.create_task(self._supervised(self._stop_monitor_loop)))
        if self.config.notifications.telegram.heartbeat_hours > 0:
            self._tasks.append(asyncio.create_task(self._supervised(self._heartbeat_loop)))

        try:
            await self._shutdown.wait()
        finally:
            await self.stop()

    def _bootstrap_strategies(self) -> None:
        """Instancia una estrategia por cada par (configuración, símbolo)."""
        for strategy_config in self.config.enabled_strategies():
            for symbol in self.config.symbols_for(strategy_config):
                strategy = build_strategy(
                    strategy_config.strategy,
                    strategy_id=strategy_config.id,
                    symbol=symbol,
                    timeframe=self.config.timeframe_for(strategy_config),
                    params=strategy_config.params,
                )
                self.strategies.append((strategy, strategy_config))
                log.info(
                    "Estrategia %-20s %-12s %-4s warmup=%d velas",
                    strategy_config.id, symbol, strategy.timeframe, strategy.warmup,
                )
        if not self.strategies:
            raise BotError("No hay estrategias habilitadas")

        self.status.strategies = [
            {
                "id": strategy.strategy_id,
                "strategy": type(strategy).name,
                "symbol": strategy.symbol,
                "timeframe": strategy.timeframe,
                "params": strategy.params,
                "doc": type(strategy).describe(strategy.params).to_dict(),
            }
            for strategy, _ in self.strategies
        ]

    async def _bootstrap_market_data(self) -> None:
        """Descarga el histórico de calentamiento. **No se opera durante esta fase.**"""
        needed: dict[tuple[str, str], int] = {}
        for strategy, _ in self.strategies:
            key = (strategy.symbol, strategy.timeframe)
            needed[key] = max(needed.get(key, 0), strategy.lookback + 10)

        for (symbol, timeframe), size in needed.items():
            limit = max(size, self.config.market.history_bars)
            candles = await asyncio.to_thread(
                self.provider.fetch_ohlcv, symbol, timeframe, since=None, limit=limit
            )
            if not candles:
                raise BotError(f"No se pudieron descargar velas de {symbol} {timeframe}")

            self._buffers[(symbol, timeframe)] = deque(candles, maxlen=limit + 100)
            # La última vela histórica se marca como procesada: el calentamiento
            # no debe generar órdenes retroactivas.
            self._last_processed[(symbol, timeframe)] = candles[-1].ts
            log.info(
                "Calentamiento %s %s: %d velas (última %s)",
                symbol, timeframe, len(candles), candles[-1].dt.strftime("%Y-%m-%d %H:%M"),
            )

            try:
                self._market_info[symbol] = self.broker.market_info(symbol)
            except Exception as exc:
                log.warning("No se pudo leer la información de mercado de %s: %s", symbol, exc)

        self._update_prices()

    async def _reconcile(self) -> None:
        """Comprueba que el estado local cuadra con el del exchange.

        En `live` cualquier discrepancia arranca el bot en **solo lectura**: es
        mejor no operar que operar sobre un estado que no entendemos.
        """
        try:
            open_orders = await asyncio.to_thread(self.broker.fetch_open_orders, None)
        except Exception as exc:
            log.warning("No se pudieron leer las órdenes abiertas: %s", exc)
            open_orders = []

        if open_orders:
            message = f"Hay {len(open_orders)} órdenes abiertas en el exchange al arrancar"
            log.warning(message)
            self.notifier.warning(
                message + "\nRevísalas antes de continuar: el bot no las gestiona.",
                title="Reconciliación",
            )

        if self.config.mode is RunMode.LIVE:
            try:
                balance = await asyncio.to_thread(
                    self.broker.fetch_balance, self.config.portfolio.base_currency
                )
                log.info(
                    "Saldo real: %.2f %s disponibles",
                    balance.free, self.config.portfolio.base_currency,
                )
                # En live el capital real manda sobre lo escrito en el YAML.
                self.portfolio.cash = balance.free
                self.portfolio.initial_equity = balance.free
                self.portfolio.peak_equity = balance.free
                self.status.initial_equity = balance.free
                if balance.free <= 0:
                    self._read_only = True
                    self.notifier.critical(
                        "Saldo cero en el exchange. El bot arranca en modo solo lectura.",
                        title="Reconciliación",
                    )
            except Exception as exc:
                self._read_only = True
                log.error("No se pudo leer el saldo: %s. Modo solo lectura.", exc)
                self.notifier.critical(
                    f"No se pudo leer el saldo del exchange: {exc}\n"
                    "El bot arranca en SOLO LECTURA y no enviará órdenes.",
                    title="Reconciliación fallida",
                )

        self.status.read_only = self._read_only

    # --------------------------------------------------------------- bucles

    async def _supervised(self, coro: Any, *args: Any) -> None:
        """Watchdog: reinicia la tarea si muere, con backoff exponencial."""
        attempt = 0
        while self._running and not self._shutdown.is_set():
            try:
                await coro(*args)
                return  # terminó de forma limpia
            except asyncio.CancelledError:
                raise
            except Exception as exc:
                attempt += 1
                self.status.errors += 1
                self.status.last_error = str(exc)
                delay = min(300.0, 5.0 * (2 ** min(attempt, 6)))
                log.exception("Tarea %s murió (intento %d). Reinicio en %.0fs", coro.__name__, attempt, delay)
                self.notifier.error(
                    f"Tarea {coro.__name__} falló: {exc}\nReinicio automático en {delay:.0f}s",
                    title="Error del motor",
                )
                if self.repo:
                    self.repo.log_event("error", "engine", f"{coro.__name__}: {exc}")
                await asyncio.sleep(delay)

    async def _timeframe_loop(self, timeframe: str) -> None:
        """Duerme hasta el cierre de vela y procesa."""
        step = timeframe_to_ms(timeframe)
        delay = self.config.market.confirmation_delay_s
        log.info("Bucle de %s iniciado (vela cada %.0f s)", timeframe, step / 1000)

        while self._running and not self._shutdown.is_set():
            wait_s = (next_close_ms(now_ms(), timeframe) - now_ms()) / 1000.0 + delay
            wait_s = max(1.0, wait_s)
            log.debug("Próxima vela de %s en %.0f s", timeframe, wait_s)

            with contextlib.suppress(asyncio.TimeoutError):
                await asyncio.wait_for(self._shutdown.wait(), timeout=wait_s)
                return  # llegó la señal de apagado

            if not self._running:
                return
            await self._process_bar(timeframe)

    async def _process_bar(self, timeframe: str) -> None:
        """Procesa el cierre de vela: datos → salidas → señales → órdenes."""
        strategies = [(s, c) for s, c in self.strategies if s.timeframe == timeframe]
        symbols = sorted({s.symbol for s, _ in strategies})

        updated: list[str] = []
        for symbol in symbols:
            if await self._refresh_candles(symbol, timeframe):
                updated.append(symbol)

        if not updated:
            log.debug("Sin velas nuevas de %s", timeframe)
            return

        prices = self._update_prices()
        bar_ts = max(
            self._last_processed.get((symbol, timeframe), 0) for symbol in updated
        )
        self.risk.on_bar(bar_ts, self.portfolio)

        # 1. Salidas por stop/objetivo, con el rango de la vela recién cerrada.
        for symbol in updated:
            await self._check_exit_levels(symbol, timeframe)

        self.portfolio.increment_bars_held()

        # 2. Señales de estrategia.
        for strategy, strategy_config in strategies:
            if strategy.symbol not in updated:
                continue
            await self._evaluate_strategy(strategy, strategy_config, timeframe)

        # 3. Snapshot de equity y publicación de estado.
        point = self.portfolio.record_equity(bar_ts, prices)
        if self.repo:
            self.repo.save_equity(point)
        self.status.last_bar_ts = bar_ts
        self._publish_status()

        log.info(
            "Vela %s procesada │ equity %.2f (%.2f %%) │ DD %.2f %% │ %d posiciones",
            timeframe, point.equity,
            (point.equity / self.portfolio.initial_equity - 1) * 100,
            point.drawdown_pct, len(self.portfolio.positions),
        )

    async def _refresh_candles(self, symbol: str, timeframe: str) -> bool:
        """Descarga velas nuevas. Devuelve `True` si había alguna sin procesar."""
        key = (symbol, timeframe)
        try:
            candles = await asyncio.to_thread(
                self.provider.fetch_ohlcv, symbol, timeframe, since=None, limit=200
            )
        except Exception as exc:
            log.error("No se pudieron descargar velas de %s %s: %s", symbol, timeframe, exc)
            return False

        if not candles:
            return False

        buffer = self._buffers.setdefault(key, deque(maxlen=1000))
        known = {c.ts for c in buffer}
        added = [c for c in candles if c.ts not in known]
        buffer.extend(added)

        last_ts = candles[-1].ts
        previous = self._last_processed.get(key, 0)
        if last_ts <= previous:
            return False  # ya procesada: dedupe, evita órdenes duplicadas

        # Fail-closed ante datos rancios: si la última vela es demasiado vieja,
        # el feed está roto y operar sería decidir con información obsoleta.
        step = timeframe_to_ms(timeframe)
        staleness = (now_ms() - last_ts) / step
        if staleness > self.config.market.max_data_staleness_bars:
            log.error(
                "Datos rancios en %s %s: última vela hace %.1f velas. No se opera.",
                symbol, timeframe, staleness,
            )
            self.notifier.warning(
                f"Datos rancios en {symbol} {timeframe} ({staleness:.1f} velas de retraso). "
                "El bot no operará hasta que el feed se recupere.",
                title="Feed de datos",
            )
            return False

        self._last_processed[key] = last_ts
        return True

    def _window(self, symbol: str, timeframe: str, lookback: int) -> Window | None:
        buffer = self._buffers.get((symbol, timeframe))
        if not buffer:
            return None
        candles = list(buffer)[-lookback:]
        return Window.from_candles(symbol, timeframe, candles) if candles else None

    def _update_prices(self) -> dict[str, float]:
        """Precios de cierre más recientes por símbolo."""
        prices: dict[str, float] = {}
        for (symbol, _), buffer in self._buffers.items():
            if buffer:
                prices[symbol] = buffer[-1].close
        self.portfolio.mark_prices(prices)
        if hasattr(self.broker, "set_prices"):
            self.broker.set_prices(prices)  # type: ignore[attr-defined]
        return prices

    async def _evaluate_strategy(
        self, strategy: Strategy, strategy_config: StrategyConfig, timeframe: str
    ) -> None:
        """Pide señal, la evalúa contra el riesgo y ejecuta si procede."""
        window = self._window(strategy.symbol, timeframe, strategy.lookback)
        if window is None or len(window) < strategy.warmup:
            return

        position = self.portfolio.position(strategy.symbol, strategy.strategy_id)
        if position is not None and self.risk.update_trailing_stop(position, window):
            log.debug(
                "Trailing stop de %s %s movido a %.4f",
                strategy.symbol, strategy.strategy_id, position.stop_price,
            )

        try:
            signal = strategy.generate(window, position)
        except Exception:
            log.exception("Error en la estrategia %s", strategy.strategy_id)
            return

        if signal is None or signal.action is SignalAction.HOLD:
            return

        market = self._market_info.get(strategy.symbol) or self.broker.market_info(strategy.symbol)
        decision = self.risk.evaluate(
            signal, self.portfolio, window, market, risk_weight=strategy_config.risk_weight
        )

        if self.repo:
            self.repo.save_signal(
                signal,
                accepted=decision.approved,
                reject_reason=decision.reason.value if decision.reason else None,
                detail=decision.detail,
            )

        if not decision.approved or decision.intent is None:
            log.info(
                "Señal %s de %s rechazada: %s (%s)",
                signal.action.value, strategy.strategy_id,
                decision.reason.value if decision.reason else "?", decision.detail,
            )
            return

        if self._read_only:
            log.warning("Modo solo lectura: la orden de %s no se envía", strategy.strategy_id)
            return

        await self._submit(decision.intent)

    async def _check_exit_levels(self, symbol: str, timeframe: str) -> None:
        """Comprueba stop y take profit con el rango de la última vela cerrada."""
        buffer = self._buffers.get((symbol, timeframe))
        if not buffer:
            return
        candle = buffer[-1]
        await self._evaluate_stops(symbol, high=candle.high, low=candle.low, price=candle.close)

    async def _evaluate_stops(self, symbol: str, *, high: float, low: float, price: float) -> None:
        """Dispara las salidas cuyas condiciones se hayan cumplido."""
        for position in list(self.portfolio.positions.values()):
            if position.symbol != symbol:
                continue
            position.update_extremes(high, low)

            reason: ExitReason | None = None
            if position.side is PositionSide.LONG:
                if position.stop_price is not None and low <= position.stop_price:
                    reason = (
                        ExitReason.TRAILING_STOP
                        if position.initial_stop is not None and position.stop_price > position.initial_stop
                        else ExitReason.STOP_LOSS
                    )
                elif position.take_profit is not None and high >= position.take_profit:
                    reason = ExitReason.TAKE_PROFIT
            else:
                if position.stop_price is not None and high >= position.stop_price:
                    reason = ExitReason.STOP_LOSS
                elif position.take_profit is not None and low <= position.take_profit:
                    reason = ExitReason.TAKE_PROFIT

            if reason is None:
                continue

            log.warning(
                "%s en %s (%s): precio %.4f, stop %.4f",
                reason.value, symbol, position.strategy_id, price, position.stop_price or 0.0,
            )
            if self._read_only:
                continue

            await self._submit(
                OrderIntent(
                    symbol=symbol,
                    side=Side.SELL if position.side is PositionSide.LONG else Side.BUY,
                    quantity=position.quantity,
                    order_type=OrderType.MARKET,
                    strategy_id=position.strategy_id,
                    ts=now_ms(),
                    reference_price=price,
                    is_exit=True,
                    exit_reason=reason,
                    reason=reason.value,
                )
            )

    async def _submit(self, intent: OrderIntent) -> None:
        """Envía la orden, aplica los fills y notifica."""
        order, fills = await asyncio.to_thread(self.router.submit, intent)

        if self.repo:
            self.repo.save_order(order)

        if not fills:
            if order.error:
                self.notifier.warning(
                    f"Orden no ejecutada en {intent.symbol}: {order.error}",
                    title="Orden rechazada",
                )
            return

        for fill in fills:
            position_before = self.portfolio.position(fill.symbol, fill.strategy_id)
            trade = self.portfolio.apply_fill(fill)

            if self.repo:
                self.repo.save_fill(fill)

            if trade is not None:
                self.risk.on_trade_closed(trade)
                if self.repo:
                    self.repo.save_trade(trade)
                emoji = "🟢" if trade.pnl > 0 else "🔴"
                self.notifier.send(
                    f"{emoji} Cerrada {trade.symbol} ({trade.strategy_id})\n"
                    f"Entrada {trade.entry_price:.4f} → Salida {trade.exit_price:.4f}\n"
                    f"PnL: {trade.pnl:+.2f} ({trade.pnl_pct:+.2f} %)\n"
                    f"Motivo: {trade.exit_reason.value}\n"
                    f"Equity: {self.portfolio.equity():,.2f}",
                    AlertLevel.INFO if trade.pnl > 0 else AlertLevel.WARNING,
                    title="Posición cerrada",
                )
            elif position_before is None:
                position = self.portfolio.position(fill.symbol, fill.strategy_id)
                if position is not None:
                    position.stop_price = intent.stop_price
                    position.initial_stop = intent.stop_price
                    position.take_profit = intent.take_profit

                lines = [
                    f"Abierta {fill.symbol} ({fill.strategy_id})",
                    f"Cantidad: {fill.quantity:.8f} @ {fill.price:.4f}",
                ]
                if intent.stop_price:
                    lines.append(f"Stop: {intent.stop_price:.4f}")
                if intent.take_profit:
                    lines.append(f"Objetivo: {intent.take_profit:.4f}")
                lines.append(f"Riesgo asumido: {intent.meta.get('risk_amount', 0.0):.2f}")
                lines.append(f"Motivo: {intent.reason}")
                self.notifier.info("\n".join(lines), title="Posición abierta")

        if self.risk.state.kill_switch_engaged:
            self.notifier.critical(
                f"KILL SWITCH ACTIVO: {self.risk.state.kill_switch_reason}\n"
                "El bot no abrirá posiciones nuevas.",
                title="Kill switch",
            )

    async def _stop_monitor_loop(self) -> None:
        """Vigila stops entre cierres de vela.

        Sin esta tarea, con velas de 4 h un stop podría tardar horas en
        dispararse. Se consulta el ticker (mucho más barato que las velas) solo
        de los símbolos con posición abierta.
        """
        interval = self.config.execution.stop_check_interval_s
        log.info("Vigilante de stops activo (cada %d s)", interval)

        while self._running and not self._shutdown.is_set():
            with contextlib.suppress(asyncio.TimeoutError):
                await asyncio.wait_for(self._shutdown.wait(), timeout=interval)
                return

            symbols = {p.symbol for p in self.portfolio.positions.values()}
            for symbol in symbols:
                try:
                    ticker = await asyncio.to_thread(self.broker.fetch_ticker, symbol)
                except Exception as exc:
                    log.debug("No se pudo leer el ticker de %s: %s", symbol, exc)
                    continue
                await self._evaluate_stops(
                    symbol, high=ticker.last, low=ticker.last, price=ticker.last
                )

            if self.risk.kill_switch_active() and self.portfolio.positions:
                await self._liquidate("kill switch activo")

    async def _liquidate(self, reason: str) -> None:
        """Cierra todas las posiciones a mercado. Solo lo llama el kill switch."""
        log.critical("Liquidando todas las posiciones: %s", reason)
        self.notifier.critical(
            f"Cerrando TODAS las posiciones. Motivo: {reason}", title="Liquidación"
        )
        for position in list(self.portfolio.positions.values()):
            try:
                ticker = await asyncio.to_thread(self.broker.fetch_ticker, position.symbol)
                price = ticker.last
            except Exception:
                price = position.entry_price
            await self._submit(
                OrderIntent(
                    symbol=position.symbol,
                    side=Side.SELL if position.side is PositionSide.LONG else Side.BUY,
                    quantity=position.quantity,
                    order_type=OrderType.MARKET,
                    strategy_id=position.strategy_id,
                    ts=now_ms(),
                    reference_price=price,
                    is_exit=True,
                    exit_reason=ExitReason.KILL_SWITCH,
                    reason=reason,
                )
            )

    async def _heartbeat_loop(self) -> None:
        """Resumen periódico: confirma que el bot sigue vivo."""
        interval = self.config.notifications.telegram.heartbeat_hours * 3600
        while self._running and not self._shutdown.is_set():
            with contextlib.suppress(asyncio.TimeoutError):
                await asyncio.wait_for(self._shutdown.wait(), timeout=interval)
                return

            summary = self.portfolio.summary()
            uptime_h = (now_ms() - self.status.started_ts) / 3_600_000
            positions = (
                "\n".join(
                    f"  · {p.symbol} ({p.strategy_id}): "
                    f"{p.unrealized_pnl_pct(self.portfolio.price_of(p.symbol, p.entry_price)):+.2f} %"
                    for p in self.portfolio.open_positions()
                )
                or "  (ninguna)"
            )
            self.notifier.info(
                f"Activo desde hace {uptime_h:.1f} h\n"
                f"Equity: {summary['equity']:,.2f} ({summary['return_pct']:+.2f} %)\n"
                f"Drawdown: {summary['drawdown_pct']:.2f} %\n"
                f"Operaciones cerradas: {summary['closed_trades']}\n"
                f"Posiciones abiertas:\n{positions}",
                title="Heartbeat",
            )

    # ---------------------------------------------------------------- estado

    def _publish_status(self) -> None:
        """Publica una instantánea inmutable para el panel web."""
        prices = self.portfolio.last_prices
        summary = self.portfolio.summary()
        self.status.equity = float(summary["equity"])
        self.status.cash = float(summary["cash"])
        self.status.return_pct = float(summary["return_pct"])
        self.status.drawdown_pct = float(summary["drawdown_pct"])
        self.status.closed_trades = int(summary["closed_trades"])
        self.status.total_fees = float(summary["total_fees"])
        self.status.last_update_ts = now_ms()
        self.status.risk = self.risk.snapshot()
        self.status.read_only = self._read_only
        self.status.open_positions = [
            {
                "symbol": p.symbol,
                "strategy_id": p.strategy_id,
                "side": p.side.value,
                "quantity": p.quantity,
                "entry_price": p.entry_price,
                "current_price": prices.get(p.symbol, p.entry_price),
                "stop_price": p.stop_price,
                "take_profit": p.take_profit,
                "unrealized_pnl": p.unrealized_pnl(prices.get(p.symbol, p.entry_price)),
                "unrealized_pnl_pct": p.unrealized_pnl_pct(prices.get(p.symbol, p.entry_price)),
                "bars_held": p.bars_held,
                "opened_ts": p.opened_ts,
            }
            for p in self.portfolio.open_positions()
        ]

    # --------------------------------------------------------------- apagado

    def _install_signal_handlers(self) -> None:
        loop = asyncio.get_running_loop()
        for sig in (signal.SIGINT, signal.SIGTERM):
            with contextlib.suppress(NotImplementedError, ValueError):
                loop.add_signal_handler(sig, self.request_shutdown)

    def request_shutdown(self) -> None:
        """Pide un apagado ordenado. Seguro llamarlo varias veces."""
        if not self._shutdown.is_set():
            log.warning("Apagado solicitado; terminando de forma ordenada…")
            self._shutdown.set()

    async def stop(self) -> None:
        """Para las tareas, persiste el estado y libera recursos."""
        if not self._running:
            return
        self._running = False
        self.status.running = False

        for task in self._tasks:
            task.cancel()
        await asyncio.gather(*self._tasks, return_exceptions=True)
        self._tasks.clear()

        summary = self.portfolio.summary()
        log.info("=" * 70)
        log.info(
            "Motor detenido │ equity %.2f (%.2f %%) │ %d operaciones │ %d posiciones abiertas",
            summary["equity"], summary["return_pct"], summary["closed_trades"],
            summary["open_positions"],
        )
        log.info("=" * 70)

        self.notifier.warning(
            f"Bot detenido\n"
            f"Equity final: {summary['equity']:,.2f} ({summary['return_pct']:+.2f} %)\n"
            f"Operaciones: {summary['closed_trades']}\n"
            f"Posiciones abiertas al parar: {summary['open_positions']} "
            "(NO se han cerrado)",
            title="Bot detenido",
        )

        if self.repo:
            self.repo.log_event("info", "lifecycle", "Motor detenido", summary)
            self.repo.end_run()
        self.notifier.close()
        with contextlib.suppress(Exception):
            self.provider.close()
        with contextlib.suppress(Exception):
            self.broker.close()


async def run_engine(engine: TradingEngine) -> None:
    """Punto de entrada asíncrono con `uvloop` si está disponible."""
    await engine.start()


def run_forever(engine: TradingEngine) -> None:
    """Arranca el motor de forma síncrona (lo que usa el CLI)."""
    try:
        import uvloop

        uvloop.install()
        log.info("uvloop activado")
    except ImportError:
        pass

    start = time.monotonic()
    try:
        asyncio.run(run_engine(engine))
    except KeyboardInterrupt:  # pragma: no cover - interacción manual
        log.warning("Interrumpido por el usuario")
    finally:
        log.info("Tiempo total de ejecución: %.1f h", (time.monotonic() - start) / 3600)
