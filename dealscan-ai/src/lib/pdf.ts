import { PDFDocument, StandardFonts, rgb, type PDFFont, type PDFPage } from "pdf-lib";
import { CONDITION_LABELS, VERDICT_LABELS, type AnalysisReport } from "./valuation/types";
import { formatStorage } from "./valuation/engine";
import { formatInteger } from "./money";

/**
 * Generación del informe en PDF con pdf-lib (JavaScript puro: no necesita
 * navegador headless ni fuentes externas, así que funciona igual en local, en
 * Docker y en un entorno serverless).
 *
 * Se usan las fuentes estándar Helvetica con codificación WinAnsi, que cubre
 * los caracteres del español (tildes, ñ, €).
 */

const A4 = { width: 595.28, height: 841.89 };
const MARGIN = 48;
const CONTENT_WIDTH = A4.width - MARGIN * 2;

const COLORS = {
  ink: rgb(0.08, 0.09, 0.13),
  muted: rgb(0.42, 0.45, 0.52),
  line: rgb(0.87, 0.89, 0.92),
  brand: rgb(0.02, 0.47, 0.42),
  good: rgb(0.05, 0.55, 0.35),
  warn: rgb(0.72, 0.45, 0.02),
  bad: rgb(0.75, 0.17, 0.17),
  panel: rgb(0.97, 0.98, 0.99),
};

interface Ctx {
  doc: PDFDocument;
  page: PDFPage;
  y: number;
  regular: PDFFont;
  bold: PDFFont;
  pageNumber: number;
}

/** WinAnsi no admite algunos caracteres tipográficos: se sustituyen. */
function sanitize(text: string): string {
  return text
    .replace(/[‘’‚]/g, "'")
    .replace(/[“”„]/g, '"')
    .replace(/—/g, "—")
    .replace(/–/g, "-")
    .replace(/…/g, "...")
    .replace(/ /g, " ")
    .replace(/−/g, "-")
    .replace(/[•▪]/g, "-")
    // Cualquier carácter que WinAnsi no cubra (emoji, símbolos raros) se cae.
    .replace(/[^\x09\x0a\x0d\x20-\x7e¡-ÿ€—]/g, "");
}

function wrap(text: string, font: PDFFont, size: number, maxWidth: number): string[] {
  const lines: string[] = [];
  for (const paragraph of sanitize(text).split("\n")) {
    const words = paragraph.split(/\s+/).filter(Boolean);
    if (words.length === 0) {
      lines.push("");
      continue;
    }
    let current = "";
    for (const word of words) {
      const candidate = current ? `${current} ${word}` : word;
      if (font.widthOfTextAtSize(candidate, size) <= maxWidth) {
        current = candidate;
      } else {
        if (current) lines.push(current);
        // Palabra más larga que la línea: se corta por caracteres.
        if (font.widthOfTextAtSize(word, size) > maxWidth) {
          let chunk = "";
          for (const char of word) {
            if (font.widthOfTextAtSize(chunk + char, size) > maxWidth) {
              lines.push(chunk);
              chunk = char;
            } else {
              chunk += char;
            }
          }
          current = chunk;
        } else {
          current = word;
        }
      }
    }
    if (current) lines.push(current);
  }
  return lines;
}

function newPage(ctx: Ctx): void {
  ctx.page = ctx.doc.addPage([A4.width, A4.height]);
  ctx.pageNumber += 1;
  ctx.y = A4.height - MARGIN;
  footer(ctx);
}

function ensure(ctx: Ctx, needed: number): void {
  if (ctx.y - needed < MARGIN + 28) newPage(ctx);
}

function footer(ctx: Ctx): void {
  const label = sanitize(`DealScan AI — informe generado automaticamente · pagina ${ctx.pageNumber}`);
  ctx.page.drawText(label, {
    x: MARGIN,
    y: MARGIN - 18,
    size: 8,
    font: ctx.regular,
    color: COLORS.muted,
  });
}

function heading(ctx: Ctx, text: string): void {
  ensure(ctx, 44);
  ctx.y -= 12;
  ctx.page.drawText(sanitize(text.toUpperCase()), {
    x: MARGIN,
    y: ctx.y,
    size: 9,
    font: ctx.bold,
    color: COLORS.brand,
  });
  ctx.y -= 8;
  ctx.page.drawLine({
    start: { x: MARGIN, y: ctx.y },
    end: { x: MARGIN + CONTENT_WIDTH, y: ctx.y },
    thickness: 0.75,
    color: COLORS.line,
  });
  ctx.y -= 16;
}

