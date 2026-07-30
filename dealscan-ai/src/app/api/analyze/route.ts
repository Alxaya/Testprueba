import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { consumeAnonymousQuota, consumeQuota, QuotaExceededError } from "@/lib/quota";
import { persistAnalysis, runAnalysis } from "@/lib/analysis-service";
import { RATE_LIMITS, clientIp, rateLimit } from "@/lib/rate-limit";
import { apiError, handleApiError, NO_STORE } from "@/lib/api";
import { getEnv } from "@/lib/env";

/** Límite de tamaño por imagen y en total, antes de decodificar base64. */
const MAX_IMAGE_BYTES = 5 * 1024 * 1024;
const MAX_TOTAL_IMAGE_BYTES = 15 * 1024 * 1024;
const MAX_IMAGES = 4;

const imageSchema = z.object({
  base64: z.string().min(32, "La imagen está vacía."),
  mediaType: z.enum(["image/jpeg", "image/png", "image/webp", "image/gif"]),
});

const schema = z
  .object({
    url: z.string().trim().max(2000).optional().nullable(),
    text: z.string().trim().max(20_000).optional().nullable(),
    images: z.array(imageSchema).max(MAX_IMAGES).optional(),
    /** Precio en euros que indica el usuario a mano (opcional). */
    priceEur: z.number().positive().max(100_000).optional().nullable(),
    condition: z.enum(["new", "like_new", "good", "fair", "poor"]).optional().nullable(),
    /** Si false, el análisis no se guarda en el historial. */
    save: z.boolean().default(true),
  })
  .refine(
    (data) => Boolean(data.url?.trim() || data.text?.trim() || (data.images?.length ?? 0) > 0),
    { message: "Aporta el enlace, el texto o una captura del anuncio." },
  );

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request.headers);
    const burst = rateLimit(`analyze:${ip}`, RATE_LIMITS.analyze);
    if (!burst.allowed) {
      return apiError(
        `Vas demasiado rápido. Espera ${burst.retryAfterSeconds} segundos.`,
        429,
        "rate_limited",
      );
    }

    const body = schema.parse(await request.json());
    const images = body.images ?? [];

    // Validación de tamaño antes de trabajar con las imágenes.
    let totalBytes = 0;
    for (const image of images) {
      const bytes = Buffer.byteLength(image.base64, "base64");
      if (bytes > MAX_IMAGE_BYTES) {
        return apiError(
          `Cada captura debe pesar menos de ${Math.round(MAX_IMAGE_BYTES / 1024 / 1024)} MB.`,
          413,
          "image_too_large",
        );
      }
      totalBytes += bytes;
    }
    if (totalBytes > MAX_TOTAL_IMAGE_BYTES) {
      return apiError(
        `El conjunto de capturas supera los ${Math.round(MAX_TOTAL_IMAGE_BYTES / 1024 / 1024)} MB.`,
        413,
        "images_too_large",
      );
    }

    const user = await getCurrentUser();
    const env = getEnv();

    // --- Cuota -------------------------------------------------------------
    let quota;
    if (user) {
      quota = await consumeQuota(user.id, user.plan);
    } else {
      if (env.ANONYMOUS_DAILY_LIMIT === 0) {
        return apiError(
          "Crea una cuenta gratuita para analizar anuncios: incluye 5 análisis al día.",
          401,
          "unauthorized",
        );
      }
      quota = consumeAnonymousQuota(ip);
      if (!quota.allowed) {
        return apiError(
          `Has usado los ${quota.limit} análisis de prueba sin cuenta. Regístrate gratis para tener ${env.FREE_DAILY_LIMIT} análisis al día.`,
          429,
          "anonymous_quota_exceeded",
          { limit: quota.limit, resetsAt: quota.resetsAt.toISOString() },
        );
      }
    }

    // --- Análisis ----------------------------------------------------------
    const outcome = await runAnalysis({
      url: body.url ?? null,
      text: body.text ?? null,
      images,
      priceOverrideCents: body.priceEur != null ? Math.round(body.priceEur * 100) : null,
      conditionOverride: body.condition ?? null,
    });

    // --- Persistencia ------------------------------------------------------
    // Solo se guarda si hay usuario: sin cuenta no se almacena nada del anuncio.
    let analysisId: string | null = null;
    if (user && body.save) {
      const saved = await persistAnalysis({ userId: user.id, outcome, images });
      analysisId = saved.id;
    }

    return NextResponse.json(
      {
        id: analysisId,
        report: outcome.report,
        warnings: outcome.warnings,
        durationMs: outcome.durationMs,
        quota: {
          plan: quota.plan,
          limit: quota.limit,
          used: quota.used,
          remaining: quota.remaining,
          resetsAt: quota.resetsAt.toISOString(),
        },
        saved: analysisId !== null,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    if (error instanceof QuotaExceededError) return handleApiError(error);
    return handleApiError(error);
  }
}
