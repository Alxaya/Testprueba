import Stripe from 'stripe';
import { PlanId, SubscriptionStatus, type Organization } from '@prisma/client';
import { env, features } from './env';
import { prisma } from './prisma';
import { PLANS, planFromStripePriceId } from './plans';

/**
 * Integracion con Stripe.
 *
 * Stripe es la fuente de verdad de la facturacion; nuestra base de datos guarda
 * una copia del estado para poder decidir limites sin llamar a su API en cada
 * peticion. Esa copia se actualiza siempre desde el webhook (ver
 * `src/app/api/stripe/webhook/route.ts`), nunca desde el navegador.
 */

export class StripeNotConfiguredError extends Error {
  constructor() {
    super('Stripe no esta configurado: faltan STRIPE_SECRET_KEY o STRIPE_WEBHOOK_SECRET.');
    this.name = 'StripeNotConfiguredError';
  }
}

let stripeClient: Stripe | null = null;

export function getStripe(): Stripe {
  if (!features.stripe) throw new StripeNotConfiguredError();
  stripeClient ??= new Stripe(env.STRIPE_SECRET_KEY!, { typescript: true });
  return stripeClient;
}

/** Traduce el estado de Stripe al enum interno. */
export function mapStatus(status: Stripe.Subscription.Status | undefined): SubscriptionStatus {
  switch (status) {
    case 'trialing':
      return SubscriptionStatus.TRIALING;
    case 'active':
      return SubscriptionStatus.ACTIVE;
    case 'past_due':
    case 'unpaid':
      return SubscriptionStatus.PAST_DUE;
    case 'canceled':
      return SubscriptionStatus.CANCELED;
    case 'incomplete':
    case 'incomplete_expired':
      return SubscriptionStatus.INCOMPLETE;
    default:
      return SubscriptionStatus.NONE;
  }
}

/** Devuelve (creandolo si hace falta) el cliente de Stripe de la organizacion. */
export async function ensureCustomer(org: Organization, email: string): Promise<string> {
  if (org.stripeCustomerId) return org.stripeCustomerId;

  const stripe = getStripe();
  const customer = await stripe.customers.create({
    email,
    name: org.name,
    metadata: { organizationId: org.id },
  });

  await prisma.organization.update({
    where: { id: org.id },
    data: { stripeCustomerId: customer.id },
  });

  return customer.id;
}

/** Sesion de Checkout para contratar o cambiar de plan. */
export async function createCheckoutSession(args: {
  organization: Organization;
  email: string;
  planId: PlanId;
}): Promise<string> {
  const plan = PLANS[args.planId];
  if (!plan.stripePriceId) {
    throw new Error(`El plan ${plan.name} no tiene precio configurado en Stripe.`);
  }

  const stripe = getStripe();
  const customerId = await ensureCustomer(args.organization, args.email);

  const session = await stripe.checkout.sessions.create({
    mode: 'subscription',
    customer: customerId,
    line_items: [{ price: plan.stripePriceId, quantity: 1 }],
    success_url: `${env.NEXT_PUBLIC_APP_URL}/app/facturacion?estado=ok`,
    cancel_url: `${env.NEXT_PUBLIC_APP_URL}/app/facturacion?estado=cancelado`,
    allow_promotion_codes: true,
    billing_address_collection: 'required',
    // Necesario para facturar con IVA correctamente en la UE.
    tax_id_collection: { enabled: true },
    subscription_data: {
      metadata: { organizationId: args.organization.id, planId: args.planId },
    },
    metadata: { organizationId: args.organization.id, planId: args.planId },
  });

  if (!session.url) throw new Error('Stripe no devolvio una URL de checkout.');
  return session.url;
}

/** Portal de cliente: cambio de tarjeta, facturas y bajas. */
export async function createPortalSession(organization: Organization, email: string): Promise<string> {
  const stripe = getStripe();
  const customerId = await ensureCustomer(organization, email);

  const session = await stripe.billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.NEXT_PUBLIC_APP_URL}/app/facturacion`,
  });

  return session.url;
}

/**
 * Vuelca el estado de una suscripcion de Stripe a la organizacion.
 * Idempotente: se puede llamar tantas veces como reintente Stripe.
 */
export async function syncSubscription(subscription: Stripe.Subscription): Promise<void> {
  const customerId =
    typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

  const organization = await prisma.organization.findFirst({
    where: {
      OR: [
        { stripeCustomerId: customerId },
        { id: (subscription.metadata?.organizationId as string | undefined) ?? '__none__' },
      ],
    },
  });

  if (!organization) {
    console.warn('[stripe] suscripcion sin organizacion asociada', subscription.id);
    return;
  }

  const item = subscription.items.data[0];
  const priceId = item?.price?.id ?? null;
  const status = mapStatus(subscription.status);
  const active = status === SubscriptionStatus.ACTIVE || status === SubscriptionStatus.TRIALING;

  // El fin de periodo vive en el item de la suscripcion en la API actual.
  const periodEndSeconds =
    (item as unknown as { current_period_end?: number } | undefined)?.current_period_end ??
    (subscription as unknown as { current_period_end?: number }).current_period_end;

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      stripeCustomerId: customerId,
      stripeSubscriptionId: subscription.id,
      stripePriceId: priceId,
      subscriptionStatus: status,
      // Si la suscripcion deja de estar activa, el cliente vuelve a FREE:
      // conserva sus datos pero con los limites del plan gratuito.
      plan: active ? planFromStripePriceId(priceId) : PlanId.FREE,
      cancelAtPeriodEnd: subscription.cancel_at_period_end ?? false,
      stripeCurrentPeriodEnd: periodEndSeconds ? new Date(periodEndSeconds * 1000) : null,
    },
  });
}

/** Marca la organizacion como sin suscripcion tras una baja definitiva. */
export async function clearSubscription(customerId: string): Promise<void> {
  const organization = await prisma.organization.findFirst({ where: { stripeCustomerId: customerId } });
  if (!organization) return;

  await prisma.organization.update({
    where: { id: organization.id },
    data: {
      plan: PlanId.FREE,
      subscriptionStatus: SubscriptionStatus.CANCELED,
      stripeSubscriptionId: null,
      stripePriceId: null,
      cancelAtPeriodEnd: false,
      stripeCurrentPeriodEnd: null,
    },
  });
}
