import { CATALOG_BY_SLUG, msrpForVariant } from "./catalog";
import { formatEuros, formatPercent } from "../money";
import { evaluateSignals } from "./risk";
import type {
  AnalysisReport,
  CalculationStep,
  CategoryKey,
  ConditionKey,
  ExtractedAttributes,
  NegotiationPlan,
  ProductReference,
  Signal,
  Verdict,
} from "./types";
import { CATEGORY_LABELS, CONDITION_LABELS } from "./types";

export const ENGINE_VERSION = "1.0.0";

/**
 * Motor de valoración de DealScan AI.
 *
 * Método (determinista y auditable paso a paso):
 *   1. PVP oficial de lanzamiento del modelo + variante de almacenamiento.
 *   2. × retención por antigüedad (curva por categoría) × factor de marca.
 *      → valor de mercado de una unidad en "buen estado".
 *   3. × factor de estado (nuevo … deficiente).
 *   4. × ajustes por batería, daños y accesorios.
 *      → precio justo para ESTA unidad concreta.
 *   5. Se compara con el precio pedido y se derivan veredicto, puntuación,
 *      ahorro y plan de negociación.
 *
 * Las curvas de retención reflejan el comportamiento observado del mercado de
 * segunda mano: caída fuerte los dos primeros años y asíntota alrededor del
 * 10-15 % del PVP a partir del séptimo. Se ajustan por categoría porque un
 * portátil y una consola no se depreciaen igual.
 */

/**
 * Retención de valor sobre el PVP para una unidad en buen estado, por año de
 * antigüedad (índice = años desde el lanzamiento).
 *
 * Las curvas son la línea base del mercado (equivalente a una marca con factor
 * 1,00) y se calibran contra precios de cierre reales de segunda mano: caída
 * fuerte los dos primeros años y cola plana a partir del sexto, cuando el precio
 * lo sostiene la utilidad del aparato y no su modelo.
 */
const RETENTION_CURVES: Record<CategoryKey, number[]> = {
  // Móvil: ~22 % de caída el primer año, ~40 % al segundo. Con el factor de
  // Apple (1,14) la curva reproduce el valor residual real de los iPhone.
  phone: [0.78, 0.6, 0.5, 0.42, 0.34, 0.28, 0.23, 0.19, 0.16],
  // Las tablets aguantan algo mejor por ciclos de renovación más largos.
  tablet: [0.82, 0.66, 0.55, 0.46, 0.39, 0.33, 0.27, 0.22, 0.18],
  // Los portátiles se deprecian de forma sostenida.
  laptop: [0.8, 0.66, 0.55, 0.45, 0.37, 0.3, 0.24, 0.19, 0.15],
  // Los relojes pierden valor rápido: batería difícil de sustituir.
  watch: [0.75, 0.56, 0.42, 0.32, 0.25, 0.2, 0.16, 0.13, 0.1],
  // Las consolas son excepcionalmente estables mientras hay catálogo de juegos.
  console: [0.88, 0.82, 0.76, 0.7, 0.64, 0.58, 0.52, 0.46, 0.4],
};

/**
 * Factor por marca sobre la retención. Refleja diferencias reales y persistentes
 * de valor residual entre fabricantes en el mercado europeo de segunda mano.
 */
const BRAND_RETENTION_FACTOR: Record<string, number> = {
  Apple: 1.14,
  Nintendo: 1.1,
  Sony: 1.04,
  Samsung: 0.94,
  Microsoft: 1.0,
  Valve: 1.06,
  Google: 0.95,
  OnePlus: 0.9,
  Lenovo: 0.9,
  Dell: 0.9,
  Asus: 0.88,
  HP: 0.86,
  Acer: 0.84,
  MSI: 0.86,
  Xiaomi: 0.86,
  Huawei: 0.8,
};

/**
 * Daños puramente estéticos. Su penalización NO se aplica cuando el estado ya
 * es "aceptable" o peor: en ese caso el desgaste ya está descontado por el
 * factor de estado y volver a restarlo penalizaría dos veces lo mismo.
 */
const COSMETIC_DAMAGES = new Set(["Arañazos", "Golpes o abolladuras"]);

/** Factor por estado, relativo a "buen estado" (= 1,00). */
const CONDITION_FACTOR: Record<ConditionKey, number> = {
  new: 1.28,
  like_new: 1.13,
  good: 1.0,
  fair: 0.85,
  poor: 0.55,
};

/** Ajuste por accesorio incluido (sobre el precio justo). */
const ACCESSORY_BONUS: Record<string, number> = {
  "Caja original": 0.025,
  Cargador: 0.02,
  Cable: 0.005,
  "Factura de compra": 0.02,
  "Garantía vigente": 0.06,
  Auriculares: 0.01,
  "Mando adicional": 0.05,
  "Juegos incluidos": 0.04,
  "Teclado / Apple Pencil": 0.07,
};

