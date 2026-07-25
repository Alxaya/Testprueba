import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUserWithOrg } from '@/lib/session';
import { getUsage } from '@/lib/organization';
import { CONTENT_TYPE_LIST, contentTypeBySlug } from '@/lib/ai/content-types';
import { GenerationForm } from '@/components/app/GenerationForm';
import { features } from '@/lib/env';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ slug: string }> };

export function generateStaticParams() {
  return CONTENT_TYPE_LIST.map((t) => ({ slug: t.slug }));
}

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { slug } = await params;
  const def = contentTypeBySlug(slug);
  return { title: def ? `Generar: ${def.label}` : 'Generar contenido' };
}

export default async function GenerateFormPage({ params }: Props) {
  const { slug } = await params;
  const def = contentTypeBySlug(slug);
  if (!def) notFound();

  const { organization } = await requireUserWithOrg();

  const [projects, usage] = await Promise.all([
    prisma.project.findMany({
      where: { organizationId: organization.id, archived: false },
      orderBy: { createdAt: 'asc' },
      select: { id: true, name: true },
    }),
    getUsage(organization),
  ]);

  const brand = organization.brandProfile;
  const hasBrand = Boolean(brand?.sector || brand?.audience || brand?.toneOfVoice);

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/generar" className="muted text-sm hover:text-brand-600">
          ← Todos los formatos
        </Link>
        <h1 className="mt-3 flex items-center gap-2 text-2xl font-bold">
          <span aria-hidden>{def.emoji}</span>
          {def.label}
        </h1>
        <p className="muted mt-1">{def.description}</p>
      </div>

      {!features.ai && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          El motor de IA no esta configurado en este entorno: falta{' '}
          <code>ANTHROPIC_API_KEY</code>. Ver <code>docs/04-ia.md</code>.
        </div>
      )}

      {!hasBrand && (
        <div className="surface p-4 text-sm">
          <strong>Consejo:</strong> completa tu{' '}
          <Link href="/app/marca" className="text-brand-600 underline">
            perfil de marca
          </Link>{' '}
          antes de generar. El resultado cambia bastante.
        </div>
      )}

      <div className="surface p-6">
        <GenerationForm
          def={{
            slug: def.slug,
            label: def.label,
            emoji: def.emoji,
            description: def.description,
            defaultWords: def.defaultWords,
            fields: def.fields,
          }}
          projects={projects}
          quotaExhausted={usage.remaining === 0}
        />
      </div>
    </div>
  );
}
