"""Optimización walk-forward.

## Por qué no una simple rejilla sobre todo el histórico

Probar 500 combinaciones de parámetros sobre el histórico completo y quedarse con
la mejor **garantiza** un resultado bonito y un futuro decepcionante. Con 500
pruebas, la mejor combinación lo es en buena parte por suerte: es sobreajuste
puro, y no hay forma de distinguirlo mirando ese mismo resultado.

## Cómo funciona el walk-forward

El histórico se divide en tramos consecutivos:

    │◄── in-sample ──►│◄─ OOS ─►│
              │◄── in-sample ──►│◄─ OOS ─►│
                        │◄── in-sample ──►│◄─ OOS ─►│

En cada tramo se optimizan los parámetros **solo** con los datos in-sample y se
evalúan **solo** sobre los datos out-of-sample siguientes, que la optimización no
ha visto. Concatenando los tramos OOS se obtiene una curva de equity que se
parece mucho más a lo que pasaría operando de verdad.

## Cómo leer el resultado

* La métrica que importa es la **out-of-sample**. La in-sample es, por
  construcción, optimista.
* Si los parámetros óptimos cambian radicalmente de un tramo a otro, la
  estrategia no tiene un régimen estable: es una señal de alarma, no un detalle.
* Un ratio OOS/IS por debajo de ~0,5 indica sobreajuste severo.
* Esto **reduce** el sobreajuste; no lo elimina. Repetir el walk-forward muchas
  veces cambiando el diseño vuelve a introducirlo por la puerta de atrás.
"""

from __future__ import annotations

import itertools
from collections.abc import Sequence
from dataclasses import dataclass, field
from typing import Any

from bot.backtest.engine import BacktestEngine, BacktestResult
from bot.config.schema import BotConfig
from bot.core.logging_setup import get_logger
from bot.core.models import Candle

log = get_logger("backtest.walkforward")


@dataclass(slots=True)
class ParameterGrid:
    """Rejilla de parámetros a explorar."""

    values: dict[str, Sequence[Any]]

    def combinations(self) -> list[dict[str, Any]]:
        if not self.values:
            return [{}]
        keys = list(self.values)
        return [dict(zip(keys, combo, strict=True)) for combo in itertools.product(*self.values.values())]

    @property
    def size(self) -> int:
        return len(self.combinations())


@dataclass(slots=True)
class FoldResult:
    """Resultado de un tramo del walk-forward."""

    fold: int
    train_start: int
    train_end: int
    test_start: int
    test_end: int
    best_params: dict[str, Any]
    in_sample_metric: float
    out_of_sample_metric: float
    out_of_sample_return_pct: float
    out_of_sample_trades: int


@dataclass(slots=True)
class WalkForwardResult:
    """Resultado agregado del walk-forward."""

    folds: list[FoldResult] = field(default_factory=list)
    metric_name: str = "sharpe_ratio"

    @property
    def avg_in_sample(self) -> float:
        return sum(f.in_sample_metric for f in self.folds) / len(self.folds) if self.folds else 0.0

    @property
    def avg_out_of_sample(self) -> float:
        return sum(f.out_of_sample_metric for f in self.folds) / len(self.folds) if self.folds else 0.0

    @property
    def total_oos_return_pct(self) -> float:
        """Retorno compuesto encadenando los tramos out-of-sample."""
        compounded = 1.0
        for fold in self.folds:
            compounded *= 1.0 + fold.out_of_sample_return_pct / 100.0
        return (compounded - 1.0) * 100.0

    @property
    def efficiency(self) -> float:
        """Ratio OOS/IS. Por debajo de ~0,5 hay sobreajuste severo."""
        if abs(self.avg_in_sample) < 1e-9:
            return 0.0
        return self.avg_out_of_sample / self.avg_in_sample

    @property
    def params_are_stable(self) -> bool:
        """`True` si el mejor juego de parámetros se repite en la mayoría de tramos."""
        if len(self.folds) < 2:
            return False
        signatures = [tuple(sorted(f.best_params.items())) for f in self.folds]
        most_common = max(set(signatures), key=signatures.count)
        return signatures.count(most_common) >= len(signatures) * 0.6

    def render(self) -> str:
        width = 78
        lines = ["═" * width, "WALK-FORWARD".center(width), "═" * width]
        lines.append(f"Métrica optimizada: {self.metric_name}")
        lines.append(f"Tramos: {len(self.folds)}")
        lines.append("")
        lines.append(f"{'#':>2}  {'IS':>8}  {'OOS':>8}  {'Ret OOS':>9}  {'Ops':>5}  Parámetros")
        lines.append("─" * width)
        for fold in self.folds:
            params = ", ".join(f"{k}={v}" for k, v in sorted(fold.best_params.items()))
            lines.append(
                f"{fold.fold:>2}  {fold.in_sample_metric:>8.3f}  {fold.out_of_sample_metric:>8.3f}  "
                f"{fold.out_of_sample_return_pct:>8.2f}%  {fold.out_of_sample_trades:>5}  {params}"
            )
        lines.append("─" * width)
        lines.append(f"Media in-sample     : {self.avg_in_sample:.3f}")
        lines.append(f"Media out-of-sample : {self.avg_out_of_sample:.3f}")
        lines.append(f"Retorno OOS total   : {self.total_oos_return_pct:+.2f} %")
        lines.append(f"Eficiencia (OOS/IS) : {self.efficiency:.2f}")
        lines.append("")

        if self.efficiency < 0.5:
            lines.append(
                "  ⚠️  Eficiencia < 0,5: los parámetros funcionan mucho peor fuera de muestra."
            )
            lines.append("      Esto es sobreajuste. No lleves esta configuración a producción.")
        if not self.params_are_stable:
            lines.append(
                "  ⚠️  Los parámetros óptimos cambian mucho entre tramos: la estrategia no"
            )
            lines.append("      tiene un régimen estable. Desconfía del resultado agregado.")
        if self.total_oos_return_pct <= 0:
            lines.append("  ⚠️  El resultado out-of-sample agregado es negativo o nulo.")

        thin = [f.fold for f in self.folds if f.out_of_sample_trades < 5]
        if thin:
            lines.append(
                f"  ⚠️  Tramos con menos de 5 operaciones fuera de muestra: {thin}."
            )
            lines.append(
                "      Con tan pocas operaciones la métrica es ruido. Alarga las ventanas"
            )
            lines.append("      o usa un timeframe más corto para tener muestra suficiente.")
        lines.append("═" * width)
        return "\n".join(lines)