/** Penalización por daño detectado (sobre el precio justo). */
const DAMAGE_PENALTY: Record<string, number> = {
  "Pantalla rota o agrietada": 0.32,
  "Pantalla no original / reparada": 0.16,
  "Golpes o abolladuras": 0.1,
  Arañazos: 0.05,
  "Batería sustituida no oficial": 0.07,
  "Daño por humedad o agua": 0.35,
  "Píxeles muertos o manchas en pantalla": 0.14,
  "Problemas de carga": 0.25,
  "Face ID / sensor no funciona": 0.2,
  "No enciende / para piezas": 0.75,
};

/** Umbrales del veredicto sobre la ratio precio pedido / precio justo. */
export const VERDICT_THRESHOLDS = {
  chollo: 0.82,
  correcto: 1.08,
  scamOverride: 60,
} as const;

export interface EngineInput {
  attributes: ExtractedAttributes;
  /** Texto completo del anuncio (para las reglas de riesgo). */
  text: string;
  askingCents: number;
  imageCount: number;
  inputs: ("url" | "text" | "image")[];
  aiUsedFor: ("extraction" | "vision" | "narrative")[];
  aiModel: string | null;
  /** Fecha de referencia para calcular la antigüedad (inyectable para tests). */
  now?: Date;
}

export function analyze(input: EngineInput): AnalysisReport {
  const now = input.now ?? new Date();
  const attr = input.attributes;
  const steps: CalculationStep[] = [];
  const caveats: string[] = [];

  const reference: ProductReference | null = attr.slug
    ? (CATALOG_BY_SLUG.get(attr.slug) ?? null)
    : null;

  const condition: ConditionKey = attr.condition ?? "good";
  if (attr.condition == null) {
    caveats.push(
      "El anuncio no indica claramente el estado del producto. Se ha asumido «buen estado», que es el caso más frecuente; si al verlo está peor, el precio justo baja.",
    );
  }

  // ------------------------------------------------------------------ paso 1
  let baseCents: number;
  let ageYears: number;
  let brandFactor: number;

  if (reference) {
    const variant = msrpForVariant(reference, attr.storageGb);
    baseCents = variant.cents;
    ageYears = Math.max(0, now.getFullYear() - reference.releaseYear);
    brandFactor = BRAND_RETENTION_FACTOR[reference.brand] ?? 1;

    steps.push({
      label: "PVP oficial de lanzamiento",
      detail:
        `${reference.brand} ${reference.model}` +
        (variant.matchedGb ? ` · ${formatStorage(variant.matchedGb)}` : "") +
        ` — lanzamiento en ${reference.releaseYear}. Fuente: ${reference.source}`,
      valueCents: baseCents,
    });

    if (attr.storageGb != null && variant.matchedGb !== attr.storageGb) {
      caveats.push(
        `El almacenamiento del anuncio (${formatStorage(attr.storageGb)}) no está en el catálogo de este modelo; se ha usado la variante de ${formatStorage(variant.matchedGb ?? 0)} para no sobrevalorar el producto.`,
      );
    }
  } else {
    // Sin referencia de catálogo no se inventa un precio: el informe se marca
    // como no valorable y se centra en riesgos y en cómo obtener el dato.
    return unidentifiedReport(input, now, condition);
  }

  // ------------------------------------------------------------------ paso 2
  const curve = RETENTION_CURVES[reference.category];
  const rawRetention = curve[Math.min(ageYears, curve.length - 1)] ?? curve[curve.length - 1]!;
  // El factor de marca no puede llevar la retención por encima del 92 %: nadie
  // paga de segunda mano lo mismo que en tienda con garantía completa.
  const retention = Math.min(0.92, round4(rawRetention * brandFactor));

  const marketGoodCents = Math.round(baseCents * retention);
  steps.push({
    label: `Depreciación por antigüedad (${ageYears} ${ageYears === 1 ? "año" : "años"})`,
    detail:
      `Curva de ${CATEGORY_LABELS[reference.category].toLowerCase()}: ${pct(rawRetention)} de retención` +
      (brandFactor !== 1
        ? ` · ajuste de marca ${reference.brand} ×${brandFactor.toFixed(2)} (su valor residual es ${brandFactor > 1 ? "superior" : "inferior"} a la media)`
        : "") +
      ` → ${pct(retention)} del PVP.`,
    factor: retention,
    valueCents: marketGoodCents,
  });

  // ------------------------------------------------------------------ paso 3
  const conditionFactor = CONDITION_FACTOR[condition];
  const conditionedCents = Math.round(marketGoodCents * conditionFactor);
  steps.push({
    label: `Estado: ${CONDITION_LABELS[condition].toLowerCase()}`,
    detail:
      conditionFactor === 1
        ? "Estado de referencia: no se aplica ajuste."
        : `${conditionFactor > 1 ? "Suma" : "Resta"} ${pct(Math.abs(conditionFactor - 1))} sobre el valor de una unidad en buen estado.`,
    factor: conditionFactor,
    valueCents: conditionedCents,
  });

  // ------------------------------------------------------------------ paso 4
  let adjustmentFactor = 1;
  const adjustmentNotes: string[] = [];

  for (const accessory of attr.accessories) {
    const bonus = ACCESSORY_BONUS[accessory];
    if (bonus) {
      adjustmentFactor += bonus;
      adjustmentNotes.push(`${accessory} +${pct(bonus)}`);
    }
  }

  const cosmeticAlreadyPriced = condition === "fair" || condition === "poor";
  for (const damage of attr.damages) {
    const penalty = DAMAGE_PENALTY[damage];
    if (!penalty) continue;
    if (COSMETIC_DAMAGES.has(damage) && cosmeticAlreadyPriced) {
      adjustmentNotes.push(`${damage} ya descontado en el estado «${CONDITION_LABELS[condition].toLowerCase()}»`);
      continue;
    }
    adjustmentFactor -= penalty;
    adjustmentNotes.push(`${damage} −${pct(penalty)}`);
  }

  if (attr.batteryHealth != null) {
    if (attr.batteryHealth < 80) {
      adjustmentFactor -= 0.07;
      adjustmentNotes.push(`batería al ${attr.batteryHealth} % −7 %`);
    } else if (attr.batteryHealth < 86) {
      adjustmentFactor -= 0.03;
      adjustmentNotes.push(`batería al ${attr.batteryHealth} % −3 %`);
    } else if (attr.batteryHealth >= 95 && condition !== "new") {
      adjustmentFactor += 0.02;
      adjustmentNotes.push(`batería al ${attr.batteryHealth} % +2 %`);
    }
  }

  // Un producto nunca vale menos del 8 % de su valor: siempre tiene piezas.
  adjustmentFactor = clamp(round4(adjustmentFactor), 0.08, 1.35);
  const fairCents = Math.max(1000, Math.round(conditionedCents * adjustmentFactor));

  steps.push({
    label: "Ajustes por accesorios, batería y daños",
    detail:
      adjustmentNotes.length > 0
        ? adjustmentNotes.join(" · ") + ` → factor ×${adjustmentFactor.toFixed(3)}`
        : "No se han detectado accesorios extra ni daños que modifiquen el precio.",
    factor: adjustmentFactor,
    valueCents: fairCents,
  });

  // El valor de mercado de referencia (para comparar el ahorro) es el de una
  // unidad equivalente en el mismo estado, sin los extras/daños concretos.
  const marketCents = conditionedCents;
  // Horquilla real observada en anuncios: los vendedores publican por encima
  // del precio de cierre, así que la banda es asimétrica.
  const marketLowCents = Math.round(marketCents * 0.89);
  const marketHighCents = Math.round(marketCents * 1.14);

  // ------------------------------------------------------------------ paso 5
  const askingCents = input.askingCents;
  const { signals, scamRisk } = evaluateSignals({
    attributes: attr,
    text: input.text,
    marketCents,
    askingCents,
    ageYears,
    imageCount: input.imageCount,
    identified: true,
  });

  const ratio = askingCents / fairCents;
  const verdict = decideVerdict(ratio, scamRisk);
  const savingCents = marketCents - askingCents;
  const savingPct = round2((savingCents / marketCents) * 100);

  const negotiation = buildNegotiationPlan({
    fairCents,
    askingCents,
    marketCents,
    attr,
    ageYears,
    reference,
    signals,
  });

  const confidence = computeConfidence(attr, input, reference);
  const valueScore = computeValueScore(ratio);

  // El riesgo actúa como techo, no solo como resta: un anuncio con riesgo alto
  // no puede presentarse con buena nota por muy barato que sea. Sin este límite
  // una estafa con precio de gancho obtendría la puntuación más alta del
  // informe, que es exactamente el error que no puede cometer este producto.
  const riskCeiling = 100 - scamRisk;
  const score = clamp(
    Math.min(
      Math.round(valueScore * 0.6 + riskCeiling * 0.3 + confidence * 0.1),
      riskCeiling,
    ),
    1,
    100,
  );
  const buyProbability = clamp(
    Math.min(Math.round(valueScore * 0.55 + riskCeiling * 0.45), riskCeiling),
    1,
    99,
  );

  return {
    engineVersion: ENGINE_VERSION,
    generatedAt: now.toISOString(),
    product: {
      category: reference.category,
      categoryLabel: CATEGORY_LABELS[reference.category],
      brand: reference.brand,
      model: reference.model,
      storageGb: attr.storageGb,
      color: attr.color,
      condition,
      conditionLabel: CONDITION_LABELS[condition],
      accessories: attr.accessories,
      damages: attr.damages,
      batteryHealth: attr.batteryHealth,
    },
    pricing: {
      askingCents,
      marketCents,
      marketLowCents,
      marketHighCents,
      fairCents,
      savingCents,
      savingPct,
      negotiationUpsideCents: Math.max(0, askingCents - negotiation.targetCents),
    },
    verdict,
    score,
    buyProbability,
    scamRisk,
    confidence,
    signals,
    breakdown: {
      reference,
      ageYears,
      retention,
      conditionFactor,
      adjustmentFactor,
      steps,
      caveats,
    },
    negotiation,
    explanation: buildExplanation({
      verdict,
      ratio,
      askingCents,
      marketCents,
      fairCents,
      savingCents,
      savingPct,
      scamRisk,
      score,
      buyProbability,
      confidence,
      signals,
      attr,
      reference,
      ageYears,
      condition,
      negotiation,
      retention,
    }),
    provenance: {
      inputs: input.inputs,
      aiUsedFor: input.aiUsedFor,
      aiModel: input.aiModel,
      catalogSource: reference.source,
      extractionEvidence: attr.evidence,
    },
  };
}

