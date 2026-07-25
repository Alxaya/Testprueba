import { MemberRole, PlanId, type Organization, type Prisma } from '@prisma/client';
import { prisma } from './prisma';
import { uniqueSlug, currentPeriod } from './utils';
import { getPlan } from './plans';

/**
 * Acceso a la organizacion activa del usuario y control de cuotas.
 *
 * Regla del producto: un usuario pertenece hoy a una sola organizacion. El
 * modelo de datos ya soporta varias, asi que estas funciones devuelven "la
 * primera" y seran el unico punto a tocar cuando se abran los equipos.
 */

export type OrganizationWithBrand = Prisma.OrganizationGetPayload<{
  include: { brandProfile: true };
}>;

/** Crea la organizacion del usuario si aun no tiene ninguna. Idempotente. */
export async function ensureOrganization(userId: string, displayName: string): Promise<Organization> {
  const existing = await prisma.membership.findFirst({
    where: { userId },
    include: { organization: true },
    orderBy: { createdAt: 'asc' },
  });
  if (existing) return existing.organization;

  const name = displayName.trim() || 'Mi negocio';

  return prisma.organization.create({
    data: {
      name,
      slug: uniqueSlug(name),
      members: { create: { userId, role: MemberRole.OWNER } },
      brandProfile: { create: {} },
      projects: {
        create: {
          name: 'Proyecto principal',
          description: 'Proyecto creado automaticamente al registrarte.',
        },
      },
    },
  });
}

/** Organizacion activa del usuario, con su perfil de marca. */
export async function getOrganizationForUser(userId: string): Promise<OrganizationWithBrand | null> {
  const membership = await prisma.membership.findFirst({
    where: { userId },
    include: { organization: { include: { brandProfile: true } } },
    orderBy: { createdAt: 'asc' },
  });
  return membership?.organization ?? null;
}

// ---------------------------------------------------------------------------
// Cuotas
// ---------------------------------------------------------------------------

export type UsageSummary = {
  used: number;
  limit: number;
  remaining: number;
  percent: number;
  periodStart: Date;
  periodEnd: Date;
  words: number;
  costCents: number;
};

/**
 * Devuelve (creandolo si hace falta) el contador de uso del periodo actual.
 * El periodo se ancla al de Stripe cuando hay suscripcion activa; si no, al
 * mes natural.
 */
export async function getOrCreateUsagePeriod(org: Organization) {
  const { start, end } = currentPeriod(org.stripeCurrentPeriodEnd);

  return prisma.usagePeriod.upsert({
    where: { organizationId_periodStart: { organizationId: org.id, periodStart: start } },
    update: {},
    create: { organizationId: org.id, periodStart: start, periodEnd: end },
  });
}

export async function getUsage(org: Organization): Promise<UsageSummary> {
  const period = await getOrCreateUsagePeriod(org);
  const limit = getPlan(org.plan).limits.generationsPerMonth;
  const used = period.generations;

  return {
    used,
    limit,
    remaining: Math.max(0, limit - used),
    percent: limit === 0 ? 100 : Math.min(100, Math.round((used / limit) * 100)),
    periodStart: period.periodStart,
    periodEnd: period.periodEnd,
    words: period.words,
    costCents: period.costCents,
  };
}

/** Comprueba la cuota antes de llamar al modelo. */
export async function assertWithinQuota(org: Organization): Promise<
  { ok: true } | { ok: false; reason: string; usage: UsageSummary }
> {
  const usage = await getUsage(org);
  if (usage.remaining > 0) return { ok: true };

  const plan = getPlan(org.plan);
  return {
    ok: false,
    usage,
    reason:
      org.plan === PlanId.FREE
        ? `Has agotado las ${plan.limits.generationsPerMonth} generaciones del plan gratuito. Elige un plan para seguir creando contenido.`
        : `Has alcanzado el limite de ${plan.limits.generationsPerMonth} generaciones de tu plan ${plan.name} en este periodo.`,
  };
}

/** Suma el consumo de una generacion al periodo en curso. */
export async function recordUsage(
  org: Organization,
  data: { words: number; inputTokens: number; outputTokens: number; costCents: number },
): Promise<void> {
  const period = await getOrCreateUsagePeriod(org);
  await prisma.usagePeriod.update({
    where: { id: period.id },
    data: {
      generations: { increment: 1 },
      words: { increment: data.words },
      inputTokens: { increment: data.inputTokens },
      outputTokens: { increment: data.outputTokens },
      costCents: { increment: data.costCents },
    },
  });
}
