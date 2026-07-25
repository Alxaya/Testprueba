import type { Metadata } from 'next';
import Link from 'next/link';
import { ContentType, GenerationStatus, type Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireUserWithOrg } from '@/lib/session';
import { CONTENT_TYPE_LIST, contentTypeLabel } from '@/lib/ai/content-types';
import { formatDateTime, pluralize } from '@/lib/utils';

export const metadata: Metadata = { title: 'Biblioteca' };
export const dynamic = 'force-dynamic';

type Props = {
  searchParams: Promise<{ tipo?: string; q?: string; favoritos?: string; pagina?: string }>;
};

const PAGE_SIZE = 20;

/** Biblioteca de contenido con filtros por formato, texto y favoritos. */
export default async function LibraryPage({ searchParams }: Props) {
  const { organization } = await requireUserWithOrg();
  const params = await searchParams;

  const page = Math.max(1, Number(params.pagina) || 1);
  const typeFilter = CONTENT_TYPE_LIST.find((t) => t.slug === params.tipo)?.id;
  const query = params.q?.trim();
  const onlyFavorites = params.favoritos === '1';

  const where: Prisma.GenerationWhereInput = {
    organizationId: organization.id,
    status: GenerationStatus.COMPLETED,
    ...(typeFilter ? { type: typeFilter as ContentType } : {}),
    ...(onlyFavorites ? { favorite: true } : {}),
    ...(query ? { title: { contains: query, mode: 'insensitive' as const } } : {}),
  };

  const [items, total] = await Promise.all([
    prisma.generation.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: {
        id: true,
        title: true,
        type: true,
        createdAt: true,
        favorite: true,
        project: { select: { name: true } },
      },
    }),
    prisma.generation.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  /** Conserva los filtros activos al construir enlaces. */
  const linkWith = (overrides: Record<string, string | undefined>) => {
    const sp = new URLSearchParams();
    const merged = { tipo: params.tipo, q: query, favoritos: params.favoritos, ...overrides };
    for (const [key, value] of Object.entries(merged)) {
      if (value) sp.set(key, value);
    }
    const qs = sp.toString();
    return qs ? `/app/biblioteca?${qs}` : '/app/biblioteca';
  };

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Biblioteca</h1>
          <p className="muted mt-1">{pluralize(total, 'pieza guardada', 'piezas guardadas')}</p>
        </div>
        <Link href="/app/generar" className="btn btn-primary text-sm">
          ✨ Crear contenido
        </Link>
      </header>

      {/* Filtros */}
      <div className="space-y-3">
        <form action="/app/biblioteca" className="flex flex-wrap gap-2">
          {params.tipo && <input type="hidden" name="tipo" value={params.tipo} />}
          {params.favoritos && <input type="hidden" name="favoritos" value={params.favoritos} />}
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Buscar por titulo…"
            className="field max-w-xs"
            aria-label="Buscar en la biblioteca"
          />
          <button type="submit" className="btn btn-secondary text-sm">
            Buscar
          </button>
        </form>

        <div className="scroll-x flex gap-2 pb-1">
          <Link
            href={linkWith({ tipo: undefined, pagina: undefined })}
            className={`badge whitespace-nowrap ${!params.tipo ? 'border-brand-300 bg-brand-50 text-brand-700' : 'muted'}`}
          >
            Todos
          </Link>
          {CONTENT_TYPE_LIST.map((type) => (
            <Link
              key={type.id}
              href={linkWith({ tipo: type.slug, pagina: undefined })}
              className={`badge whitespace-nowrap ${params.tipo === type.slug ? 'border-brand-300 bg-brand-50 text-brand-700' : 'muted'}`}
            >
              {type.emoji} {type.label}
            </Link>
          ))}
          <Link
            href={linkWith({ favoritos: onlyFavorites ? undefined : '1', pagina: undefined })}
            className={`badge whitespace-nowrap ${onlyFavorites ? 'border-amber-300 bg-amber-50 text-amber-700' : 'muted'}`}
          >
            ★ Favoritos
          </Link>
        </div>
      </div>

      {/* Resultados */}
      {items.length === 0 ? (
        <div className="surface p-10 text-center">
          <p className="muted text-sm">
            {total === 0 && !query && !params.tipo
              ? 'Tu biblioteca esta vacia. Genera tu primera pieza de contenido.'
              : 'No hay resultados con estos filtros.'}
          </p>
          <Link href="/app/generar" className="btn btn-primary mt-4 text-sm">
            Crear contenido
          </Link>
        </div>
      ) : (
        <ul className="surface divide-y">
          {items.map((item) => (
            <li key={item.id}>
              <Link
                href={`/app/biblioteca/${item.id}`}
                className="flex items-center justify-between gap-4 px-4 py-3 transition-colors hover:bg-ink-50 dark:hover:bg-ink-800/50"
              >
                <span className="min-w-0">
                  <span className="flex items-center gap-1.5">
                    {item.favorite && (
                      <span className="text-amber-500" aria-label="Favorito">
                        ★
                      </span>
                    )}
                    <span className="truncate text-sm font-medium">{item.title}</span>
                  </span>
                  <span className="muted mt-0.5 block text-xs">
                    {contentTypeLabel(item.type)}
                    {item.project && ` · ${item.project.name}`}
                  </span>
                </span>
                <time className="muted shrink-0 text-xs" dateTime={item.createdAt.toISOString()}>
                  {formatDateTime(item.createdAt)}
                </time>
              </Link>
            </li>
          ))}
        </ul>
      )}

      {/* Paginacion */}
      {totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Paginacion">
          {page > 1 ? (
            <Link href={linkWith({ pagina: String(page - 1) })} className="btn btn-secondary text-sm">
              ← Anterior
            </Link>
          ) : (
            <span />
          )}
          <span className="muted text-sm">
            Pagina {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <Link href={linkWith({ pagina: String(page + 1) })} className="btn btn-secondary text-sm">
              Siguiente →
            </Link>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
