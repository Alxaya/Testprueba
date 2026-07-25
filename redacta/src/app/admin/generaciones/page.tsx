import type { Metadata } from 'next';
import { GenerationStatus } from '@prisma/client';
import { prisma } from '@/lib/prisma';
import { requireAdmin } from '@/lib/session';
import { contentTypeLabel } from '@/lib/ai/content-types';
import { formatCurrency, formatDateTime, formatNumber, truncate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Generaciones' };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ estado?: string }> };

/**
 * Registro de generaciones. Sirve para dar soporte ("no me funciono esto") y
 * para vigilar la tasa de error del proveedor.
 */
export default async function AdminGenerationsPage({ searchParams }: Props) {
  await requireAdmin();
  const { estado } = await searchParams;

  const statusFilter =
    estado && Object.values(GenerationStatus).includes(estado as GenerationStatus)
      ? (estado as GenerationStatus)
      : undefined;

  const [items, counts] = await Promise.all([
    prisma.generation.findMany({
      where: statusFilter ? { status: statusFilter } : {},
      orderBy: { createdAt: 'desc' },
      take: 60,
      include: {
        organization: { select: { name: true, plan: true } },
        user: { select: { email: true } },
      },
    }),
    prisma.generation.groupBy({ by: ['status'], _count: { _all: true } }),
  ]);

  const countFor = (status: GenerationStatus) =>
    counts.find((c) => c.status === status)?._count._all ?? 0;

  const completed = countFor(GenerationStatus.COMPLETED);
  const failed = countFor(GenerationStatus.FAILED);
  const errorRate = completed + failed > 0 ? Math.round((failed / (completed + failed)) * 100) : 0;

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Generaciones</h1>
        <p className="muted mt-1">
          {formatNumber(completed)} completadas · {formatNumber(failed)} fallidas ({errorRate}% de
          error)
        </p>
      </header>

      <div className="flex flex-wrap gap-2">
        <a href="/admin/generaciones" className={`badge ${!statusFilter ? 'border-brand-300 bg-brand-50 text-brand-700' : 'muted'}`}>
          Todas
        </a>
        <a
          href="/admin/generaciones?estado=COMPLETED"
          className={`badge ${statusFilter === 'COMPLETED' ? 'border-brand-300 bg-brand-50 text-brand-700' : 'muted'}`}
        >
          Completadas
        </a>
        <a
          href="/admin/generaciones?estado=FAILED"
          className={`badge ${statusFilter === 'FAILED' ? 'border-red-300 bg-red-50 text-red-700' : 'muted'}`}
        >
          Fallidas
        </a>
      </div>

      <div className="surface scroll-x">
        <table className="w-full min-w-[820px] text-sm">
          <thead>
            <tr style={{ background: 'var(--bg-subtle)' }}>
              <th className="p-3 text-left font-semibold">Fecha</th>
              <th className="p-3 text-left font-semibold">Cliente</th>
              <th className="p-3 text-left font-semibold">Formato</th>
              <th className="p-3 text-left font-semibold">Estado</th>
              <th className="p-3 text-right font-semibold">Tokens</th>
              <th className="p-3 text-right font-semibold">Coste</th>
              <th className="p-3 text-right font-semibold">Tiempo</th>
            </tr>
          </thead>
          <tbody>
            {items.map((item) => (
              <tr key={item.id} className="border-t">
                <td className="muted p-3 whitespace-nowrap text-xs">
                  {formatDateTime(item.createdAt)}
                </td>
                <td className="p-3">
                  <span className="block max-w-[180px] truncate">{item.organization.name}</span>
                  <span className="muted block max-w-[180px] truncate text-xs">
                    {item.user?.email ?? '—'}
                  </span>
                </td>
                <td className="p-3 text-xs">{contentTypeLabel(item.type)}</td>
                <td className="p-3">
                  {item.status === GenerationStatus.FAILED ? (
                    <span
                      className="badge border-red-300 bg-red-50 text-red-700"
                      title={item.errorMessage ?? undefined}
                    >
                      {truncate(item.errorMessage ?? 'Error', 28)}
                    </span>
                  ) : (
                    <span className="badge border-emerald-300 bg-emerald-50 text-emerald-700">OK</span>
                  )}
                </td>
                <td className="p-3 text-right tabular-nums text-xs">
                  {formatNumber(item.inputTokens)} / {formatNumber(item.outputTokens)}
                </td>
                <td className="p-3 text-right tabular-nums text-xs">
                  {formatCurrency(item.costCents)}
                </td>
                <td className="muted p-3 text-right tabular-nums text-xs">
                  {(item.durationMs / 1000).toFixed(1)} s
                </td>
              </tr>
            ))}

            {items.length === 0 && (
              <tr>
                <td colSpan={7} className="muted p-8 text-center text-sm">
                  Sin generaciones registradas.
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
