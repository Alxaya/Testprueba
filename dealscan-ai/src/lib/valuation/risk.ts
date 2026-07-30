import { formatEuros } from "../money";
import { normalize } from "./extract";
import type { ExtractedAttributes, Signal } from "./types";

/**
 * Detección de señales de estafa, riesgos e incoherencias.
 *
 * Cada regla es explícita y auditable: tiene un peso documentado sobre el índice
 * de riesgo y devuelve el fragmento del anuncio que la activó. Nada es opaco:
 * el usuario siempre puede ver por qué se ha marcado algo.
 *
 * Las reglas están basadas en los patrones de fraude habituales en plataformas
 * de segunda mano (pago fuera de plataforma, vendedor "en el extranjero",
 * reservas por adelantado, terminales bloqueados por cuenta o IMEI).
 */

interface TextRule {
  code: string;
  kind: Signal["kind"];
  severity: Signal["severity"];
  weight: number;
  title: string;
  detail: string;
  patterns: RegExp;
}

const SCAM_TEXT_RULES: TextRule[] = [
  {
    code: "off_platform_payment",
    kind: "scam",
    severity: "critical",
    weight: 32,
    title: "Pide pagar fuera de la plataforma",
    detail:
      "El vendedor propone Bizum, transferencia o efectivo por adelantado sin usar el sistema de pago protegido. Es el patrón de fraude más común: sin la plataforma de por medio no hay forma de reclamar el dinero. Insiste en usar el pago protegido o en pagar en mano tras probar el producto.",
    patterns:
      /\b(bizum|transferencia bancaria|paypal amigos|paypal familia|western union|money ?gram|revolut|pago por adelantado|pagar por adelantado|fuera de la (app|plataforma)|te paso mi (iban|cuenta))\b/,
  },
  {
    code: "seller_abroad",
    kind: "scam",
    severity: "critical",
    weight: 30,
    title: "El vendedor dice estar fuera o de viaje",
    detail:
      "«Estoy en el extranjero / de viaje / me he mudado» combinado con envío es una excusa clásica para justificar que no puedes ver el producto ni entregarlo en mano. No hay forma de verificar que el artículo existe.",
    patterns:
      /\b(estoy en el extranjero|vivo fuera de espa[nñ]a|estoy de viaje|me he mudado a|estoy fuera del pa[ií]s|trabajo en el extranjero|actualmente en (londres|alemania|francia|italia|portugal))\b/,
  },
  {
    code: "no_inspection",
    kind: "scam",
    severity: "high",
    weight: 22,
    title: "No permite ver ni probar el producto",
    detail:
      "Se niega a entregar en mano, a hacer videollamada o a enviar fotos adicionales. Un vendedor legítimo no tiene problema en demostrar que el producto existe y funciona.",
    patterns:
      /\b(no puedo enviar (m[aá]s )?fotos|no hago videollamada|no se puede ver antes|no acepto ver el producto|solo env[ií]o|no entrego en mano|no admito pruebas)\b/,
  },
  {
    code: "advance_deposit",
    kind: "scam",
    severity: "high",
    weight: 24,
    title: "Exige una señal o reserva por adelantado",
    detail:
      "Pedir una «señal» para reservar antes de ver el producto es un método habitual de estafa: se cobra a varios compradores y no se entrega nada. Nunca pagues una reserva sin ver el artículo.",
    patterns:
      /\b(se[nñ]al para reservar|dejar una se[nñ]al|reserva con \d|pago de reserva|para reservarlo hay que|adelanto del \d{1,2}%)\b/,
  },
  {
    code: "account_locked",
    kind: "scam",
    severity: "critical",
    weight: 34,
    title: "Posible bloqueo por cuenta (iCloud / Google)",
    detail:
      "Un dispositivo con cuenta iCloud o Google del anterior propietario es un pisapapeles: no se puede activar ni restaurar y no existe forma de desbloquearlo. Exige que el vendedor lo borre delante de ti (Ajustes → Borrar contenido) y que quede en la pantalla de bienvenida.",
    patterns:
      /\b(bloqueado por icloud|cuenta icloud del anterior|no recuerdo la contrase[nñ]a de icloud|pide cuenta anterior|bloqueo de cuenta|no se puede resetear|pide el pin del anterior|cuenta google anterior|frp)\b/,
  },
  {
    code: "imei_blocked",
    kind: "scam",
    severity: "critical",
    weight: 30,
    title: "Indicios de IMEI bloqueado o terminal robado",
    detail:
      "Un IMEI en lista negra deja el teléfono sin cobertura en todas las operadoras. Antes de pagar, pide el IMEI y compruébalo; si el vendedor se niega a dar el IMEI, no compres.",
    patterns:
      /\b(imei bloqueado|lista negra|no funciona con (movistar|vodafone|orange)|solo funciona con wifi|sin cobertura|no coge se[nñ]al|libre pero solo wifi)\b/,
  },
  {
    code: "urgency_pressure",
    kind: "scam",
    severity: "medium",
    weight: 12,
    title: "Presión por urgencia",
    detail:
      "Las prisas artificiales («solo hoy», «primera persona que pague») buscan que no verifiques nada. Un precio real aguanta que te tomes un día para comprobar el producto.",
    patterns:
      /\b(urge vender|solo por hoy|[uú]ltimo d[ií]a|primera persona que (pague|lo reserve)|me corre prisa|vendo ya|antes de las \d+h)\b/,
  },
  {
    code: "sealed_but_cheap",
    kind: "scam",
    severity: "high",
    weight: 18,
    title: "«Precintado» a precio muy bajo",
    detail:
      "Un producto nuevo y sellado muy por debajo del mercado suele ser una caja vacía, una unidad falsificada o un artículo de procedencia ilícita. Comprueba el número de serie con el fabricante antes de pagar.",
    patterns: /\b(precintad[oa]|sin abrir|sellad[oa]|a estrenar)\b/,
  },
  {
    code: "no_invoice_new",
    kind: "risk",
    severity: "medium",
    weight: 8,
    title: "Sin factura ni garantía",
    detail:
      "Sin factura no hay garantía del fabricante ni prueba de propiedad. No invalida la compra, pero reduce el valor del producto y te deja sin cobertura si falla.",
    patterns: /\b(sin factura|no tengo factura|sin garant[ií]a|no tiene garant[ií]a|perd[ií] la factura)\b/,
  },
  {
    code: "external_link",
    kind: "scam",
    severity: "high",
    weight: 20,
    title: "Redirige a un enlace o web externa",
    detail:
      "Los enlaces a webs de «pago seguro» o «verificación» fuera de la plataforma son phishing: replican la página real para capturar tu tarjeta. Nunca introduzcas datos de pago en un enlace enviado por el vendedor.",
    patterns:
      /\b(entra en este enlace|verifica tu cuenta en|completa el pago en|http:\/\/bit\.ly|pago seguro en|formulario de entrega)\b/,
  },
  {
    code: "contact_off_platform",
    kind: "scam",
    severity: "medium",
    weight: 10,
    title: "Empuja a hablar por WhatsApp o Telegram",
    detail:
      "Sacar la conversación de la plataforma elimina el registro del trato. Si acabas en WhatsApp, la plataforma no puede mediar ni devolverte el dinero. Mantén la negociación en el chat oficial.",
    patterns:
      /\b(escr[ií]beme al whatsapp|mi whatsapp es|háblame por telegram|te paso mi n[uú]mero|contacto por wasap|\+34\s?\d{2}\s?\d{3}\s?\d{2}\s?\d{2})\b/,
  },
  {
    code: "stock_photos",
    kind: "scam",
    severity: "medium",
    weight: 14,
    title: "Fotos que parecen de catálogo",
    detail:
      "Imágenes de prensa o de la web del fabricante en lugar del producto real. Pide fotos del artículo encendido, con la fecha del día visible en pantalla y con el número de serie.",
    patterns:
      /\b(foto de (internet|catalogo|muestra)|imagen de referencia|fotos gen[eé]ricas|foto ilustrativa)\b/,
  },
  {
    code: "shipping_only_unusual",
    kind: "risk",
    severity: "low",
    weight: 6,
    title: "Solo acepta envío",
    detail:
      "No es necesariamente fraude, pero pierdes la posibilidad de probar el producto antes de pagar. Usa siempre el envío protegido de la plataforma para conservar el derecho de devolución.",
    patterns: /\b(solo env[ií]o|[uú]nicamente env[ií]o|no entrego en persona)\b/,
  },
];

