/**
 * Punto de entrada del bundle de la vista previa.
 *
 * Expone en `window.DealScan` exactamente el mismo motor que usa el servidor:
 * el catálogo de referencia, el extractor determinista, las reglas de riesgo y
 * el motor de valoración, sin ninguna reimplementación. Así las cifras de la
 * vista previa son las mismas que devolvería la aplicación desplegada.
 *
 * Lo que la vista previa NO puede hacer, porque vive solo en el navegador:
 *  - Leer capturas de pantalla (requiere el modelo de visión en el servidor).
 *  - Descargar el contenido de un enlace (lo impide la política de la página).
 *  - Cuentas, historial, favoritos guardados y suscripciones.
 */

import { analyze, ENGINE_VERSION, formatStorage } from "../src/lib/valuation/engine";
import { extractAttributes, parseAmountToCents } from "../src/lib/valuation/extract";
import { PRODUCT_CATALOG } from "../src/lib/valuation/catalog";
import { formatEuros, formatPercent } from "../src/lib/money";
import {
  CATEGORY_LABELS,
  CONDITION_LABELS,
  CONDITION_ORDER,
  VERDICT_LABELS,
} from "../src/lib/valuation/types";
import type { AnalysisReport, ConditionKey } from "../src/lib/valuation/types";

export interface PreviewResult {
  report: AnalysisReport;
  warnings: string[];
  durationMs: number;
}

/**
 * Ejecuta el análisis sobre el texto del anuncio.
 * Devuelve el mismo informe tipado que la API `/api/analyze`.
 */
function run(input: {
  text: string;
  priceEur?: number | null;
  condition?: ConditionKey | null;
}): PreviewResult {
  const started = performance.now();
  const text = input.text.trim();

  if (text.length === 0) {
    throw new Error("Pega el texto del anuncio para poder analizarlo.");
  }

  let attributes = extractAttributes(text);
  const warnings: string[] = [
    "Vista previa sin IA: el producto se ha identificado con el analizador determinista por reglas. Los cálculos de precio son idénticos a los de la aplicación, porque no dependen de la IA.",
  ];

  if (input.condition) {
    attributes = {
      ...attributes,
      condition: input.condition,
      conditionClaims: [...new Set([...attributes.conditionClaims, input.condition])],
      evidence: [
        ...attributes.evidence,
        { field: "estado", quote: "Estado indicado manualmente." },
      ],
    };
  }

  const askingCents =
    input.priceEur != null && input.priceEur > 0
      ? Math.round(input.priceEur * 100)
      : attributes.askingCents;

  if (askingCents == null || askingCents <= 0) {
    throw new Error(
      "No he encontrado el precio en el anuncio. Indícalo en el campo «Precio pedido» para poder valorarlo.",
    );
  }

  if (input.priceEur != null && input.priceEur > 0) {
    attributes = {
      ...attributes,
      askingCents,
      evidence: [
        ...attributes.evidence,
        { field: "precio", quote: "Precio indicado manualmente." },
      ],
    };
  }

  const report = analyze({
    attributes,
    text,
    askingCents,
    imageCount: 0,
    inputs: ["text"],
    aiUsedFor: [],
    aiModel: null,
  });

  return { report, warnings, durationMs: Math.round(performance.now() - started) };
}

const api = {
  run,
  extractAttributes,
  parseAmountToCents,
  formatEuros,
  formatPercent,
  formatStorage,
  engineVersion: ENGINE_VERSION,
  catalog: PRODUCT_CATALOG,
  labels: {
    category: CATEGORY_LABELS,
    condition: CONDITION_LABELS,
    conditionOrder: CONDITION_ORDER,
    verdict: VERDICT_LABELS,
  },
};

declare global {
  interface Window {
    DealScan: typeof api;
  }
}

window.DealScan = api;
