/**
 * Tipos del dominio de valoración de DealScan AI.
 *
 * Todo el dinero se representa en **céntimos de euro** (entero) para que los
 * cálculos sean exactos. La conversión a texto ocurre solo en la capa de UI.
 */

export type CategoryKey =
  | "phone"
  | "tablet"
  | "laptop"
  | "watch"
  | "console";

export const CATEGORY_LABELS: Record<CategoryKey, string> = {
  phone: "Móvil",
  tablet: "Tablet",
  laptop: "Portátil",
  watch: "Smartwatch",
  console: "Consola",
};

/** Estados normalizados del producto, de mejor a peor. */
export type ConditionKey = "new" | "like_new" | "good" | "fair" | "poor";

export const CONDITION_LABELS: Record<ConditionKey, string> = {
  new: "Nuevo / precintado",
  like_new: "Como nuevo",
  good: "Buen estado",
  fair: "Estado aceptable",
  poor: "Estado deficiente",
};

export const CONDITION_ORDER: ConditionKey[] = [
  "new",
  "like_new",
  "good",
  "fair",
  "poor",
];

export type Verdict = "CHOLLO" | "CORRECTO" | "CARO" | "ESTAFA_PROBABLE";

export const VERDICT_LABELS: Record<Verdict, string> = {
  CHOLLO: "Chollo",
  CORRECTO: "Precio correcto",
  CARO: "Caro",
  ESTAFA_PROBABLE: "Posible estafa",
};

/** Un modelo del catálogo de referencia. */
export interface ProductReference {
  category: CategoryKey;
  brand: string;
  model: string;
  slug: string;
  releaseYear: number;
  /** PVP oficial de lanzamiento de la variante base, en céntimos. */
  msrpCents: number;
  /** Variantes de almacenamiento y su sobreprecio sobre la base, en céntimos. */
  storageTiers: { gb: number; deltaCents: number }[];
  /** Formas en las que el modelo aparece escrito en anuncios reales. */
  aliases: string[];
  /** Procedencia del dato de referencia. */
  source: string;
}

/** Atributos del producto extraídos del anuncio. */
export interface ExtractedAttributes {
  brand: string | null;
  model: string | null;
  /** Slug del catálogo si se ha podido identificar el modelo exacto. */
  slug: string | null;
  category: CategoryKey | null;
  storageGb: number | null;
  color: string | null;
  /** Estado con el que se valora: el peor de los detectados. */
  condition: ConditionKey | null;
  /**
   * Todos los estados que el anuncio afirma. Si el vendedor dice "precintado"
   * y a la vez describe arañazos, aquí aparecen ambos y el motor lo señala
   * como incoherencia en lugar de elegir uno en silencio.
   */
  conditionClaims: ConditionKey[];
  /** Salud de batería declarada (%), típico en iPhone. */
  batteryHealth: number | null;
  accessories: string[];
  /** Daños declarados o visibles en las imágenes. */
  damages: string[];
  /** Precio pedido por el vendedor, en céntimos. */
  askingCents: number | null;
  /** Año de compra o antigüedad declarada por el vendedor. */
  declaredYear: number | null;
  /** Ubicación declarada, útil para detectar incoherencias de envío. */
  location: string | null;
  /** Frases textuales del anuncio que respaldan cada dato extraído. */
  evidence: { field: string; quote: string }[];
}

export type SignalSeverity = "info" | "low" | "medium" | "high" | "critical";

/** Señal detectada: puede ser de estafa, de riesgo o de incoherencia. */
export interface Signal {
  code: string;
  kind: "scam" | "risk" | "inconsistency" | "positive";
  severity: SignalSeverity;
  title: string;
  /** Por qué esto importa y qué hacer al respecto. */
  detail: string;
  /** Puntos que suma al índice de riesgo de estafa (0 si no aplica). */
  weight: number;
  /** Fragmento del anuncio que activó la señal, si procede. */
  evidence?: string;
}

/** Paso del cálculo, para que el informe sea auditable línea a línea. */
export interface CalculationStep {
  label: string;
  detail: string;
  /** Valor resultante acumulado en céntimos, si el paso afecta al precio. */
  valueCents?: number;
  /** Factor aplicado en el paso, si es multiplicativo. */
  factor?: number;
}

export interface ValuationBreakdown {
  /** Referencia usada; null si no se identificó el modelo en catálogo. */
  reference: ProductReference | null;
  ageYears: number;
  /** Retención de valor aplicada por antigüedad y marca (0-1). */
  retention: number;
  /** Factor por estado del producto respecto a "buen estado" (=1). */
  conditionFactor: number;
  /** Factor por accesorios, batería y daños. */
  adjustmentFactor: number;
  steps: CalculationStep[];
  /** Advertencias sobre la propia valoración (datos ausentes, etc.). */
  caveats: string[];
}

export interface NegotiationPlan {
  /** Precio objetivo realista al que cerrar la compra. */
  targetCents: number;
  /** Primera cantidad a ofrecer al vendedor (ancla de negociación). */
  openingOfferCents: number;
  /** Margen máximo que tiene sentido pagar. */
  walkAwayCents: number;
  /** Argumentos concretos para justificar la oferta ante el vendedor. */
  arguments: string[];
  /** Mensaje listo para enviar al vendedor. */
  message: string;
}

export interface AnalysisReport {
  /** Versión del algoritmo: permite comparar informes en el tiempo. */
  engineVersion: string;
  generatedAt: string;

  product: {
    category: CategoryKey | null;
    categoryLabel: string;
    brand: string | null;
    model: string | null;
    storageGb: number | null;
    color: string | null;
    condition: ConditionKey | null;
    conditionLabel: string;
    accessories: string[];
    damages: string[];
    batteryHealth: number | null;
  };

  pricing: {
    askingCents: number;
    /** Valor de mercado de segunda mano para este modelo y estado. */
    marketCents: number;
    marketLowCents: number;
    marketHighCents: number;
    /** Precio justo ajustado a estado, accesorios y daños. */
    fairCents: number;
    /** Diferencia frente al valor de mercado (positivo = ahorras). */
    savingCents: number;
    savingPct: number;
    /** Cuánto más se puede rebajar negociando hasta el objetivo. */
    negotiationUpsideCents: number;
  };

  verdict: Verdict;
  /** Valoración global 0-100. */
  score: number;
  /** Probabilidad de que sea una buena compra, 0-100. */
  buyProbability: number;
  /** Índice de riesgo de estafa, 0-100. */
  scamRisk: number;
  /** Confianza del análisis según la calidad de los datos, 0-100. */
  confidence: number;

  signals: Signal[];
  breakdown: ValuationBreakdown;
  negotiation: NegotiationPlan;

  /** Explicación completa en lenguaje natural, en secciones. */
  explanation: {
    summary: string;
    priceReasoning: string;
    conditionReasoning: string;
    riskReasoning: string;
    recommendation: string;
  };

  /** Qué fuentes de datos han alimentado el informe. */
  provenance: {
    inputs: ("url" | "text" | "image")[];
    aiUsedFor: ("extraction" | "vision" | "narrative")[];
    aiModel: string | null;
    catalogSource: string | null;
    extractionEvidence: { field: string; quote: string }[];
  };
}
