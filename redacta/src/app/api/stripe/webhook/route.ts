import { NextResponse, type NextRequest } from 'next/server';
import type Stripe from 'stripe';
import { prisma } from '@/lib/prisma';
import { env, features } from '@/lib/env';
import { clearSubscription, getStripe, syncSubscription } from '@/lib/stripe';
import { getPlan } from '@/lib/plans';
import { sendEmail, templates } from '@/lib/email';
import { EVENTS, track } from '@/lib/analytics';

/**
 * Webhook de Stripe: unica via por la que cambia el plan de una organizacion.
 *
 * Tres garantias:
 *  1. Se verifica la firma antes de leer nada del cuerpo.
 *  2. Se registra el id del evento para no procesarlo dos veces (Stripe
 *     reintenta hasta recibir un 2xx).
 *  3. Los errores devuelven 500 a proposito, para que Stripe reintente.
 */

// El cuerpo debe llegar sin transformar para poder verificar la firma.
export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  if (!features.stripe) {
    return NextResponse.json({ error: 'Stripe no configurado' }, { status: 503 });
  }

  const signature = request.headers.get('stripe-signature');
  if (!signature) return NextResponse.json({ error: 'Falta la firma' }, { status: 400 });

  const payload = await request.text();

  let event: Stripe.Event;
  try {
    event = getStripe().webhooks.constructEvent(payload, signature, env.STRIPE_WEBHOOK_SECRET!);
  } catch (error) {
    console.error('[stripe] firma invalida', error);
    return NextResponse.json({ error: 'Firma invalida' }, { status: 400 });
  }

  // Idempotencia: si el evento ya se proceso, se confirma sin repetir efectos.
  const already = await prisma.processedWebhook.findUnique({
    where: { stripeEventId: event.id },
    select: { id: true },
  });
  if (already) return NextResponse.json({ received: true, duplicated: true });

  try {
    await handleEvent(event);

    await prisma.processedWebhook.create({
      data: { stripeEventId: event.id, type: event.type },
    });

    return NextResponse.json({ received: true });
  } catch (error) {
    console.error(`[stripe] error procesando ${event.type}`, error);
    // 500 hace que Stripe reintente con backoff: preferimos reintentar a
    // perder un cambio de suscripcion.
    return NextResponse.json({ error: 'Error interno' }, { status: 500 });
  }
}

async function handleEvent(event: Stripe.Event): Promise<void> {
  const stripe = getStripe();

  switch (event.type) {
    /** Alta o cambio de plan completado. */
    case 'checkout.session.completed': {
      const session = event.data.object as Stripe.Checkout.Session;
      if (!session.subscription) break;

      const subscriptionId =
        typeof session.subscription === 'string' ? session.subscription : session.subscription.id;
      const subscription = await stripe.subscriptions.retrieve(subscriptionId);
      await syncSubscription(subscription);

      const organizationId = session.metadata?.organizationId;
      if (organizationId) {
        const organization = await prisma.organization.findUnique({ where: { id: organizationId } });
        if (organization) {
          await track({
            name: EVENTS.SUBSCRIPTION_ACTIVATED,
            organizationId,
            props: { plan: organization.plan },
          });

          const owner = await prisma.membership.findFirst({
            where: { organizationId },
            include: { user: { select: { email: true } } },
            orderBy: { createdAt: 'asc' },
          });

          if (owner?.user.email) {
            await sendEmail({
              to: owner.user.email,
              template: 'subscription-activated',
              organizationId,
              email: templates.subscriptionActivated(getPlan(organization.plan).name),
            });
          }
        }
      }
      break;
    }

    /** Cualquier cambio de estado, plan o renovacion. */
    case 'customer.subscription.created':
    case 'customer.subscription.updated': {
      await syncSubscription(event.data.object as Stripe.Subscription);
      break;
    }

    /** Baja definitiva: vuelve a plan gratuito. */
    case 'customer.subscription.deleted': {
      const subscription = event.data.object as Stripe.Subscription;
      const customerId =
        typeof subscription.customer === 'string' ? subscription.customer : subscription.customer.id;

      await clearSubscription(customerId);

      const organization = await prisma.organization.findFirst({
        where: { stripeCustomerId: customerId },
        select: { id: true },
      });
      if (organization) {
        await track({ name: EVENTS.SUBSCRIPTION_CANCELED, organizationId: organization.id });
      }
      break;
    }

    /** Cobro fallido: avisamos para que actualicen la tarjeta. */
    case 'invoice.payment_failed': {
      const invoice = event.data.object as Stripe.Invoice;
      const customerId =
        typeof invoice.customer === 'string' ? invoice.customer : invoice.customer?.id;
      if (!customerId) break;

      const organization = await prisma.organization.findFirst({
        where: { stripeCustomerId: customerId },
        select: { id: true },
      });
      if (!organization) break;

      const owner = await prisma.membership.findFirst({
        where: { organizationId: organization.id },
        include: { user: { select: { email: true } } },
        orderBy: { createdAt: 'asc' },
      });

      if (owner?.user.email) {
        await sendEmail({
          to: owner.user.email,
          template: 'payment-failed',
          organizationId: organization.id,
          email: templates.paymentFailed(),
        });
      }
      break;
    }

    default:
      // El resto de eventos no nos afectan; se confirman igualmente para que
      // Stripe no los reintente.
      break;
  }
}
