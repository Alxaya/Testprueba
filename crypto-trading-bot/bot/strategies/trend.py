"""Estrategias de seguimiento de tendencia.

Todas son técnicas **públicas y ampliamente documentadas** desde hace décadas.
Ninguna es un secreto ni una fórmula mágica: su ventaja histórica es pequeña,
inestable y puede haber desaparecido. Se implementan porque son transparentes,
auditables y sirven de base honesta sobre la que medir.

El patrón común del seguimiento de tendencia es: **muchas pérdidas pequeñas y
pocas ganancias grandes**. Psicológicamente es duro (se acierta menos del 40 %
de las veces) y matemáticamente depende por completo de dejar correr los
aciertos. Si cortas las ganancias, no queda nada.
"""

from __future__ import annotations

from typing import Any, ClassVar

import numpy as np

from bot.core.enums import SignalAction
from bot.core.errors import ConfigError
from bot.core.indicators import crossed_above, crossed_below, last_valid
from bot.core.models import Position, Signal
from bot.core.window import Window
from bot.strategies.base import Strategy, register


@register("ema_crossover")
class EMACrossover(Strategy):
    """Cruce de medias móviles exponenciales con filtro de tendencia.

    Entra en largo cuando la EMA rápida cruza por encima de la lenta y el precio
    está por encima de la EMA de tendencia (filtro de régimen). Sale cuando la
    rápida cruza por debajo de la lenta.
    """

    family = "Seguimiento de tendencia"
    summary = (
        "Compra cuando la media rápida cruza al alza la media lenta, filtrado por "
        "una media larga que define el régimen. Sale con el cruce a la baja."
    )
    EDGE = (
        "El cruce de medias captura persistencia de precios (momentum), un efecto "
        "documentado en múltiples clases de activos desde los años 90 (Jegadeesh & "
        "Titman, 1993; Moskowitz et al., 2012). La justificación conductual habitual "
        "es la infrarreacción inicial de los participantes a la información nueva. "
        "El filtro de tendencia larga evita operar contra la dirección dominante, que "
        "es donde este tipo de sistema acumula la mayoría de sus falsas señales."
    )
    LIMITATIONS = (
        "Retardo estructural: las medias son filtros causales, siempre entran tarde "
        "y salen tarde. Nunca comprarás el mínimo ni venderás el máximo.",
        "En mercados laterales genera 'whipsaws' (sierra): entradas y salidas "
        "consecutivas con pérdida, cada una pagando comisiones y slippage.",
        "Tasa de acierto baja, típicamente 30–45 %. La rentabilidad depende de que "
        "unas pocas operaciones grandes compensen muchas pequeñas.",
        "Es la estrategia más popular del mundo: cualquier ventaja está muy "
        "arbitrada y es muy sensible a los parámetros elegidos.",
    )
    RISKS = (
        "Sobreoptimización: probar 200 combinaciones de periodos y quedarse con la "
        "mejor produce un resultado histórico bonito y un futuro decepcionante.",
        "Huecos de precio: en cripto el mercado abre 24/7, pero un movimiento brusco "
        "puede saltarse el stop y la pérdida real superar a la planificada.",
        "Rachas largas de pérdidas en mercados laterales; el drawdown puede durar "
        "meses y es la principal causa de abandono del sistema.",
    )
    DEFAULTS: ClassVar[dict[str, Any]] = {
        "fast_period": 21,
        "slow_period": 55,
        "trend_period": 200,
        "use_trend_filter": True,
        "atr_period": 14,
        "atr_stop_multiplier": 2.0,
    }

    def validate_params(self) -> None:
        if self.params["fast_period"] >= self.params["slow_period"]:
            raise ConfigError(
                f"{self.strategy_id}: fast_period ({self.params['fast_period']}) debe ser "
                f"menor que slow_period ({self.params['slow_period']})"
            )

    @property
    def warmup(self) -> int:
        periods = [self.params["slow_period"], self.params["atr_period"]]
        if self.params["use_trend_filter"]:
            periods.append(self.params["trend_period"])
        return max(periods) + 10

    def generate(self, window: Window, position: Position | None) -> Signal | None:
        if not self.ready(window):
            return None

        fast = window.ema(self.params["fast_period"])
        slow = window.ema(self.params["slow_period"])
        if np.isnan(fast[-1]) or np.isnan(slow[-1]):
            return None

        if self.is_long(position):
            if crossed_below(fast, slow):
                return self.signal(
                    SignalAction.EXIT_LONG, window,
                    reason=f"EMA{self.params['fast_period']} cruzó bajo EMA{self.params['slow_period']}",
                )
            return None

        if position is not None:
            return None

        if not crossed_above(fast, slow):
            return None

        if self.params["use_trend_filter"]:
            trend = window.ema(self.params["trend_period"])
            trend_value = last_valid(trend)
            if trend_value is None or window.price <= trend_value:
                return None

        atr_value = last_valid(window.atr(self.params["atr_period"]))
        stop = (
            window.price - atr_value * self.params["atr_stop_multiplier"]
            if atr_value else None
        )
        return self.signal(
            SignalAction.ENTER_LONG, window,
            stop_price=stop,
            reason=f"EMA{self.params['fast_period']} cruzó sobre EMA{self.params['slow_period']}",
            fast=float(fast[-1]), slow=float(slow[-1]),
        )


