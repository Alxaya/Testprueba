"""Tests del gestor de riesgo.

Este es el fichero de tests más importante del proyecto. Cada test describe algo
que **nunca debe pasar**: una estrategia pidiendo más capital del que hay, una
entrada sin stop, operar con el kill switch activo, superar el drawdown máximo.

Regla del repositorio: cualquier cambio en `bot/risk` exige tests nuevos aquí.
"""

from __future__ import annotations

import pytest

from bot.config.schema import RiskConfig
from bot.core.enums import ExitReason, PositionSide, RejectReason, SignalAction
from bot.core.models import MarketInfo, Signal, Trade
from bot.core.window import Window
from bot.data.synthetic import generate_candles
from bot.execution.portfolio import Portfolio
from bot.risk.manager import RiskManager

MARKET = MarketInfo(
    symbol="BTC/USDT", base="BTC", quote="USDT",
    price_precision=2, amount_precision=6, min_notional=10.0,
    maker_fee=0.001, taker_fee=0.001,
)


@pytest.fixture
def window() -> Window:
    candles = generate_candles(count=200, start_price=30_000, volatility_per_bar=0.01, seed=1)
    return Window.from_candles("BTC/USDT", "1h", candles)


@pytest.fixture
def portfolio() -> Portfolio:
    return Portfolio(initial_equity=10_000.0)


@pytest.fixture
def risk() -> RiskManager:
    return RiskManager(RiskConfig())


def make_signal(
    action: SignalAction = SignalAction.ENTER_LONG,
    *,
    price: float = 30_000.0,
    stop: float | None = 29_400.0,
    strategy_id: str = "test",
) -> Signal:
    return Signal(
        action=action, symbol="BTC/USDT", strategy_id=strategy_id,
        ts=1_700_000_000_000, price=price, stop_price=stop,
    )


# ------------------------------------------------------------- dimensionado


def test_position_size_respects_risk_per_trade(window: Window, portfolio: Portfolio) -> None:
    """Se arriesga exactamente el % configurado sobre la distancia al stop."""
    risk = RiskManager(RiskConfig(risk_per_trade_pct=1.0, max_position_pct=100, max_total_exposure_pct=100))
    signal = make_signal(price=30_000, stop=29_000)  # 1000 de distancia

    decision = risk.evaluate(signal, portfolio, window, MARKET)

    assert decision.approved
    assert decision.intent is not None
    # 1 % de 10.000 = 100 de riesgo; 100 / 1000 = 0,1 BTC
    assert decision.intent.quantity == pytest.approx(0.1, rel=1e-3)


def test_wider_stop_means_smaller_position(window: Window, portfolio: Portfolio) -> None:
    """Un stop más lejano implica menos cantidad, para arriesgar lo mismo."""
    risk = RiskManager(RiskConfig(risk_per_trade_pct=1.0, max_position_pct=100, max_total_exposure_pct=100))

    tight = risk.evaluate(make_signal(stop=29_700), portfolio, window, MARKET)
    wide = risk.evaluate(make_signal(stop=27_000, strategy_id="other"), portfolio, window, MARKET)

    assert tight.intent is not None and wide.intent is not None
    assert wide.intent.quantity < tight.intent.quantity
    # El riesgo monetario es prácticamente idéntico en ambos casos.
    risk_tight = tight.intent.quantity * (30_000 - 29_700)
    risk_wide = wide.intent.quantity * (30_000 - 27_000)
    assert risk_tight == pytest.approx(risk_wide, rel=0.02)


def test_max_position_pct_caps_size(window: Window, portfolio: Portfolio) -> None:
    """El tope por posición manda aunque el riesgo permita más."""
    risk = RiskManager(RiskConfig(risk_per_trade_pct=5.0, max_position_pct=10.0, max_total_exposure_pct=50))
    decision = risk.evaluate(make_signal(stop=29_990), portfolio, window, MARKET)

    assert decision.approved
    assert decision.intent is not None
    # Máximo 10 % de 10.000 = 1.000 de nocional.
    assert decision.intent.notional <= 1_000 * 1.001


def test_cannot_size_beyond_available_cash(window: Window) -> None:
    """Nunca se pide más de lo que hay en caja, pase lo que pase."""
    portfolio = Portfolio(initial_equity=100.0, cash=100.0)
    risk = RiskManager(RiskConfig(risk_per_trade_pct=5.0, max_position_pct=100, max_total_exposure_pct=100))

    decision = risk.evaluate(make_signal(stop=29_999), portfolio, window, MARKET)

    if decision.approved:
        assert decision.intent is not None
        assert decision.intent.notional <= portfolio.cash