function decideVerdict(ratio: number, scamRisk: number): Verdict {
  if (scamRisk >= VERDICT_THRESHOLDS.scamOverride) return "ESTAFA_PROBABLE";
  if (ratio <= VERDICT_THRESHOLDS.chollo) return "CHOLLO";
  if (ratio <= VERDICT_THRESHOLDS.correcto) return "CORRECTO";
  return "CARO";
}

/**
 * Puntuación de valor 0-100 a partir de la ratio precio/valor justo.
 * ratio 0,70 → 100 · ratio 1,00 → 60 · ratio 1,30 → 0
 *
 * La ratio se limita por abajo a 0,72: un descuento superior al 28 % sobre el
 * valor justo no suma más puntos porque, a partir de ahí, un precio más bajo
 * deja de ser una oportunidad y empieza a ser un indicio de problema. El ahorro
 * real sí se muestra íntegro en el informe.
 */
function computeValueScore(ratio: number): number {
  return clamp(Math.round(((1.3 - Math.max(ratio, 0.72)) / 0.6) * 100), 0, 100);
}

/** Confianza según la cantidad y calidad de los datos disponibles. */
function computeConfidence(
  attr: ExtractedAttributes,
  input: EngineInput,
  reference: ProductReference | null,
): number {
  let score = 35;
  if (reference) score += 25;
  if (attr.storageGb != null) score += 10;
  if (attr.condition != null) score += 10;
  if (attr.batteryHealth != null) score += 5;
  if (input.imageCount > 0) score += 8;
  if (input.aiUsedFor.includes("vision")) score += 4;
  if (input.aiUsedFor.includes("extraction")) score += 5;
  if (input.text.length > 250) score += 5;
  else if (input.text.length < 60) score -= 12;
  if (attr.evidence.length >= 4) score += 3;
  return clamp(score, 5, 99);
}

