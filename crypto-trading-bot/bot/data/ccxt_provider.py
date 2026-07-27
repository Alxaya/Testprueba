"""Proveedor de datos sobre ccxt.

Puntos que parecen detalles y son lo que separa un bot que aguanta 24/7 de uno
que se cae el primer domingo:

* **Se descarta siempre la vela en curso.** ccxt devuelve la vela actual sin
  cerrar; usarla es look-ahead puro y genera señales que luego desaparecen.
* **Reintentos con backoff exponencial y jitter.** Sin jitter, varios símbolos
  reintentan a la vez y vuelven a chocar contra el rate limit.
* **El rate limit del exchange se respeta** vía `enableRateLimit` de ccxt.
* **Paginación defensiva:** si el exchange deja de avanzar, se corta el bucle en
  lugar de girar para siempre.
"""

from __future__ import annotations

import os
import random
import time
from typing import Any

from bot.config.schema import ExchangeConfig
from bot.core.errors import NetworkError, RateLimitError
from bot.core.logging_setup import get_logger
from bot.core.models import Candle, now_ms
from bot.core.timeframe import timeframe_to_ms
from bot.data.base import DataProvider, sanitize

log = get_logger("data.ccxt")


def create_exchange(config: ExchangeConfig, *, with_credentials: bool = False) -> Any:
    """Instancia un exchange de ccxt a partir de la configuración.

    Se importa ccxt de forma perezosa para que el backtest y los tests funcionen
    sin tener la librería instalada.
    """
    try:
        import ccxt  # noqa: PLC0415  (import perezoso deliberado)
    except ImportError as exc:  # pragma: no cover
        raise NetworkError(
            "ccxt no está instalado. Ejecuta: pip install ccxt"
        ) from exc

    if not hasattr(ccxt, config.id):
        raise NetworkError(f"Exchange desconocido para ccxt: {config.id!r}")

    params: dict[str, Any] = {
        "enableRateLimit": config.enable_rate_limit,
        "timeout": config.request_timeout_ms,
        "options": {"defaultType": "spot", "adjustForTimeDifference": True},
    }
    if with_credentials and config.has_credentials:
        params["apiKey"] = config.api_key
        params["secret"] = config.api_secret
        if config.api_password:
            params["password"] = config.api_password

    exchange = getattr(ccxt, config.id)(params)
    _configure_session(exchange)

    if config.testnet:
        if exchange.has.get("sandbox") is False:  # pragma: no cover
            log.warning("El exchange %s no declara soporte de sandbox", config.id)
        try:
            exchange.set_sandbox_mode(True)
            log.info("Modo sandbox/testnet ACTIVADO en %s", config.id)
        except Exception as exc:  # pragma: no cover - depende del exchange
            raise NetworkError(
                f"No se pudo activar el modo testnet en {config.id}: {exc}"
            ) from exc

    return exchange


def _configure_session(exchange: Any) -> None:
    """Hace que ccxt respete el proxy y el CA bundle del entorno.

    ccxt fija `session.trust_env = False`, lo que desactiva de golpe **dos** cosas
    de `requests`: los proxies de entorno (`HTTPS_PROXY`) y el CA bundle
    (`REQUESTS_CA_BUNDLE` / `SSL_CERT_FILE`). El síntoma típico es un
    `NetworkError` genérico de ccxt que en realidad esconde un
    `CERTIFICATE_VERIFY_FAILED`.

    Esto importa fuera de este proyecto: cualquiera que ejecute el bot detrás de
    un proxy corporativo, una VPN con inspección TLS o un contenedor con CA
    propia se topa con lo mismo. Aquí se reactiva de forma explícita, sin
    desactivar nunca la verificación de certificados.
    """
    session = getattr(exchange, "session", None)
    if session is None:  # pragma: no cover - ccxt async no usa requests
        return

    proxy = os.getenv("HTTPS_PROXY") or os.getenv("https_proxy")
    if proxy:
        session.trust_env = True
        log.info("Usando el proxy HTTPS del entorno para %s", exchange.id)

    ca_bundle = (
        os.getenv("REQUESTS_CA_BUNDLE") or os.getenv("SSL_CERT_FILE") or os.getenv("CURL_CA_BUNDLE")
    )
    if ca_bundle and os.path.isfile(ca_bundle):
        # Se apunta a la CA concreta en vez de tocar `verify`: la verificación de
        # certificados sigue activa, que es lo único no negociable.
        exchange.verify = ca_bundle
        session.verify = ca_bundle
        log.info("CA bundle personalizado: %s", ca_bundle)


