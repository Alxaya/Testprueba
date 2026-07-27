"""Esquema de configuración validado con pydantic v2.

Dos reglas que evitan incidentes caros:

1. **`extra="forbid"`**: una clave mal escrita en el YAML revienta al arrancar,
   no en silencio a las 3 de la mañana con una posición abierta.
2. **Ningún secreto vive aquí**. El YAML declara el *nombre* de la variable de
   entorno (`api_key_env: BINANCE_API_KEY`) y el valor se resuelve en tiempo de
   ejecución. Así el fichero de configuración se puede versionar sin miedo.
"""

from __future__ import annotations

import os
from typing import Any, Literal

from pydantic import BaseModel, ConfigDict, Field, field_validator, model_validator

from bot.core.enums import AlertLevel, RunMode
from bot.core.timeframe import timeframe_to_ms


class StrictModel(BaseModel):
    """Base con validación estricta para toda la configuración."""

    model_config = ConfigDict(extra="forbid", validate_assignment=True)


class FeesConfig(StrictModel):
    """Comisiones en puntos básicos (1 bp = 0,01 %).

    Por defecto se usan las de Binance spot sin descuentos (10 bps). Poner
    comisiones más bajas de las reales es la forma más fácil de auto-engañarse en
    un backtest.
    """

    maker_bps: float = Field(default=10.0, ge=0, le=1000)
    taker_bps: float = Field(default=10.0, ge=0, le=1000)

    @property
    def taker_rate(self) -> float:
        return self.taker_bps / 10_000.0

    @property
    def maker_rate(self) -> float:
        return self.maker_bps / 10_000.0


class ExchangeConfig(StrictModel):
    """Conexión al exchange."""

    id: str = "binance"
    testnet: bool = True
    api_key_env: str = "EXCHANGE_API_KEY"
    api_secret_env: str = "EXCHANGE_API_SECRET"
    api_password_env: str | None = None  # algunos exchanges (OKX, KuCoin) lo piden
    quote_currency: str = "USDT"
    fees: FeesConfig = Field(default_factory=FeesConfig)
    enable_rate_limit: bool = True
    request_timeout_ms: int = Field(default=20_000, ge=1_000, le=120_000)
    max_retries: int = Field(default=4, ge=0, le=10)

    @property
    def api_key(self) -> str | None:
        return os.getenv(self.api_key_env) or None

    @property
    def api_secret(self) -> str | None:
        return os.getenv(self.api_secret_env) or None

    @property
    def api_password(self) -> str | None:
        return os.getenv(self.api_password_env) if self.api_password_env else None

    @property
    def has_credentials(self) -> bool:
        return bool(self.api_key and self.api_secret)


class MarketConfig(StrictModel):
    """Qué se sigue y con qué granularidad."""

    symbols: list[str] = Field(default_factory=lambda: ["BTC/USDT"], min_length=1)
    timeframe: str = "1h"
    history_bars: int = Field(default=500, ge=50, le=5_000)
    #: Segundos de espera tras el cierre de vela antes de pedir datos. El
    #: exchange puede tardar en consolidar la última vela.
    confirmation_delay_s: float = Field(default=5.0, ge=0, le=300)
    #: Si la última vela recibida es más vieja que esto, se considera dato rancio
    #: y no se opera (fail-closed).
    max_data_staleness_bars: int = Field(default=2, ge=1, le=10)

    @field_validator("timeframe")
    @classmethod
    def _validate_timeframe(cls, value: str) -> str:
        timeframe_to_ms(value)  # lanza si no es válido
        return value

    @field_validator("symbols")
    @classmethod
    def _validate_symbols(cls, value: list[str]) -> list[str]:
        for symbol in value:
            if "/" not in symbol:
                raise ValueError(f"Símbolo {symbol!r} debe tener formato BASE/QUOTE, p. ej. BTC/USDT")
        return value


class PortfolioConfig(StrictModel):
    """Capital de partida (solo aplica a backtest y paper)."""

    initial_balance: float = Field(default=10_000.0, gt=0)
    base_currency: str = "USDT"


