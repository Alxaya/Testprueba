import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { prisma } from "./db";
import { hasAI } from "./env";
import { extractWithAI, type AIImageInput } from "./ai/anthropic";
import { fetchListing } from "./fetch-listing";
import { analyze } from "./valuation/engine";
import { extractAttributes, mergeAttributes } from "./valuation/extract";
import type { AnalysisReport } from "./valuation/types";
import type { InputKind, Prisma } from "@prisma/client";

/**
 * Orquestador del análisis: reúne las entradas, pide a la IA los atributos,
 * los cruza con el extractor determinista y ejecuta el motor de valoración.
 *
 * Orden de responsabilidades (importante para que ningún dato sea inventado):
 *   1. Recolección de texto: pegado por el usuario, descargado del enlace, o
 *      leído de las capturas por la IA.
 *   2. Extracción de atributos: IA (si hay clave) + reglas, con las reglas
 *      actuando de verificación.
 *   3. Valoración: 100 % determinista sobre el catálogo de referencia.
 */

export interface AnalyzeRequest {
  url?: string | null;
  text?: string | null;
  images?: AIImageInput[];
  /** Precio indicado a mano por el usuario, en céntimos (prevalece si existe). */
  priceOverrideCents?: number | null;
  /** Estado indicado a mano por el usuario. */
  conditionOverride?: "new" | "like_new" | "good" | "fair" | "poor" | null;
}

export interface AnalyzeOutcome {
  report: AnalysisReport;
  /** Texto finalmente analizado (lo ve el usuario en el informe). */
  sourceText: string;
  inputKind: InputKind;
  sourceUrl: string | null;
  durationMs: number;
  /** Avisos no bloqueantes: por ejemplo que la IA no estaba disponible. */
  warnings: string[];
}

export class AnalysisInputError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "AnalysisInputError";
  }
}

export async function runAnalysis(request: AnalyzeRequest): Promise<AnalyzeOutcome> {
  const started = Date.now();
  const warnings: string[] = [];
  const images = request.images ?? [];

  const pastedText = request.text?.trim() ?? "";
  const url = request.url?.trim() || null;

  if (!pastedText && !url && images.length === 0) {
    throw new AnalysisInputError(
      "Necesito al menos una de estas tres cosas: el enlace del anuncio, su texto o una captura de pantalla.",
    );
  }

  // --- 1. Recolección del texto -------------------------------------------
  const parts: string[] = [];
  let inputKind: InputKind = "TEXT";
  let resolvedUrl: string | null = null;

  if (pastedText) {
    parts.push(pastedText);
  }

  if (url) {
    inputKind = "URL";
    try {
      const fetched = await fetchListing(url);
      resolvedUrl = fetched.url;
      if (fetched.title) parts.push(fetched.title);
      parts.push(fetched.text);
    } catch (error) {
      // Si el enlace no se puede leer pero hay texto o capturas, se sigue con
      // esas fuentes y se avisa. Solo es un error si no queda nada que analizar.
      const message = error instanceof Error ? error.message : "No se ha podido leer el enlace.";
      if (!pastedText && images.length === 0) {
        throw new AnalysisInputError(message);
      }
      resolvedUrl = url;
      warnings.push(message);
    }
  }

  if (images.length > 0 && !pastedText && !resolvedUrl) {
    inputKind = "IMAGE";
  }

  // --- 2. Extracción de atributos -----------------------------------------
  const aiResult = await extractWithAI({
    text: parts.join("\n\n"),
    images,
  });

  if (!aiResult) {
    if (!hasAI()) {
      warnings.push(
        "La identificación por IA no está activada (falta ANTHROPIC_API_KEY), así que el producto se ha identificado con el analizador por reglas. Los cálculos de precio son idénticos: no dependen de la IA.",
      );
    } else {
      warnings.push(
        "La identificación por IA no ha estado disponible en esta consulta; el análisis se ha completado con el analizador por reglas.",
      );
    }
    if (images.length > 0) {
      warnings.push(
        "Las capturas no se han podido analizar porque la lectura de imágenes requiere la IA. Añade el texto del anuncio para un análisis completo.",
      );
    }
  }

  // El texto que ve el motor incluye lo observado en las imágenes por la IA:
  // así las reglas de riesgo también pueden actuar sobre esos hallazgos.
  const sourceText = [
    parts.join("\n\n"),
    ...(aiResult?.visualFindings.length
      ? [`Observado en las imágenes: ${aiResult.visualFindings.join("; ")}`]
      : []),
  ]
    .filter((s) => s.trim().length > 0)
    .join("\n\n");

  if (sourceText.trim().length === 0) {
    throw new AnalysisInputError(
      "No se ha podido leer nada del anuncio. Pega el texto del anuncio para poder analizarlo.",
    );
  }

  const ruleAttributes = extractAttributes(sourceText);
  let attributes = aiResult
    ? mergeAttributes(aiResult.attributes, ruleAttributes)
    : ruleAttributes;

  // --- 3. Correcciones manuales del usuario -------------------------------
  if (request.conditionOverride) {
    attributes = {
      ...attributes,
      condition: request.conditionOverride,
      conditionClaims: [...new Set([...attributes.conditionClaims, request.conditionOverride])],
      evidence: [
        ...attributes.evidence,
        { field: "estado", quote: "Estado indicado manualmente por el usuario." },
      ],
    };
  }

  const askingCents = request.priceOverrideCents ?? attributes.askingCents;
  if (askingCents == null || askingCents <= 0) {
    throw new AnalysisInputError(
      "No he encontrado el precio en el anuncio. Indícalo en el campo «Precio pedido» para poder valorarlo.",
    );
  }

  if (request.priceOverrideCents != null) {
    attributes = {
      ...attributes,
      askingCents: request.priceOverrideCents,
      evidence: [
        ...attributes.evidence,
        { field: "precio", quote: "Precio indicado manualmente por el usuario." },
      ],
    };
  }

  // --- 4. Valoración -------------------------------------------------------
  const inputs: ("url" | "text" | "image")[] = [];
  if (resolvedUrl) inputs.push("url");
  if (pastedText) inputs.push("text");
  if (images.length > 0) inputs.push("image");

  const report = analyze({
    attributes,
    text: sourceText,
    askingCents,
    imageCount: images.length,
    inputs,
    aiUsedFor: aiResult?.usedFor ?? [],
    aiModel: aiResult?.model ?? null,
  });

  return {
    report,
    sourceText,
    inputKind,
    sourceUrl: resolvedUrl,
    durationMs: Date.now() - started,
    warnings,
  };
}

