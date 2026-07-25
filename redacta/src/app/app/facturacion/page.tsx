import type { Metadata } from 'next';
import { PlanId, SubscriptionStatus } from '@prisma/client';
import { requireUserWithOrg } from '@/lib/session';
import { getUsage } from '@/lib/organization';
import { PLANS, PLAN_ORDER, formatPrice, getPlan } from '@/lib/plans';
import { UsageMeter } from '@/components/app/UsageMeter';
import { ActionForm } from '@/components/ui/ActionForm';
import { openPortalAction, startCheckoutAction } from '@/app/actions/billing';
import { features } from '@/lib/env';
import { formatDate } from '@/lib/utils';

export const metadata: Metadata = { title: 'Facturacion' };
export const dynamic = 'force-dynamic';

type Props = { searchParams: Promise<{ estado?: string }> };

const STATUS_LABEL: Record<SubscriptionStatus, string> = {
  NONE: 'Sin suscripcion',
  TRIALING: 'Periodo de prueba',
  ACTIVE: 'Activa',
  PAST_DUE: 'Pago pendiente',
  CANCELED: 'Cancelada',
  INCOMPLETE: 'Incompleta',
};

export default async function BillingPage({ searchParams }: Props) {
  const { organization } = await requireUserWithOrg();
  const { estado } = await searchParams;
  const usage = await getUsage(organization);
  const currentPlan = getPlan(organization.plan);

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold">Facturacion</h1>
        <p className="muted mt-1">Tu plan, tu consumo y tus facturas.</p>
      </header>

      {estado === 'ok' && (
        <p
          role="status"
          className="rounded-lg border border-emerald-300 bg-emerald-50 px-4 py-3 text-sm text-emerald-700 dark:border-emerald-900 dark:bg-emerald-950 dark:text-emerald-300"
        >
          Pago completado. Si el plan aun aparece como antes, actualiza en unos segundos: estamos
          confirmando el cobro con Stripe.
        </p>
      )}
      {estado === 'cancelado' && (
        <p className="muted rounded-lg border px-4 py-3 text-sm">
          Has salido del proceso de pago. No se ha realizado ningun cargo.
        </p>
      )}

      {!features.stripe && (
        <div className="rounded-lg border border-amber-300 bg-amber-50 px-4 py-3 text-sm text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
          Los pagos no estan configurados en este entorno, asi que todas las cuentas funcionan con
          los limites del plan gratuito. Ver <code>docs/05-stripe.md</code>.
        </div>
      )}

      <div className="grid gap-6 lg:grid-cols-[1fr_300px]">
        <section className="surface p-6">
          <h2 className="text-sm font-semibold">Suscripcion actual</h2>
          <p className="mt-3 text-2xl font-bold">
            Plan {currentPlan.name}
            {currentPlan.priceCents > 0 && (
              <span className="muted text-base font-normal"> · {formatPrice(currentPlan.priceCents)}/mes</span>
            )}
          </p>

          <dl className="muted mt-4 space-y-1.5 text-sm">
            <div className="flex justify-between gap-4">
              <dt>Estado</dt>
              <dd className="font-medium">{STATUS_LABEL[organization.subscriptionStatus]}</dd>
            </div>
            {organization.stripeCurrentPeriodEnd && (
              <div className="flex justify-between gap-4">
                <dt>{organization.cancelAtPeriodEnd ? 'Acceso hasta' : 'Proxima renovacion'}</dt>
                <dd className="font-medium">{formatDate(organization.stripeCurrentPeriodEnd)}</dd>
              </div>
            )}
          </dl>

          {organization.cancelAtPeriodEnd && (
            <p className="mt-4 rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-xs text-amber-800 dark:border-amber-800 dark:bg-amber-950 dark:text-amber-200">
              Tu suscripcion se cancelara al final del periodo. Puedes reactivarla desde el portal.
            </p>
          )}

          {organization.stripeCustomerId && features.stripe && (
            <div className="mt-5 border-t pt-5">
              <ActionForm
                action={openPortalAction}
                submitLabel="Gestionar suscripcion y facturas"
                pendingLabel="Abriendo…"
                className="space-y-3"
              >
                <p className="muted text-sm">
                  Cambia la tarjeta, descarga facturas o cancela desde el portal seguro de Stripe.
                </p>
              </ActionForm>
            </div>
          )}
        </section>

        <UsageMeter usage={usage} planName={currentPlan.name} />
      </div>

      <section>
        <h2 className="mb-4 text-sm font-semibold">Cambiar de plan</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {PLAN_ORDER.map((id) => {
            const plan = PLANS[id];
            const isCurrent = id === organization.plan;

            return (
              <div
                key={id}
                className={`surface flex flex-col p-5 ${isCurrent ? 'border-brand-500 ring-1 ring-brand-500' : ''}`}
              >
                <h3 className="font-semibold">{plan.name}</h3>
                <p className="mt-2 text-2xl font-bold">
                  {formatPrice(plan.priceCents)}
                  {plan.priceCents > 0 && <span className="muted text-sm font-normal">/mes</span>}
                </p>
                <p className="muted mt-1 text-xs">
                  {plan.limits.generationsPerMonth} generaciones al mes
                </p>

                <div className="mt-4 flex-1" />

                {isCurrent ? (
                  <span className="badge justify-center">Plan actual</span>
                ) : id === PlanId.FREE ? (
                  <p className="muted text-center text-xs">
                    Se aplica automaticamente al cancelar
                  </p>
                ) : (
                  <ActionForm
                    action={startCheckoutAction}
                    submitLabel={`Cambiar a ${plan.name}`}
                    pendingLabel="Abriendo pago…"
                    className="space-y-2"
                  >
                    <input type="hidden" name="planId" value={id} />
                  </ActionForm>
                )}
              </div>
            );
          })}
        </div>
        <p className="muted mt-4 text-xs">
          Los cambios de plan se prorratean automaticamente. Precios sin IVA.
        </p>
      </section>
    </div>
  );
}