function paragraph(ctx: Ctx, text: string, opts: { size?: number; bold?: boolean; color?: ReturnType<typeof rgb>; indent?: number } = {}): void {
  const size = opts.size ?? 9.5;
  const font = opts.bold ? ctx.bold : ctx.regular;
  const indent = opts.indent ?? 0;
  const lines = wrap(text, font, size, CONTENT_WIDTH - indent);
  const lineHeight = size * 1.45;

  for (const line of lines) {
    ensure(ctx, lineHeight);
    ctx.page.drawText(line, {
      x: MARGIN + indent,
      y: ctx.y,
      size,
      font,
      color: opts.color ?? COLORS.ink,
    });
    ctx.y -= lineHeight;
  }
}

function bullet(ctx: Ctx, title: string, detail?: string): void {
  ensure(ctx, 26);
  ctx.page.drawText("-", { x: MARGIN, y: ctx.y, size: 9.5, font: ctx.bold, color: COLORS.brand });
  paragraphAt(ctx, title, MARGIN + 12, 9.5, ctx.bold);
  if (detail) paragraphAt(ctx, detail, MARGIN + 12, 8.8, ctx.regular, COLORS.muted);
  ctx.y -= 4;
}

function paragraphAt(
  ctx: Ctx,
  text: string,
  x: number,
  size: number,
  font: PDFFont,
  color = COLORS.ink,
): void {
  const lines = wrap(text, font, size, CONTENT_WIDTH - (x - MARGIN));
  const lineHeight = size * 1.4;
  for (const line of lines) {
    ensure(ctx, lineHeight);
    ctx.page.drawText(line, { x, y: ctx.y, size, font, color });
    ctx.y -= lineHeight;
  }
}

function eur(cents: number): string {
  // En el PDF se escribe "EUR" en lugar de "€" para no depender de la
  // codificación del símbolo en la fuente estándar.
  return `${formatInteger(Math.abs(cents) / 100)} EUR`;
}

function verdictColor(verdict: AnalysisReport["verdict"]) {
  switch (verdict) {
    case "CHOLLO":
      return COLORS.good;
    case "CORRECTO":
      return COLORS.brand;
    case "CARO":
      return COLORS.warn;
    case "ESTAFA_PROBABLE":
      return COLORS.bad;
    case "SIN_VALORAR":
      return COLORS.muted;
  }
}

/** Tarjeta con una métrica destacada. */
function metricRow(ctx: Ctx, metrics: { label: string; value: string; color?: ReturnType<typeof rgb> }[]): void {
  const height = 46;
  ensure(ctx, height + 10);
  const columnWidth = CONTENT_WIDTH / metrics.length;
  const top = ctx.y;

  ctx.page.drawRectangle({
    x: MARGIN,
    y: top - height,
    width: CONTENT_WIDTH,
    height,
    color: COLORS.panel,
    borderColor: COLORS.line,
    borderWidth: 0.75,
  });

  metrics.forEach((metric, index) => {
    const x = MARGIN + columnWidth * index + 10;
    ctx.page.drawText(sanitize(metric.label.toUpperCase()), {
      x,
      y: top - 16,
      size: 6.8,
      font: ctx.bold,
      color: COLORS.muted,
    });
    ctx.page.drawText(sanitize(metric.value), {
      x,
      y: top - 34,
      size: 13,
      font: ctx.bold,
      color: metric.color ?? COLORS.ink,
    });
  });

  ctx.y = top - height - 12;
}

export interface PdfMeta {
  analysisId: string;
  createdAt: Date;
  sourceUrl: string | null;
  /** Nombre o email de quien genera el informe (puede omitirse). */
  requestedBy?: string | null;
  shareUrl?: string | null;
}

