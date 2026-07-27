"""Estrategias de reversión a la media.

Apuestan a que un precio que se aleja mucho de su media tiende a volver. Es la
familia **opuesta** al seguimiento de tendencia y por eso se comportan bien en
condiciones distintas: combinar ambas familias suele suavizar la curva de capital
más que optimizar cualquiera de ellas por separado.

El perfil de resultados también es el inverso: **muchas ganancias pequeñas y
pocas pérdidas grandes**. Es psicológicamente cómoda (se acierta el 60–70 % de
las veces) y peligrosa por el mismo motivo: la operación que sale mal puede
borrar veinte que salieron bien. Por eso aquí el stop no es opcional.
"""

from __future__ import annotations

from typing import Any, ClassVar

import numpy as np

from bot.core.enums import SignalAction
from bot.core.errors import ConfigError
from bot.core.indicators import last_valid
from bot.core.models import Position, Signal
from bot.core.window import Window
from bot.strategies.base import Strategy, register


@register("rsi_mean_reversion")
class RSIMeanReversion(Strategy):
    """Compra sobreventa y vende cuando el RSI se recupera.

    Incluye dos filtros que reducen mucho el riesgo de "coger un cuchillo cayendo":
    un filtro de tendencia larga (no comprar sobreventa en un mercado bajista) y
    un filtro de ADX (no comprar reversión cuando la tendencia es muy fuerte).
    """

    family = "Reversión a la media"
    summary = (
        "Compra cuando el RSI cae por debajo del nivel de sobreventa y cierra cuando "
        "supera el nivel de salida, con filtros de tendencia y de régimen."
    )
    EDGE = (
        "Tras movimientos bruscos a la baja aparece un rebote técnico por dos motivos "
        "bien documentados: provisión de liquidez (quien compra el pánico cobra una "
        "prima por asumir riesgo de inventario) y sobrerreacción de los participantes "
        "(De Bondt & Thaler, 1985). En cripto el efecto es apreciable en marcos "
        "temporales cortos, donde las liquidaciones forzadas amplifican los movimientos."
    )
    LIMITATIONS = (
        "Sobreventa no significa suelo. En un mercado bajista el RSI puede estar por "
        "debajo de 30 durante semanas mientras el precio sigue cayendo.",
        "Perfil de pagos asimétrico y peligroso: muchas ganancias pequeñas y alguna "
        "pérdida enorme. Sin stop estricto, este sistema arruina cuentas.",
        "Un backtest sin comisiones parece espectacular: opera mucho y cada operación "
        "gana poco, así que los costes se comen una parte enorme del resultado.",
        "El filtro de tendencia reduce las oportunidades de forma drástica: es el "
        "precio que se paga por no comprar en caída libre.",
    )
    RISKS = (
        "Riesgo de ruina en eventos extremos: un desplome del 40 % en horas convierte "
        "la 'reversión a la media' en una pérdida permanente.",
        "Tentación de promediar a la baja. Este sistema NO lo hace, y no debe hacerlo: "
        "es la vía más rápida a una pérdida catastrófica.",
        "En criptomonedas pequeñas, lo que parece sobreventa puede ser el principio de "
        "una quiebra o de un fraude; el precio no vuelve nunca.",
    )
    DEFAULTS: ClassVar[dict[str, Any]] = {
        "rsi_period": 14,
        "oversold": 30.0,
        "exit_level": 55.0,
        "trend_period": 200,
        "use_trend_filter": True,
        "max_adx": 0.0,  # 0 = filtro desactivado
        "adx_period": 14,
        "atr_period": 14,
        "atr_stop_multiplier": 2.0,
        "max_bars_in_trade": 0,  # 0 = sin límite temporal
    }

    def validate_params(self) -> None:
        if not 0 < self.params["oversold"] < self.params["exit_level"] < 100:
            raise ConfigError(
                f"{self.strategy_id}: se requiere 0 < oversold < exit_level < 100 "
                f"(oversold={self.params['oversold']}, exit_level={self.params['exit_level']})"
            )

    @property
    def warmup(self) -> int:
        periods = [self.params["rsi_period"] * 3, self.params["atr_period"]]
        if self.params["use_trend_filter"]:
            periods.append(self.params["trend_period"])
        if self.params["max_adx"] > 0:
            periods.append(self.params["adx_period"] * 3)
        return max(periods) + 10

    def generate(self, window: Window, position: Position | None) -> Signal | None:
        if not self.ready(window):
            return None

        rsi_values = window.rsi(self.params["rsi_period"])
        rsi_now = last_valid(rsi_values)
        if rsi_now is None:
            return None

        if self.is_long(position):
            assert position is not None
            if rsi_now >= self.params["exit_level"]:
                return self.signal(
                    SignalAction.EXIT_LONG, window,
                    reason=f"RSI recuperado a {rsi_now:.1f} (salida en {self.params['exit_level']})",
                )
            max_bars = self.params["max_bars_in_trade"]
            if max_bars and position.bars_held >= max_bars:
                # Salida por tiempo: si la reversión no ocurre pronto, la tesis
                # de la operación ha dejado de ser válida.
                return self.signal(
                    SignalAction.EXIT_LONG, window,
                    reason=f"Salida por tiempo tras {position.bars_held} velas",
                )
            return None

        if position is not None or rsi_now >= self.params["oversold"]:
            return None

        if self.params["use_trend_filter"]:
            trend = last_valid(window.ema(self.params["trend_period"]))
            if trend is None or window.price <= trend:
                return None

        if self.params["max_adx"] > 0:
            adx_now = last_valid(window.adx(self.params["adx_period"]))
            if adx_now is not None and adx_now > self.params["max_adx"]:
                return None  # tendencia demasiado fuerte para apostar por la reversión

        atr_value = last_valid(window.atr(self.params["atr_period"]))
        stop = window.price - atr_value * self.params["atr_stop_multiplier"] if atr_value else None
        # Cuanto más extremo el RSI, mayor la confianza (0 en el umbral, 1 en RSI=0).
        confidence = min(1.0, (self.params["oversold"] - rsi_now) / max(self.params["oversold"], 1e-9))
        return self.signal(
            SignalAction.ENTER_LONG, window,
            stop_price=stop,
            confidence=max(0.1, confidence),
            reason=f"RSI en sobreventa ({rsi_now:.1f} < {self.params['oversold']})",
            rsi=rsi_now,
        )


