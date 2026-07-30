import { type NextRequest } from "next/server";
import type Stripe from "stripe";
import { prisma } from "@/lib/db";
import { getEnv } from "@/lib/env";
import { getStripe, mapSubscriptionStatus } from "@/lib/stripe";
import { apiError } from "@/lib/api";

/**
 * Webhook de Stripe: única fuente de verdad del estado de la suscripción.
 *
 * Garantías:
 *  - La firma se verifica siempre con STRIPE_WEBHOOK_SECRET sobre el cuerpo en
 *    bruto. Sin firma válida no se procesa nada.
 *  - Idempotencia: cada `event.id` se registra en la tabla `StripeEvent` y los
 *    reenvíos de Stripe se descartan sin volver a aplicar cambios.
 *  - Se responde 200 aunque el evento no interese, para que Stripe no reintente.
 *
 * En local: `stripe listen --forward-to localhost:3000/api/stripe/webhook`
 */

const RELEVANT_EVENTS = new Set<Stripe.Event.Type>([
  "checkout.session.completed",
  "customer.subscription.created",
  "customer.subscription.updated",
  "customer.subscription.deleted",
  "invoice.payment_failed",
]);

export async function POST(request: NextRequest) {
  const signature = request.headers.get("stripe-signature");
  if (!signature) {
    return apiError("Falta la firma de Stripe.", 400, "missing_signature");
  }

  const env = getEnv();
  if (!env.STRIPE_WEBHOOK_SECRET) {
    return apiError(
      "Falta STRIPE_WEBHOOK_SECRET: el webhook no puede verificar la firma.",
      503,
      "stripe_not_configured",
    );
  }

  // El cuerpo debe leerse en bruto: cualquier reserialización invalida la firma.
  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET);
  } catch (error) {
    console.error("[dealscan] firma de webhook no válida:", error);
    return apiError("Firma de webhook no válida.", 400, "invalid_signature");
  }

  if (!RELEVANT_EVENTS.has(event.type)) {
    return Response.json({ received: true, ignored: event.type });
  }

  // Idempotencia: si el evento ya se procesó, no se vuelve a aplicar.
  try {
    await prisma.stripeEvent.create({ data: { id: event.id, type: event.type } });
  } catch {
    return Response.json({ received: true, duplicate: true });
  }

  try {
    await processEvent(event);
  } catch (error) {
    // Si falla el procesado se borra el registro para que el reintento de
    // Stripe pueda volver a aplicarlo.
    await prisma.stripeEvent.delete({ where: { id: event.id } }).catch(() => {});
    console.error(`[dealscan] error procesando ${event.type}:`, error);
    return apiError("Error procesando el evento.", 500, "processing_error");
  }

  return Response.json({ received: true });
}

async function processEvent(event: Stripe.Event): Promise<void> {
  switch (event.type) {
    case "checkout.session.completed": {
      const session = event.data.object;
      const userId =
        session.client_reference_id ?? (session.metadata?.userId as string | undefined);
      const customerId = typeof session.customer === "string" ? session.customer : null;
      const subscriptionId =
        typeof session.subscription === "string" ? session.subscription : null;

      if (!userId || !subscriptionId) return;

      // Se consulta la suscripción para conocer su estado real y su vigencia.
      const subscription = await getStripe().subscriptions.retrieve(subscriptionId);
      await applySubscription(userId, customerId, subscription);
      return;
    }

    case "customer.subscription.created":
    case "customer.subscription.updated":
    case "customer.subscription.deleted": {
      const subscription = event.data.object;
      const customerId =
        typeof subscription.customer === "string" ? subscription.customer : null;
      const userId = await resolveUserId(
        subscription.metadata?.userId as string | undefined,
        customerId,
      );
      if (!userId) return;
      await applySubscription(userId, customerId, subscription);
      return;
    }

    case "invoice.payment_failed": {
      const invoice = event.data.object;
      const customerId = typeof invoice.customer === "string" ? invoice.customer : null;
      if (!customerId) return;
      await prisma.user.updateMany({
        where: { stripeCustomerId: customerId },
        data: { subscriptionStatus: "PAST_DUE" },
      });
      return;
    }

    default:
      return;
  }
}

/** Busca el usuario por metadato y, si no está, por cliente de Stripe. */
async function resolveUserId(
  metadataUserId: string | undefined,
  customerId: string | null,
): Promise<string | null> {
  if (metadataUserId) {
    const byId = await prisma.user.findUnique({
      where: { id: metadataUserId },
      select: { id: true },
    });
    if (byId) return byId.id;
  }
  if (customerId) {
    const byCustomer = await prisma.user.findUnique({
      where: { stripeCustomerId: customerId },
      select: { id: true },
    });
    if (byCustomer) return byCustomer.id;
  }
  return null;
}

async function applySubscription(
  userId: string,
  customerId: string | null,
  subscription: Stripe.Subscription,
): Promise<void> {
  const status = mapSubscriptionStatus(subscription.status);
  // Solo "active" y "trialing" dan acceso Premium. Un impago mantiene la cuenta
  // pero baja al plan gratuito hasta que se regularice.
  const plan = status === "ACTIVE" || status === "TRIALING" ? "PREMIUM" : "FREE";

  const periodEndSeconds =
    subscription.items.data[0]?.current_period_end ??
    (subscription as unknown as { current_period_end?: number }).current_period_end;

  await prisma.user.update({
    where: { id: userId },
    data: {
      plan,
      subscriptionStatus: status,
      stripeSubscriptionId: subscription.id,
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      currentPeriodEnd:
        typeof periodEndSeconds === "number" ? new Date(periodEndSeconds * 1000) : null,
    },
  });
}
