import Link from 'next/link';
import { formatDate, formatNumber } from '@/lib/utils';
import type { UsageSummary } from '@/lib/organization';

/** Barra de consumo del periodo. Cambia de color al acercarse al limite. */
export function UsageMeter({ usage, planName }: { usage: UsageSummary; planName: string }) {
  const color =
    usage.percent >= 100 ? 'bg-red-500' : usage.percent >= 80 ? 'bg-amber-500' : 'bg-brand-600';

  return (
    <div className="surface p-5">
      <div className="flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="text-sm font-semibold">Consumo de este periodo</h2>
        <span className="badge">{planName}</span>
      </div>

      <p className="mt-3 text-2xl font-bold">
        {formatNumber(usage.used)}
        <span className="muted text-base font-normal"> / {formatNumber(usage.limit)} generaciones</span>
      </p>

      <div
        className="mt-3 h-2 w-full overflow-hidden rounded-full"
        role="progressbar"
        aria-valuenow={usage.percent}
        aria-valuemin={0}
        aria-valuemax={100}
        aria-label="Consumo del periodo"
        style={{ background: 'var(--border)' }}
      >
        <div className={`h-full rounded-full transition-all ${color}`} style={{ width: `${usage.percent}%` }} />
      </div>

      <p className="muted mt-3 text-xs">
        Se renueva el {formatDate(usage.periodEnd)} · {formatNumber(usage.words)} palabras escritas
      </p>

      {usage.percent >= 80 && (
        <Link href="/app/facturacion" className="btn btn-primary mt-4 w-full text-sm">
          {usage.remaining === 0 ? 'Subir de plan para seguir' : 'Ampliar plan'}
        </Link>
      )}
    </div>
  );
}
