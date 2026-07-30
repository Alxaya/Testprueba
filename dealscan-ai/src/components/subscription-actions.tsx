"use client";

import { useState } from "react";

/**
 * Botones de contratación y de portal de facturación.
 * Redirigen a Stripe; si Stripe no está configurado, el error del servidor se
 * muestra tal cual —incluyendo qué variable falta— en lugar de fingir un pago.
 */
export function SubscriptionActions({
  isPremium,
  hasCustomer,
  stripeReady,
}: {
  isPremium: boolean;
  hasCustomer: boolean;
  stripeReady: boolean;
}) {
  const [loading, setLoading] = useState<"checkout" | "portal" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function go(endpoint: "checkout" | "portal") {
    setLoading(endpoint);
    setError(null);
    try {
      const response = await fetch(`/api/stripe/${endpoint}`, { method: "POST" });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "No se ha podido continuar con el pago.");
        return;
      }
      window.location.href = data.url;
    } catch {
      setError("No se ha podido conectar con la pasarela de pago.");
    } finally {
      setLoading(null);
    }
  }

  return (
    <div>
      <div className="flex flex-wrap gap-3">
        {!isPremium && (
          <button
            type="button"
            onClick={() => go("checkout")}
            disabled={loading !== null || !stripeReady}
            className="btn btn-primary"
            title={stripeReady ? undefined : "Stripe no está configurado en este entorno"}
          >
            {loading === "checkout" ? "Abriendo el pago…" : "Pasar a Premium — 4,99 €/mes"}
          </button>
        )}

        {hasCustomer && (
          <button
            type="button"
            onClick={() => go("portal")}
            disabled={loading !== null}
            className="btn btn-ghost"
          >
            {loading === "portal" ? "Abriendo el portal…" : "Gestionar facturación"}
          </button>
        )}
      </div>

      {error && (
        <p
          role="alert"
          className="mt-4 rounded-xl border border-bad/30 bg-bad-soft px-4 py-3 text-sm leading-relaxed text-bad"
        >
          {error}
        </p>
      )}
    </div>
  );
}
