"""`CCXTBroker`: acceso a un exchange real (o a su testnet).

Diferencias con el simulador que hay que tener muy presentes:

* **La red falla.** Todo va envuelto en reintentos con backoff.
* **Un timeout no significa "no se envió".** Ante un timeout, se consulta si la
  orden existe (`fetch_order`) **antes** de reenviar. Reenviar a ciegas es cómo
  se acaba con posición doble.
* **Las reglas del mercado importan.** Precio y cantidad se normalizan a la
  precisión del exchange; una cantidad con un decimal de más es un rechazo.
* **Los cortos no existen en spot.** `supports_shorting` es `False`: el
  `RiskManager` vetará cualquier señal de venta en corto.
"""

from __future__ import annotations

import math
from typing import Any

from bot.broker.base import Broker
from bot.config.schema import ExchangeConfig
from bot.core.enums import OrderStatus, OrderType, Side
from bot.core.errors import ExchangeError, InsufficientFunds, OrderRejected
from bot.core.logging_setup import get_logger
from bot.core.models import Balance, MarketInfo, Order, Ticker, now_ms
from bot.data.ccxt_provider import create_exchange, with_retries

log = get_logger("broker.ccxt")

_STATUS_MAP = {
    "open": OrderStatus.OPEN,
    "closed": OrderStatus.FILLED,
    "filled": OrderStatus.FILLED,
    "canceled": OrderStatus.CANCELED,
    "cancelled": OrderStatus.CANCELED,
    "expired": OrderStatus.CANCELED,
    "rejected": OrderStatus.REJECTED,
}


