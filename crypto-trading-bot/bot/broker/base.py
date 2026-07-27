"""Interfaz de broker.

Todo lo que toca el exchange pasa por aquí. Gracias a esta abstracción, el motor
de trading no sabe si está operando contra Binance, contra el testnet o contra un
simulador — y eso es lo que permite que el paper trading pruebe *exactamente* el
mismo código que operará con dinero real.
"""

from __future__ import annotations

from abc import ABC, abstractmethod

from bot.core.enums import OrderType, Side
from bot.core.models import Balance, Fill, MarketInfo, Order, Ticker


class Broker(ABC):
    """Contrato mínimo que necesita el motor."""

    #: `True` si el broker permite abrir cortos (spot no; derivados sí).
    supports_shorting: bool = False

    @abstractmethod
    def fetch_balance(self, currency: str) -> Balance:
        """Saldo disponible y bloqueado en la divisa indicada."""

    @abstractmethod
    def fetch_ticker(self, symbol: str) -> Ticker:
        """Precio actual del símbolo."""

    @abstractmethod
    def market_info(self, symbol: str) -> MarketInfo:
        """Reglas del mercado: precisión, mínimos y comisiones."""

    @abstractmethod
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
        """Envía una orden. Debe ser idempotente respecto a `client_order_id`."""

    @abstractmethod
    def fetch_order(self, client_order_id: str, symbol: str) -> Order | None:
        """Estado de una orden previamente enviada, o `None` si no existe.

        Es la pieza que hace segura la política de reintentos: ante un timeout,
        primero se pregunta si la orden llegó, y solo se reenvía si no llegó.
        """

    @abstractmethod
    def cancel_order(self, client_order_id: str, symbol: str) -> bool:
        """Cancela una orden abierta. Devuelve `True` si se canceló."""

    @abstractmethod
    def fetch_open_orders(self, symbol: str | None = None) -> list[Order]:
        """Órdenes vivas. Se usa en la reconciliación al arrancar."""

    def fills_for(self, order: Order) -> list[Fill]:
        """Ejecuciones asociadas a una orden ya completada."""
        if not order.is_filled or order.filled_quantity <= 0:
            return []
        return [
            Fill(
                order_id=order.client_order_id,
                symbol=order.symbol,
                side=order.side,
                quantity=order.filled_quantity,
                price=order.average_price,
                fee=order.fee,
                ts=order.ts_updated or order.ts_created,
                strategy_id=order.strategy_id,
                is_exit=order.is_exit,
                exit_reason=order.exit_reason,
            )
        ]

    def close(self) -> None:
        """Libera recursos. Opcional."""