@register("donchian_breakout")
class DonchianBreakout(Strategy):
    """Ruptura del canal de Donchian, al estilo del sistema Turtle.

    Entra en largo cuando el cierre supera el máximo de los últimos `entry_period`
    periodos (calculado **sin incluir** la vela actual) y sale cuando pierde el
    mínimo de los últimos `exit_period`.
    """

    family = "Seguimiento de tendencia / Ruptura"
    summary = (
        "Compra rupturas del máximo de N periodos y sale por el mínimo de M periodos. "
        "Es la mecánica del sistema Turtle original (Dennis & Eckhardt, 1983)."
    )
    EDGE = (
        "Las rupturas de rango capturan el inicio de tendencias sostenidas. La lógica "
        "es que un precio que supera su máximo de N periodos ha resuelto un equilibrio "
        "de oferta y demanda, y la continuación es más probable que la reversión. Es la "
        "base de los sistemas de futuros gestionados (managed futures / CTA), cuyo "
        "rendimiento a largo plazo está ampliamente documentado."
    )
    LIMITATIONS = (
        "Muchas rupturas son falsas. Históricamente acierta un 30–40 % de las veces.",
        "El sistema Turtle original operaba una cartera diversificada de decenas de "
        "futuros; aplicado a uno o dos pares de cripto pierde gran parte de su "
        "diversificación y su comportamiento es mucho más errático.",
        "Devuelve una parte importante de la ganancia en cada salida, porque la señal "
        "de salida es por definición posterior al máximo.",
        "Muy sensible a la elección de `entry_period` y `exit_period`.",
    )
    RISKS = (
        "Drawdowns prolongados en mercados laterales; la curva de capital pasa la "
        "mayor parte del tiempo por debajo de su máximo.",
        "En cripto, las rupturas suelen coincidir con picos de volatilidad, donde el "
        "slippage real es muy superior al modelado.",
        "Riesgo de concentración si varias criptomonedas rompen a la vez: están muy "
        "correlacionadas y lo que parecen tres posiciones puede ser una sola apuesta.",
    )
    DEFAULTS: ClassVar[dict[str, Any]] = {
        "entry_period": 20,
        "exit_period": 10,
        "atr_period": 14,
        "atr_stop_multiplier": 2.0,
        "min_atr_pct": 0.0,  # filtro opcional de volatilidad mínima
    }

    def validate_params(self) -> None:
        if self.params["entry_period"] < 2 or self.params["exit_period"] < 2:
            raise ConfigError(f"{self.strategy_id}: los periodos deben ser >= 2")

    @property
    def warmup(self) -> int:
        return max(self.params["entry_period"], self.params["exit_period"], self.params["atr_period"]) + 10

    def generate(self, window: Window, position: Position | None) -> Signal | None:
        if not self.ready(window):
            return None

        _, _, upper = window.donchian(self.params["entry_period"])
        lower_exit, _, _ = window.donchian(self.params["exit_period"])
        price = window.price

        if self.is_long(position):
            exit_level = last_valid(lower_exit)
            if exit_level is not None and price < exit_level:
                return self.signal(
                    SignalAction.EXIT_LONG, window,
                    reason=f"Cierre bajo el mínimo de {self.params['exit_period']} periodos",
                )
            return None

        if position is not None:
            return None

        breakout_level = last_valid(upper)
        if breakout_level is None or price <= breakout_level:
            return None

        atr_value = last_valid(window.atr(self.params["atr_period"]))
        min_atr_pct = self.params["min_atr_pct"]
        if min_atr_pct > 0 and (atr_value is None or (atr_value / price * 100.0) < min_atr_pct):
            return None

        stop = price - atr_value * self.params["atr_stop_multiplier"] if atr_value else None
        return self.signal(
            SignalAction.ENTER_LONG, window,
            stop_price=stop,
            reason=f"Ruptura del máximo de {self.params['entry_period']} periodos ({breakout_level:.2f})",
            breakout_level=breakout_level,
        )