class CCXTBroker(Broker):
    """Broker spot sobre ccxt."""

    supports_shorting = False

    def __init__(self, config: ExchangeConfig, exchange: Any | None = None) -> None:
        self.config = config
        self._exchange = exchange or create_exchange(config, with_credentials=True)
        self._markets: dict[str, Any] = {}
        self._order_cache: dict[str, Order] = {}

    # ------------------------------------------------------------- mercados

    def load_markets(self) -> None:
        self._markets = with_retries(
            self._exchange.load_markets,
            max_retries=self.config.max_retries,
            description="load_markets",
        )
        log.info("Mercados cargados: %d", len(self._markets))

    def market_info(self, symbol: str) -> MarketInfo:
        if not self._markets:
            self.load_markets()
        market = self._markets.get(symbol)
        if market is None:
            raise ExchangeError(f"El exchange {self.config.id} no tiene el mercado {symbol}")

        precision = market.get("precision") or {}
        limits = market.get("limits") or {}
        return MarketInfo(
            symbol=symbol,
            base=market.get("base", symbol.split("/")[0]),
            quote=market.get("quote", symbol.split("/")[-1]),
            price_precision=_as_decimals(precision.get("price"), default=8),
            amount_precision=_as_decimals(precision.get("amount"), default=8),
            min_amount=float((limits.get("amount") or {}).get("min") or 0.0),
            min_notional=float((limits.get("cost") or {}).get("min") or 0.0),
            maker_fee=float(market.get("maker") or self.config.fees.maker_rate),
            taker_fee=float(market.get("taker") or self.config.fees.taker_rate),
        )

    # -------------------------------------------------------------- cuenta

    def fetch_balance(self, currency: str) -> Balance:
        raw = with_retries(
            self._exchange.fetch_balance,
            max_retries=self.config.max_retries,
            description="fetch_balance",
        )
        free = float((raw.get("free") or {}).get(currency) or 0.0)
        total = float((raw.get("total") or {}).get(currency) or 0.0)
        return Balance(currency=currency, free=free, used=max(0.0, total - free))

    def fetch_ticker(self, symbol: str) -> Ticker:
        raw = with_retries(
            self._exchange.fetch_ticker,
            symbol,
            max_retries=self.config.max_retries,
            description=f"fetch_ticker {symbol}",
        )
        last = float(raw.get("last") or raw.get("close") or 0.0)
        return Ticker(
            symbol=symbol,
            last=last,
            bid=float(raw.get("bid") or last),
            ask=float(raw.get("ask") or last),
            ts=int(raw.get("timestamp") or now_ms()),
        )

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
        """Envía la orden normalizando cantidades y con reintento seguro.

        La secuencia ante fallo es: comprobar si la orden ya existe en el
        exchange (por `client_order_id`) y solo enviarla si no existe.
        """
        info = self.market_info(symbol)
        amount = info.round_amount(quantity)
        limit_price = info.round_price(price) if price is not None else None

        order = Order(
            client_order_id=client_order_id,
            symbol=symbol,
            side=side,
            order_type=order_type,
            quantity=amount,
            strategy_id=strategy_id,
            ts_created=now_ms(),
            price=limit_price,
            is_exit=is_exit,
        )

        if amount <= 0:
            order.status = OrderStatus.REJECTED
            order.error = "cantidad cero tras aplicar la precisión del mercado"
            return order

        existing = self.fetch_order(client_order_id, symbol)
        if existing is not None:
            log.warning("La orden %s ya existía en el exchange; no se reenvía", client_order_id)
            return existing

        params = {"clientOrderId": client_order_id}
        try:
            raw = with_retries(
                self._exchange.create_order,
                symbol,
                order_type.value,
                side.value,
                amount,
                limit_price,
                params,
                max_retries=self.config.max_retries,
                description=f"create_order {symbol} {side.value} {amount}",
            )
        except Exception as exc:
            recovered = self.fetch_order(client_order_id, symbol)
            if recovered is not None:
                log.warning("create_order falló pero la orden sí llegó (%s)", client_order_id)
                return recovered
            message = str(exc).lower()
            order.status = OrderStatus.REJECTED
            order.error = str(exc)
            if "insufficient" in message or "balance" in message:
                raise InsufficientFunds(str(exc)) from exc
            raise OrderRejected(f"El exchange rechazó la orden: {exc}") from exc

        updated = self._parse_order(raw, order)
        self._order_cache[client_order_id] = updated
        return updated

    def fetch_order(self, client_order_id: str, symbol: str) -> Order | None:
        """Consulta el estado real de la orden en el exchange.

        Si el exchange no soporta la búsqueda por `clientOrderId`, se recorre el
        histórico reciente. Devuelve `None` si no aparece.
        """
        template = self._order_cache.get(client_order_id)
        try:
            raw = self._exchange.fetch_order(client_order_id, symbol, {"clientOrderId": client_order_id})
            if raw:
                return self._parse_order(raw, template)
        except Exception:
            pass

        try:
            recent = self._exchange.fetch_orders(symbol, None, 50)
            for raw in recent or []:
                if (raw.get("clientOrderId") or raw.get("info", {}).get("clientOrderId")) == client_order_id:
                    return self._parse_order(raw, template)
        except Exception:
            log.debug("fetch_orders no disponible en %s", self.config.id)
        return None

    def cancel_order(self, client_order_id: str, symbol: str) -> bool:
        try:
            with_retries(
                self._exchange.cancel_order,
                client_order_id,
                symbol,
                {"clientOrderId": client_order_id},
                max_retries=self.config.max_retries,
                description=f"cancel_order {client_order_id}",
            )
            return True
        except Exception as exc:
            log.warning("No se pudo cancelar %s: %s", client_order_id, exc)
            return False

    def fetch_open_orders(self, symbol: str | None = None) -> list[Order]:
        raw_orders = with_retries(
            self._exchange.fetch_open_orders,
            symbol,
            max_retries=self.config.max_retries,
            description="fetch_open_orders",
        )
        return [self._parse_order(raw, None) for raw in raw_orders or []]

    # -------------------------------------------------------------- interno

    def _parse_order(self, raw: dict[str, Any], template: Order | None) -> Order:
        """Traduce la orden de ccxt al modelo del dominio."""
        client_id = (
            raw.get("clientOrderId")
            or (raw.get("info") or {}).get("clientOrderId")
            or (template.client_order_id if template else str(raw.get("id")))
        )
        symbol = raw.get("symbol") or (template.symbol if template else "")
        side_raw = (raw.get("side") or (template.side.value if template else "buy")).lower()
        type_raw = (raw.get("type") or (template.order_type.value if template else "market")).lower()

        filled = float(raw.get("filled") or 0.0)
        average = float(raw.get("average") or raw.get("price") or 0.0)
        status = _STATUS_MAP.get(str(raw.get("status") or "").lower(), OrderStatus.OPEN)
        if status is OrderStatus.OPEN and filled > 0:
            amount = float(raw.get("amount") or filled)
            status = OrderStatus.FILLED if filled >= amount - 1e-12 else OrderStatus.PARTIALLY_FILLED

        fee_info = raw.get("fee") or {}
        fee_cost = float(fee_info.get("cost") or 0.0)
        if not fee_cost and raw.get("fees"):
            fee_cost = sum(float(f.get("cost") or 0.0) for f in raw["fees"])

        order = Order(
            client_order_id=str(client_id),
            symbol=symbol,
            side=Side(side_raw),
            order_type=OrderType(type_raw) if type_raw in ("market", "limit") else OrderType.MARKET,
            quantity=float(raw.get("amount") or (template.quantity if template else filled)),
            strategy_id=template.strategy_id if template else "",
            ts_created=int(raw.get("timestamp") or (template.ts_created if template else now_ms())),
            price=float(raw["price"]) if raw.get("price") else None,
            status=status,
            filled_quantity=filled,
            average_price=average,
            fee=fee_cost,
            exchange_order_id=str(raw.get("id")) if raw.get("id") else None,
            ts_updated=int(raw.get("lastTradeTimestamp") or raw.get("timestamp") or now_ms()),
            is_exit=template.is_exit if template else False,
            exit_reason=template.exit_reason if template else None,
        )
        self._order_cache[order.client_order_id] = order
        return order

    def check_permissions(self) -> list[str]:
        """Avisos de seguridad sobre la API key.

        Una clave con permiso de retirada es un riesgo innecesario: el bot solo
        necesita operar. Si el exchange expone esa información, se comprueba.
        """
        warnings: list[str] = []
        try:
            raw = self._exchange.fetch_status()
            if raw.get("status") not in (None, "ok"):
                warnings.append(f"Estado del exchange: {raw.get('status')}")
        except Exception:
            pass

        try:
            info = self._exchange.privateGetAccount()  # específico de Binance
            if info.get("canWithdraw"):
                warnings.append(
                    "⚠️ La API key tiene permiso de RETIRADA. Desactívalo en el exchange: "
                    "el bot solo necesita permisos de trading."
                )
        except Exception:
            pass
        return warnings

    def close(self) -> None:
        close = getattr(self._exchange, "close", None)
        if callable(close):
            try:
                close()
            except Exception:  # pragma: no cover
                log.debug("Fallo al cerrar la sesión del exchange", exc_info=True)


def _as_decimals(precision: Any, *, default: int = 8) -> int:
    """Normaliza la precisión de ccxt a número de decimales.

    ccxt la expresa unas veces como número de decimales (4) y otras como tamaño
    de tick (0.0001), según el exchange y el modo de precisión.
    """
    if precision is None:
        return default
    try:
        value = float(precision)
    except (TypeError, ValueError):
        return default
    if value <= 0:
        return default
    if value >= 1:
        return int(value)
    return max(0, round(-math.log10(value)))
