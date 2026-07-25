import { formatNumber } from '@/lib/utils';

/**
 * Graficas del panel de administracion.
 *
 * Decisiones de diseno:
 *  - Una sola serie por grafica y un unico tono (marca): al no haber varias
 *    categorias que distinguir, no hay riesgo de confusion por daltonismo.
 *  - Marcas finas, rejilla discreta y etiquetas selectivas (no un numero
 *    encima de cada barra).
 *  - Cada grafica lleva su tabla equivalente en un desplegable: la informacion
 *    nunca depende solo de la forma o el color.
 *  - Sin JavaScript de cliente: el detalle por punto se muestra con el tooltip
 *    nativo del navegador.
 */

// --------------------------------------------------------------------------- Tile

export function StatTile({
  label,
  value,
  hint,
  tone = 'default',
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: 'default' | 'good' | 'warn';
}) {
  const valueColor =
    tone === 'good' ? 'text-emerald-600' : tone === 'warn' ? 'text-amber-600' : '';

  return (
    <div className="surface p-5">
      <p className="muted text-xs font-medium uppercase tracking-wide">{label}</p>
      <p className={`mt-2 text-2xl font-bold ${valueColor}`}>{value}</p>
      {hint && <p className="muted mt-1 text-xs">{hint}</p>}
    </div>
  );
}

// --------------------------------------------------------------------------- Serie temporal

export type SeriesPoint = { day: string; count: number };

/** Serie diaria en barras verticales. Una sola serie, un solo tono. */
export function DailyBars({
  title,
  data,
  emptyLabel = 'Sin datos en el periodo.',
}: {
  title: string;
  data: SeriesPoint[];
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="surface p-5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="muted mt-6 text-center text-sm">{emptyLabel}</p>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((sum, d) => sum + d.count, 0);
  const peak = data.reduce((best, d) => (d.count > best.count ? d : best), data[0]);

  return (
    <figure className="surface p-5">
      <figcaption className="flex flex-wrap items-baseline justify-between gap-2">
        <h3 className="text-sm font-semibold">{title}</h3>
        <span className="muted text-xs">{formatNumber(total)} en total</span>
      </figcaption>

      <div className="mt-5 flex h-32 items-end gap-[2px]" role="img" aria-label={`${title}: ${total} eventos en el periodo`}>
        {data.map((point) => {
          const height = Math.max(2, Math.round((point.count / max) * 100));
          return (
            <div
              key={point.day}
              className="flex-1 rounded-t bg-brand-500 transition-colors hover:bg-brand-700"
              style={{ height: `${height}%` }}
              title={`${point.day}: ${formatNumber(point.count)}`}
            />
          );
        })}
      </div>

      <div className="muted mt-2 flex justify-between text-[0.6875rem]">
        <span>{data[0]?.day}</span>
        <span>maximo: {formatNumber(peak.count)}</span>
        <span>{data[data.length - 1]?.day}</span>
      </div>

      <details className="mt-4">
        <summary className="muted cursor-pointer text-xs">Ver datos en tabla</summary>
        <div className="scroll-x mt-2 max-h-48">
          <table className="w-full text-xs">
            <thead>
              <tr className="muted text-left">
                <th className="py-1">Dia</th>
                <th className="py-1">Total</th>
              </tr>
            </thead>
            <tbody>
              {data.map((point) => (
                <tr key={point.day} className="border-t">
                  <td className="py-1">{point.day}</td>
                  <td className="py-1">{formatNumber(point.count)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </details>
    </figure>
  );
}

// --------------------------------------------------------------------------- Ranking

/** Barras horizontales para comparar magnitudes entre categorias. */
export function RankedBars({
  title,
  data,
  emptyLabel = 'Sin datos.',
}: {
  title: string;
  data: Array<{ label: string; count: number }>;
  emptyLabel?: string;
}) {
  if (data.length === 0) {
    return (
      <div className="surface p-5">
        <h3 className="text-sm font-semibold">{title}</h3>
        <p className="muted mt-6 text-center text-sm">{emptyLabel}</p>
      </div>
    );
  }

  const max = Math.max(...data.map((d) => d.count), 1);

  return (
    <figure className="surface p-5">
      <figcaption className="text-sm font-semibold">{title}</figcaption>

      <div className="mt-4 space-y-2.5">
        {data.map((row) => (
          <div key={row.label}>
            <div className="flex items-baseline justify-between gap-3 text-xs">
              <span className="truncate">{row.label}</span>
              <span className="muted shrink-0 tabular-nums">{formatNumber(row.count)}</span>
            </div>
            <div className="mt-1 h-1.5 w-full rounded-full" style={{ background: 'var(--border)' }}>
              <div
                className="h-full rounded-full bg-brand-500"
                style={{ width: `${Math.max(2, (row.count / max) * 100)}%` }}
              />
            </div>
          </div>
        ))}
      </div>
    </figure>
  );
}

// --------------------------------------------------------------------------- Embudo

/** Embudo de conversion: cada paso con su porcentaje respecto al primero. */
export function FunnelChart({
  steps,
}: {
  steps: Array<{ label: string; count: number; percent: number }>;
}) {
  return (
    <figure className="surface p-5">
      <figcaption className="text-sm font-semibold">Embudo de adquisicion (30 dias)</figcaption>

      <ol className="mt-4 space-y-3">
        {steps.map((step, index) => {
          const previous = index > 0 ? steps[index - 1].count : null;
          const dropoff =
            previous && previous > 0 ? Math.round(100 - (step.count / previous) * 100) : null;

          return (
            <li key={step.label}>
              <div className="flex items-baseline justify-between gap-3 text-xs">
                <span className="font-medium">{step.label}</span>
                <span className="muted tabular-nums">
                  {formatNumber(step.count)} · {step.percent}%
                </span>
              </div>
              <div className="mt-1 h-2 w-full rounded-full" style={{ background: 'var(--border)' }}>
                <div
                  className="h-full rounded-full bg-brand-500"
                  style={{ width: `${Math.max(1, step.percent)}%` }}
                  title={`${step.label}: ${formatNumber(step.count)}`}
                />
              </div>
              {dropoff !== null && dropoff > 0 && (
                <p className="muted mt-1 text-[0.6875rem]">−{dropoff}% respecto al paso anterior</p>
              )}
            </li>
          );
        })}
      </ol>
    </figure>
  );
}