// ---------------------------------------------------------------------------
// Plan de negociación
// ---------------------------------------------------------------------------

function buildNegotiationPlan(args: {
  fairCents: number;
  askingCents: number;
  marketCents: number;
  attr: ExtractedAttributes;
  ageYears: number;
  reference: ProductReference;
  signals: Signal[];
}): NegotiationPlan {
  const { fairCents, askingCents, attr, reference, ageYears } = args;

  // Objetivo: un 6 % por debajo del precio justo — margen que los vendedores
  // aceptan habitualmente en venta entre particulares. Nunca por encima de lo
  // que ya pide el vendedor.
  const targetCents = Math.min(askingCents, Math.round(fairCents * 0.94));
  // Primera oferta: ancla un 10 % por debajo del objetivo, con suelo en el 78 %
  // del precio justo para que la oferta siga siendo creíble y no ofenda. Nunca
  // puede superar el objetivo: si el vendedor ya pide menos de lo que vale, la
  // oferta de apertura es directamente su precio.
  const openingOfferCents = Math.min(
    targetCents,
    Math.max(Math.round(fairCents * 0.78), Math.round(targetCents * 0.9)),
  );
  // Límite: por encima del precio justo + 4 % la compra deja de tener sentido.
  const walkAwayCents = Math.round(fairCents * 1.04);

  const productName = [reference.brand, reference.model, attr.storageGb ? formatStorage(attr.storageGb) : null]
    .filter(Boolean)
    .join(" ");

  // Cuando el vendedor ya pide menos que el objetivo, el consejo no es regatear
  // sino cerrar: intentar rebajar un chollo es la forma más habitual de perderlo.
  // Se devuelve un plan distinto en lugar de tres cifras iguales sin sentido.
  if (askingCents <= targetCents) {
    return {
      targetCents,
      openingOfferCents: askingCents,
      walkAwayCents,
      arguments: [
        `El precio pedido (${fmtCents(askingCents)}) ya está por debajo del valor justo de esta unidad (${fmtCents(fairCents)}): no hay margen que ganar regateando, y sí una venta que perder.`,
        "Responde rápido y sé el primero: en los anuncios por debajo de mercado la unidad se va en horas.",
        "Invierte el esfuerzo en verificar, no en negociar: comprueba que enciende, que la cuenta del anterior propietario está borrada y que no hay bloqueo de operador.",
        ...(attr.accessories.includes("Factura de compra")
          ? []
          : ["Pide la factura o el justificante de compra: es lo único que conviene reclamar a este precio."]),
      ],
      message:
        `Hola, me interesa el ${productName}. Me encaja el precio que pides, así que por mí lo cerramos tal cual. ` +
        "¿Cuándo te viene bien la entrega en mano? Puedo pasar hoy o mañana, pagar en el momento y comprobarlo allí mismo contigo.",
    };
  }

  const argumentsList: string[] = [];

  if (askingCents > fairCents) {
    argumentsList.push(
      `El precio pedido está ${fmtCents(askingCents - fairCents)} por encima de lo que vale esta unidad según su estado y antigüedad (${fmtCents(fairCents)}).`,
    );
  }
  if (ageYears >= 2) {
    argumentsList.push(
      `El ${reference.model} salió en ${reference.releaseYear}: tiene ${ageYears} años y le quedan pocos ciclos de actualizaciones, lo que reduce su valor de reventa.`,
    );
  }
  for (const damage of attr.damages) {
    const penalty = DAMAGE_PENALTY[damage];
    if (penalty) {
      argumentsList.push(
        `${damage}: descuento razonable de ${pct(penalty)} (${fmtCents(Math.round(fairCents * penalty))}) por la reparación o la pérdida de valor.`,
      );
    }
  }
  if (attr.batteryHealth != null && attr.batteryHealth < 86) {
    argumentsList.push(
      `La batería está al ${attr.batteryHealth} %: sustituirla en servicio oficial cuesta entre 50 € y 120 €, y eso lo asume el comprador.`,
    );
  }
  if (!attr.accessories.includes("Caja original")) {
    argumentsList.push("Sin caja ni accesorios originales, el valor de reventa baja entre un 2 % y un 5 %.");
  }
  if (!attr.accessories.includes("Factura de compra") && !attr.accessories.includes("Garantía vigente")) {
    argumentsList.push("Sin factura ni garantía, cualquier avería posterior corre por cuenta del comprador.");
  }
  argumentsList.push(
    "Hay unidades equivalentes publicadas en el mismo rango, así que el vendedor sabe que puede perder la venta si no ajusta.",
  );

  const reasons = [
    attr.damages.length > 0 ? attr.damages[0]!.toLowerCase() : null,
    attr.batteryHealth != null && attr.batteryHealth < 86 ? `la batería está al ${attr.batteryHealth} %` : null,
    ageYears >= 3 ? `el modelo es de ${reference.releaseYear}` : null,
    !attr.accessories.includes("Caja original") ? "no incluye caja ni accesorios originales" : null,
  ].filter((r): r is string => r !== null);

  const message =
    `Hola, me interesa el ${productName}. He estado comparando precios de unidades equivalentes y en el estado que describes se están cerrando alrededor de ${fmtCents(targetCents)}` +
    (reasons.length > 0 ? `, sobre todo porque ${reasons.slice(0, 2).join(" y ")}` : "") +
    `. Te puedo ofrecer ${fmtCents(openingOfferCents)} ahora mismo, pago y recogida cuando te venga bien. Si te encaja, lo cerramos hoy.`;

  return {
    targetCents,
    openingOfferCents,
    walkAwayCents,
    arguments: argumentsList,
    message,
  };
}

