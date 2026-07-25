import type { Metadata } from 'next';
import Link from 'next/link';
import { notFound } from 'next/navigation';
import { prisma } from '@/lib/prisma';
import { requireUserWithOrg } from '@/lib/session';
import { markdownToHtml } from '@/lib/markdown';
import { CONTENT_TYPES, contentTypeLabel } from '@/lib/ai/content-types';
import { CopyButton } from '@/components/ui/CopyButton';
import { deleteGenerationAction, toggleFavoriteAction } from '@/app/actions/content';
import { formatCurrency, formatDateTime, countWords } from '@/lib/utils';

export const dynamic = 'force-dynamic';

type Props = { params: Promise<{ id: string }> };

export async function generateMetadata({ params }: Props): Promise<Metadata> {
  const { id } = await params;
  const generation = await prisma.generation
    .findUnique({ where: { id }, select: { title: true } })
    .catch(() => null);
  return { title: generation?.title ?? 'Contenido' };
}

/** Ficha de una pieza generada: contenido, metadatos y acciones. */
export default async function GenerationDetailPage({ params }: Props) {
  const { id } = await params;
  const { organization } = await requireUserWithOrg();

  // El filtro por organizacion evita que un id ajeno devuelva contenido.
  const generation = await prisma.generation.findFirst({
    where: { id, organizationId: organization.id },
    include: { project: { select: { name: true } } },
  });

  if (!generation) notFound();

  const def = CONTENT_TYPES[generation.type];
  const output = generation.output ?? '';
  const inputData = (generation.input ?? {}) as Record<string, string>;

  return (
    <div className="space-y-6">
      <div>
        <Link href="/app/biblioteca" className="muted text-sm hover:text-brand-600">
          ← Biblioteca
        </Link>
        <div className="mt-3 flex flex-wrap items-start justify-between gap-3">
          <div className="min-w-0">
            <h1 className="text-xl font-bold sm:text-2xl">{generation.title}</h1>
            <p className="muted mt-1 text-sm">
              {contentTypeLabel(generation.type)} · {formatDateTime(generation.createdAt)}
              {generation.project && ` · ${generation.project.name}`}
            </p>
          </div>

          <div className="flex flex-wrap gap-2">
            <CopyButton text={output} label="Copiar todo" />
            <form action={toggleFavoriteAction}>
              <input type="hidden" name="id" value={generation.id} />
              <button type="submit" className="btn btn-secondary text-sm">
                {generation.favorite ? '★ Quitar' : '☆ Favorito'}
              </button>
            </form>
            <Link href={`/app/generar/${def.slug}`} className="btn btn-primary text-sm">
              Generar otra
            </Link>
          </div>
        </div>
      </div>

      {generation.status === 'FAILED' ? (
        <div className="surface border-red-300 bg-red-50 p-6 dark:bg-red-950/30">
          <h2 className="font-semibold">Esta generacion fallo</h2>
          <p className="muted mt-2 text-sm">{generation.errorMessage ?? 'Error desconocido.'}</p>
          <p className="muted mt-2 text-sm">No se ha descontado de tu cuota.</p>
        </div>
      ) : (
        <article className="surface p-6">
          <div
            className="prose-content"
            // markdownToHtml escapa el HTML antes de generar etiquetas.
            dangerouslySetInnerHTML={{ __html: markdownToHtml(output) }}
          />
        </article>
      )}

      {/* Detalles tecnicos: utiles para soporte y para entender el coste */}
      <details className="surface p-5">
        <summary className="cursor-pointer text-sm font-semibold">Detalles de la generacion</summary>

        <dl className="mt-4 grid gap-4 text-sm sm:grid-cols-2">
          <div>
            <dt className="muted text-xs">Palabras</dt>
            <dd className="font-medium">{countWords(output)}</dd>
          </div>
          <div>
            <dt className="muted text-xs">Modelo</dt>
            <dd className="font-medium">{generation.model ?? '—'}</dd>
          </div>
          <div>
            <dt className="muted text-xs">Tokens (entrada / salida)</dt>
            <dd className="font-medium">
              {generation.inputTokens} / {generation.outputTokens}
            </dd>
          </div>
          <div>
            <dt className="muted text-xs">Tiempo</dt>
            <dd className="font-medium">{(generation.durationMs / 1000).toFixed(1)} s</dd>
          </div>
          <div>
            <dt className="muted text-xs">Coste estimado</dt>
            <dd className="font-medium">{formatCurrency(generation.costCents)}</dd>
          </div>
        </dl>

        <h3 className="mt-6 text-xs font-semibold uppercase tracking-wide">Datos introducidos</h3>
        <dl className="mt-2 space-y-2 text-sm">
          {Object.entries(inputData).map(([key, value]) => {
            const field = def.fields.find((f) => f.name === key);
            return (
              <div key={key}>
                <dt className="muted text-xs">{field?.label ?? key}</dt>
                <dd className="whitespace-pre-wrap">{String(value)}</dd>
              </div>
            );
          })}
        </dl>
      </details>

      <form action={deleteGenerationAction} className="border-t pt-6">
        <input type="hidden" name="id" value={generation.id} />
        <button type="submit" className="btn btn-ghost text-sm text-red-600">
          Eliminar esta pieza
        </button>
      </form>
    </div>
  );
}
