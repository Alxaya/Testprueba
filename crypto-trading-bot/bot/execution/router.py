"""Enrutador de órdenes.

Única puerta de salida hacia el broker. Su responsabilidad es que **una intención
se convierta exactamente en una orden**, ni cero ni dos.

## Identificadores deterministas

    {estrategia}-{símbolo}-{timestamp_vela}-{acción}

Como el timestamp es el de la vela (no el del reloj), reprocesar la misma vela
tras un reinicio genera el mismo identificador. El broker lo rechaza como
duplicado o devuelve la orden existente: en ningún caso se abre dos veces.

Este mecanismo es lo que hace seguro reintentar. Sin él, un timeout de red
—donde no sabes si la orden llegó— te obliga a elegir entre arriesgarte a
duplicar o a no operar.
"""

from __future__ import annotations

import hashlib
import time

from bot.broker.base import Broker
from bot.config.schema import ExecutionConfig
from bot.core.enums import OrderStatus
from bot.core.errors import ExchangeError, InsufficientFunds, OrderRejected
from bot.core.logging_setup import get_logger
from bot.core.models import Fill, Order, OrderIntent

log = get_logger("execution.router")


def build_client_order_id(intent: OrderIntent) -> str:
    """Identificador determinista y compatible con los límites del exchange.

    La mayoría de exchanges limitan el `clientOrderId` a 32–36 caracteres
    alfanuméricos, así que se recorta con un hash estable en lugar de truncar
    (truncar provocaría colisiones entre símbolos con prefijo común).
    """
    action = "X" if intent.is_exit else "E"
    raw = f"{intent.strategy_id}-{intent.symbol}-{intent.ts}-{action}-{intent.side.value}"
    digest = hashlib.sha1(raw.encode("utf-8")).hexdigest()[:16]
    safe_strategy = "".join(c for c in intent.strategy_id if c.isalnum())[:8]
    return f"bot{safe_strategy}{action}{digest}"


class OrderRouter:
    """Envía órdenes al broker con reintentos seguros."""

    def __init__(self, broker: Broker, config: ExecutionConfig) -> None:
        self.broker = broker
        self.config = config
        self.sent: dict[str, Order] = {}

    def submit(self, intent: OrderIntent) -> tuple[Order, list[Fill]]:
        """Envía la intención y devuelve `(orden, ejecuciones)`.

        No lanza ante un rechazo del exchange: devuelve la orden en estado
        `REJECTED`. Un rechazo es información de negocio (saldo insuficiente,
        mínimo no alcanzado), no una excepción del programa, y el motor debe
        seguir vivo.
        """
        client_order_id = build_client_order_id(intent)

        cached = self.sent.get(client_order_id)
        if cached is not None and cached.status.is_terminal:
            log.info("Orden %s ya procesada; no se reenvía", client_order_id)
            return cached, []

        limit_price = self._limit_price(intent)
        last_error: Exception | None = None

        for attempt in range(self.config.max_retries + 1):
            try:
                order = self.broker.create_order(
                    symbol=intent.symbol,
                    side=intent.side,
                    order_type=intent.order_type,
                    quantity=intent.quantity,
                    price=limit_price,
                    client_order_id=client_order_id,
                    strategy_id=intent.strategy_id,
                    is_exit=intent.is_exit,
                )
                order.exit_reason = intent.exit_reason
                order.meta.update(intent.meta)
                self.sent[client_order_id] = order

                if order.status is OrderStatus.REJECTED:
                    log.warning(
                        "Orden rechazada por el broker: %s %s %.8f — %s",
                        intent.side.value, intent.symbol, intent.quantity, order.error,
                    )
                    return order, []

                fills = self.broker.fills_for(order)
                for fill in fills:
                    log.info(
                        "EJECUTADA %s %s %.8f @ %.4f (comisión %.4f) [%s]",
                        fill.side.value, fill.symbol, fill.quantity, fill.price,
                        fill.fee, intent.strategy_id,
                    )
                return order, fills

            except InsufficientFunds as exc:
                # Reintentar no va a crear dinero: se corta aquí.
                log.error("Saldo insuficiente para %s: %s", intent.symbol, exc)
                return self._rejected(intent, client_order_id, str(exc)), []

            except OrderRejected as exc:
                log.error("Orden rechazada por el exchange: %s", exc)
                return self._rejected(intent, client_order_id, str(exc)), []

            except ExchangeError as exc:
                last_error = exc
                if attempt >= self.config.max_retries:
                    break
                delay = self.config.retry_backoff_s * (2**attempt)
                log.warning(
                    "Error del exchange al enviar (intento %d/%d): %s. Reintento en %.1fs",
                    attempt + 1, self.config.max_retries + 1, exc, delay,
                )
                time.sleep(delay)

                # Antes de reenviar: comprobar si la orden anterior sí llegó.
                existing = self._safe_fetch(client_order_id, intent.symbol)
                if existing is not None:
                    log.warning("La orden %s ya existía en el exchange", client_order_id)
                    self.sent[client_order_id] = existing
                    return existing, self.broker.fills_for(existing)

        message = f"No se pudo enviar la orden tras {self.config.max_retries + 1} intentos: {last_error}"
        log.error(message)
        return self._rejected(intent, client_order_id, message), []

    def _safe_fetch(self, client_order_id: str, symbol: str) -> Order | None:
        try:
            return self.broker.fetch_order(client_order_id, symbol)
        except Exception:
            log.debug("fetch_order falló durante la verificación", exc_info=True)
            return None

    def _limit_price(self, intent: OrderIntent) -> float | None:
        """Precio límite ligeramente agresivo para maximizar la probabilidad de cruce."""
        from bot.core.enums import OrderType, Side  # import local: evita ciclo

        if intent.order_type is not OrderType.LIMIT:
            return None
        if intent.limit_price is not None:
            return intent.limit_price
        offset = self.config.limit_offset_bps / 10_000.0
        return (
            intent.reference_price * (1.0 + offset)
            if intent.side is Side.BUY
            else intent.reference_price * (1.0 - offset)
        )

    def _rejected(self, intent: OrderIntent, client_order_id: str, error: str) -> Order:
        order = Order(
            client_order_id=client_order_id,
            symbol=intent.symbol,
            side=intent.side,
            order_type=intent.order_type,
            quantity=intent.quantity,
            strategy_id=intent.strategy_id,
            ts_created=intent.ts,
            status=OrderStatus.REJECTED,
            error=error,
            is_exit=intent.is_exit,
            exit_reason=intent.exit_reason,
        )
        self.sent[client_order_id] = order
        return order
