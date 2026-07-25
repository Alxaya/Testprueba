import { GenerationStatus, PlanId, SubscriptionStatus } from '@prisma/client';
import { prisma } from './prisma';
import { PLANS, PLAN_ORDER } from './plans';

/**
 * Metricas de negocio.
 *
 * Se calculan en tiempo real sobre las tablas operativas. Con el volumen de una
 * micro-SaaS es de sobra; el dia que deje de serlo, el sitio donde meter una
 * tabla de agregados diarios es este fichero y solo este.
 */

const DAY = 24 * 60 * 60 * 1000;

export type BusinessSnapshot = {
  /** Ingreso recurrente mensual en centimos. */
  mrrCents: number;
  /** Proyeccion anual simple (MRR x 12). */
  arrCents: number;
  activeSubscriptions: number;
  totalOrganizations: number;
  newOrganizations30d: number;
  pastDue: number;
  canceled30d: number;
  planDistribution: Array<{ plan: PlanId; name: string; count: number }>;
  /** Coste de modelo del mes en curso, en centimos. */
  modelCostCents30d: number;
  /** Margen bruto estimado: MRR menos coste de modelo. */
  grossMarginCents: number;
  generations30d: number;
  failed30d: number;
  averageCostPerGenerationCents: number;
};

export async function getBusinessSnapshot(): Promise<BusinessSnapshot> {
  const since30d = new Date(Date.now() - 30 * DAY);

  const [byPlan, totalOrganizations, newOrganizations30d, pastDue, canceled30d, usage, generations] =
    await Promise.all([
      prisma.organization.groupBy({
        by: ['plan'],
        where: {
          subscriptionStatus: { in: [SubscriptionStatus.ACTIVE, SubscriptionStatus.TRIALING] },
        },
        _count: { _all: true },
      }),
      prisma.organization.count(),
      prisma.organization.count({ where: { createdAt: { gte: since30d } } }),
      prisma.organization.count({ where: { subscriptionStatus: SubscriptionStatus.PAST_DUE } }),
      prisma.organization.count({
        where: { subscriptionStatus: SubscriptionStatus.CANCELED, updatedAt: { gte: since30d } },
      }),
      prisma.usagePeriod.aggregate({
        where: { periodStart: { gte: since30d } },
        _sum: { costCents: true },
      }),
      prisma.generation.groupBy({
        by: ['status'],
        where: { createdAt: { gte: since30d } },
        _count: { _all: true },
      }),
    ]);

  const counts = new Map(byPlan.map((row) => [row.plan, row._count._all]));

  const mrrCents = PLAN_ORDER.reduce(
    (total, plan) => total + PLANS[plan].priceCents * (counts.get(plan) ?? 0),
    0,
  );

  const activeSubscriptions = PLAN_ORDER.filter((p) => p !== PlanId.FREE).reduce(
    (total, plan) => total + (counts.get(plan) ?? 0),
    0,
  );

  const modelCostCents30d = usage._sum.costCents ?? 0;
  const completed = generations.find((g) => g.status === GenerationStatus.COMPLETED)?._count._all ?? 0;
  const failed = generations.find((g) => g.status === GenerationStatus.FAILED)?._count._all ?? 0;

  return {
    mrrCents,
    arrCents: mrrCents * 12,
    activeSubscriptions,
    totalOrganizations,
    newOrganizations30d,
    pastDue,
    canceled30d,
    planDistribution: PLAN_ORDER.map((plan) => ({
      plan,
      name: PLANS[plan].name,
      count: counts.get(plan) ?? 0,
    })),
    modelCostCents30d,
    grossMarginCents: mrrCents - modelCostCents30d,
    generations30d: completed,
    failed30d: failed,
    averageCostPerGenerationCents: completed > 0 ? Math.round(modelCostCents30d / completed) : 0,
  };
}

/** Clientes ordenados por consumo, para detectar quien esta al limite o cuesta dinero. */
export async function getTopOrganizations(limit = 10) {
  const since = new Date(Date.now() - 30 * DAY);

  const rows = await prisma.generation.groupBy({
    by: ['organizationId'],
    where: { createdAt: { gte: since }, status: GenerationStatus.COMPLETED },
    _count: { _all: true },
    _sum: { costCents: true },
    orderBy: { _count: { organizationId: 'desc' } },
    take: limit,
  });

  const organizations = await prisma.organization.findMany({
    where: { id: { in: rows.map((r) => r.organizationId) } },
    select: { id: true, name: true, plan: true },
  });

  const byId = new Map(organizations.map((o) => [o.id, o]));

  return rows.map((row) => ({
    id: row.organizationId,
    name: byId.get(row.organizationId)?.name ?? '—',
    plan: byId.get(row.organizationId)?.plan ?? PlanId.FREE,
    generations: row._count._all,
    costCents: row._sum.costCents ?? 0,
  }));
}
