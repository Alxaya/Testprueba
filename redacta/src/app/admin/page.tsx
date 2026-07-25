import Link from 'next/link';
import { getBusinessSnapshot, getTopOrganizations } from '@/lib/metrics';
import { EVENTS, dailySeries } from '@/lib/analytics';
import { DailyBars, RankedBars, StatTile } from '@/components/admin/Charts';
import { formatCurrency, formatNumber } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Cuadro de mando del negocio. */
export default async function AdminHomePage() {
  const [snapshot, topOrganizations, signups, generations] = await Promise.all([
    getBusinessSnapshot(),
    getTopOrganizations(8),
    dailySeries(EVENTS.SIGNUP, 30),
    dailySeries(EVENTS.GENERATION_CREATED, 30),
  ]);

  const marginPercent =
    snapshot.mrrCents > 0
      ? Math.round((snapshot.grossMarginCents / snapshot.mrrCents) * 100)
      : 0;

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Negocio</h1>
        <p className="muted mt-1">Ingresos, clientes y coste real del servicio.</p>
      </header>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="MRR"
          value={formatCurrency(snapshot.mrrCents)}
          hint={`${snapshot.activeSubscriptions} suscripciones de pago`}
        />
        <StatTile
          label="ARR proyectado"
          value={formatCurrency(snapshot.arrCents)}
          hint="MRR x 12, sin descontar bajas"
        />
        <StatTile
          label="Margen bruto (30 d)"
          value={formatCurrency(snapshot.grossMarginCents)}
          hint={`${marginPercent}% sobre MRR · coste modelo ${formatCurrency(snapshot.modelCostCents30d)}`}
          tone={snapshot.grossMarginCents >= 0 ? 'good' : 'warn'}
        />
        <StatTile
          label="Cuentas totales"
          value={formatNumber(snapshot.totalOrganizations)}
          hint={`+${snapshot.newOrganizations30d} en 30 dias`}
        />
      </section>

      <section className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <StatTile
          label="Generaciones (30 d)"
          value={formatNumber(snapshot.generations30d)}
          hint={`${snapshot.failed30d} fallidas`}
        />
        <StatTile
          label="Coste medio por pieza"
          value={formatCurrency(snapshot.averageCostPerGenerationCents)}
          hint="Estimacion sobre tokens consumidos"
        />
        <StatTile
          label="Pagos pendientes"
          value={formatNumber(snapshot.pastDue)}
          hint="Cuentas con cobro fallido"
          tone={snapshot.pastDue > 0 ? 'warn' : 'default'}
        />
        <StatTile
          label="Bajas (30 d)"
          value={formatNumber(snapshot.canceled30d)}
          hint="Suscripciones canceladas"
          tone={snapshot.canceled30d > 0 ? 'warn' : 'default'}
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <DailyBars title="Registros por dia (30 dias)" data={signups} />
        <DailyBars title="Generaciones por dia (30 dias)" data={generations} />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <RankedBars
          title="Distribucion por plan (suscripciones activas)"
          data={snapshot.planDistribution.map((p) => ({ label: p.name, count: p.count }))}
        />

        <figure className="surface p-5">
          <figcaption className="flex items-center justify-between">
            <h3 className="text-sm font-semibold">Clientes con mas consumo (30 d)</h3>
            <Link href="/admin/clientes" className="muted text-xs hover:text-brand-600">
              Ver todos →
            </Link>
          </figcaption>

          {topOrganizations.length === 0 ? (
            <p className="muted mt-6 text-center text-sm">Sin actividad todavia.</p>
          ) : (
            <div className="scroll-x mt-4">
              <table className="w-full text-xs">
                <thead>
                  <tr className="muted text-left">
                    <th className="py-1.5">Cliente</th>
                    <th className="py-1.5">Plan</th>
                    <th className="py-1.5 text-right">Piezas</th>
                    <th className="py-1.5 text-right">Coste</th>
                  </tr>
                </thead>
                <tbody>
                  {topOrganizations.map((organization) => (
                    <tr key={organization.id} className="border-t">
                      <td className="max-w-[140px] truncate py-1.5">{organization.name}</td>
                      <td className="py-1.5">{organization.plan}</td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatNumber(organization.generations)}
                      </td>
                      <td className="py-1.5 text-right tabular-nums">
                        {formatCurrency(organization.costCents)}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </figure>
      </section>
    </div>
  );
}