@register("bollinger_reversion")
class BollingerReversion(Strategy):
    """Compra en el toque de la banda inferior, sale al volver a la media.

    Variante clásica y conservadora: solo entra si el precio **cierra** por debajo
    de la banda inferior, y sale al recuperar la media móvil central.
    """

    family = "Reversión a la media"
    summary = (
        "Entra cuando el precio cierra bajo la banda inferior de Bollinger y sale al "
        "recuperar la media central."
    )
    EDGE = (
        "Las bandas de Bollinger normalizan la desviación respecto a la media por la "
        "volatilidad reciente, así que la señal se adapta al régimen: en periodos "
        "tranquilos basta un movimiento pequeño, en periodos agitados exige uno grande. "
        "Es la misma lógica de sobrerreacción del RSI, pero medida en desviaciones "
        "típicas en lugar de en momentum."
    )
    LIMITATIONS = (
        "En una tendencia bajista fuerte el precio 'camina' por la banda inferior y la "
        "estrategia entra una y otra vez contra la tendencia.",
        "Las bandas se ensanchan *después* del movimiento (la volatilidad se mide con "
        "retardo), así que la señal llega cuando el daño ya está hecho.",
        "Con `num_std` bajo opera muchísimo y las comisiones dominan el resultado; con "
        "`num_std` alto casi no opera y la muestra es demasiado pequeña para concluir nada.",
    )
    RISKS = (
        "Igual que toda reversión a la media: la pérdida máxima no está acotada por la "
        "lógica de la estrategia, solo por el stop. El stop es obligatorio.",
        "Falsa sensación de fiabilidad por la alta tasa de acierto; conviene mirar el "
        "profit factor y el peor trade, no el porcentaje de aciertos.",
    )
    DEFAULTS: ClassVar[dict[str, Any]] = {
        "period": 20,
        "num_std": 2.0,
        "trend_period": 200,
        "use_trend_filter": True,
        "atr_period": 14,
        "atr_stop_multiplier": 2.0,
        "max_bars_in_trade": 0,
    }

    def validate_params(self) -> None:
        if self.params["num_std"] <= 0:
            raise ConfigError(f"{self.strategy_id}: num_std debe ser > 0")

    @property
    def warmup(self) -> int:
        periods = [self.params["period"] * 2, self.params["atr_period"]]
        if self.params["use_trend_filter"]:
            periods.append(self.params["trend_period"])
        return max(periods) + 10

    def generate(self, window: Window, position: Position | None) -> Signal | None:
        if not self.ready(window):
            return None

        lower, middle, _ = window.bollinger(self.params["period"], self.params["num_std"])
        if np.isnan(lower[-1]) or np.isnan(middle[-1]):
            return None

        price = window.price

        if self.is_long(position):
            assert position is not None
            if price >= middle[-1]:
                return self.signal(
                    SignalAction.EXIT_LONG, window,
                    reason=f"Precio de vuelta en la media ({middle[-1]:.2f})",
                )
            max_bars = self.params["max_bars_in_trade"]
            if max_bars and position.bars_held >= max_bars:
                return self.signal(
                    SignalAction.EXIT_LONG, window,
                    reason=f"Salida por tiempo tras {position.bars_held} velas",
                )
            return None

        if position is not None or price >= lower[-1]:
            return None

        if self.params["use_trend_filter"]:
            trend = last_valid(window.ema(self.params["trend_period"]))
            if trend is None or price <= trend:
                return None

        atr_value = last_valid(window.atr(self.params["atr_period"]))
        stop = price - atr_value * self.params["atr_stop_multiplier"] if atr_value else None
        return self.signal(
            SignalAction.ENTER_LONG, window,
            stop_price=stop,
            take_profit=float(middle[-1]),
            reason=f"Cierre bajo la banda inferior ({lower[-1]:.2f})",
            lower_band=float(lower[-1]), middle_band=float(middle[-1]),
        )
