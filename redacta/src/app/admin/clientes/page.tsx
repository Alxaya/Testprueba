import type { Metadata } from 'next';
import type { Prisma } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';
import { getPlan } from '@/lib/plans';
import { formatDate, formatNumber, pluralize } from '@/lib/utils';

export const metadata: Metadata = { title: 'Clientes' };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ q?: string; pagina?: string }> };

const PAGE_SIZE = 25;

/** Listado de cuentas con su plan, consumo y estado de suscripcion. */
export default async function AdminClientsPage({ searchParams }: Props) {
  await requireAdmin();
  const params = await searchParams;

  const query = params.q?.trim();
  const page = Math.max(1, Number(params.pagina) || 1);

  const where: Prisma.OrganizationWhereInput = query
    ? {
        OR: [
          { name: { contains: query, mode: 'insensitive' } },
          { members: { some: { user: { email: { contains: query, mode: 'insensitive' } } } } },
        ],
      }
    : {};

  const [organizations, total] = await Promise.all([
    prisma.organization.findMany({
      where,
      orderBy: { createdAt: 'desc' },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      include: {
        _count: { select: { generations: true } },
        members: {
          take: 1,
          orderBy: { createdAt: 'asc' },
          include: { user: { select: { email: true, lastLoginAt: true } } },
        },
      },
    }),
    prisma.organization.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-bold">Clientes</h1>
          <p className="muted mt-1">{pluralize(total, 'cuenta registrada', 'cuentas registradas')}</p>
        </div>
        <form action="/admin/clientes" className="flex gap-2">
          <input
            type="search"
            name="q"
            defaultValue={query}
            placeholder="Buscar por nombre o email…"
            className="field max-w-xs"
            aria-label="Buscar clientes"
          />
          <button type="submit" className="btn btn-secondary text-sm">
            Buscar
          </button>
        </form>
      </header>

      <div className="surface scroll-x">
        <table className="w-full min-w-[780px] text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-subtle)' }}>
              <th className="p-3 text-left font-semibold">Cuenta</th>
              <th className="p-3 text-left font-semibold">Plan</th>
              <th className="p-3 text-left font-semibold">Estado</th>
              <th className="p-3 text-right font-semibold">Piezas</th>
              <th className="p-3 text-left font-semibold">Alta</th>
              <th className="p-3 text-left font-semibold">Ultimo acceso</th>
            </tr>
          </thead>
          <tbody>
            {organizations.map((organization) => {
              const owner = organization.members[0]?.user;
              return (
                <tr key={organization.id} className="border-t">
                  <td className="p-3">
                    <span className="block max-w-[220px] truncate font-medium">
                      {organization.name}
                    </span>
                    <span className="muted block max-w-[220px] truncate text-xs">
                      {owner?.email ?? '—'}
                    </span>
                  </td>
                  <td className="p-3">{getPlan(organization.plan).name}</td>
                  <td className="p-3">
                    <span
                      className={`badge ${
                        organization.subscriptionStatus === 'ACTIVE'
                          ? 'border-emerald-300 bg-emerald-50 text-emerald-700'
                          : organization.subscriptionStatus === 'PAST_DUE'
                            ? 'border-red-300 bg-red-50 text-red-700'
                            : 'muted'
                      }`}
                    >
                      {organization.subscriptionStatus}
                    </span>
                  </td>
                  <td className="p-3 text-right tabular-nums">
                    {formatNumber(organization._count.generations)}
                  </td>
                  <td className="muted p-3 text-xs">{formatDate(organization.createdAt)}</td>
                  <td className="muted p-3 text-xs">
                    {owner?.lastLoginAt ? formatDate(owner.lastLoginAt) : '—'}
                  </td>
                </tr>
              );
            })}

            {organizations.length === 0 && (
              <tr>
                <td colSpan={6} className="muted p-8 text-center text-sm">
                  No hay cuentas que coincidan con la busqueda.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <nav className="flex items-center justify-between" aria-label="Paginacion">
          {page > 1 ? (
            <a
              href={`/admin/clientes?pagina=${page - 1}${query ? `&q=${encodeURIComponent(query)}` : ''}`}
              className="btn btn-secondary text-sm"
            >
              ← Anterior
            </a>
          ) : (
            <span />
          )}
          <span className="muted text-sm">
            Pagina {page} de {totalPages}
          </span>
          {page < totalPages ? (
            <a
              href={`/admin/clientes?pagina=${page + 1}${query ? `&q=${encodeURIComponent(query)}` : ''}`}
              className="btn btn-secondary text-sm"
            >
              Siguiente →
            </a>
          ) : (
            <span />
          )}
        </nav>
      )}
    </div>
  );
}
