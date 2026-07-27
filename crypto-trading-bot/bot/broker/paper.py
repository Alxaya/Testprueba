"""`PaperBroker`: simulador de exchange.

Es el mismo objeto que usan el **backtest** y el **paper trading en vivo**. Esa
identidad es deliberada: si el backtest usara un modelo de costes distinto al del
paper, las diferencias entre ambos serían imposibles de diagnosticar.

## Qué modela

* **Comisiones** maker/taker configurables, aplicadas también en la salida (un
  error clásico es cobrar solo a la entrada y duplicar la rentabilidad aparente).
* **Slippage** en puntos básicos, siempre en contra: se compra un poco más caro y
  se vende un poco más barato.
* **Rechazos realistas**: saldo insuficiente, nocional mínimo, cantidad mínima y
  precisión del mercado.
* **Contabilidad de saldos** por divisa, como un exchange spot real: comprar
  BTC/USDT resta USDT y suma BTC.

## Qué NO modela (limitaciones honestas)

* **Profundidad de libro e impacto de mercado.** Se asume que la orden es
  pequeña frente al volumen. Con tamaño grande o pares ilíquidos, el resultado
  real será peor.
* **Ejecuciones parciales.** Las órdenes de mercado se llenan del todo o se
  rechazan.
* **Latencia.** El fill es instantáneo al precio de referencia + slippage.
* **Órdenes límite que no se cruzan.** En backtest, una orden límite se ejecuta
  si el rango de la vela toca el precio; eso es optimista frente a la realidad de
  una cola de órdenes.
"""

from __future__ import annotations

from collections import defaultdict

from bot.broker.base import Broker
from bot.config.schema import ExecutionConfig, FeesConfig
from bot.core.enums import ExitReason, OrderStatus, OrderType, Side
from bot.core.logging_setup import get_logger
from bot.core.models import Balance, MarketInfo, Order, Ticker, now_ms

log = get_logger("broker.paper")


