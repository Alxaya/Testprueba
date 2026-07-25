import type { Metadata } from 'next';
import { requireAdmin } from '@/lib/session';
import { EVENTS, countsByEvent, dailySeries, funnel, topSources } from '@/lib/analytics';
import { DailyBars, FunnelChart, RankedBars } from '@/components/admin/Charts';

export const metadata: Metadata = { title: 'Analitica' };
export const dynamic = 'force-dynamic';

/** Analitica de producto y adquisicion, con datos propios. */
export default async function AdminAnalyticsPage() {
  await requireAdmin();

  const [steps, sources, events, pageviews, quotaHits] = await Promise.all([
    funnel(30),
    topSources(30),
    countsByEvent(30),
    dailySeries(EVENTS.PAGEVIEW, 30),
    dailySeries(EVENTS.QUOTA_REACHED, 30),
  ]);

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">Analitica</h1>
        <p className="muted mt-1">
          Datos propios de los ultimos 30 dias. Sin cookies ni herramientas de terceros.
        </p>
      </header>

      <DailyBars title="Visitas por dia" data={pageviews} />

      <section className="grid gap-4 lg:grid-cols-2">
        <FunnelChart steps={steps} />
        <RankedBars
          title="Fuentes de trafico"
          data={sources.map((s) => ({ label: s.source, count: s.count }))}
          emptyLabel="Sin visitas registradas todavia."
        />
      </section>

      <section className="grid gap-4 lg:grid-cols-2">
        <RankedBars
          title="Eventos mas frecuentes"
          data={events.slice(0, 10).map((e) => ({ label: e.name, count: e.count }))}
        />
        <DailyBars
          title="Limites de cuota alcanzados"
          data={quotaHits}
          emptyLabel="Ningun cliente ha llegado a su limite. Buena senal (o poco uso)."
        />
      </section>

      <p className="muted text-xs">
        Los eventos se conservan 180 dias y despues se eliminan automaticamente con el trabajo de
        limpieza.
      </p>
    </div>
  );
}
