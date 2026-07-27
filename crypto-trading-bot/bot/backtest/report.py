"""Informes de backtest para consola y CSV.

Todo informe incluye, sin excepción y sin poder desactivarse:

* la **comparación con comprar y mantener**,
* los **supuestos** del modelo de ejecución,
* un **aviso** cuando la muestra es demasiado pequeña para concluir nada.

Un backtest presentado sin estas tres cosas es publicidad, no evidencia.
"""

from __future__ import annotations

import csv
from collections.abc import Sequence
from datetime import UTC, datetime
from pathlib import Path

from bot.backtest.engine import BacktestResult
from bot.core.models import EquityPoint, Trade

#: Por debajo de esta cifra, cualquier métrica es ruido con formato de tabla.
MIN_TRADES_FOR_SIGNIFICANCE = 30


def _fmt_ts(ts: int) -> str:
    return datetime.fromtimestamp(ts / 1000, tz=UTC).strftime("%Y-%m-%d %H:%M")


def render_console(result: BacktestResult) -> str:
    """Informe completo en texto plano."""
    metrics = result.metrics
    width = 78
    lines: list[str] = []

    lines.append("═" * width)
    lines.append("INFORME DE BACKTEST".center(width))
    lines.append("═" * width)
    lines.append(f"Símbolos     : {', '.join(result.symbols)}")
    lines.append(f"Timeframe    : {result.timeframe}")
    lines.append(f"Periodo      : {_fmt_ts(result.start_ts)} → {_fmt_ts(result.end_ts)}")
    lines.append(f"Estrategias  : {', '.join(result.strategy_ids)}")
    lines.append("")

    lines.append("─" * width)
    lines.append("RESULTADOS")
    lines.append("─" * width)
    lines.extend(metrics.summary_lines())
    lines.append("")

    lines.append("─" * width)
    lines.append("COMPARACIÓN CON COMPRAR Y MANTENER")
    lines.append("─" * width)
    difference = metrics.total_return_pct - result.benchmark_return_pct
    lines.append(f"Estrategia        : {metrics.total_return_pct:+.2f} %")
    lines.append(f"Comprar y mantener: {result.benchmark_return_pct:+.2f} %")
    lines.append(f"Diferencia        : {difference:+.2f} puntos porcentuales")
    if difference <= 0:
        lines.append("")
        lines.append(
            "  ⚠️  La estrategia NO bate a comprar y mantener. Con más riesgo operativo,"
        )
        lines.append(
            "      más comisiones y más trabajo, el resultado es peor. Si el objetivo"
        )
        lines.append(
            "      fuese la rentabilidad pura, la decisión racional sería no operarla."
        )
        lines.append(
            "      (Matiz legítimo: un sistema puede valer la pena por tener MENOS"
        )
        lines.append(
            "       drawdown, aunque rente menos. Compara también esa columna.)"
        )
    lines.append("")

    if metrics.exit_reasons:
        lines.append("─" * width)
        lines.append("MOTIVOS DE SALIDA")
        lines.append("─" * width)
        total = sum(metrics.exit_reasons.values())
        for reason, count in sorted(metrics.exit_reasons.items(), key=lambda kv: -kv[1]):
            lines.append(f"  {reason:<20} {count:>5}  ({count / total * 100:5.1f} %)")
        lines.append("")

    if result.rejected_signals:
        lines.append("─" * width)
        lines.append("SEÑALES RECHAZADAS POR EL GESTOR DE RIESGO")
        lines.append("─" * width)
        counts: dict[str, int] = {}
        for rejected in result.rejected_signals:
            counts[rejected.reason] = counts.get(rejected.reason, 0) + 1
        for reason, count in sorted(counts.items(), key=lambda kv: -kv[1]):
            lines.append(f"  {reason:<24} {count:>5}")
        lines.append("")

    lines.append("─" * width)
    lines.append("SUPUESTOS DEL MODELO DE EJECUCIÓN")
    lines.append("─" * width)
    for assumption in result.assumptions:
        lines.append(f"  · {assumption}")
    lines.append("")

    warnings = _warnings(result)
    if warnings:
        lines.append("─" * width)
        lines.append("AVISOS")
        lines.append("─" * width)
        for warning in warnings:
            lines.append(f"  ⚠️  {warning}")
        lines.append("")

    lines.append("═" * width)
    lines.append(
        "Rentabilidad pasada NO garantiza resultados futuros. Un backtest es la mejor"
    )
    lines.append(
        "versión posible de la historia, no una previsión. Espera en real un drawdown"
    )
    lines.append("de al menos 1,5× el peor observado aquí.")
    lines.append("═" * width)
    return "\n".join(lines)