class PaperBroker(Broker):
    """Exchange simulado con contabilidad de saldos por divisa."""

    supports_shorting = False

    def __init__(
        self,
        *,
        initial_balance: float,
        quote_currency: str = "USDT",
        fees: FeesConfig | None = None,
        execution: ExecutionConfig | None = None,
        market_info: dict[str, MarketInfo] | None = None,
    ) -> None:
        self.quote_currency = quote_currency
        self.fees = fees or FeesConfig()
        self.execution = execution or ExecutionConfig()
        self._balances: dict[str, float] = defaultdict(float)
        self._balances[quote_currency] = float(initial_balance)
        self._market_info = dict(market_info or {})
        self._orders: dict[str, Order] = {}
        #: Precios de referencia, actualizados por el motor en cada vela.
        self._prices: dict[str, float] = {}
        self.initial_balance = float(initial_balance)

    # -------------------------------------------------------------- estado

    def set_price(self, symbol: str, price: float) -> None:
        """Fija el precio de referencia usado para valorar y ejecutar."""
        self._prices[symbol] = float(price)

    def set_prices(self, prices: dict[str, float]) -> None:
        self._prices.update({k: float(v) for k, v in prices.items()})

    def price_of(self, symbol: str) -> float:
        price = self._prices.get(symbol)
        if price is None:
            raise KeyError(f"Sin precio de referencia para {symbol}. Llama antes a set_price().")
        return price

    def balances(self) -> dict[str, float]:
        """Copia de todos los saldos, incluidas las criptos compradas."""
        return {k: v for k, v in self._balances.items() if abs(v) > 1e-12}

    def fetch_balance(self, currency: str) -> Balance:
        return Balance(currency=currency, free=self._balances.get(currency, 0.0), used=0.0)

    def fetch_ticker(self, symbol: str) -> Ticker:
        price = self.price_of(symbol)
        spread = price * self.execution.slippage_rate
        return Ticker(symbol=symbol, last=price, bid=price - spread, ask=price + spread, ts=now_ms())

    def market_info(self, symbol: str) -> MarketInfo:
        """Reglas del mercado; si no se han cargado, se usan defaults razonables."""
        if symbol not in self._market_info:
            base, _, quote = symbol.partition("/")
            self._market_info[symbol] = MarketInfo(
                symbol=symbol,
                base=base,
                quote=quote or self.quote_currency,
                price_precision=2,
                amount_precision=8,
                min_amount=0.0,
                min_notional=0.0,
                maker_fee=self.fees.maker_rate,
                taker_fee=self.fees.taker_rate,
            )
        return self._market_info[symbol]

    def register_market(self, info: MarketInfo) -> None:
        self._market_info[info.symbol] = info

    # ------------------------------------------------------------- órdenes

    def create_order(
        self,
        *,
        symbol: str,
        side: Side,
        order_type: OrderType,
        quantity: float,
        price: float | None = None,
        client_order_id: str,
        strategy_id: str = "",
        is_exit: bool = False,
    ) -> Order:
        """Ejecuta la orden de inmediato contra el precio de referencia.

        Idempotente: reenviar el mismo `client_order_id` devuelve la orden
        existente en lugar de duplicarla.
        """
        if client_order_id in self._orders:
            return self._orders[client_order_id]

        ts = now_ms()
        info = self.market_info(symbol)
        reference = price if (order_type is OrderType.LIMIT and price) else self.price_of(symbol)
        fill_price = self._apply_slippage(reference, side)
        amount = info.round_amount(quantity)

        order = Order(
            client_order_id=client_order_id,
            symbol=symbol,
            side=side,
            order_type=order_type,
            quantity=amount,
            strategy_id=strategy_id,
            ts_created=ts,
            ts_updated=ts,
            price=price,
            is_exit=is_exit,
        )

        rejection = self._validate(order, info, amount, fill_price)
        if rejection:
            order.status = OrderStatus.REJECTED
            order.error = rejection
            self._orders[client_order_id] = order
            log.warning("Orden rechazada (%s): %s", client_order_id, rejection)
            return order

        fee_rate = info.taker_fee if order_type is OrderType.MARKET else info.maker_fee
        notional = amount * fill_price
        fee = notional * fee_rate

        base, _, quote = symbol.partition("/")
        if side is Side.BUY:
            self._balances[quote] -= notional + fee
            self._balances[base] += amount
        else:
            self._balances[base] -= amount
            self._balances[quote] += notional - fee

        order.status = OrderStatus.FILLED
        order.filled_quantity = amount
        order.average_price = fill_price
        order.fee = fee
        order.exchange_order_id = f"paper-{len(self._orders) + 1}"
        self._orders[client_order_id] = order

        log.debug(
            "Fill %s %s %.8f @ %.4f (comisión %.4f %s)",
            side.value, symbol, amount, fill_price, fee, quote,
        )
        return order

    def _validate(self, order: Order, info: MarketInfo, amount: float, fill_price: float) -> str | None:
        """Devuelve el motivo del rechazo, o `None` si la orden es válida."""
        if amount <= 0:
            return "cantidad cero tras aplicar la precisión del mercado"
        if info.min_amount and amount < info.min_amount:
            return f"cantidad {amount} por debajo del mínimo {info.min_amount}"

        notional = amount * fill_price
        if info.min_notional and notional < info.min_notional:
            return f"nocional {notional:.2f} por debajo del mínimo {info.min_notional}"

        base, _, quote = order.symbol.partition("/")
        fee_rate = info.taker_fee if order.order_type is OrderType.MARKET else info.maker_fee
        if order.side is Side.BUY:
            required = notional * (1.0 + fee_rate)
            available = self._balances.get(quote, 0.0)
            if required > available + 1e-9:
                return f"saldo insuficiente: se necesitan {required:.2f} {quote}, hay {available:.2f}"
        else:
            available = self._balances.get(base, 0.0)
            if amount > available + 1e-12:
                return f"saldo insuficiente: se necesitan {amount:.8f} {base}, hay {available:.8f}"
        return None

    def _apply_slippage(self, price: float, side: Side) -> float:
        """El slippage siempre juega en contra: se compra más caro, se vende más barato."""
        rate = self.execution.slippage_rate
        return price * (1.0 + rate) if side is Side.BUY else price * (1.0 - rate)

    def fetch_order(self, client_order_id: str, symbol: str) -> Order | None:
        return self._orders.get(client_order_id)

    def cancel_order(self, client_order_id: str, symbol: str) -> bool:
        order = self._orders.get(client_order_id)
        if order and not order.status.is_terminal:
            order.status = OrderStatus.CANCELED
            order.ts_updated = now_ms()
            return True
        return False

    def fetch_open_orders(self, symbol: str | None = None) -> list[Order]:
        """En el simulador las órdenes se ejecutan al instante: nunca quedan abiertas."""
        return [
            o for o in self._orders.values()
            if not o.status.is_terminal and (symbol is None or o.symbol == symbol)
        ]

    # ----------------------------------------------------------- valoración

    def equity(self, prices: dict[str, float] | None = None) -> float:
        """Valor total de la cuenta en la divisa de cotización."""
        marks = prices or self._prices
        total = self._balances.get(self.quote_currency, 0.0)
        for currency, amount in self._balances.items():
            if currency == self.quote_currency or abs(amount) < 1e-12:
                continue
            symbol = f"{currency}/{self.quote_currency}"
            price = marks.get(symbol)
            if price is not None:
                total += amount * price
        return total

    def orders(self) -> list[Order]:
        return list(self._orders.values())

    def reset(self) -> None:
        """Vuelve al estado inicial. Útil entre iteraciones de una optimización."""
        self._balances = defaultdict(float)
        self._balances[self.quote_currency] = self.initial_balance
        self._orders.clear()
        self._prices.clear()


def exit_reason_of(order: Order) -> ExitReason | None:  # pragma: no cover - helper trivial
    return order.exit_reason