@register("macd_trend")
class MACDTrend(Strategy):
    """Cruce del MACD sobre su línea de señal, con filtro de dirección.

    Solo acepta cruces alcistas producidos por debajo o cerca de cero (donde el
    recorrido potencial es mayor) y con el precio sobre su media larga.
    """

    family = "Seguimiento de tendencia"
    summary = (
        "Entra cuando la línea MACD cruza al alza su señal, con el precio sobre una "
        "media larga. Sale con el cruce bajista."
    )
    EDGE = (
        "El MACD es la diferencia de dos EMAs: mide aceleración del momentum en lugar "
        "de su nivel. Frente al cruce simple de medias, reacciona algo antes a los "
        "cambios de impulso, a costa de más señales falsas. La ventaja teórica es la "
        "misma que la del momentum: persistencia de las tendencias."
    )
    LIMITATIONS = (
        "Genera bastantes más señales que un cruce de medias, y por tanto más "
        "comisiones. En pares con comisiones altas puede no compensar.",
        "El histograma tiende a producir divergencias que se interpretan de forma muy "
        "subjetiva; aquí solo se usan los cruces, que son objetivos y reproducibles.",
        "Igual que cualquier sistema de tendencia, sufre en mercados laterales.",
    )
    RISKS = (
        "Sobreoperación: es fácil acabar pagando más en comisiones que lo que aporta "
        "la señal, sobre todo en timeframes cortos.",
        "El filtro de media larga reduce señales pero también retrasa la entrada en "
        "los giros de mercado, que es cuando más recorrido habría.",
    )
    DEFAULTS: ClassVar[dict[str, Any]] = {
        "fast_period": 12,
        "slow_period": 26,
        "signal_period": 9,
        "trend_period": 100,
        "use_trend_filter": True,
        "atr_period": 14,
        "atr_stop_multiplier": 2.0,
    }

    def validate_params(self) -> None:
        if self.params["fast_period"] >= self.params["slow_period"]:
            raise ConfigError(f"{self.strategy_id}: fast_period debe ser menor que slow_period")

    @property
    def warmup(self) -> int:
        base = self.params["slow_period"] + self.params["signal_period"]
        if self.params["use_trend_filter"]:
            base = max(base, self.params["trend_period"])
        return base + 20

    def generate(self, window: Window, position: Position | None) -> Signal | None:
        if not self.ready(window):
            return None

        macd_line, signal_line, _ = window.macd(
            self.params["fast_period"], self.params["slow_period"], self.params["signal_period"]
        )
        if np.isnan(macd_line[-1]) or np.isnan(signal_line[-1]):
            return None

        if self.is_long(position):
            if crossed_below(macd_line, signal_line):
                return self.signal(SignalAction.EXIT_LONG, window, reason="MACD cruzó bajo su señal")
            return None

        if position is not None or not crossed_above(macd_line, signal_line):
            return None

        if self.params["use_trend_filter"]:
            trend = last_valid(window.ema(self.params["trend_period"]))
            if trend is None or window.price <= trend:
                return None

        atr_value = last_valid(window.atr(self.params["atr_period"]))
        stop = window.price - atr_value * self.params["atr_stop_multiplier"] if atr_value else None
        return self.signal(
            SignalAction.ENTER_LONG, window,
            stop_price=stop,
            reason="MACD cruzó sobre su señal",
            macd=float(macd_line[-1]), signal=float(signal_line[-1]),
        )