def _warnings(result: BacktestResult) -> list[str]:
    """Avisos automáticos sobre la fiabilidad del resultado."""
    metrics = result.metrics
    warnings: list[str] = []

    if metrics.total_trades < MIN_TRADES_FOR_SIGNIFICANCE:
        warnings.append(
            f"Solo {metrics.total_trades} operaciones (mínimo recomendable "
            f"{MIN_TRADES_FOR_SIGNIFICANCE}). La muestra es demasiado pequeña para "
            "distinguir habilidad de suerte."
        )
    if metrics.bars < 500:
        warnings.append(
            f"Solo {metrics.bars} velas de histórico. Prueba sobre varios años y, sobre "
            "todo, sobre al menos un mercado bajista completo."
        )
    if metrics.max_drawdown_pct > 30:
        warnings.append(
            f"Drawdown máximo del {metrics.max_drawdown_pct:.1f} %. Pregúntate en serio "
            "si aguantarías eso con dinero real sin apagar el bot."
        )
    if metrics.fees_pct_of_pnl > 30:
        warnings.append(
            f"Las comisiones se llevan el {metrics.fees_pct_of_pnl:.0f} % del PnL bruto. "
            "El sistema opera demasiado para el margen que obtiene."
        )
    if metrics.sharpe_ratio > 3:
        warnings.append(
            f"Sharpe de {metrics.sharpe_ratio:.2f}: sospechosamente alto. Antes de "
            "celebrarlo, revisa si hay look-ahead, sesgo de supervivencia o "
            "sobreoptimización."
        )
    if metrics.win_rate_pct > 80 and metrics.total_trades > 10:
        warnings.append(
            f"Tasa de acierto del {metrics.win_rate_pct:.0f} %. Comprueba el peor trade: "
            "las estrategias de acierto altísimo suelen esconder pérdidas enormes."
        )
    if metrics.exposure_pct < 10 and metrics.total_trades > 0:
        warnings.append(
            f"Solo se está en mercado el {metrics.exposure_pct:.1f} % del tiempo. El "
            "capital ocioso también tiene coste de oportunidad."
        )
    return warnings


def export_trades_csv(trades: Sequence[Trade], path: str | Path) -> Path:
    """Vuelca las operaciones cerradas a CSV."""
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow([
            "symbol", "strategy_id", "side", "quantity", "entry_price", "exit_price",
            "entry_time", "exit_time", "pnl", "pnl_pct", "fees", "r_multiple",
            "bars_held", "exit_reason",
        ])
        for trade in trades:
            writer.writerow([
                trade.symbol, trade.strategy_id, trade.side.value, f"{trade.quantity:.8f}",
                f"{trade.entry_price:.8f}", f"{trade.exit_price:.8f}",
                _fmt_ts(trade.entry_ts), _fmt_ts(trade.exit_ts),
                f"{trade.pnl:.4f}", f"{trade.pnl_pct:.4f}", f"{trade.fees:.4f}",
                f"{trade.r_multiple:.3f}" if trade.r_multiple is not None else "",
                trade.bars_held, trade.exit_reason.value,
            ])
    return output


def export_equity_csv(curve: Sequence[EquityPoint], path: str | Path) -> Path:
    """Vuelca la curva de equity a CSV."""
    output = Path(path)
    output.parent.mkdir(parents=True, exist_ok=True)
    with output.open("w", newline="", encoding="utf-8") as handle:
        writer = csv.writer(handle)
        writer.writerow(["time", "equity", "cash", "positions_value", "drawdown_pct"])
        for point in curve:
            writer.writerow([
                _fmt_ts(point.ts), f"{point.equity:.4f}", f"{point.cash:.4f}",
                f"{point.positions_value:.4f}", f"{point.drawdown_pct:.4f}",
            ])
    return output