class RiskConfig(StrictModel):
    """Parámetros de gestión de riesgo.

    Los valores por defecto son deliberadamente conservadores. Si te parecen
    tímidos, ese es exactamente el punto: los límites existen para el día en que
    la estrategia falle, no para el día en que funcione.
    """

    #: Porcentaje del equity que se arriesga por operación, medido sobre la
    #: distancia al stop (no sobre el nocional).
    risk_per_trade_pct: float = Field(default=0.5, gt=0, le=5)
    #: Tope de nocional por posición, en % del equity.
    max_position_pct: float = Field(default=20.0, gt=0, le=100)
    #: Tope de exposición agregada, en % del equity.
    max_total_exposure_pct: float = Field(default=60.0, gt=0, le=100)
    max_concurrent_positions: int = Field(default=3, ge=1, le=50)

    #: Cortacircuitos de cartera.
    max_daily_loss_pct: float = Field(default=3.0, gt=0, le=100)
    max_drawdown_pct: float = Field(default=15.0, gt=0, le=100)
    max_consecutive_losses: int = Field(default=5, ge=1, le=100)
    cooldown_bars: int = Field(default=3, ge=0, le=500)

    #: Stops y objetivos.
    stop_atr_period: int = Field(default=14, ge=2, le=200)
    stop_atr_multiplier: float = Field(default=2.0, gt=0, le=20)
    #: Take profit como múltiplo de R (distancia al stop). 0 = desactivado.
    take_profit_r_multiple: float = Field(default=2.0, ge=0, le=50)
    trailing_stop_enabled: bool = True
    trailing_stop_atr_multiplier: float = Field(default=3.0, gt=0, le=20)
    #: Stop de emergencia en % si no hay ATR disponible.
    fallback_stop_pct: float = Field(default=5.0, gt=0, le=50)

    min_notional: float = Field(default=10.0, ge=0)
    allow_shorting: bool = False
    #: Escalar el tamaño por la confianza de la señal (`confidence`).
    scale_by_confidence: bool = False

    @model_validator(mode="after")
    def _check_coherence(self) -> RiskConfig:
        if self.max_position_pct > self.max_total_exposure_pct:
            raise ValueError(
                "max_position_pct no puede superar max_total_exposure_pct: "
                "una sola posición no debería poder saltarse el tope global"
            )
        if self.trailing_stop_enabled and self.trailing_stop_atr_multiplier < self.stop_atr_multiplier:
            raise ValueError(
                "trailing_stop_atr_multiplier debe ser >= stop_atr_multiplier, "
                "si no el trailing arrancaría más cerca que el stop inicial"
            )
        return self


class ExecutionConfig(StrictModel):
    """Cómo se envían las órdenes."""

    order_type: Literal["market", "limit"] = "market"
    #: Slippage modelado en puntos básicos (solo paper/backtest).
    slippage_bps: float = Field(default=5.0, ge=0, le=500)
    #: Desvío del precio límite respecto al de referencia, en bps.
    limit_offset_bps: float = Field(default=5.0, ge=0, le=500)
    max_retries: int = Field(default=3, ge=0, le=10)
    retry_backoff_s: float = Field(default=1.0, gt=0, le=60)

    #: Vigilancia de stops entre cierres de vela. Sin esto, un stop solo se
    #: comprueba al cerrar la vela: en un timeframe de 4h eso puede significar
    #: horas de exposición no controlada.
    intrabar_stop_check: bool = True
    stop_check_interval_s: int = Field(default=60, ge=5, le=3600)

    @property
    def slippage_rate(self) -> float:
        return self.slippage_bps / 10_000.0


class StrategyConfig(StrictModel):
    """Una instancia de estrategia. Se pueden ejecutar varias a la vez."""

    id: str
    strategy: str  # nombre registrado, p. ej. "ema_crossover"
    enabled: bool = True
    symbols: list[str] = Field(default_factory=list)  # vacío = todos los del mercado
    timeframe: str | None = None  # None = el del mercado
    params: dict[str, Any] = Field(default_factory=dict)
    #: Fracción del riesgo global asignada a esta estrategia. Permite repartir
    #: presupuesto de riesgo entre varias estrategias sin tocar sus parámetros.
    risk_weight: float = Field(default=1.0, gt=0, le=10)

    @field_validator("timeframe")
    @classmethod
    def _validate_timeframe(cls, value: str | None) -> str | None:
        if value is not None:
            timeframe_to_ms(value)
        return value


class TelegramConfig(StrictModel):
    enabled: bool = False
    bot_token_env: str = "TELEGRAM_BOT_TOKEN"
    chat_id_env: str = "TELEGRAM_CHAT_ID"
    min_level: AlertLevel = AlertLevel.INFO
    #: Resumen periódico de que el bot sigue vivo. 0 = desactivado.
    heartbeat_hours: float = Field(default=12.0, ge=0, le=168)
    #: Ventana de deduplicación de mensajes idénticos, en segundos.
    dedupe_window_s: float = Field(default=300.0, ge=0, le=86_400)

    @property
    def bot_token(self) -> str | None:
        return os.getenv(self.bot_token_env) or None

    @property
    def chat_id(self) -> str | None:
        return os.getenv(self.chat_id_env) or None


