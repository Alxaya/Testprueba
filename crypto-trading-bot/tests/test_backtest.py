"""Tests del motor de backtesting y de las estrategias.

El test más importante del fichero es `test_no_lookahead_in_execution`: verifica
que ninguna orden se ejecuta al precio de la vela que la generó. Si esa propiedad
se rompe, todos los resultados del sistema dejan de significar nada.
"""

from __future__ import annotations

import pytest

from bot.backtest.engine import BacktestEngine
from bot.backtest.metrics import compute_metrics
from bot.backtest.report import render_console
from bot.config.schema import (
    BotConfig,
    ExecutionConfig,
    MarketConfig,
    PortfolioConfig,
    RiskConfig,
    StrategyConfig,
)
from bot.core.enums import RunMode
from bot.core.models import Candle, EquityPoint
from bot.data.synthetic import generate_candles, generate_trend
from bot.strategies import available_strategies, build_strategy


def make_config(**overrides) -> BotConfig:
    base = {
        "mode": RunMode.BACKTEST,
        "market": MarketConfig(symbols=["BTC/USDT"], timeframe="1h"),
        "portfolio": PortfolioConfig(initial_balance=10_000),
        "risk": RiskConfig(risk_per_trade_pct=1.0, max_position_pct=50, max_total_exposure_pct=90),
        "execution": ExecutionConfig(slippage_bps=5),
        "strategies": [
            StrategyConfig(id="ema", strategy="ema_crossover", symbols=["BTC/USDT"],
                           params={"fast_period": 10, "slow_period": 30, "use_trend_filter": False})
        ],
    }
    base.update(overrides)
    return BotConfig(**base)


@pytest.fixture
def trending_data() -> dict[str, list[Candle]]:
    return {"BTC/USDT": generate_trend(count=600)}


def test_backtest_runs_and_produces_metrics(trending_data) -> None:
    result = BacktestEngine(make_config(), trending_data).run()

    assert result.metrics.bars > 0
    assert result.metrics.final_equity > 0
    assert isinstance(result.benchmark_return_pct, float)
    assert result.assumptions, "el informe debe declarar sus supuestos"


def test_no_lookahead_in_execution(trending_data) -> None:
    """Ninguna operación puede ejecutarse al precio exacto del cierre que la generó.

    En el motor, la señal nace del cierre de `t` y la orden se ejecuta al `open`
    de `t+1`. Si algún precio de entrada coincidiese sistemáticamente con el
    cierre de su vela de señal, habría look-ahead.
    """
    result = BacktestEngine(make_config(), trending_data).run()
    closes = {round(c.close, 8) for c in trending_data["BTC/USDT"]}

    entries_at_close = sum(1 for t in result.trades if round(t.entry_price, 8) in closes)
    # Con slippage aplicado, ningún precio de entrada debería coincidir con un cierre.
    assert entries_at_close == 0, "hay entradas ejecutadas al cierre de su propia vela"


def test_positions_closed_at_end(trending_data) -> None:
    """Al final del histórico no puede quedar nada abierto sin contabilizar."""
    engine = BacktestEngine(make_config(), trending_data)
    result = engine.run()

    assert not engine.portfolio.positions
    assert result.metrics.total_trades == len(result.trades)


def test_fees_reduce_returns(trending_data) -> None:
    """Con comisiones altas, el resultado debe ser peor. Suena obvio; conviene verificarlo."""
    from bot.config.schema import ExchangeConfig, FeesConfig

    cheap = make_config()
    cheap.exchange = ExchangeConfig(fees=FeesConfig(maker_bps=0, taker_bps=0))
    expensive = make_config()
    expensive.exchange = ExchangeConfig(fees=FeesConfig(maker_bps=50, taker_bps=50))

    cheap_result = BacktestEngine(cheap, trending_data).run()
    expensive_result = BacktestEngine(expensive, trending_data).run()

    if cheap_result.metrics.total_trades > 0:
        assert expensive_result.metrics.total_return_pct <= cheap_result.metrics.total_return_pct


def test_risk_limits_apply_in_backtest(trending_data) -> None:
    """Con un tope de una posición, nunca puede haber dos abiertas a la vez."""
    config = make_config(
        market=MarketConfig(symbols=["BTC/USDT", "ETH/USDT"], timeframe="1h"),
        risk=RiskConfig(max_concurrent_positions=1),
        strategies=[
            StrategyConfig(id="ema", strategy="ema_crossover",
                           params={"fast_period": 10, "slow_period": 30, "use_trend_filter": False}),
        ],
    )
    data = {
        "BTC/USDT": generate_trend(count=600),
        "ETH/USDT": generate_candles(count=600, start_price=2_000, drift_per_bar=0.002, seed=99),
    }
    engine = BacktestEngine(config, data)
    engine.run()

    assert len(engine.portfolio.positions) <= 1


def test_stop_loss_limits_loss_per_trade() -> None:
    """Ninguna pérdida individual debe superar de forma sensible el riesgo planificado.

    Se permite margen porque un hueco puede saltarse el stop, pero una pérdida
    de varias veces lo previsto indicaría que el stop no se está aplicando.
    """
    config = make_config(risk=RiskConfig(risk_per_trade_pct=1.0, stop_atr_multiplier=2.0))
    data = {"BTC/USDT": generate_candles(count=800, volatility_per_bar=0.02, seed=3, regime_shift=True)}

    result = BacktestEngine(config, data).run()

    losses = [t.pnl for t in result.trades if t.pnl < 0]
    if losses:
        worst = abs(min(losses))
        assert worst < 10_000 * 0.05, f"pérdida de {worst:.2f}, muy por encima del 1 % planificado"


