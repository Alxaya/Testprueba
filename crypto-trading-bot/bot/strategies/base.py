"""Base y registro de estrategias.

Contrato de una estrategia:

* Recibe una `Window` (velas cerradas) y la posición abierta, si la hay.
* Devuelve una `Signal` o `None`.
* **No conoce el capital, ni el tamaño, ni las comisiones.** Solo dice qué
  hacer; el `RiskManager` decide cuánto y si se permite.
* **No hace I/O.** Nada de red, disco ni base de datos. Eso la hace testeable al
  100 % y determinista.

Cada estrategia debe declarar su documentación honesta (`EDGE`, `LIMITATIONS`,
`RISKS`). No es decoración: se muestra en el CLI y en el panel web, y obliga a
escribir por qué debería funcionar algo **antes** de arriesgar dinero con ello.
"""

from __future__ import annotations

from abc import ABC, abstractmethod
from collections.abc import Callable
from dataclasses import dataclass, field
from typing import Any, ClassVar

from bot.core.enums import PositionSide, SignalAction
from bot.core.errors import ConfigError
from bot.core.models import Position, Signal
from bot.core.window import Window


@dataclass(slots=True, frozen=True)
class StrategyDoc:
    """Ficha honesta de una estrategia."""

    name: str
    family: str
    summary: str
    edge: str
    limitations: tuple[str, ...]
    risks: tuple[str, ...]
    params: dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return {
            "name": self.name,
            "family": self.family,
            "summary": self.summary,
            "edge": self.edge,
            "limitations": list(self.limitations),
            "risks": list(self.risks),
            "params": self.params,
        }


class Strategy(ABC):
    """Clase base de todas las estrategias."""

    #: Nombre con el que se registra y se referencia desde el YAML.
    name: ClassVar[str] = "base"
    family: ClassVar[str] = "sin clasificar"
    summary: ClassVar[str] = ""
    #: Por qué *podría* tener ventaja. Si no sabes escribir esto, no la operes.
    EDGE: ClassVar[str] = ""
    LIMITATIONS: ClassVar[tuple[str, ...]] = ()
    RISKS: ClassVar[tuple[str, ...]] = ()
    #: Parámetros por defecto. Los del YAML se validan contra estas claves.
    DEFAULTS: ClassVar[dict[str, Any]] = {}

    def __init__(self, strategy_id: str, symbol: str, timeframe: str, params: dict[str, Any] | None = None) -> None:
        self.strategy_id = strategy_id
        self.symbol = symbol
        self.timeframe = timeframe
        self.params = self._merge_params(params or {})
        self.validate_params()

    def _merge_params(self, params: dict[str, Any]) -> dict[str, Any]:
        unknown = set(params) - set(self.DEFAULTS)
        if unknown:
            raise ConfigError(
                f"Parámetros desconocidos para la estrategia {self.name!r}: {sorted(unknown)}. "
                f"Válidos: {sorted(self.DEFAULTS)}"
            )
        merged = dict(self.DEFAULTS)
        merged.update(params)
        return merged

    def validate_params(self) -> None:
        """Comprobaciones específicas. Se llama al construir; debe lanzar `ConfigError`."""

    @property
    @abstractmethod
    def warmup(self) -> int:
        """Velas mínimas necesarias antes de poder generar una señal fiable."""

    @property
    def lookback(self) -> int:
        """Tamaño de la ventana que se le pasa a la estrategia.

        Se usa 3× el warmup para que la siembra de las medias exponenciales al
        inicio de la ventana sea irrelevante: una EMA converge muy por debajo de
        ese margen, así que la señal es prácticamente idéntica a la que daría el
        histórico completo, pero con coste O(warmup) por vela en lugar de O(n).
        """
        return max(self.warmup * 3, self.warmup + 50)

    @abstractmethod
    def generate(self, window: Window, position: Position | None) -> Signal | None:
        """Decide qué hacer con la última vela cerrada de `window`."""

    # --------------------------------------------------------------- ayudas

    def signal(
        self,
        action: SignalAction,
        window: Window,
        *,
        stop_price: float | None = None,
        take_profit: float | None = None,
        confidence: float = 1.0,
        reason: str = "",
        **meta: Any,
    ) -> Signal:
        """Construye una `Signal` con los campos comunes ya rellenos."""
        return Signal(
            action=action,
            symbol=self.symbol,
            strategy_id=self.strategy_id,
            ts=window.last_ts,
            price=window.price,
            stop_price=stop_price,
            take_profit=take_profit,
            confidence=max(0.0, min(1.0, confidence)),
            reason=reason,
            meta=meta,
        )

    @staticmethod
    def is_long(position: Position | None) -> bool:
        return position is not None and position.side is PositionSide.LONG

    def ready(self, window: Window) -> bool:
        """`True` si hay velas suficientes para decidir."""
        return len(window) >= self.warmup

    @classmethod
    def describe(cls, params: dict[str, Any] | None = None) -> StrategyDoc:
        return StrategyDoc(
            name=cls.name,
            family=cls.family,
            summary=cls.summary.strip(),
            edge=cls.EDGE.strip(),
            limitations=cls.LIMITATIONS,
            risks=cls.RISKS,
            params=params if params is not None else dict(cls.DEFAULTS),
        )

    def __repr__(self) -> str:  # pragma: no cover - depuración
        return f"<{type(self).__name__} id={self.strategy_id} {self.symbol} {self.timeframe}>"


# ------------------------------------------------------------------ registro

_REGISTRY: dict[str, type[Strategy]] = {}


def register(name: str) -> Callable[[type[Strategy]], type[Strategy]]:
    """Decorador de registro. Añadir una estrategia = crear un fichero."""

    def decorator(cls: type[Strategy]) -> type[Strategy]:
        if name in _REGISTRY:
            raise ConfigError(f"Ya existe una estrategia registrada con el nombre {name!r}")
        cls.name = name
        _REGISTRY[name] = cls
        return cls

    return decorator


def get_strategy_class(name: str) -> type[Strategy]:
    if name not in _REGISTRY:
        raise ConfigError(
            f"Estrategia desconocida: {name!r}. Disponibles: {sorted(_REGISTRY)}"
        )
    return _REGISTRY[name]


def available_strategies() -> dict[str, type[Strategy]]:
    return dict(_REGISTRY)


def build_strategy(
    name: str, strategy_id: str, symbol: str, timeframe: str, params: dict[str, Any] | None = None
) -> Strategy:
    """Instancia una estrategia registrada."""
    return get_strategy_class(name)(strategy_id, symbol, timeframe, params)
