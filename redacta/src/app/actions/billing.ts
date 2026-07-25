'use server';

import { redirect } from 'next/navigation';
import { PlanId } from '@prisma/client';
import { requireUserWithOrg } from '@/lib/session';
import { createCheckoutSession, createPortalSession, StripeNotConfiguredError } from '@/lib/stripe';
import { EVENTS, track } from '@/lib/analytics';
import type { ActionState } from './content';

/**
 * Acciones de facturacion.
 *
 * Nunca modifican el plan en base de datos: eso lo hace exclusivamente el
 * webhook de Stripe cuando el pago se confirma. Aqui solo se abren sesiones
 * alojadas por Stripe.
 */

export async function startCheckoutAction(
  _prev: ActionState,
  formData: FormData,
): Promise<ActionState> {
  const { user, organization } = await requireUserWithOrg();

  const planId = String(formData.get('planId') ?? '') as PlanId;
  if (!Object.values(PlanId).includes(planId) || planId === PlanId.FREE) {
    return { error: 'Plan no valido.' };
  }

  let url: string;
  try {
    url = await createCheckoutSession({ organization, email: user.email, planId });
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return {
        error: 'Los pagos aun no estan configurados en este entorno. Revisa docs/05-stripe.md.',
      };
    }
    console.error('[billing] no se pudo crear la sesion de checkout', error);
    return { error: 'No hemos podido abrir el proceso de pago. Intentalo de nuevo.' };
  }

  await track({
    name: EVENTS.CHECKOUT_STARTED,
    organizationId: organization.id,
    userId: user.id,
    props: { planId },
  });

  redirect(url);
}

export async function openPortalAction(
  _prev: ActionState,
  _formData: FormData,
): Promise<ActionState> {
  const { user, organization } = await requireUserWithOrg();

  let url: string;
  try {
    url = await createPortalSession(organization, user.email);
  } catch (error) {
    if (error instanceof StripeNotConfiguredError) {
      return { error: 'Los pagos aun no estan configurados en este entorno.' };
    }
    console.error('[billing] no se pudo abrir el portal de cliente', error);
    return { error: 'No hemos podido abrir el portal de facturacion.' };
  }

  redirect(url);
}