/** Guarda un análisis y devuelve su identificador. */
export async function persistAnalysis(args: {
  userId: string | null;
  outcome: AnalyzeOutcome;
  images: AIImageInput[];
}): Promise<{ id: string }> {
  const { outcome, userId } = args;
  const r = outcome.report;

  const created = await prisma.analysis.create({
    data: {
      userId,
      inputKind: outcome.inputKind,
      sourceUrl: outcome.sourceUrl,
      rawText: outcome.sourceText.slice(0, 20_000),
      imageCount: args.images.length,
      askingCents: r.pricing.askingCents,
      category: r.product.category,
      brand: r.product.brand,
      model: r.product.model,
      storageGb: r.product.storageGb,
      color: r.product.color,
      conditionKey: r.product.condition,
      accessories: r.product.accessories,
      marketCents: r.pricing.marketCents,
      marketLowCents: r.pricing.marketLowCents,
      marketHighCents: r.pricing.marketHighCents,
      fairCents: r.pricing.fairCents,
      targetCents: r.negotiation.targetCents,
      offerCents: r.negotiation.openingOfferCents,
      savingCents: r.pricing.savingCents,
      verdict: r.verdict,
      score: r.score,
      buyProbability: r.buyProbability,
      scamRisk: r.scamRisk,
      confidence: r.confidence,
      report: r as unknown as Prisma.InputJsonValue,
      aiModel: r.provenance.aiModel,
      aiUsedFor: r.provenance.aiUsedFor,
      durationMs: outcome.durationMs,
      images: {
        create: args.images.map((image) => ({
          sha256: createHash("sha256").update(Buffer.from(image.base64, "base64")).digest("hex"),
          mimeType: image.mediaType,
          bytes: Buffer.byteLength(image.base64, "base64"),
        })),
      },
    },
    select: { id: true },
  });

  return created;
}

/** Genera (o reutiliza) el token público de compartición de un análisis. */
export async function ensureShareToken(analysisId: string, userId: string): Promise<string> {
  const existing = await prisma.analysis.findFirst({
    where: { id: analysisId, userId },
    select: { shareToken: true },
  });
  if (!existing) {
    throw new AnalysisInputError("El análisis no existe o no es tuyo.");
  }
  if (existing.shareToken) return existing.shareToken;

  const token = randomBytes(16).toString("base64url");
  await prisma.analysis.update({
    where: { id: analysisId },
    data: { shareToken: token, sharedAt: new Date() },
  });
  return token;
}
