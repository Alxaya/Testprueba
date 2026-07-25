import { PlanId } from '@prisma/client';
import { env } from './env';

/**
 * Catalogo comercial.
 *
 * Vive en codigo (no en base de datos) a proposito: cambiar precios o limites
 * es un despliegue, queda en el historial de git y no requiere migracion.
 * Lo unico que se guarda en la BD es que plan tiene cada organizacion.
 */

export type PlanLimits = {
  /** Generaciones de contenido incluidas por periodo de facturacion. */
  generationsPerMonth: number;
  /** Tope de palabras por pieza (evita que una sola llamada dispare el coste). */
  maxWordsPerGeneration: number;
  /** Proyectos simultaneos. */
  projects: number;
  /** Usuarios en la organizacion. */
  seats: number;
};

export type Plan = {
  id: PlanId;
  name: string;
  tagline: string;
  /** Precio mensual en centimos de euro, IVA no incluido. */
  priceCents: number;
  limits: PlanLimits;
  /** Ventajas mostradas en la pagina de precios, en orden. */
  features: string[];
  /** Marca visualmente el plan recomendado. */
  highlighted?: boolean;
  /** ID de precio en Stripe. Null en el plan gratuito. */
  stripePriceId: string | null;
};

export const PLANS: Record<PlanId, Plan> = {
  FREE: {
    id: PlanId.FREE,
    name: 'Gratis',
    tagline: 'Para probar el motor sin tarjeta.',
    priceCents: 0,
    limits: { generationsPerMonth: 5, maxWordsPerGeneration: 400, projects: 1, seats: 1 },
    features: [
      '5 generaciones al mes',
      'Fichas de producto y metadatos SEO',
      '1 proyecto',
      'Perfil de marca basico',
    ],
    stripePriceId: null,
  },
  STARTER: {
    id: PlanId.STARTER,
    name: 'Starter',
    tagline: 'Para tiendas que publican cada semana.',
    priceCents: 1900,
    limits: { generationsPerMonth: 100, maxWordsPerGeneration: 1200, projects: 3, seats: 1 },
    features: [
      '100 generaciones al mes',
      'Todos los tipos de contenido',
      '3 proyectos',
      'Perfil de marca completo',
      'Exportacion a Markdown y CSV',
      'Soporte por email',
    ],
    stripePriceId: env.STRIPE_PRICE_STARTER_MONTHLY ?? null,
  },
  PRO: {
    id: PlanId.PRO,
    name: 'Pro',
    tagline: 'Para catalogos grandes y contenido continuo.',
    priceCents: 4900,
    limits: { generationsPerMonth: 500, maxWordsPerGeneration: 2500, projects: 15, seats: 3 },
    features: [
      '500 generaciones al mes',
      'Generacion por lotes de catalogo',
      '15 proyectos',
      'Hasta 3 usuarios',
      'Calendario de contenido para redes',
      'Soporte prioritario',
    ],
    highlighted: true,
    stripePriceId: env.STRIPE_PRICE_PRO_MONTHLY ?? null,
  },
  BUSINESS: {
    id: PlanId.BUSINESS,
    name: 'Business',
    tagline: 'Para agencias y equipos con varias marcas.',
    priceCents: 9900,
    limits: { generationsPerMonth: 2000, maxWordsPerGeneration: 4000, projects: 100, seats: 10 },
    features: [
      '2.000 generaciones al mes',
      'Proyectos ilimitados en la practica (100)',
      'Hasta 10 usuarios',
      'Multiples perfiles de marca',
      'Acceso a la API',
      'Soporte con SLA',
    ],
    stripePriceId: env.STRIPE_PRICE_BUSINESS_MONTHLY ?? null,
  },
};

/** Orden de presentacion en la pagina de precios. */
export const PLAN_ORDER: PlanId[] = [PlanId.FREE, PlanId.STARTER, PlanId.PRO, PlanId.BUSINESS];

export function getPlan(id: PlanId): Plan {
  return PLANS[id];
}

/** Resuelve el plan a partir de un price ID de Stripe (usado por el webhook). */
export function planFromStripePriceId(priceId: string | null | undefined): PlanId {
  if (!priceId) return PlanId.FREE;
  const match = PLAN_ORDER.find((id) => PLANS[id].stripePriceId === priceId);
  return match ?? PlanId.FREE;
}

/** Formatea centimos como precio en euros: 1900 -> "19 €". */
export function formatPrice(cents: number): string {
  if (cents === 0) return '0 €';
  const euros = cents / 100;
  return `${euros % 1 === 0 ? euros.toFixed(0) : euros.toFixed(2).replace('.', ',')} €`;
}

// ---------------------------------------------------------------------------
// Coste del modelo
// ---------------------------------------------------------------------------

/**
 * Tarifas de Claude Opus 5 en dolares por millon de tokens.
 * Se usan para estimar el margen por cliente, no para facturar.
 */
const USD_PER_MTOK_INPUT = 5;
const USD_PER_MTOK_OUTPUT = 25;
/** Tipo de cambio conservador USD -> EUR. */
const USD_TO_EUR = 0.92;

/** Coste estimado de una generacion, en centimos de euro. */
export function estimateCostCents(inputTokens: number, outputTokens: number): number {
  const usd =
    (inputTokens / 1_000_000) * USD_PER_MTOK_INPUT + (outputTokens / 1_000_000) * USD_PER_MTOK_OUTPUT;
  return Math.round(usd * USD_TO_EUR * 100);
}