const RISK_TEXT_RULES: TextRule[] = [
  {
    code: "unofficial_repair",
    kind: "risk",
    severity: "medium",
    weight: 5,
    title: "Reparado en servicio no oficial",
    detail:
      "Las reparaciones no oficiales pueden usar piezas genéricas, anular la resistencia al agua y provocar avisos de «pieza desconocida». Reduce el valor de reventa entre un 10 % y un 20 %.",
    patterns:
      /\b(reparad[oa] en (tienda|un sitio)|servicio no oficial|pieza gen[eé]rica|repuesto compatible|arreglad[oa] por mi)\b/,
  },
  {
    code: "jailbreak_root",
    kind: "risk",
    severity: "medium",
    weight: 5,
    title: "Dispositivo modificado (jailbreak / root)",
    detail:
      "Un sistema modificado puede tener la garantía anulada, fallos de seguridad y problemas para recibir actualizaciones. Restaura el dispositivo a fábrica antes de usarlo.",
    patterns: /\b(jailbreak|rooteado|root|bootloader desbloqueado|custom rom|magisk)\b/,
  },
  {
    code: "no_returns",
    kind: "risk",
    severity: "low",
    weight: 3,
    title: "No admite devoluciones",
    detail:
      "Sin devolución, cualquier fallo posterior es tu problema. Prueba a fondo el producto en el momento de la entrega: cámaras, altavoces, micrófono, carga, Wi-Fi y todos los botones.",
    patterns: /\b(no admito devoluciones|sin devoluci[oó]n|venta sin garant[ií]a de devoluci[oó]n|no se aceptan cambios)\b/,
  },
];