// ---------------------------------------------------------------------------
// Explicación en lenguaje natural
// ---------------------------------------------------------------------------

function buildExplanation(a: {
  verdict: Verdict;
  ratio: number;
  askingCents: number;
  marketCents: number;
  fairCents: number;
  savingCents: number;
  savingPct: number;
  scamRisk: number;
  score: number;
  buyProbability: number;
  confidence: number;
  signals: Signal[];
  attr: ExtractedAttributes;
  reference: ProductReference;
  ageYears: number;
  condition: ConditionKey;
  negotiation: NegotiationPlan;
  retention: number;
}): AnalysisReport["explanation"] {
  const name = `${a.reference.brand} ${a.reference.model}`;
  const diff = a.askingCents - a.fairCents;
  const diffPct = Math.abs(Math.round((diff / a.fairCents) * 100));

  const verdictSentence: Record<Verdict, string> = {
    CHOLLO: `Es un chollo: se piden ${fmtCents(a.askingCents)} por un ${name} que en este estado vale alrededor de ${fmtCents(a.fairCents)}, un ${diffPct} % por debajo.`,
    CORRECTO: `El precio es correcto: los ${fmtCents(a.askingCents)} que se piden están dentro del rango de mercado para un ${name} en este estado (${fmtCents(a.fairCents)} de valor justo).`,
    CARO: `Está caro: se piden ${fmtCents(a.askingCents)} por un ${name} cuyo valor justo en este estado es de ${fmtCents(a.fairCents)}, un ${diffPct} % más de lo que debería costar.`,
    ESTAFA_PROBABLE: `Alto riesgo de fraude. Independientemente del precio, este anuncio acumula señales que apuntan a estafa (índice de riesgo ${a.scamRisk}/100). La recomendación es no seguir adelante.`,
    // Inalcanzable en esta rama: si hay referencia de catálogo, siempre hay
    // veredicto de precio. Se declara para que el mapa quede exhaustivo y
    // añadir un estado nuevo obligue a decidir su texto.
    SIN_VALORAR: `No se ha podido valorar el precio de este anuncio. El vendedor pide ${fmtCents(a.askingCents)}.`,
  };

  const summary =
    verdictSentence[a.verdict] +
    ` Valoración global: ${a.score}/100, con una probabilidad del ${a.buyProbability} % de que sea una buena compra y una confianza del análisis del ${a.confidence} %.`;

  const priceReasoning =
    `El cálculo parte del PVP oficial de lanzamiento del ${name}` +
    (a.attr.storageGb ? ` en su versión de ${formatStorage(a.attr.storageGb)}` : "") +
    ` (${a.reference.source.toLowerCase()}). Sobre ese precio se aplica la depreciación que corresponde a sus ${a.ageYears} ${a.ageYears === 1 ? "año" : "años"} de antigüedad —una retención del ${pct(a.retention)}, ajustada al comportamiento de ${a.reference.brand} en el mercado de segunda mano— y después el factor de estado y los ajustes por accesorios y daños concretos de esta unidad. ` +
    `El resultado es un valor de mercado de ${fmtCents(a.marketCents)} (rango habitual de publicación entre ${fmtCents(Math.round(a.marketCents * 0.89))} y ${fmtCents(Math.round(a.marketCents * 1.14))}) y un precio justo de ${fmtCents(a.fairCents)} para esta unidad en particular. ` +
    // Con riesgo de fraude, la diferencia de precio no se narra como un ahorro:
    // el descuento es el gancho, no un beneficio para el comprador.
    (a.verdict === "ESTAFA_PROBABLE" && a.savingCents > 0
      ? `Se piden ${fmtCents(a.askingCents)}, un ${formatPercent(Math.abs(a.savingPct), 2)} por debajo de ese valor. Una diferencia de este tamaño en un anuncio con las señales detectadas no es una oportunidad: es el señuelo.`
      : a.savingCents > 0
      ? `Comprando a ${fmtCents(a.askingCents)} el ahorro frente al mercado es de ${fmtCents(a.savingCents)} (${formatPercent(a.savingPct, 2)}).`
      : `Comprando a ${fmtCents(a.askingCents)} se pagan ${fmtCents(-a.savingCents)} por encima del valor de mercado.`);

  const conditionParts: string[] = [
    `El estado declarado es «${CONDITION_LABELS[a.condition].toLowerCase()}»`,
  ];
  if (a.attr.batteryHealth != null) {
    conditionParts.push(`la batería está al ${a.attr.batteryHealth} %`);
  }
  if (a.attr.accessories.length > 0) {
    conditionParts.push(`incluye ${a.attr.accessories.join(", ").toLowerCase()}`);
  } else {
    conditionParts.push("no se mencionan accesorios incluidos");
  }
  if (a.attr.damages.length > 0) {
    conditionParts.push(`se han detectado estos defectos: ${a.attr.damages.join(", ").toLowerCase()}`);
  } else {
    conditionParts.push("no se describen daños");
  }
  const conditionReasoning =
    conditionParts.join(", ") +
    ". Cada uno de estos factores modifica el precio justo con un porcentaje fijo y documentado, visible en el desglose del cálculo.";

  const scamSignals = a.signals.filter((s) => s.kind === "scam");
  const riskSignals = a.signals.filter((s) => s.kind === "risk");
  const inconsistencies = a.signals.filter((s) => s.kind === "inconsistency");
  const positives = a.signals.filter((s) => s.kind === "positive");

  const riskParts: string[] = [];
  if (scamSignals.length > 0) {
    riskParts.push(
      `Se han detectado ${scamSignals.length} ${scamSignals.length === 1 ? "señal" : "señales"} compatibles con estafa: ${scamSignals.map((s) => s.title.toLowerCase()).join("; ")}.`,
    );
  } else {
    riskParts.push("No se han encontrado señales claras de estafa en el texto del anuncio.");
  }
  if (inconsistencies.length > 0) {
    riskParts.push(
      `Hay ${inconsistencies.length} ${inconsistencies.length === 1 ? "incoherencia" : "incoherencias"} en la información del vendedor: ${inconsistencies.map((s) => s.title.toLowerCase()).join("; ")}.`,
    );
  }
  if (riskSignals.length > 0) {
    riskParts.push(`Riesgos a tener en cuenta: ${riskSignals.map((s) => s.title.toLowerCase()).join("; ")}.`);
  }
  if (positives.length > 0) {
    riskParts.push(`A favor del anuncio: ${positives.map((s) => s.title.toLowerCase()).join("; ")}.`);
  }
  riskParts.push(`El índice de riesgo de estafa resultante es ${a.scamRisk}/100.`);
  const riskReasoning = riskParts.join(" ");

  const recommendation =
    a.verdict === "ESTAFA_PROBABLE"
      ? `No compres. El riesgo detectado (${a.scamRisk}/100) es demasiado alto para arriesgar ${fmtCents(a.askingCents)}. Si aun así quieres seguir, no pagues nada por adelantado: queda en un lugar público, comprueba el producto encendido, verifica el IMEI o número de serie y paga solo en mano.`
      : a.verdict === "CHOLLO"
        ? `Merece la pena. Ofrece ${fmtCents(a.negotiation.openingOfferCents)} para intentar cerrarlo aún más bajo, pero no dejes escapar la unidad por discutir ${fmtCents(Math.max(1000, a.askingCents - a.negotiation.targetCents))}: por encima de ${fmtCents(a.negotiation.walkAwayCents)} deja de ser interesante. Antes de pagar, comprueba en persona que enciende, que la cuenta del anterior propietario está borrada y que no hay bloqueo de operador.`
        : a.verdict === "CORRECTO"
          ? `Compra razonable. Empieza ofreciendo ${fmtCents(a.negotiation.openingOfferCents)} y cierra en torno a ${fmtCents(a.negotiation.targetCents)}; por encima de ${fmtCents(a.negotiation.walkAwayCents)} estarías pagando de más. Verifica el producto en persona antes de pagar.`
          : `Negocia o busca otra unidad. Ofrece ${fmtCents(a.negotiation.openingOfferCents)} y no pases de ${fmtCents(a.negotiation.walkAwayCents)}: al precio actual pagarías ${fmtCents(diff)} de más. Si el vendedor no baja, hay unidades equivalentes por menos.`;

  return { summary, priceReasoning, conditionReasoning, riskReasoning, recommendation };
}