export async function buildAnalysisPdf(
  report: AnalysisReport,
  meta: PdfMeta,
): Promise<Uint8Array> {
  const doc = await PDFDocument.create();
  const regular = await doc.embedFont(StandardFonts.Helvetica);
  const bold = await doc.embedFont(StandardFonts.HelveticaBold);

  const ctx: Ctx = {
    doc,
    page: doc.addPage([A4.width, A4.height]),
    y: A4.height - MARGIN,
    regular,
    bold,
    pageNumber: 1,
  };
  footer(ctx);

  doc.setTitle(
    `DealScan AI - ${[report.product.brand, report.product.model].filter(Boolean).join(" ") || "Informe"}`,
  );
  doc.setProducer("DealScan AI");
  doc.setCreator("DealScan AI");
  doc.setCreationDate(meta.createdAt);

  // ------------------------------------------------------------- cabecera
  ctx.page.drawText("DealScan AI", {
    x: MARGIN,
    y: ctx.y,
    size: 20,
    font: bold,
    color: COLORS.brand,
  });
  ctx.y -= 18;
  ctx.page.drawText(sanitize("Informe de analisis de compra de segunda mano"), {
    x: MARGIN,
    y: ctx.y,
    size: 9.5,
    font: regular,
    color: COLORS.muted,
  });
  ctx.y -= 26;

  const productName =
    [report.product.brand, report.product.model].filter(Boolean).join(" ") ||
    "Producto sin identificar";
  const productDetails = [
    report.product.storageGb ? formatStorage(report.product.storageGb) : null,
    report.product.color,
    report.product.condition ? CONDITION_LABELS[report.product.condition] : null,
  ]
    .filter(Boolean)
    .join(" · ");

  ctx.page.drawText(sanitize(productName), { x: MARGIN, y: ctx.y, size: 15, font: bold, color: COLORS.ink });
  ctx.y -= 15;
  if (productDetails) {
    ctx.page.drawText(sanitize(productDetails), {
      x: MARGIN,
      y: ctx.y,
      size: 9.5,
      font: regular,
      color: COLORS.muted,
    });
    ctx.y -= 14;
  }

  const metaLine = [
    `Informe ${meta.analysisId.slice(0, 8)}`,
    meta.createdAt.toLocaleString("es-ES", { dateStyle: "long", timeStyle: "short" }),
    meta.requestedBy ? `Solicitado por ${meta.requestedBy}` : null,
  ]
    .filter(Boolean)
    .join("  ·  ");
  ctx.page.drawText(sanitize(metaLine), {
    x: MARGIN,
    y: ctx.y,
    size: 8,
    font: regular,
    color: COLORS.muted,
  });
  ctx.y -= 22;

  // -------------------------------------------------------------- veredicto
  const identified = report.pricing.marketCents > 0;

  metricRow(ctx, [
    { label: "Veredicto", value: VERDICT_LABELS[report.verdict], color: verdictColor(report.verdict) },
    { label: "Valoracion", value: `${report.score}/100` },
    { label: "Buena compra", value: `${report.buyProbability} %` },
    { label: "Riesgo estafa", value: `${report.scamRisk}/100`, color: report.scamRisk >= 40 ? COLORS.bad : COLORS.ink },
  ]);

  if (identified) {
    metricRow(ctx, [
      { label: "Precio pedido", value: eur(report.pricing.askingCents) },
      { label: "Valor de mercado", value: eur(report.pricing.marketCents) },
      { label: "Precio justo", value: eur(report.pricing.fairCents) },
      {
        label: report.pricing.savingCents >= 0 ? "Ahorro estimado" : "Sobreprecio",
        value: eur(Math.abs(report.pricing.savingCents)),
        color: report.pricing.savingCents >= 0 ? COLORS.good : COLORS.bad,
      },
    ]);
    metricRow(ctx, [
      { label: "Rango de mercado", value: `${eur(report.pricing.marketLowCents)} - ${eur(report.pricing.marketHighCents)}` },
      { label: "Precio a negociar", value: eur(report.negotiation.targetCents), color: COLORS.brand },
      { label: "Oferta inicial", value: eur(report.negotiation.openingOfferCents), color: COLORS.brand },
      { label: "No pagar mas de", value: eur(report.negotiation.walkAwayCents) },
    ]);
  }

  // ------------------------------------------------------------- resumen
  heading(ctx, "Resumen");
  paragraph(ctx, report.explanation.summary);

  heading(ctx, "Analisis del precio");
  paragraph(ctx, report.explanation.priceReasoning);

  heading(ctx, "Estado del producto");
  paragraph(ctx, report.explanation.conditionReasoning);
  if (report.product.accessories.length > 0) {
    ctx.y -= 4;
    paragraph(ctx, `Accesorios incluidos: ${report.product.accessories.join(", ")}`, {
      size: 9,
      color: COLORS.muted,
    });
  }
  if (report.product.damages.length > 0) {
    paragraph(ctx, `Danos detectados: ${report.product.damages.join(", ")}`, {
      size: 9,
      color: COLORS.bad,
    });
  }
  if (report.product.batteryHealth != null) {
    paragraph(ctx, `Salud de bateria declarada: ${report.product.batteryHealth} %`, {
      size: 9,
      color: COLORS.muted,
    });
  }

  // -------------------------------------------------------------- señales
  const scams = report.signals.filter((s) => s.kind === "scam");
  const inconsistencies = report.signals.filter((s) => s.kind === "inconsistency");
  const risks = report.signals.filter((s) => s.kind === "risk");
  const positives = report.signals.filter((s) => s.kind === "positive");

  heading(ctx, "Senales de estafa");
  if (scams.length === 0) {
    paragraph(ctx, "No se han detectado senales de estafa en la informacion analizada.", {
      color: COLORS.good,
    });
  } else {
    for (const signal of scams) {
      bullet(ctx, `[${signal.severity.toUpperCase()}] ${signal.title}`, signal.detail);
    }
  }

  if (inconsistencies.length > 0) {
    heading(ctx, "Incoherencias detectadas");
    for (const signal of inconsistencies) bullet(ctx, signal.title, signal.detail);
  }

  heading(ctx, "Riesgos");
  if (risks.length === 0) {
    paragraph(ctx, "Sin riesgos relevantes ademas de los propios de una compra entre particulares.");
  } else {
    for (const signal of risks) bullet(ctx, signal.title, signal.detail);
  }

  if (positives.length > 0) {
    heading(ctx, "Puntos a favor");
    for (const signal of positives) bullet(ctx, signal.title, signal.detail);
  }

  paragraph(ctx, report.explanation.riskReasoning, { size: 9, color: COLORS.muted });

  // ---------------------------------------------------------- negociación
  if (identified) {
    heading(ctx, "Como negociar");
    paragraph(
      ctx,
      `Ofrece ${eur(report.negotiation.openingOfferCents)} como primera oferta, con el objetivo de cerrar en ${eur(report.negotiation.targetCents)}. No pagues mas de ${eur(report.negotiation.walkAwayCents)}.`,
      { bold: true },
    );
    ctx.y -= 6;
    for (const argument of report.negotiation.arguments) bullet(ctx, argument);
    ctx.y -= 4;
    paragraph(ctx, "Mensaje listo para enviar al vendedor:", { bold: true, size: 9 });
    ctx.y -= 2;
    paragraph(ctx, `"${report.negotiation.message}"`, { size: 9, color: COLORS.brand, indent: 10 });
  }

  // -------------------------------------------------------------- cálculo
  heading(ctx, "Como se ha calculado");
  for (const step of report.breakdown.steps) {
    bullet(
      ctx,
      step.valueCents != null ? `${step.label}: ${eur(step.valueCents)}` : step.label,
      step.detail,
    );
  }
  if (report.breakdown.caveats.length > 0) {
    ctx.y -= 4;
    paragraph(ctx, "Limitaciones de esta valoracion:", { bold: true, size: 9 });
    for (const caveat of report.breakdown.caveats) {
      paragraph(ctx, `- ${caveat}`, { size: 8.8, color: COLORS.muted, indent: 8 });
    }
  }

  // ------------------------------------------------------------ evidencias
  if (report.provenance.extractionEvidence.length > 0) {
    heading(ctx, "De donde sale cada dato");
    for (const item of report.provenance.extractionEvidence.slice(0, 18)) {
      paragraph(ctx, `${item.field}: "${item.quote}"`, { size: 8.5, color: COLORS.muted });
    }
  }

  // ------------------------------------------------------------ procedencia
  heading(ctx, "Procedencia y metodo");
  const provenance = [
    `Entradas analizadas: ${report.provenance.inputs.join(", ") || "ninguna"}.`,
    report.provenance.aiModel
      ? `Identificacion del producto asistida por IA (${report.provenance.aiModel}), usada para: ${report.provenance.aiUsedFor.join(", ")}.`
      : "Producto identificado con el analizador determinista por reglas (sin IA).",
    report.provenance.catalogSource
      ? `Precio de referencia: ${report.provenance.catalogSource}`
      : "Sin referencia de catalogo: este informe no incluye valoracion de precio.",
    `Version del motor de valoracion: ${report.engineVersion}.`,
    "Todas las cifras se calculan con un modelo determinista y auditable sobre el precio oficial de lanzamiento del producto. Ningun importe de este informe procede de una estimacion generativa.",
  ];
  for (const line of provenance) {
    paragraph(ctx, `- ${line}`, { size: 8.5, color: COLORS.muted });
  }

  if (meta.sourceUrl) {
    ctx.y -= 4;
    paragraph(ctx, `Anuncio analizado: ${meta.sourceUrl}`, { size: 8, color: COLORS.muted });
  }
  if (meta.shareUrl) {
    paragraph(ctx, `Version en linea: ${meta.shareUrl}`, { size: 8, color: COLORS.muted });
  }

  ctx.y -= 10;
  paragraph(
    ctx,
    "Aviso: este informe es una estimacion orientativa basada en la informacion aportada del anuncio y en precios de referencia oficiales. No sustituye a la comprobacion presencial del producto ni constituye asesoramiento legal o financiero. Verifica siempre el articulo antes de pagar.",
    { size: 7.8, color: COLORS.muted },
  );

  return doc.save();
}
