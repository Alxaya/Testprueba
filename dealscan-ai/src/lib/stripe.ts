import "server-only";

import Stripe from "stripe";
import { getEnv, hasStripe, missingStripeVars } from "./env";

/**
 * Integración de Stripe para la suscripción Premium.
 *
 * Credenciales necesarias (todas se obtienen en dashboard.stripe.com):
 *   STRIPE_SECRET_KEY                 — clave secreta (sk_live_… / sk_test_…)
 *   STRIPE_WEBHOOK_SECRET             — secreto del endpoint de webhook (whsec_…)
 *   STRIPE_PRICE_ID_PREMIUM_MONTHLY   — ID del precio recurrente (price_…)
 *   NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — clave pública (pk_…), solo para el cliente
 *
 * Si falta alguna, las rutas de pago responden 503 diciendo exactamente cuál:
 * no hay modo simulado ni suscripciones ficticias.
 */

let stripe: Stripe | null = null;

export class StripeNotConfiguredError extends Error {
  readonly missing: string[];

  constructor() {
    const missing = missingStripeVars();
    super(
      `Stripe no está configurado. Falta${missing.length > 1 ? "n" : ""} ${missing.join(", ")}. ` +
        "Consíguelas en dashboard.stripe.com y añádelas a las variables de entorno (ver .env.example).",
    );
    this.name = "StripeNotConfiguredError";
    this.missing = missing;
  }
}

export function getStripe(): Stripe {
  if (!hasStripe()) throw new StripeNotConfiguredError();
  if (!stripe) {
    stripe = new Stripe(getEnv().STRIPE_SECRET_KEY!, {
      apiVersion: "2025-08-27.basil",
      typescript: true,
      maxNetworkRetries: 2,
    });
  }
  return stripe;
}

export { hasStripe };

/** Crea la sesión de pago para la suscripción Premium. */
export async function createCheckoutSession(args: {
  userId: string;
  email: string;
  stripeCustomerId: string | null;
}): Promise<{ url: string; customerId: string }> {
  const env = getEnv();
  const client = getStripe();

  // Se reutiliza el cliente si ya existe para no duplicar fichas en Stripe.
  let customerId = args.stripeCustomerId;
  if (!customerId) {
    const customer = await client.customers.create({
      email: args.email,
      metadata: { userId: args.userId },
    });
    customerId = customer.id;
  }

  const session = await client.checkout.sessions.create({
    mode: "subscription",
    customer: customerId,
    line_items: [{ price: env.STRIPE_PRICE_ID_PREMIUM_MONTHLY!, quantity: 1 }],
    success_url: `${env.APP_URL}/panel/suscripcion?estado=ok`,
    cancel_url: `${env.APP_URL}/panel/suscripcion?estado=cancelado`,
    allow_promotion_codes: true,
    billing_address_collection: "auto",
    // Referencia cruzada: permite localizar al usuario desde el webhook incluso
    // si el cliente de Stripe se creó por otra vía.
    client_reference_id: args.userId,
    subscription_data: { metadata: { userId: args.userId } },
    metadata: { userId: args.userId },
  });

  if (!session.url) {
    throw new Error("Stripe no ha devuelto una URL de pago.");
  }
  return { url: session.url, customerId };
}

/** Portal de cliente: permite cancelar o cambiar el método de pago. */
export async function createBillingPortalSession(customerId: string): Promise<string> {
  const env = getEnv();
  const session = await getStripe().billingPortal.sessions.create({
    customer: customerId,
    return_url: `${env.APP_URL}/panel/suscripcion`,
  });
  return session.url;
}

/** Traduce el estado de Stripe al enum del modelo de datos. */
export function mapSubscriptionStatus(
  status: Stripe.Subscription.Status,
): "ACTIVE" | "TRIALING" | "PAST_DUE" | "CANCELED" | "NONE" {
  switch (status) {
    case "active":
      return "ACTIVE";
    case "trialing":
      return "TRIALING";
    case "past_due":
    case "unpaid":
      return "PAST_DUE";
    case "canceled":
    case "incomplete_expired":
      return "CANCELED";
    default:
      return "NONE";
  }
}
