"""Tests del simulador de exchange y de la contabilidad de la cartera.

Aquí se comprueba que el dinero cuadra: que las comisiones se cobran, que el
slippage juega en contra, que no se puede gastar lo que no hay y que el PnL de
una operación cerrada es el que debe ser.
"""

from __future__ import annotations

import pytest

from bot.broker.paper import PaperBroker
from bot.config.schema import ExecutionConfig, FeesConfig
from bot.core.enums import ExitReason, OrderStatus, OrderType, PositionSide, Side
from bot.core.models import Fill, MarketInfo
from bot.execution.portfolio import Portfolio


@pytest.fixture
def broker() -> PaperBroker:
    b = PaperBroker(
        initial_balance=10_000.0,
        quote_currency="USDT",
        fees=FeesConfig(maker_bps=10, taker_bps=10),
        execution=ExecutionConfig(slippage_bps=5),
    )
    b.set_price("BTC/USDT", 30_000.0)
    return b


def test_buy_updates_balances_with_fees(broker: PaperBroker) -> None:
    order = broker.create_order(
        symbol="BTC/USDT", side=Side.BUY, order_type=OrderType.MARKET,
        quantity=0.1, client_order_id="test-1",
    )

    assert order.status is OrderStatus.FILLED
    # Slippage de 5 bps en contra: se compra más caro.
    assert order.average_price == pytest.approx(30_000 * 1.0005)
    assert order.fee == pytest.approx(order.average_price * 0.1 * 0.001)

    balances = broker.balances()
    assert balances["BTC"] == pytest.approx(0.1)
    assert balances["USDT"] == pytest.approx(10_000 - order.average_price * 0.1 - order.fee)


def test_sell_applies_negative_slippage(broker: PaperBroker) -> None:
    broker.create_order(
        symbol="BTC/USDT", side=Side.BUY, order_type=OrderType.MARKET,
        quantity=0.1, client_order_id="buy",
    )
    order = broker.create_order(
        symbol="BTC/USDT", side=Side.SELL, order_type=OrderType.MARKET,
        quantity=0.1, client_order_id="sell",
    )

    # Al vender, el slippage resta.
    assert order.average_price == pytest.approx(30_000 * 0.9995)


def test_insufficient_funds_rejected(broker: PaperBroker) -> None:
    order = broker.create_order(
        symbol="BTC/USDT", side=Side.BUY, order_type=OrderType.MARKET,
        quantity=100.0, client_order_id="too-big",  # 3.000.000 USDT
    )

    assert order.status is OrderStatus.REJECTED
    assert "insuficiente" in (order.error or "")
    assert broker.balances()["USDT"] == pytest.approx(10_000.0)


def test_min_notional_rejected() -> None:
    broker = PaperBroker(initial_balance=10_000.0, market_info={
        "BTC/USDT": MarketInfo("BTC/USDT", "BTC", "USDT", 2, 8, min_notional=100.0)
    })
    broker.set_price("BTC/USDT", 30_000.0)

    order = broker.create_order(
        symbol="BTC/USDT", side=Side.BUY, order_type=OrderType.MARKET,
        quantity=0.001, client_order_id="tiny",  # 30 USDT < 100
    )

    assert order.status is OrderStatus.REJECTED


def test_orders_are_idempotent(broker: PaperBroker) -> None:
    """Reenviar el mismo client_order_id no puede duplicar la posición.

    Es la garantía que hace seguro reintentar tras un timeout de red.
    """
    first = broker.create_order(
        symbol="BTC/USDT", side=Side.BUY, order_type=OrderType.MARKET,
        quantity=0.1, client_order_id="same-id",
    )
    second = broker.create_order(
        symbol="BTC/USDT", side=Side.BUY, order_type=OrderType.MARKET,
        quantity=0.1, client_order_id="same-id",
    )

    assert first is second
    assert broker.balances()["BTC"] == pytest.approx(0.1)


def test_equity_marks_positions_to_market(broker: PaperBroker) -> None:
    broker.create_order(
        symbol="BTC/USDT", side=Side.BUY, order_type=OrderType.MARKET,
        quantity=0.1, client_order_id="buy",
    )
    broker.set_price("BTC/USDT", 33_000.0)

    # 10.000 - coste + 0,1 × 33.000
    assert broker.equity() == pytest.approx(10_000 + 0.1 * 3_000, abs=10)


# ------------------------------------------------------------------ cartera


def test_portfolio_computes_net_pnl() -> None:
    """El PnL de un trade cerrado descuenta las comisiones de entrada y salida."""
    portfolio = Portfolio(initial_equity=10_000.0)

    portfolio.apply_fill(Fill(
        order_id="1", symbol="BTC/USDT", side=Side.BUY, quantity=0.1,
        price=30_000, fee=3.0, ts=1_000, strategy_id="s1",
    ))
    trade = portfolio.apply_fill(Fill(
        order_id="2", symbol="BTC/USDT", side=Side.SELL, quantity=0.1,
        price=31_000, fee=3.1, ts=2_000, strategy_id="s1", is_exit=True,
        exit_reason=ExitReason.TAKE_PROFIT,
    ))

    assert trade is not None
    assert trade.pnl == pytest.approx(0.1 * 1_000 - 3.0 - 3.1)
    assert trade.is_win
    assert not portfolio.positions


