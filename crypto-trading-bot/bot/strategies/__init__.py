"""Catálogo de estrategias.

Importar este paquete registra todas las estrategias disponibles. Para añadir una
nueva basta con crear el módulo, decorar la clase con `@register("nombre")` e
importarla aquí.
"""

# El import tiene efecto secundario deliberado: rellena el registro.
from bot.strategies import benchmark, mean_reversion, trend  # noqa: F401  (registro)
from bot.strategies.base import (
    Strategy,
    StrategyDoc,
    available_strategies,
    build_strategy,
    get_strategy_class,
    register,
)

__all__ = [
    "Strategy",
    "StrategyDoc",
    "available_strategies",
    "build_strategy",
    "get_strategy_class",
    "register",
]
