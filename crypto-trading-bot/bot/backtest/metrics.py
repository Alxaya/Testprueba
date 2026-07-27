"""Métricas de rendimiento.

Todas se calculan sobre la curva de equity y las operaciones cerradas.

Advertencias que conviene tener presentes al leer cualquiera de estos números:

* **El Sharpe de un backtest de cripto está inflado.** Se calcula con retornos
  que no son normales (colas gruesas, volatilidad agrupada) y sobre un periodo
  que casi siempre incluye un mercado alcista histórico irrepetible.
* **El máximo drawdown pasado es un suelo, no un techo.** La regla práctica de la
  industria es esperar en real al menos 1,5× el peor drawdown del backtest.
* **Con menos de ~30 operaciones no hay conclusión posible.** Cualquier métrica
  sobre 12 operaciones es ruido con formato de tabla.
"""

from __future__ import annotations

import math
from collections.abc import Sequence
from dataclasses import asdict, dataclass, field
from typing import Any

import numpy as np

from bot.core.enums import ExitReason
from bot.core.models import EquityPoint, Trade
from bot.core.timeframe import periods_per_year

#: Tope del CAGR reportado. Anualizar una muestra corta produce cifras absurdas
#: (millones por ciento); se acota para que el informe siga siendo legible.
MAX_CAGR_PCT = 1e6
_MAX_CAGR_LOG = math.log(1.0 + MAX_CAGR_PCT / 100.0)


@dataclass(slots=True)
class PerformanceMetrics:
    """Resumen cuantitativo de un run."""

    initial_equity: float = 0.0
    final_equity: float = 0.0
    total_return_pct: float = 0.0
    cagr_pct: float = 0.0
    annual_volatility_pct: float = 0.0
    sharpe_ratio: float = 0.0
    sortino_ratio: float = 0.0
    max_drawdown_pct: float = 0.0
    max_drawdown_duration_bars: int = 0
    calmar_ratio: float = 0.0

    total_trades: int = 0
    winning_trades: int = 0
    losing_trades: int = 0
    win_rate_pct: float = 0.0
    profit_factor: float = 0.0
    expectancy: float = 0.0
    expectancy_r: float = 0.0
    avg_win: float = 0.0
    avg_loss: float = 0.0
    best_trade: float = 0.0
    worst_trade: float = 0.0
    avg_bars_held: float = 0.0
    total_fees: float = 0.0
    fees_pct_of_pnl: float = 0.0

    exposure_pct: float = 0.0
    bars: int = 0
    exit_reasons: dict[str, int] = field(default_factory=dict)

    def to_dict(self) -> dict[str, Any]:
        return asdict(self)

    def summary_lines(self) -> list[str]:
        """Resumen legible para consola y Telegram."""
        return [
            f"Capital        {self.initial_equity:,.2f} → {self.final_equity:,.2f} "
            f"({self.total_return_pct:+.2f} %)",
            f"CAGR           {self.cagr_pct:+.2f} %",
            f"Volatilidad    {self.annual_volatility_pct:.2f} % anualizada",
            f"Sharpe         {self.sharpe_ratio:.2f}   Sortino {self.sortino_ratio:.2f}",
            f"Max drawdown   {self.max_drawdown_pct:.2f} % "
            f"({self.max_drawdown_duration_bars} velas)   Calmar {self.calmar_ratio:.2f}",
            f"Operaciones    {self.total_trades} "
            f"({self.winning_trades}G / {self.losing_trades}P, acierto {self.win_rate_pct:.1f} %)",
            f"Profit factor  {self.profit_factor:.2f}   Expectancy {self.expectancy:+.2f} "
            f"({self.expectancy_r:+.2f} R)",
            f"Mejor/peor     {self.best_trade:+.2f} / {self.worst_trade:+.2f}",
            f"Comisiones     {self.total_fees:,.2f} ({self.fees_pct_of_pnl:.1f} % del PnL bruto)",
            f"Exposición     {self.exposure_pct:.1f} % del tiempo",
        ]


