import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getQuotaStatus } from "@/lib/quota";
import { hasStripe } from "@/lib/env";
import { SubscriptionActions } from "@/components/subscription-actions";
import { fullDate } from "@/lib/format";

export const metadata: Metadata = { title: "Suscripción" };
export const dynamic = "force-dynamic";

const STATUS_LABELS: Record<string, string> = {
  NONE: "Sin suscripción",
  ACTIVE: "Activa",
  TRIALING: "En periodo de prueba",
  PAST_DUE: "Pago pendiente",
  CANCELED: "Cancelada",
};

export default async function SubscriptionPage({
  searchParams,
}: {
  searchParams: Promise<{ estado?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const [record, quota] = await Promise.all([
    prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: {
        plan: true,
        subscriptionStatus: true,
        currentPeriodEnd: true,
        stripeCustomerId: true,
      },
    }),
    getQuotaStatus(user.id, user.plan),
  ]);

  const stripeReady = hasStripe();
  const isPremium = record.plan === "PREMIUM";

  return (
    <div className="max-w-3xl space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Suscripción</h1>
        <p className="mt-1 text-sm text-text-muted">
          Gestiona tu plan. Los pagos los procesa Stripe; DealScan AI no almacena datos de tarjeta.
        </p>
      </header>

      {params.estado === "ok" && (
        <p className="card border-good/30 bg-good-soft p-4 text-sm text-text">
          Pago completado. Si el plan todavía aparece como gratuito, recarga en unos segundos: la
          activación llega por webhook desde Stripe.
        </p>
      )}
      {params.estado === "cancelado" && (
        <p className="card border-warn/30 bg-warn-soft p-4 text-sm text-text">
          Has salido del pago sin completarlo. No se ha realizado ningún cargo.
        </p>
      )}

      <section className="card p-5 sm:p-6">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted">
              Tu plan actual
            </p>
            <p className="mt-1 text-2xl font-bold">{isPremium ? "Premium" : "Gratuito"}</p>
            <p className="mt-1 text-sm text-text-muted">
              Estado: {STATUS_LABELS[record.subscriptionStatus] ?? record.subscriptionStatus}
              {record.currentPeriodEnd && (
                <> · {isPremium ? "se renueva" : "válido hasta"} el {fullDate(record.currentPeriodEnd)}</>
              )}
            </p>
          </div>

          <div className="rounded-xl bg-surface-2 px-4 py-3">
            <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted">
              Análisis hoy
            </p>
            <p className="tnum mt-0.5 text-lg font-bold">
              {quota.limit === null ? `${quota.used} · ilimitados` : `${quota.used} / ${quota.limit}`}
            </p>
          </div>
        </div>

        <div className="mt-6">
          <SubscriptionActions
            isPremium={isPremium}
            hasCustomer={Boolean(record.stripeCustomerId)}
            stripeReady={stripeReady}
          />
        </div>

        {!stripeReady && (
          <div className="mt-5 rounded-xl border border-warn/30 bg-warn-soft p-4">
            <p className="text-sm font-semibold">La pasarela de pago no está configurada</p>
            <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
              Para activar las suscripciones hay que definir estas variables de entorno con datos
              reales de la cuenta de Stripe (dashboard.stripe.com):
            </p>
            <ul className="mt-2.5 space-y-1 font-mono text-xs text-text-muted">
              <li>STRIPE_SECRET_KEY — clave secreta (sk_live_… o sk_test_…)</li>
              <li>STRIPE_WEBHOOK_SECRET — secreto del endpoint /api/stripe/webhook (whsec_…)</li>
              <li>STRIPE_PRICE_ID_PREMIUM_MONTHLY — ID del precio recurrente (price_…)</li>
              <li>NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY — clave pública (pk_…)</li>
            </ul>
            <p className="mt-2.5 text-xs text-text-muted">
              Hasta entonces el botón de contratación devuelve un error explícito en lugar de
              simular una suscripción.
            </p>
          </div>
        )}
      </section>

      <section className="grid gap-4 sm:grid-cols-2">
        <div className="card p-5">
          <h2 className="font-semibold">Plan gratuito</h2>
          <p className="tnum mt-2 text-2xl font-bold">0 €</p>
          <ul className="mt-4 space-y-2 text-sm text-text-muted">
            {[
              "5 análisis al día",
              "Informe completo",
              "Historial y favoritos",
              "Comparador de 2 anuncios",
              "Enlaces para compartir",
            ].map((feature) => (
              <li key={feature}>· {feature}</li>
            ))}
          </ul>
        </div>

        <div className="card border-accent/40 p-5 ring-1 ring-accent/20">
          <h2 className="font-semibold">Premium</h2>
          <p className="tnum mt-2 text-2xl font-bold">
            4,99 € <span className="text-sm font-normal text-text-muted">/ mes</span>
          </p>
          <ul className="mt-4 space-y-2 text-sm text-text-muted">
            {[
              "Análisis ilimitados",
              "Exportación en PDF",
              "Comparador ilimitado",
              "Historial ilimitado",
              "Análisis prioritario",
              "Cancela cuando quieras",
            ].map((feature) => (
              <li key={feature}>· {feature}</li>
            ))}
          </ul>
        </div>
      </section>
    </div>
  );
}
