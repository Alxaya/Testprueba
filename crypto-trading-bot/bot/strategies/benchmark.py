"""Estrategia de referencia (baseline).

`buy_and_hold` no está pensada para operar en producción: existe para que
**ningún backtest se lea sin su comparación honesta**. Si una estrategia con 200
operaciones, comisiones y noches sin dormir no bate a comprar y esperar, la
respuesta correcta es comprar y esperar.

Es sorprendentemente frecuente que sistemas de aspecto sofisticado pierdan contra
este baseline en mercados alcistas, precisamente porque pasan mucho tiempo fuera
del mercado.
"""

from __future__ import annotations

from typing import Any, ClassVar

from bot.core.enums import SignalAction
from bot.core.models import Position, Signal
from bot.core.window import Window
from bot.strategies.base import Strategy, register


@register("buy_and_hold")
class BuyAndHold(Strategy):
    """Compra en la primera vela válida y no vuelve a hacer nada."""

    family = "Referencia"
    summary = "Compra una vez y mantiene. Es el listón que hay que superar."
    EDGE = (
        "En un activo con deriva positiva a largo plazo, no hacer nada evita "
        "comisiones, slippage, errores de ejecución y decisiones emocionales. "
        "Históricamente supera a la mayoría de sistemas activos en mercados alcistas."
    )
    LIMITATIONS = (
        "Sufre el drawdown completo del activo: en cripto, caídas del 70–85 % son "
        "históricamente normales.",
        "No tiene ninguna gestión de riesgo: no hay stop, no hay salida.",
        "Depende por completo de que el activo elegido sobreviva y suba.",
    )
    RISKS = (
        "Riesgo de ruina si el activo va a cero (le ha pasado a muchísimos proyectos).",
        "Requiere un horizonte temporal y una tolerancia al drawdown que casi nadie "
        "tiene de verdad hasta que lo vive.",
    )
    DEFAULTS: ClassVar[dict[str, Any]] = {}

    @property
    def warmup(self) -> int:
        return 2

    @property
    def lookback(self) -> int:
        return 5  # no necesita histórico: entra y se queda

    def generate(self, window: Window, position: Position | None) -> Signal | None:
        if position is not None or not self.ready(window):
            return None
        return self.signal(
            SignalAction.ENTER_LONG, window,
            reason="Compra inicial de referencia (buy & hold)",
        )