def test_below_min_notional_is_rejected(window: Window) -> None:
    portfolio = Portfolio(initial_equity=50.0, cash=50.0)
    risk = RiskManager(RiskConfig(risk_per_trade_pct=0.1, min_notional=10.0))

    decision = risk.evaluate(make_signal(), portfolio, window, MARKET)

    assert not decision.approved
    assert decision.reason in (RejectReason.BELOW_MIN_NOTIONAL, RejectReason.ZERO_QUANTITY)


# ----------------------------------------------------------------- límites


def test_max_concurrent_positions(window: Window, portfolio: Portfolio) -> None:
    risk = RiskManager(RiskConfig(max_concurrent_positions=2))
    for i in range(2):
        portfolio.positions[(f"X{i}/USDT", f"s{i}")] = _position(f"X{i}/USDT", f"s{i}")

    decision = risk.evaluate(make_signal(), portfolio, window, MARKET)

    assert not decision.approved
    assert decision.reason is RejectReason.MAX_POSITIONS


def test_kill_switch_blocks_entries(window: Window, portfolio: Portfolio, risk: RiskManager) -> None:
    risk.engage_kill_switch("prueba")

    decision = risk.evaluate(make_signal(), portfolio, window, MARKET)

    assert not decision.approved
    assert decision.reason is RejectReason.KILL_SWITCH


def test_kill_switch_never_blocks_exits(window: Window, portfolio: Portfolio, risk: RiskManager) -> None:
    """Cerrar riesgo siempre está permitido. Bloquear una salida sería atrapar al usuario."""
    portfolio.positions[("BTC/USDT", "test")] = _position()
    risk.engage_kill_switch("prueba")

    decision = risk.evaluate(make_signal(SignalAction.EXIT_LONG), portfolio, window, MARKET)

    assert decision.approved


def test_kill_switch_file_is_detected(tmp_path, window: Window, portfolio: Portfolio) -> None:
    """Un `touch data/KILL` desde fuera del proceso debe parar la operativa."""
    sentinel = tmp_path / "KILL"
    risk = RiskManager(RiskConfig(), kill_switch_file=sentinel)

    assert risk.evaluate(make_signal(), portfolio, window, MARKET).approved

    sentinel.touch()
    decision = risk.evaluate(make_signal(strategy_id="other"), portfolio, window, MARKET)

    assert not decision.approved
    assert decision.reason is RejectReason.KILL_SWITCH


def test_max_drawdown_triggers_kill_switch(window: Window, risk: RiskManager) -> None:
    portfolio = Portfolio(initial_equity=10_000.0, cash=10_000.0)
    portfolio.peak_equity = 10_000.0
    portfolio.cash = 8_000.0  # -20 %, por encima del 15 % configurado

    risk.on_bar(1_700_000_000_000, portfolio)

    assert risk.state.kill_switch_engaged
    assert "Drawdown" in risk.state.kill_switch_reason


def test_daily_loss_limit_blocks_new_entries(window: Window, risk: RiskManager) -> None:
    portfolio = Portfolio(initial_equity=10_000.0, cash=10_000.0)
    day_one = 1_700_000_000_000

    risk.on_bar(day_one, portfolio)          # fija el equity de referencia del día
    portfolio.cash = 9_600.0                 # -4 %, supera el 3 % configurado
    risk.on_bar(day_one + 3_600_000, portfolio)

    decision = risk.evaluate(make_signal(), portfolio, window, MARKET)

    assert not decision.approved
    assert decision.reason is RejectReason.DAILY_LOSS_LIMIT


def test_cooldown_after_consecutive_losses(window: Window, portfolio: Portfolio) -> None:
    risk = RiskManager(RiskConfig(max_consecutive_losses=3, cooldown_bars=5))
    for _ in range(3):
        risk.on_trade_closed(_losing_trade())

    decision = risk.evaluate(make_signal(), portfolio, window, MARKET)

    assert not decision.approved
    assert decision.reason is RejectReason.COOLDOWN


def test_winning_trade_resets_loss_streak(portfolio: Portfolio) -> None:
    risk = RiskManager(RiskConfig(max_consecutive_losses=3))
    risk.on_trade_closed(_losing_trade())
    risk.on_trade_closed(_losing_trade())
    assert risk.state.consecutive_losses == 2

    risk.on_trade_closed(_winning_trade())

    assert risk.state.consecutive_losses == 0


