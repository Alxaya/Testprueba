import Link from 'next/link';
import { GenerationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUserWithOrg } from '@/lib/session';
import { getUsage } from '@/lib/organization';
import { getPlan } from '@/lib/plans';
import { UsageMeter } from '@/components/app/UsageMeter';
import { CONTENT_TYPE_LIST, contentTypeLabel } from '@/lib/ai/content-types';
import { formatDateTime, pluralize } from '@/lib/utils';

export const dynamic = 'force-dynamic';

/** Resumen del panel: consumo, accesos rapidos y actividad reciente. */
export default async function DashboardPage() {
  const { user, organization } = await requireUserWithOrg();

  const [usage, recent, totals] = await Promise.all([
    getUsage(organization),
    prisma.generation.findMany({
      where: { organizationId: organization.id, status: GenerationStatus.COMPLETED },
      orderBy: { createdAt: 'desc' },
      take: 6,
      select: { id: true, title: true, type: true, createdAt: true },
    }),
    prisma.generation.aggregate({
      where: { organizationId: organization.id, status: GenerationStatus.COMPLETED },
      _count: { _all: true },
    }),
  ]);

  const brand = organization.brandProfile;
  const brandFields = [brand?.sector, brand?.audience, brand?.toneOfVoice, brand?.valueProps];
  const brandCompleted = brandFields.filter(Boolean).length;
  const brandIncomplete = brandCompleted < brandFields.length;

  const firstName = user.name?.split(' ')[0];

  return (
    <div className="space-y-8">
      <header>
        <h1 className="text-2xl font-bold">
          Hola{firstName ? `, ${firstName}` : ''} 👋
        </h1>
        <p className="muted mt-1">
          {totals._count._all === 0
            ? 'Aun no has generado contenido. Empieza por una ficha de producto.'
            : `Llevas ${pluralize(totals._count._all, 'pieza creada', 'piezas creadas')} con Redacta.`}
        </p>
      </header>

      {/* Aviso de perfil de marca incompleto: es lo que mas mejora el resultado */}
      {brandIncomplete && (
        <div className="surface border-brand-300 bg-brand-50 p-5 dark:bg-brand-900/20">
          <h2 className="font-semibold">Completa tu perfil de marca ({brandCompleted}/4)</h2>
          <p className="muted mt-1 text-sm">
            Sector, publico, tono y propuesta de valor. Es lo que separa un texto generico de uno que
            suena a tu negocio.
          </p>
          <Link href="/app/marca" className="btn btn-primary mt-3 text-sm">
            Completar ahora
          </Link>
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section>
          <h2 className="mb-3 text-sm font-semibold">Crear contenido</h2>
          <div className="grid gap-3 sm:grid-cols-2">
            {CONTENT_TYPE_LIST.slice(0, 6).map((type) => (
              <Link
                key={type.id}
                href={`/app/generar/${type.slug}`}
                className="surface flex items-start gap-3 p-4 transition-colors hover:border-brand-400"
              >
                <span className="text-xl" aria-hidden>
                  {type.emoji}
                </span>
                <span>
                  <span className="block text-sm font-medium">{type.label}</span>
                  <span className="muted mt-0.5 block text-xs leading-snug">{type.description}</span>
                </span>
              </Link>
            ))}
          </div>
          <Link href="/app/generar" className="muted mt-3 inline-block text-sm hover:text-brand-600">
            Ver todos los formatos →
          </Link>
        </section>

        <aside className="space-y-4">
          <UsageMeter usage={usage} planName={getPlan(organization.plan).name} />
        </aside>
      </div>

      <section>
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-sm font-semibold">Ultimo contenido</h2>
          <Link href="/app/biblioteca" className="muted text-sm hover:text-brand-600">
            Ver biblioteca →
          </Link>
        </div>

        {recent.length === 0 ? (
          <div className="surface p-8 text-center">
            <p className="muted text-sm">
              Todavia no hay nada aqui. Lo que generes aparecera en esta lista.
            </p>
          </div>
        ) : (
          <ul className="surface divide-y">
            {recent.map((item) => (
              <li key={item.id}>
                <Link
                  href={`/app/biblioteca/${item.id}`}
                  className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-ink-50 dark:hover:bg-ink-800/50"
                >
                  <span className="min-w-0">
                    <span className="block truncate text-sm font-medium">{item.title}</span>
                    <span className="muted text-xs">{contentTypeLabel(item.type)}</span>
                  </span>
                  <time className="muted shrink-0 text-xs" dateTime={item.createdAt.toISOString()}>
                    {formatDateTime(item.createdAt)}
                  </time>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