// ---------------------------------------------------------------------------
// Informe cuando no se identifica el producto
// ---------------------------------------------------------------------------

/**
 * Si el modelo no está en el catálogo de referencia, NO se estima ningún precio:
 * inventar un valor de mercado sería exactamente lo que este producto no debe
 * hacer. Se devuelve un informe honesto centrado en riesgos, con el precio
 * pedido como única cifra y las instrucciones para completar el análisis.
 */
function unidentifiedReport(
  input: EngineInput,
  now: Date,
  condition: ConditionKey,
): AnalysisReport {
  const attr = input.attributes;
  const { signals, scamRisk } = evaluateSignals({
    attributes: attr,
    text: input.text,
    marketCents: null,
    askingCents: input.askingCents,
    ageYears: null,
    imageCount: input.imageCount,
    identified: false,
  });

  const asking = input.askingCents;
  const confidence = clamp(computeConfidence(attr, input, null) - 20, 5, 45);

  return {
    engineVersion: ENGINE_VERSION,
    generatedAt: now.toISOString(),
    product: {
      category: attr.category,
      categoryLabel: attr.category ? CATEGORY_LABELS[attr.category] : "Sin identificar",
      brand: attr.brand,
      model: attr.model,
      storageGb: attr.storageGb,
      color: attr.color,
      condition: attr.condition,
      conditionLabel: attr.condition ? CONDITION_LABELS[attr.condition] : "Sin determinar",
      accessories: attr.accessories,
      damages: attr.damages,
      batteryHealth: attr.batteryHealth,
    },
    pricing: {
      askingCents: asking,
      marketCents: 0,
      marketLowCents: 0,
      marketHighCents: 0,
      fairCents: 0,
      savingCents: 0,
      savingPct: 0,
      negotiationUpsideCents: 0,
    },
    // Sin modelo identificado no hay juicio de precio posible: decir
    // "correcto" sería afirmar algo que no se ha calculado.
    verdict: scamRisk >= VERDICT_THRESHOLDS.scamOverride ? "ESTAFA_PROBABLE" : "SIN_VALORAR",
    score: clamp(Math.round((100 - scamRisk) * 0.5), 1, 55),
    buyProbability: clamp(Math.round((100 - scamRisk) * 0.6), 1, 70),
    scamRisk,
    confidence,
    signals,
    breakdown: {
      reference: null,
      ageYears: 0,
      retention: 0,
      conditionFactor: CONDITION_FACTOR[condition],
      adjustmentFactor: 1,
      steps: [
        {
          label: "Producto no identificado en el catálogo de referencia",
          detail:
            "No se ha podido determinar el modelo exacto, así que no se calcula ningún precio de mercado: dar una cifra sin referencia real sería inventarla. Indica marca y modelo completos (o sube una captura del anuncio con el título) para obtener la valoración de precio.",
        },
      ],
      caveats: [
        "Este informe no incluye valoración de precio porque falta identificar el modelo. El análisis de riesgos y señales de estafa sí es válido.",
      ],
    },
    negotiation: {
      targetCents: 0,
      openingOfferCents: 0,
      walkAwayCents: 0,
      arguments: [
        "Antes de negociar, pide al vendedor el modelo exacto y la capacidad (en Ajustes → Información del dispositivo).",
        "Pide también el número de serie o IMEI: permite verificar el modelo real y comprobar que no está bloqueado.",
      ],
      message:
        "Hola, me interesa el producto. ¿Me puedes confirmar el modelo exacto y la capacidad que aparecen en Ajustes → Información, y si incluye caja y factura? Con esos datos te digo algo enseguida.",
    },
    explanation: {
      summary: `No se ha podido identificar el modelo exacto del anuncio, así que este informe no estima precio de mercado: solo analiza riesgos. El vendedor pide ${fmtCents(asking)}. Índice de riesgo de estafa: ${scamRisk}/100.`,
      priceReasoning:
        "DealScan AI solo estima precios cuando puede anclarlos a un modelo concreto del catálogo de referencia (PVP oficial de lanzamiento + curva de depreciación). Sin esa referencia no se genera ninguna cifra, porque un precio sin base real no sirve para decidir. Añade marca y modelo completos y el informe incluirá la valoración.",
      conditionReasoning:
        attr.condition != null
          ? `El estado declarado es «${CONDITION_LABELS[attr.condition].toLowerCase()}».` +
            (attr.damages.length > 0 ? ` Defectos detectados: ${attr.damages.join(", ").toLowerCase()}.` : "")
          : "El anuncio no permite determinar el estado del producto.",
      riskReasoning:
        signals.length > 0
          ? `Señales detectadas: ${signals.map((s) => s.title.toLowerCase()).join("; ")}. Índice de riesgo: ${scamRisk}/100.`
          : "No se han detectado señales de riesgo en el texto aportado.",
      recommendation:
        scamRisk >= VERDICT_THRESHOLDS.scamOverride
          ? "No sigas adelante con este anuncio: las señales de fraude son suficientes para descartarlo sin necesidad de valorar el precio."
          : "Pide al vendedor el modelo exacto y vuelve a lanzar el análisis: con esa información el informe incluirá precio de mercado, ahorro estimado y plan de negociación.",
    },
    provenance: {
      inputs: input.inputs,
      aiUsedFor: input.aiUsedFor,
      aiModel: input.aiModel,
      catalogSource: null,
      extractionEvidence: attr.evidence,
    },
  };
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}

function pct(factor: number): string {
  return `${Math.round(factor * 100)} %`;
}

export function formatStorage(gb: number): string {
  return gb >= 1024 && gb % 1024 === 0 ? `${gb / 1024} TB` : `${gb} GB`;
}

export function fmtCents(cents: number): string {
  return formatEuros(cents);
}
