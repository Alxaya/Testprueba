import "server-only";

import { NextResponse } from "next/server";
import { ZodError } from "zod";
import { UnauthorizedError } from "./auth";
import { QuotaExceededError } from "./quota";
import { AnalysisInputError } from "./analysis-service";
import { ListingFetchError } from "./fetch-listing";
import { StripeNotConfiguredError } from "./stripe";

/**
 * Traducción de errores a respuestas HTTP.
 *
 * Principio: el usuario recibe siempre un mensaje que explica qué ha pasado y
 * qué puede hacer. Los detalles internos (trazas, SQL) se registran en el
 * servidor pero nunca se devuelven al cliente.
 */

export interface ApiErrorBody {
  error: string;
  code: string;
  /** Datos adicionales útiles para la interfaz (cuota restante, etc.). */
  meta?: Record<string, unknown>;
}

export function apiError(
  message: string,
  status: number,
  code: string,
  meta?: Record<string, unknown>,
): NextResponse<ApiErrorBody> {
  return NextResponse.json({ error: message, code, ...(meta ? { meta } : {}) }, { status });
}

export function handleApiError(error: unknown): NextResponse<ApiErrorBody> {
  if (error instanceof UnauthorizedError) {
    return apiError("Necesitas iniciar sesión para continuar.", 401, "unauthorized");
  }

  if (error instanceof QuotaExceededError) {
    return apiError(error.message, 429, "quota_exceeded", {
      limit: error.limit,
      resetsAt: error.resetsAt.toISOString(),
    });
  }

  if (error instanceof AnalysisInputError) {
    return apiError(error.message, 400, "invalid_input");
  }

  if (error instanceof ListingFetchError) {
    return apiError(error.message, 400, `fetch_${error.code}`);
  }

  if (error instanceof StripeNotConfiguredError) {
    return apiError(error.message, 503, "stripe_not_configured", { missing: error.missing });
  }

  if (error instanceof ZodError) {
    const first = error.issues[0];
    return apiError(
      first ? `${first.path.join(".") || "campo"}: ${first.message}` : "Datos no válidos.",
      400,
      "validation_error",
      { issues: error.issues.map((i) => ({ path: i.path.join("."), message: i.message })) },
    );
  }

  // Errores no previstos: se registran completos y se responde en genérico.
  console.error("[dealscan] error no controlado:", error);
  return apiError(
    "Se ha producido un error inesperado. Vuelve a intentarlo en unos segundos.",
    500,
    "internal_error",
  );
}

/** Cabeceras para respuestas que nunca deben cachearse. */
export const NO_STORE = { "Cache-Control": "no-store, max-age=0" } as const;