def compute_metrics(
    equity_curve: Sequence[EquityPoint],
    trades: Sequence[Trade],
    *,
    timeframe: str,
    initial_equity: float,
    risk_free_rate: float = 0.0,
) -> PerformanceMetrics:
    """Calcula todas las métricas de un run.

    `risk_free_rate` es anual y por defecto 0: en cripto no hay un tipo libre de
    riesgo evidente, y usar 0 hace las comparaciones entre estrategias limpias.
    """
    metrics = PerformanceMetrics(initial_equity=initial_equity, final_equity=initial_equity)
    if not equity_curve:
        return metrics

    equity = np.array([p.equity for p in equity_curve], dtype=np.float64)
    metrics.bars = int(equity.size)
    metrics.final_equity = float(equity[-1])
    metrics.total_return_pct = (
        (metrics.final_equity / initial_equity - 1.0) * 100.0 if initial_equity > 0 else 0.0
    )

    ppy = periods_per_year(timeframe)

    # --- Retornos y ratios ------------------------------------------------
    if equity.size > 1:
        with np.errstate(divide="ignore", invalid="ignore"):
            returns = np.diff(equity) / equity[:-1]
        returns = returns[np.isfinite(returns)]
    else:
        returns = np.array([], dtype=np.float64)

    if returns.size > 1:
        mean_r = float(returns.mean())
        std_r = float(returns.std(ddof=1))
        metrics.annual_volatility_pct = std_r * math.sqrt(ppy) * 100.0

        rf_per_bar = risk_free_rate / ppy
        excess = mean_r - rf_per_bar
        if std_r > 0:
            metrics.sharpe_ratio = excess / std_r * math.sqrt(ppy)

        downside = returns[returns < rf_per_bar]
        if downside.size > 1:
            downside_std = float(downside.std(ddof=1))
            if downside_std > 0:
                metrics.sortino_ratio = excess / downside_std * math.sqrt(ppy)

    # --- CAGR --------------------------------------------------------------
    # Se calcula en espacio logarítmico: anualizar una muestra de pocas velas
    # eleva el crecimiento a un exponente enorme y desborda en coma flotante.
    # El resultado se acota, y de todos modos un CAGR sobre pocas semanas de
    # datos no significa nada (el informe avisa cuando la muestra es corta).
    years = metrics.bars / ppy
    if years > 0 and initial_equity > 0 and metrics.final_equity > 0:
        growth = metrics.final_equity / initial_equity
        annual_log = math.log(growth) / years
        if annual_log > _MAX_CAGR_LOG:
            metrics.cagr_pct = MAX_CAGR_PCT
        elif annual_log < -_MAX_CAGR_LOG:
            metrics.cagr_pct = -100.0
        else:
            metrics.cagr_pct = max(-100.0, min(MAX_CAGR_PCT, (math.exp(annual_log) - 1.0) * 100.0))

    # --- Drawdown ----------------------------------------------------------
    running_max = np.maximum.accumulate(equity)
    with np.errstate(divide="ignore", invalid="ignore"):
        drawdowns = np.where(running_max > 0, (running_max - equity) / running_max, 0.0)
    metrics.max_drawdown_pct = float(np.nanmax(drawdowns) * 100.0) if drawdowns.size else 0.0
    metrics.max_drawdown_duration_bars = _max_drawdown_duration(equity, running_max)

    if metrics.max_drawdown_pct > 0:
        metrics.calmar_ratio = metrics.cagr_pct / metrics.max_drawdown_pct

    # --- Exposición --------------------------------------------------------
    in_market = sum(1 for p in equity_curve if p.positions_value > 0)
    metrics.exposure_pct = in_market / metrics.bars * 100.0 if metrics.bars else 0.0

    # --- Operaciones -------------------------------------------------------
    metrics.total_trades = len(trades)
    if trades:
        pnls = np.array([t.pnl for t in trades], dtype=np.float64)
        wins = pnls[pnls > 0]
        losses = pnls[pnls <= 0]

        metrics.winning_trades = int(wins.size)
        metrics.losing_trades = int(losses.size)
        metrics.win_rate_pct = wins.size / pnls.size * 100.0
        metrics.avg_win = float(wins.mean()) if wins.size else 0.0
        metrics.avg_loss = float(losses.mean()) if losses.size else 0.0
        metrics.best_trade = float(pnls.max())
        metrics.worst_trade = float(pnls.min())
        metrics.expectancy = float(pnls.mean())

        gross_profit = float(wins.sum())
        gross_loss = abs(float(losses.sum()))
        # Sin pérdidas el profit factor es infinito; se marca como inf explícito
        # para que nadie lo lea como "0" o como un dato fiable.
        metrics.profit_factor = (
            gross_profit / gross_loss if gross_loss > 0 else (math.inf if gross_profit > 0 else 0.0)
        )

        r_multiples = [t.r_multiple for t in trades if t.r_multiple is not None]
        if r_multiples:
            metrics.expectancy_r = float(np.mean(r_multiples))

        metrics.avg_bars_held = float(np.mean([t.bars_held for t in trades]))
        metrics.total_fees = float(sum(t.fees for t in trades))
        gross_pnl = float(pnls.sum()) + metrics.total_fees
        metrics.fees_pct_of_pnl = (
            metrics.total_fees / abs(gross_pnl) * 100.0 if abs(gross_pnl) > 1e-9 else 0.0
        )

        counts: dict[str, int] = {}
        for trade in trades:
            reason = trade.exit_reason.value if isinstance(trade.exit_reason, ExitReason) else str(trade.exit_reason)
            counts[reason] = counts.get(reason, 0) + 1
        metrics.exit_reasons = counts

    return metrics


def _max_drawdown_duration(equity: np.ndarray, running_max: np.ndarray) -> int:
    """Racha más larga (en velas) por debajo del máximo histórico previo."""
    longest = current = 0
    for i in range(equity.size):
        if equity[i] < running_max[i]:
            current += 1
            longest = max(longest, current)
        else:
            current = 0
    return longest


def buy_and_hold_return(closes: np.ndarray, *, fee_rate: float = 0.001) -> float:
    """Retorno porcentual de comprar y mantener, con comisión de entrada y salida.

    Es la comparación obligatoria: si la estrategia no bate esto, no aporta nada
    salvo trabajo y riesgo operativo.
    """
    if closes.size < 2 or closes[0] <= 0:
        return 0.0
    gross = closes[-1] / closes[0]
    net = gross * (1.0 - fee_rate) ** 2
    return float((net - 1.0) * 100.0)