def test_portfolio_averages_price_on_scale_in() -> None:
    portfolio = Portfolio(initial_equity=10_000.0)
    for price in (30_000, 32_000):
        portfolio.apply_fill(Fill(
            order_id=str(price), symbol="BTC/USDT", side=Side.BUY, quantity=0.1,
            price=price, fee=3.0, ts=1_000, strategy_id="s1",
        ))

    position = portfolio.position("BTC/USDT", "s1")
    assert position is not None
    assert position.quantity == pytest.approx(0.2)
    assert position.entry_price == pytest.approx(31_000)


def test_positions_are_isolated_per_strategy() -> None:
    """Dos estrategias sobre el mismo par mantienen posiciones independientes."""
    portfolio = Portfolio(initial_equity=10_000.0)
    for strategy in ("a", "b"):
        portfolio.apply_fill(Fill(
            order_id=strategy, symbol="BTC/USDT", side=Side.BUY, quantity=0.1,
            price=30_000, fee=3.0, ts=1_000, strategy_id=strategy,
        ))

    assert len(portfolio.positions) == 2
    assert portfolio.position("BTC/USDT", "a") is not None
    assert portfolio.position("BTC/USDT", "b") is not None


def test_r_multiple_uses_initial_stop() -> None:
    """El R-múltiplo mide la ganancia en unidades del riesgo asumido al entrar."""
    portfolio = Portfolio(initial_equity=10_000.0)
    portfolio.apply_fill(Fill(
        order_id="1", symbol="BTC/USDT", side=Side.BUY, quantity=0.1,
        price=30_000, fee=0.0, ts=1_000, strategy_id="s1",
    ))
    position = portfolio.position("BTC/USDT", "s1")
    assert position is not None
    position.initial_stop = 29_000.0  # riesgo de 1.000 por unidad

    trade = portfolio.apply_fill(Fill(
        order_id="2", symbol="BTC/USDT", side=Side.SELL, quantity=0.1,
        price=32_000, fee=0.0, ts=2_000, strategy_id="s1", is_exit=True,
    ))

    assert trade is not None
    assert trade.r_multiple == pytest.approx(2.0)  # ganó 2.000, arriesgaba 1.000


def test_drawdown_tracks_peak() -> None:
    portfolio = Portfolio(initial_equity=10_000.0)
    portfolio.record_equity(1_000)
    portfolio.cash = 12_000.0
    portfolio.record_equity(2_000)
    portfolio.cash = 9_600.0
    point = portfolio.record_equity(3_000)

    assert portfolio.peak_equity == pytest.approx(12_000)
    assert point.drawdown_pct == pytest.approx(20.0)


def test_exit_without_position_is_ignored() -> None:
    """Un fill de salida huérfano se registra pero no rompe la contabilidad."""
    portfolio = Portfolio(initial_equity=10_000.0)

    trade = portfolio.apply_fill(Fill(
        order_id="x", symbol="BTC/USDT", side=Side.SELL, quantity=0.1,
        price=30_000, fee=3.0, ts=1_000, strategy_id="s1", is_exit=True,
    ))

    assert trade is None
    assert not portfolio.positions


def test_unrealized_pnl_sign_for_long_and_short() -> None:
    from bot.core.models import Position

    long_pos = Position("BTC/USDT", "s", PositionSide.LONG, 1.0, 100.0, 0)
    short_pos = Position("BTC/USDT", "s", PositionSide.SHORT, 1.0, 100.0, 0)

    assert long_pos.unrealized_pnl(110.0) == pytest.approx(10.0)
    assert short_pos.unrealized_pnl(110.0) == pytest.approx(-10.0)


def test_rounded_exit_leaves_no_dust_position() -> None:
    """Regresión: vender una posición truncada a la precisión del mercado no
    puede dejar una nano-posición abierta.

    Al enviar la salida, la cantidad se trunca a los decimales del mercado, así
    que vender 0.123456789 ejecuta 0.12345678 y sobra ~1e-9. Si ese residuo se
    queda como posición abierta, el bot intenta cerrarlo en cada vela (un rechazo
    por vela) y —mucho peor— el `RiskManager` cree que sigue en mercado y veta
    todas las entradas nuevas con ALREADY_IN_POSITION.
    """
    portfolio = Portfolio(initial_equity=10_000.0)
    portfolio.apply_fill(Fill(
        order_id="1", symbol="BTC/USDT", side=Side.BUY, quantity=0.123456789,
        price=30_000, fee=0.0, ts=1_000, strategy_id="s1",
    ))

    trade = portfolio.apply_fill(Fill(
        order_id="2", symbol="BTC/USDT", side=Side.SELL, quantity=0.12345678,
        price=31_000, fee=0.0, ts=2_000, strategy_id="s1", is_exit=True,
    ))

    assert trade is not None
    assert not portfolio.positions, "quedó una posición de polvo abierta"


def test_genuine_partial_exit_keeps_position_open() -> None:
    """La tolerancia al polvo no puede tragarse una salida parcial real."""
    portfolio = Portfolio(initial_equity=10_000.0)
    portfolio.apply_fill(Fill(
        order_id="1", symbol="BTC/USDT", side=Side.BUY, quantity=1.0,
        price=30_000, fee=0.0, ts=1_000, strategy_id="s1",
    ))

    portfolio.apply_fill(Fill(
        order_id="2", symbol="BTC/USDT", side=Side.SELL, quantity=0.4,
        price=31_000, fee=0.0, ts=2_000, strategy_id="s1", is_exit=True,
    ))

    position = portfolio.position("BTC/USDT", "s1")
    assert position is not None
    assert position.quantity == pytest.approx(0.6)