def test_shorting_disabled_on_spot(window: Window, portfolio: Portfolio) -> None:
    risk = RiskManager(RiskConfig(allow_shorting=True), allow_shorting_broker=False)
    signal = make_signal(SignalAction.ENTER_SHORT, stop=30_600)

    decision = risk.evaluate(signal, portfolio, window, MARKET)

    assert not decision.approved
    assert decision.reason is RejectReason.SHORTING_DISABLED


def test_duplicate_entry_rejected(window: Window, portfolio: Portfolio, risk: RiskManager) -> None:
    portfolio.positions[("BTC/USDT", "test")] = _position()

    decision = risk.evaluate(make_signal(), portfolio, window, MARKET)

    assert not decision.approved
    assert decision.reason is RejectReason.ALREADY_IN_POSITION


def test_exit_without_position_rejected(window: Window, portfolio: Portfolio, risk: RiskManager) -> None:
    decision = risk.evaluate(make_signal(SignalAction.EXIT_LONG), portfolio, window, MARKET)

    assert not decision.approved
    assert decision.reason is RejectReason.NO_POSITION_TO_EXIT


# -------------------------------------------------------------------- stops


def test_entry_always_gets_a_stop(window: Window, portfolio: Portfolio, risk: RiskManager) -> None:
    """Sin stop no se entra. Es la regla que impide pérdidas sin fondo."""
    decision = risk.evaluate(make_signal(stop=None), portfolio, window, MARKET)

    assert decision.approved
    assert decision.intent is not None
    assert decision.intent.stop_price is not None
    assert decision.intent.stop_price < decision.intent.reference_price


def test_incoherent_stop_is_replaced(window: Window, portfolio: Portfolio, risk: RiskManager) -> None:
    """Un stop por encima de la entrada en un largo es un bug: se sustituye."""
    decision = risk.evaluate(make_signal(price=30_000, stop=31_000), portfolio, window, MARKET)

    assert decision.approved
    assert decision.intent is not None
    assert decision.intent.stop_price is not None
    assert decision.intent.stop_price < 30_000


def test_take_profit_uses_r_multiple(window: Window, portfolio: Portfolio) -> None:
    risk = RiskManager(RiskConfig(take_profit_r_multiple=2.0))

    decision = risk.evaluate(make_signal(price=30_000, stop=29_000), portfolio, window, MARKET)

    assert decision.intent is not None
    assert decision.intent.take_profit == pytest.approx(32_000)  # 30.000 + 2 × 1.000


def test_trailing_stop_only_moves_favourably(window: Window) -> None:
    """El trailing nunca puede alejarse: eso aumentaría el riesgo ya asumido."""
    risk = RiskManager(RiskConfig(trailing_stop_enabled=True, trailing_stop_atr_multiplier=3.0))
    position = _position()
    position.stop_price = window.price * 0.999  # stop muy pegado al precio

    before = position.stop_price
    risk.update_trailing_stop(position, window)

    assert position.stop_price >= before


def test_trailing_stop_disabled_does_nothing(window: Window) -> None:
    risk = RiskManager(RiskConfig(trailing_stop_enabled=False))
    position = _position()
    position.stop_price = 29_000.0

    assert risk.update_trailing_stop(position, window) is False
    assert position.stop_price == 29_000.0


# ------------------------------------------------------------------- ayudas


def _position(symbol: str = "BTC/USDT", strategy_id: str = "test"):
    from bot.core.models import Position

    return Position(
        symbol=symbol, strategy_id=strategy_id, side=PositionSide.LONG,
        quantity=0.1, entry_price=30_000.0, opened_ts=1_700_000_000_000,
        stop_price=29_000.0,
    )


def _losing_trade() -> Trade:
    return Trade(
        symbol="BTC/USDT", strategy_id="test", side=PositionSide.LONG, quantity=0.1,
        entry_price=30_000, exit_price=29_000, entry_ts=0, exit_ts=1,
        pnl=-100.0, fees=1.0, exit_reason=ExitReason.STOP_LOSS,
    )


def _winning_trade() -> Trade:
    return Trade(
        symbol="BTC/USDT", strategy_id="test", side=PositionSide.LONG, quantity=0.1,
        entry_price=30_000, exit_price=31_000, entry_ts=0, exit_ts=1,
        pnl=100.0, fees=1.0, exit_reason=ExitReason.TAKE_PROFIT,
    )
