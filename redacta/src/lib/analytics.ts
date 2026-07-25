import { prisma } from './prisma';

/**
 * Analitica propia, sin cookies ni terceros.
 *
 * Se guardan los eventos en nuestra base de datos: cumple RGPD sin banner de
 * cookies (no se usa almacenamiento en el navegador ni identificadores
 * persistentes), y permite cruzar producto con negocio en las mismas consultas.
 *
 * Los fallos al registrar un evento nunca deben romper la peticion del usuario:
 * todo va envuelto en try/catch.
 */

export const EVENTS = {
  PAGEVIEW: 'pageview',
  SIGNUP: 'signup',
  LOGIN: 'login',
  GENERATION_CREATED: 'generation_created',
  GENERATION_FAILED: 'generation_failed',
  QUOTA_REACHED: 'quota_reached',
  CHECKOUT_STARTED: 'checkout_started',
  SUBSCRIPTION_ACTIVATED: 'subscription_activated',
  SUBSCRIPTION_CANCELED: 'subscription_canceled',
  BRAND_PROFILE_UPDATED: 'brand_profile_updated',
} as const;

export type EventName = (typeof EVENTS)[keyof typeof EVENTS] | (string & {});

export type TrackInput = {
  name: EventName;
  organizationId?: string | null;
  userId?: string | null;
  anonymousId?: string | null;
  path?: string | null;
  referrer?: string | null;
  utmSource?: string | null;
  utmMedium?: string | null;
  utmCampaign?: string | null;
  country?: string | null;
  device?: string | null;
  props?: Record<string, unknown> | null;
};

/** Registra un evento. Nunca lanza. */
export async function track(input: TrackInput): Promise<void> {
  try {
    await prisma.analyticsEvent.create({
      data: {
        name: input.name,
        organizationId: input.organizationId ?? null,
        userId: input.userId ?? null,
        anonymousId: input.anonymousId ?? null,
        path: input.path ?? null,
        referrer: input.referrer ?? null,
        utmSource: input.utmSource ?? null,
        utmMedium: input.utmMedium ?? null,
        utmCampaign: input.utmCampaign ?? null,
        country: input.country ?? null,
        device: input.device ?? null,
        props: (input.props ?? undefined) as never,
      },
    });
  } catch (error) {
    console.error('[analytics] no se pudo registrar el evento', input.name, error);
  }
}

/** Deduce el tipo de dispositivo a partir del user-agent. */
export function deviceFromUserAgent(ua: string | null | undefined): string {
  if (!ua) return 'unknown';
  const s = ua.toLowerCase();
  if (/(ipad|tablet)/.test(s)) return 'tablet';
  if (/(mobi|android|iphone)/.test(s)) return 'mobile';
  if (/(bot|crawler|spider)/.test(s)) return 'bot';
  return 'desktop';
}

// ---------------------------------------------------------------------------
// Consultas agregadas para los paneles
// ---------------------------------------------------------------------------

export type DailyPoint = { day: string; count: number };

/** Serie diaria de un evento en los ultimos N dias. */
export async function dailySeries(name: EventName, days = 30): Promise<DailyPoint[]> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.$queryRaw<Array<{ day: Date; count: bigint }>>`
    SELECT date_trunc('day', "createdAt") AS day, COUNT(*) AS count
    FROM "AnalyticsEvent"
    WHERE "name" = ${name} AND "createdAt" >= ${since}
    GROUP BY 1
    ORDER BY 1 ASC
  `;
  return rows.map((r) => ({ day: r.day.toISOString().slice(0, 10), count: Number(r.count) }));
}

/** Recuento por evento en una ventana temporal. */
export async function countsByEvent(days = 30): Promise<Array<{ name: string; count: number }>> {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.analyticsEvent.groupBy({
    by: ['name'],
    where: { createdAt: { gte: since } },
    _count: { _all: true },
    orderBy: { _count: { name: 'desc' } },
  });
  return rows.map((r) => ({ name: r.name, count: r._count._all }));
}

/** Fuentes de trafico mas frecuentes. */
export async function topSources(days = 30, limit = 8) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);
  const rows = await prisma.analyticsEvent.groupBy({
    by: ['utmSource'],
    where: { createdAt: { gte: since }, name: EVENTS.PAGEVIEW },
    _count: { _all: true },
    orderBy: { _count: { utmSource: 'desc' } },
    take: limit,
  });
  return rows.map((r) => ({ source: r.utmSource ?? 'directo', count: r._count._all }));
}

/**
 * Embudo de adquisicion.
 *
 * Cada paso cuenta **identidades unicas**, no eventos: un visitante que ve seis
 * paginas es uno, y una cuenta que genera veinte piezas es una. Contar eventos
 * brutos produce embudos donde un paso posterior supera al anterior, que es
 * justo lo que un embudo no debe hacer.
 */
export async function funnel(days = 30) {
  const since = new Date(Date.now() - days * 24 * 60 * 60 * 1000);

  const steps = [
    { key: EVENTS.PAGEVIEW, label: 'Visitantes', identity: 'anonymousId' as const },
    { key: EVENTS.SIGNUP, label: 'Registros', identity: 'event' as const },
    { key: EVENTS.GENERATION_CREATED, label: 'Han creado contenido', identity: 'organizationId' as const },
    { key: EVENTS.CHECKOUT_STARTED, label: 'Checkout iniciado', identity: 'organizationId' as const },
    { key: EVENTS.SUBSCRIPTION_ACTIVATED, label: 'Suscripciones', identity: 'organizationId' as const },
  ];

  const counts = await Promise.all(
    steps.map(async (step) => {
      if (step.identity === 'event') {
        return prisma.analyticsEvent.count({ where: { name: step.key, createdAt: { gte: since } } });
      }

      // COUNT(DISTINCT ...) no tiene equivalente directo en la API de Prisma.
      const column = step.identity;
      const rows =
        column === 'anonymousId'
          ? await prisma.$queryRaw<Array<{ total: bigint }>>`
              SELECT COUNT(DISTINCT "anonymousId") AS total
              FROM "AnalyticsEvent"
              WHERE "name" = ${step.key} AND "createdAt" >= ${since} AND "anonymousId" IS NOT NULL
            `
          : await prisma.$queryRaw<Array<{ total: bigint }>>`
              SELECT COUNT(DISTINCT "organizationId") AS total
              FROM "AnalyticsEvent"
              WHERE "name" = ${step.key} AND "createdAt" >= ${since} AND "organizationId" IS NOT NULL
            `;

      return Number(rows[0]?.total ?? 0);
    }),
  );

  const top = counts[0] || 1;
  return steps.map((step, i) => ({
    label: step.label,
    count: counts[i],
    percent: Math.min(100, Math.round((counts[i] / top) * 100)),
  }));
}