def with_retries(
    func: Any,
    *args: Any,
    max_retries: int = 4,
    base_delay: float = 1.0,
    description: str = "petición",
    **kwargs: Any,
) -> Any:
    """Ejecuta `func` reintentando errores transitorios con backoff + jitter."""
    try:
        import ccxt  # noqa: PLC0415
    except ImportError:  # pragma: no cover
        ccxt = None  # type: ignore[assignment]

    last_error: Exception | None = None
    for attempt in range(max_retries + 1):
        try:
            return func(*args, **kwargs)
        except Exception as exc:  # noqa: BLE001 - se reclasifica más abajo
            last_error = exc
            transient = False
            wait = base_delay * (2**attempt)

            if ccxt is not None:
                if isinstance(exc, ccxt.RateLimitExceeded):
                    transient = True
                    wait = max(wait, 5.0 * (attempt + 1))  # el rate limit exige paciencia
                elif isinstance(exc, (ccxt.NetworkError, ccxt.ExchangeNotAvailable, ccxt.RequestTimeout)):
                    transient = True
            if isinstance(exc, (TimeoutError, ConnectionError, OSError)):
                transient = True

            if not transient or attempt >= max_retries:
                break

            wait += random.uniform(0, wait * 0.25)  # jitter: evita reintentos sincronizados
            log.warning(
                "%s falló (intento %d/%d): %s. Reintento en %.1fs",
                description, attempt + 1, max_retries + 1, exc, wait,
            )
            time.sleep(wait)

    assert last_error is not None
    if ccxt is not None and isinstance(last_error, ccxt.RateLimitExceeded):
        raise RateLimitError(f"{description}: rate limit agotado — {last_error}") from last_error
    raise NetworkError(f"{description} falló tras {max_retries + 1} intentos: {last_error}") from last_error


class CCXTDataProvider(DataProvider):
    """Descarga velas de un exchange real vía ccxt."""

    #: Muchos exchanges limitan a 1000 velas por petición.
    MAX_PER_REQUEST = 1000

    def __init__(self, config: ExchangeConfig, exchange: Any | None = None) -> None:
        self.config = config
        self._exchange = exchange or create_exchange(config)

    @property
    def exchange(self) -> Any:
        return self._exchange

    def fetch_ohlcv(
        self,
        symbol: str,
        timeframe: str,
        *,
        since: int | None = None,
        limit: int = 500,
    ) -> list[Candle]:
        """Últimas `limit` velas **cerradas**, o desde `since` si se indica."""
        raw = with_retries(
            self._exchange.fetch_ohlcv,
            symbol,
            timeframe,
            since,
            min(limit + 1, self.MAX_PER_REQUEST),  # +1: la última puede estar en curso
            max_retries=self.config.max_retries,
            description=f"fetch_ohlcv {symbol} {timeframe}",
        )
        candles = _to_candles(raw)
        candles = _drop_unclosed(candles, timeframe)
        candles = sanitize(candles, symbol, timeframe)
        return candles[-limit:] if limit else candles

    def fetch_range(
        self,
        symbol: str,
        timeframe: str,
        *,
        since: int,
        until: int | None = None,
        progress: Any | None = None,
    ) -> list[Candle]:
        """Descarga paginada de un rango histórico completo."""
        step = timeframe_to_ms(timeframe)
        until = until or now_ms()
        cursor = since
        collected: list[Candle] = []
        empty_rounds = 0

        while cursor < until:
            raw = with_retries(
                self._exchange.fetch_ohlcv,
                symbol,
                timeframe,
                cursor,
                self.MAX_PER_REQUEST,
                max_retries=self.config.max_retries,
                description=f"fetch_ohlcv {symbol} {timeframe} desde {cursor}",
            )
            batch = _to_candles(raw)
            if not batch:
                empty_rounds += 1
                if empty_rounds >= 3:
                    log.info("Sin más datos para %s %s en %d", symbol, timeframe, cursor)
                    break
                cursor += step * self.MAX_PER_REQUEST
                continue

            empty_rounds = 0
            collected.extend(batch)
            last_ts = batch[-1].ts

            if last_ts < cursor:  # el exchange no avanza: cortamos para no colgarnos
                log.warning("Paginación estancada en %s %s (ts=%d)", symbol, timeframe, last_ts)
                break
            cursor = last_ts + step

            if progress is not None:
                progress(len(collected), cursor)

        candles = _drop_unclosed(collected, timeframe)
        candles = sanitize(candles, symbol, timeframe)
        return [c for c in candles if since <= c.ts <= until]

    def load_markets(self) -> dict[str, Any]:
        return with_retries(  # type: ignore[no-any-return]
            self._exchange.load_markets,
            max_retries=self.config.max_retries,
            description="load_markets",
        )

    def close(self) -> None:
        close = getattr(self._exchange, "close", None)
        if callable(close):
            try:
                close()
            except Exception:  # pragma: no cover - cierre best-effort
                log.debug("Fallo al cerrar la sesión del exchange", exc_info=True)


def _to_candles(raw: list[list[float]] | None) -> list[Candle]:
    """Convierte la matriz cruda de ccxt en velas del dominio."""
    if not raw:
        return []
    return [
        Candle(ts=int(r[0]), open=float(r[1]), high=float(r[2]), low=float(r[3]),
               close=float(r[4]), volume=float(r[5]))
        for r in raw
        if r and len(r) >= 6 and r[1] is not None
    ]


def _drop_unclosed(candles: list[Candle], timeframe: str) -> list[Candle]:
    """Elimina la vela en curso.

    Una vela está cerrada si su instante de cierre (`ts + duración`) ya pasó.
    Este filtro es la barrera principal contra el look-ahead en producción.
    """
    if not candles:
        return []
    step = timeframe_to_ms(timeframe)
    now = now_ms()
    return [c for c in candles if c.ts + step <= now]