/** Reglas de texto: escanean el anuncio original. */
function evaluateTextRules(text: string, rules: TextRule[]): Signal[] {
  const haystack = normalize(text);
  const signals: Signal[] = [];
  for (const rule of rules) {
    const m = rule.patterns.exec(haystack);
    if (!m) continue;
    const start = Math.max(0, m.index - 45);
    const end = Math.min(haystack.length, m.index + m[0].length + 45);
    signals.push({
      code: rule.code,
      kind: rule.kind,
      severity: rule.severity,
      weight: rule.weight,
      title: rule.title,
      detail: rule.detail,
      evidence: (start > 0 ? "…" : "") + haystack.slice(start, end).trim() + (end < haystack.length ? "…" : ""),
    });
  }
  return signals;
}

export interface RiskContext {
  attributes: ExtractedAttributes;
  text: string;
  /** Valor de mercado calculado, en céntimos (para reglas de precio). */
  marketCents: number | null;
  askingCents: number;
  /** Antigüedad del modelo en años. */
  ageYears: number | null;
  /** Número de imágenes aportadas por el usuario. */
  imageCount: number;
  /** true si el modelo se identificó en el catálogo de referencia. */
  identified: boolean;
}

/**
 * Evalúa todas las señales del anuncio.
 * Devuelve la lista completa y el índice de riesgo de estafa (0-100).
 */