class WalkForwardOptimizer:
    """Optimiza parámetros con validación out-of-sample."""

    def __init__(
        self,
        config: BotConfig,
        data: dict[str, list[Candle]],
        *,
        strategy_id: str,
        grid: ParameterGrid,
        metric: str = "sharpe_ratio",
    ) -> None:
        self.config = config
        self.data = data
        self.strategy_id = strategy_id
        self.grid = grid
        self.metric = metric

    def run(self, *, train_bars: int, test_bars: int, step_bars: int | None = None) -> WalkForwardResult:
        """Ejecuta el walk-forward con ventanas rodantes."""
        step = step_bars or test_bars
        symbol = next(iter(self.data))
        total_bars = len(self.data[symbol])
        result = WalkForwardResult(metric_name=self.metric)

        if total_bars < train_bars + test_bars:
            raise ValueError(
                f"Histórico insuficiente: {total_bars} velas para {train_bars} de "
                f"entrenamiento + {test_bars} de prueba"
            )

        combos = self.grid.combinations()
        log.info(
            "Walk-forward: %d combinaciones × %d tramos",
            len(combos), (total_bars - train_bars - test_bars) // step + 1,
        )

        fold_number = 0
        start = 0
        while start + train_bars + test_bars <= total_bars:
            train_slice = slice(start, start + train_bars)
            test_slice = slice(start + train_bars, start + train_bars + test_bars)

            train_data = {s: c[train_slice] for s, c in self.data.items()}
            test_data = {s: c[test_slice] for s, c in self.data.items()}

            best_params: dict[str, Any] = combos[0]
            best_score = float("-inf")
            best_metric = 0.0
            for params in combos:
                train_result = self._run(train_data, params)
                score = self._score(train_result)
                if score > best_score:
                    best_score = score
                    best_metric = self._raw_metric(train_result)
                    best_params = params

            test_result = self._run(test_data, best_params)
            fold_number += 1
            result.folds.append(
                FoldResult(
                    fold=fold_number,
                    train_start=train_data[symbol][0].ts,
                    train_end=train_data[symbol][-1].ts,
                    test_start=test_data[symbol][0].ts,
                    test_end=test_data[symbol][-1].ts,
                    best_params=best_params,
                    # Se reporta la métrica REAL, no la puntuación penalizada: la
                    # penalización sirve para elegir, no para informar.
                    in_sample_metric=best_metric,
                    out_of_sample_metric=self._raw_metric(test_result),
                    out_of_sample_return_pct=test_result.metrics.total_return_pct,
                    out_of_sample_trades=test_result.metrics.total_trades,
                )
            )
            log.info(
                "Tramo %d: IS=%.3f OOS=%.3f params=%s",
                fold_number, best_metric, result.folds[-1].out_of_sample_metric, best_params,
            )
            start += step

        return result

    def _run(self, data: dict[str, list[Candle]], params: dict[str, Any]) -> BacktestResult:
        """Backtest con una copia de la configuración y los parámetros dados."""
        config = self.config.model_copy(deep=True)
        for strategy in config.strategies:
            if strategy.id == self.strategy_id:
                strategy.params = {**strategy.params, **params}
                strategy.enabled = True
            else:
                strategy.enabled = False
        return BacktestEngine(config, data).run()

    #: Por debajo de este número de operaciones, el resultado es ruido y la
    #: optimización no debe elegir esos parámetros.
    MIN_TRADES_TO_SELECT = 5

    def _raw_metric(self, result: BacktestResult) -> float:
        """Valor real de la métrica, para informar."""
        value = getattr(result.metrics, self.metric, None)
        if value is None:
            raise ValueError(f"Métrica desconocida: {self.metric}")
        value = float(value)
        # Un profit factor infinito (cero pérdidas) no es una virtud: es una
        # muestra sin operaciones perdedoras todavía. Se normaliza a 0.
        return value if value not in (float("inf"), float("-inf")) else 0.0

    def _score(self, result: BacktestResult) -> float:
        """Puntuación **para seleccionar**, penalizando muestras minúsculas.

        Sin este castigo, la optimización elige sistemáticamente parámetros que
        producen 3 operaciones afortunadas y un Sharpe absurdo. Ojo: esta
        penalización no se reporta — el informe muestra la métrica real, porque
        un `-inf` en la tabla no informa de nada.
        """
        if result.metrics.total_trades < self.MIN_TRADES_TO_SELECT:
            return float("-inf")
        return self._raw_metric(result)