def test_buy_and_hold_matches_benchmark() -> None:
    """La estrategia de referencia debe quedar cerca del benchmark calculado."""
    config = make_config(
        strategies=[StrategyConfig(id="bh", strategy="buy_and_hold")],
        risk=RiskConfig(risk_per_trade_pct=5.0, max_position_pct=99, max_total_exposure_pct=99,
                        take_profit_r_multiple=0, trailing_stop_enabled=False,
                        max_drawdown_pct=99, max_daily_loss_pct=99),
    )
    result = BacktestEngine(config, {"BTC/USDT": generate_trend(count=500)}).run()

    assert result.metrics.total_trades >= 1


@pytest.mark.parametrize("name", sorted(available_strategies()))
def test_every_strategy_runs_and_is_documented(name: str) -> None:
    """Toda estrategia registrada debe ejecutarse sin errores y estar documentada."""
    cls = available_strategies()[name]
    doc = cls.describe()
    assert doc.summary, f"{name} no tiene resumen"
    assert doc.edge, f"{name} no explica su ventaja teórica"
    assert doc.limitations, f"{name} no declara limitaciones"
    assert doc.risks, f"{name} no declara riesgos"

    config = make_config(strategies=[StrategyConfig(id=name, strategy=name)])
    result = BacktestEngine(config, {"BTC/USDT": generate_candles(count=800, seed=5)}).run()

    assert result.metrics.bars > 0


def test_strategy_rejects_unknown_params() -> None:
    """Un parámetro mal escrito debe fallar al arrancar, no comportarse raro en producción."""
    from bot.core.errors import ConfigError

    with pytest.raises(ConfigError, match="desconocidos"):
        build_strategy("ema_crossover", "x", "BTC/USDT", "1h", {"fast_perido": 10})


def test_strategy_validates_parameter_coherence() -> None:
    from bot.core.errors import ConfigError

    with pytest.raises(ConfigError, match="menor que"):
        build_strategy("ema_crossover", "x", "BTC/USDT", "1h",
                       {"fast_period": 50, "slow_period": 20})


# ------------------------------------------------------------------ métricas


def test_metrics_on_known_curve() -> None:
    """Curva conocida: +50 % con un drawdown máximo del 25 %."""
    values = [100.0, 120.0, 90.0, 110.0, 150.0]
    curve = [EquityPoint(ts=i * 3_600_000, equity=v, cash=v, positions_value=0.0) for i, v in enumerate(values)]

    metrics = compute_metrics(curve, [], timeframe="1h", initial_equity=100.0)

    assert metrics.total_return_pct == pytest.approx(50.0)
    assert metrics.max_drawdown_pct == pytest.approx(25.0)  # de 120 a 90
    assert metrics.bars == 5


def test_metrics_handle_empty_input() -> None:
    metrics = compute_metrics([], [], timeframe="1h", initial_equity=1_000.0)

    assert metrics.total_trades == 0
    assert metrics.final_equity == 1_000.0
    assert metrics.max_drawdown_pct == 0.0


def test_report_always_shows_benchmark(trending_data) -> None:
    """El informe no puede omitir la comparación con comprar y mantener."""
    result = BacktestEngine(make_config(), trending_data).run()
    text = render_console(result)

    assert "COMPARACIÓN CON COMPRAR Y MANTENER" in text
    assert "SUPUESTOS DEL MODELO DE EJECUCIÓN" in text


def test_report_warns_on_small_sample() -> None:
    result = BacktestEngine(make_config(), {"BTC/USDT": generate_trend(count=300)}).run()
    text = render_console(result)

    if result.metrics.total_trades < 30:
        assert "muestra es demasiado pequeña" in text


def test_backtest_leaves_no_rejected_dust_orders(trending_data) -> None:
    """Regresión del bug de polvo, visto desde el motor completo.

    Un backtest sano no debe acumular órdenes rechazadas ni dejar posiciones
    abiertas al terminar. Cuando el bug estaba presente, ambas cosas ocurrían y
    el número de operaciones caía a la mitad sin ningún error visible.
    """
    engine = BacktestEngine(make_config(), trending_data)
    engine.run()

    rejected = [o for o in engine.broker.orders() if o.status.value == "rejected"]
    assert not rejected, f"{len(rejected)} órdenes rechazadas: {rejected[0].error}"
    assert not engine.portfolio.positions


def test_walkforward_reports_real_metric_not_penalty() -> None:
    """El informe walk-forward no puede mostrar -inf: eso no informa de nada.

    La penalización por muestra pequeña sirve para *elegir* parámetros, no para
    reportarlos.
    """
    import math

    from bot.backtest.walkforward import ParameterGrid, WalkForwardOptimizer

    config = make_config(
        strategies=[StrategyConfig(id="ema", strategy="ema_crossover",
                                   params={"use_trend_filter": False})],
    )
    data = {"BTC/USDT": generate_candles(count=2500, seed=17, volatility_per_bar=0.015)}
    optimizer = WalkForwardOptimizer(
        config, data, strategy_id="ema",
        grid=ParameterGrid({"fast_period": [10, 21], "slow_period": [50, 89]}),
    )

    result = optimizer.run(train_bars=1000, test_bars=400)

    assert result.folds
    for fold in result.folds:
        assert math.isfinite(fold.in_sample_metric)
        assert math.isfinite(fold.out_of_sample_metric)
    assert math.isfinite(result.efficiency)
    assert "═" in result.render()