export function evaluateSignals(ctx: RiskContext): { signals: Signal[]; scamRisk: number } {
  const signals: Signal[] = [
    ...evaluateTextRules(ctx.text, SCAM_TEXT_RULES),
    ...evaluateTextRules(ctx.text, RISK_TEXT_RULES),
  ];

  // --- Reglas de precio: solo si tenemos referencia de mercado -------------
  if (ctx.marketCents != null && ctx.marketCents > 0) {
    const ratio = ctx.askingCents / ctx.marketCents;
    if (ratio < 0.35) {
      signals.push({
        code: "price_impossibly_low",
        kind: "scam",
        severity: "critical",
        weight: 38,
        title: `Precio ${Math.round((1 - ratio) * 100)} % por debajo del mercado`,
        detail: `Se piden ${fmt(ctx.askingCents)} por algo que en el mercado de segunda mano vale alrededor de ${fmt(ctx.marketCents)}. Una diferencia de este tamaño casi nunca es una oportunidad: es el gancho de una estafa, un producto robado o bloqueado, o una réplica. Verifica el producto en persona antes de pagar un solo euro.`,
        evidence: `Precio pedido ${fmt(ctx.askingCents)} frente a mercado ${fmt(ctx.marketCents)}`,
      });
    } else if (ratio < 0.5) {
      signals.push({
        code: "price_very_low",
        kind: "scam",
        severity: "high",
        weight: 20,
        title: `Precio muy por debajo del mercado (${Math.round((1 - ratio) * 100)} % menos)`,
        detail:
          "Puede ser una venta urgente legítima, pero también el señuelo típico de un fraude. Pide fotos del producto encendido con la fecha de hoy visible, el IMEI o número de serie, y paga en mano tras comprobarlo.",
        evidence: `Precio pedido ${fmt(ctx.askingCents)} frente a mercado ${fmt(ctx.marketCents)}`,
      });
    }
  }

  // --- Incoherencias -------------------------------------------------------
  const { attributes: attr } = ctx;
  const haystack = normalize(ctx.text);

  // Se compara con lo que el vendedor AFIRMA, no con el estado ya corregido:
  // la contradicción entre "precintado" y "tiene arañazos" es justo el dato útil.
  const claimsNew = attr.conditionClaims.includes("new");
  const claimsLikeNew = attr.conditionClaims.includes("like_new");

  if ((claimsNew || claimsLikeNew) && attr.damages.length > 0) {
    signals.push({
      code: "inconsistent_new_with_damage",
      kind: "inconsistency",
      severity: claimsNew ? "high" : "medium",
      weight: claimsNew ? 16 : 8,
      title: claimsNew ? "Dice «nuevo» pero describe daños" : "Dice «como nuevo» pero describe daños",
      detail: `El anuncio se presenta como ${claimsNew ? "nuevo o precintado" : "como nuevo"} y a la vez menciona ${attr.damages
        .join(", ")
        .toLowerCase()}. Las dos cosas no pueden ser ciertas. La valoración se ha hecho con el estado peor de los dos, pero pregunta directamente y pide fotos del defecto antes de decidir.`,
      evidence: attr.damages.join(" · "),
    });
  }

  if (claimsNew && attr.batteryHealth != null && attr.batteryHealth < 100) {
    signals.push({
      code: "inconsistent_new_battery",
      kind: "inconsistency",
      severity: "medium",
      weight: 12,
      title: `«Nuevo» con batería al ${attr.batteryHealth} %`,
      detail:
        "Un dispositivo realmente precintado marca el 100 % de salud de batería. Un valor inferior indica que se ha usado, así que el estado declarado no es correcto.",
      evidence: `Salud de batería declarada: ${attr.batteryHealth} %`,
    });
  }

  if (attr.storageGb != null && attr.slug == null && attr.brand != null) {
    signals.push({
      code: "model_not_identified",
      kind: "risk",
      severity: "low",
      weight: 0,
      title: "Modelo exacto sin confirmar",
      detail:
        "Se ha identificado la marca pero no el modelo concreto en el catálogo de referencia, así que la valoración es aproximada. Pide al vendedor el modelo exacto (Ajustes → Información) para afinar el precio.",
    });
  }

  if (/\b(libre|desbloqueado)\b/.test(haystack) && /\b(solo funciona con|bloqueado con|operador)\b/.test(haystack)) {
    signals.push({
      code: "inconsistent_unlocked",
      kind: "inconsistency",
      severity: "high",
      weight: 15,
      title: "Dice «libre» y a la vez menciona bloqueo de operador",
      detail:
        "El anuncio se contradice sobre si el terminal está libre. Un móvil bloqueado a una operadora vale bastante menos y puede requerir un desbloqueo que no siempre es posible. Confírmalo con el IMEI antes de comprar.",
    });
  }

  if (ctx.imageCount === 0 && attr.damages.length === 0 && attr.condition !== null) {
    signals.push({
      code: "no_images_provided",
      kind: "risk",
      severity: "low",
      weight: 4,
      title: "Sin imágenes que verificar",
      detail:
        "El análisis se basa solo en el texto. Sube capturas del anuncio para que se revisen los daños visibles, la coherencia de las fotos y los detalles de la pantalla.",
    });
  }

  if (attr.batteryHealth != null && attr.batteryHealth < 80) {
    signals.push({
      code: "battery_degraded",
      kind: "risk",
      severity: "medium",
      weight: 6,
      title: `Batería degradada (${attr.batteryHealth} %)`,
      detail:
        "Por debajo del 80 % la batería está fuera del rango de servicio y el dispositivo puede apagarse antes de tiempo o limitar su rendimiento. Sustituirla cuesta entre 50 € y 120 € según modelo: descuéntalo del precio.",
      evidence: `Salud de batería: ${attr.batteryHealth} %`,
    });
  }

  if (ctx.ageYears != null && ctx.ageYears >= 6) {
    signals.push({
      code: "end_of_support",
      kind: "risk",
      severity: "medium",
      weight: 4,
      title: `Modelo de hace ${ctx.ageYears} años`,
      detail:
        "Un dispositivo de esta antigüedad está cerca del fin de soporte de software: dejará de recibir actualizaciones de seguridad y algunas apps dejarán de ser compatibles. Cuenta con una vida útil corta.",
    });
  }

  // --- Señales positivas ---------------------------------------------------
  if (attr.accessories.includes("Factura de compra")) {
    signals.push({
      code: "has_invoice",
      kind: "positive",
      severity: "info",
      weight: 0,
      title: "Incluye factura de compra",
      detail:
        "La factura acredita la propiedad, permite reclamar la garantía del fabricante y descarta que el producto sea robado. Es una de las mejores señales de un vendedor legítimo.",
    });
  }
  if (attr.accessories.includes("Garantía vigente")) {
    signals.push({
      code: "has_warranty",
      kind: "positive",
      severity: "info",
      weight: 0,
      title: "Garantía todavía vigente",
      detail:
        "Si queda garantía del fabricante, cualquier avería de fábrica está cubierta. Esto justifica pagar algo más que por una unidad sin garantía.",
    });
  }
  if (attr.accessories.includes("Caja original")) {
    signals.push({
      code: "has_box",
      kind: "positive",
      severity: "info",
      weight: 0,
      title: "Con caja y accesorios originales",
      detail:
        "La caja original con sus accesorios añade entre un 2 % y un 5 % al valor de reventa y suele indicar un propietario cuidadoso.",
    });
  }

  // El precintado solo es sospechoso si además el precio es anormalmente bajo.
  const sealed = signals.find((s) => s.code === "sealed_but_cheap");
  if (sealed) {
    const ratio = ctx.marketCents ? ctx.askingCents / ctx.marketCents : 1;
    if (ratio >= 0.6) {
      signals.splice(signals.indexOf(sealed), 1);
    }
  }

  const scamRisk = clamp(
    Math.round(signals.reduce((total, s) => total + s.weight, 0)),
    0,
    100,
  );

  return { signals: dedupe(signals), scamRisk };
}

function dedupe(signals: Signal[]): Signal[] {
  const seen = new Set<string>();
  const out: Signal[] = [];
  const order: Record<Signal["severity"], number> = {
    critical: 0,
    high: 1,
    medium: 2,
    low: 3,
    info: 4,
  };
  for (const s of signals) {
    if (seen.has(s.code)) continue;
    seen.add(s.code);
    out.push(s);
  }
  return out.sort((a, b) => order[a.severity] - order[b.severity] || b.weight - a.weight);
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}

function fmt(cents: number): string {
  return formatEuros(cents);
}