class NotificationsConfig(StrictModel):
    telegram: TelegramConfig = Field(default_factory=TelegramConfig)


class WebConfig(StrictModel):
    enabled: bool = True
    host: str = "127.0.0.1"
    port: int = Field(default=8000, ge=1, le=65535)
    auth_token_env: str = "WEB_AUTH_TOKEN"
    #: Segundos de refresco del panel.
    refresh_seconds: int = Field(default=15, ge=2, le=600)

    @property
    def auth_token(self) -> str | None:
        return os.getenv(self.auth_token_env) or None

    @model_validator(mode="after")
    def _warn_public_bind(self) -> WebConfig:
        public_bind = self.host not in ("127.0.0.1", "localhost", "::1")
        if self.enabled and public_bind and not os.getenv(self.auth_token_env):
            raise ValueError(
                f"El panel escucha en {self.host} (accesible desde fuera) pero "
                f"{self.auth_token_env} no está definido. Define un token o "
                "usa host: 127.0.0.1"
            )
        return self


class StorageConfig(StrictModel):
    db_path: str = "data/bot.db"
    ohlcv_path: str = "data/ohlcv.db"
    #: Fichero centinela: si existe, el bot no abre posiciones nuevas.
    kill_switch_file: str = "data/KILL"


class LoggingConfig(StrictModel):
    level: Literal["DEBUG", "INFO", "WARNING", "ERROR"] = "INFO"
    directory: str = "logs"
    json_format: bool = False
    max_bytes: int = Field(default=10_485_760, ge=1024)
    backup_count: int = Field(default=5, ge=0, le=100)


class BotConfig(StrictModel):
    """Configuración completa del bot."""

    mode: RunMode = RunMode.PAPER
    exchange: ExchangeConfig = Field(default_factory=ExchangeConfig)
    market: MarketConfig = Field(default_factory=MarketConfig)
    portfolio: PortfolioConfig = Field(default_factory=PortfolioConfig)
    risk: RiskConfig = Field(default_factory=RiskConfig)
    execution: ExecutionConfig = Field(default_factory=ExecutionConfig)
    strategies: list[StrategyConfig] = Field(default_factory=list)
    notifications: NotificationsConfig = Field(default_factory=NotificationsConfig)
    web: WebConfig = Field(default_factory=WebConfig)
    storage: StorageConfig = Field(default_factory=StorageConfig)
    logging: LoggingConfig = Field(default_factory=LoggingConfig)

    #: Interruptor explícito para operar con dinero real. Sin esto, el modo
    #: `live` no arranca. Es intencionadamente incómodo.
    i_understand_live_trading_risk: bool = False

    @model_validator(mode="after")
    def _validate_run(self) -> BotConfig:
        ids = [s.id for s in self.strategies]
        duplicates = {i for i in ids if ids.count(i) > 1}
        if duplicates:
            raise ValueError(f"IDs de estrategia duplicados: {sorted(duplicates)}")

        market_symbols = set(self.market.symbols)
        for strategy in self.strategies:
            unknown = set(strategy.symbols) - market_symbols
            if unknown:
                raise ValueError(
                    f"La estrategia {strategy.id!r} referencia símbolos que no están "
                    f"en market.symbols: {sorted(unknown)}"
                )

        if self.mode is RunMode.LIVE:
            if not self.i_understand_live_trading_risk:
                raise ValueError(
                    "Modo LIVE bloqueado: pon i_understand_live_trading_risk: true en la "
                    "configuración para confirmar que operas con dinero real."
                )
            if not self.exchange.has_credentials:
                raise ValueError(
                    f"Modo LIVE sin credenciales: define {self.exchange.api_key_env} y "
                    f"{self.exchange.api_secret_env} en el entorno."
                )
        return self

    def enabled_strategies(self) -> list[StrategyConfig]:
        return [s for s in self.strategies if s.enabled]

    def symbols_for(self, strategy: StrategyConfig) -> list[str]:
        return strategy.symbols or list(self.market.symbols)

    def timeframe_for(self, strategy: StrategyConfig) -> str:
        return strategy.timeframe or self.market.timeframe
