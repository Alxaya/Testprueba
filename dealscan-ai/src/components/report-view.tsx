import {
  conditionLabel,
  eur,
  productTitle,
  riskTone,
  scoreTone,
  severityTone,
  storage,
  verdictTone,
} from "@/lib/format";
import type { AnalysisReport, Signal } from "@/lib/valuation/types";

/**
 * Informe completo. Componente de servidor sin estado: se reutiliza tal cual en
 * el resultado del análisis, en el historial y en el enlace público compartido,
 * así que las tres vistas muestran exactamente lo mismo.
 */
export function ReportView({
  report,
  className = "",
}: {
  report: AnalysisReport;
  className?: string;
}) {
  const identified = report.pricing.marketCents > 0;
  const tone = verdictTone(report.verdict);

  const scams = report.signals.filter((s) => s.kind === "scam");
  const inconsistencies = report.signals.filter((s) => s.kind === "inconsistency");
  const risks = report.signals.filter((s) => s.kind === "risk");
  const positives = report.signals.filter((s) => s.kind === "positive");

  return (
    <div className={`space-y-5 ${className}`}>
      {/* ---------------------------------------------------- veredicto */}
      <section className={`card overflow-hidden ${tone.border}`}>
        <div className={`${tone.bg} px-5 py-4 sm:px-7 sm:py-5`}>
          <div className="flex flex-wrap items-start justify-between gap-4">
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Veredicto
              </p>
              <h2 className={`mt-1 text-2xl font-bold sm:text-3xl ${tone.text}`}>{tone.label}</h2>
              <p className="mt-1 truncate text-sm text-text-muted">{productTitle(report)}</p>
            </div>

            <div className="flex shrink-0 items-center gap-5">
              <ScoreDial score={report.score} />
            </div>
          </div>
        </div>

        <div className="grid grid-cols-2 divide-x divide-y divide-border border-t border-border sm:grid-cols-4 sm:divide-y-0">
          <Metric
            label="Probabilidad de buena compra"
            value={`${report.buyProbability} %`}
            tone={scoreTone(report.buyProbability)}
          />
          <Metric
            label="Riesgo de estafa"
            value={`${report.scamRisk}/100`}
            tone={riskTone(report.scamRisk)}
          />
          <Metric label="Confianza del análisis" value={`${report.confidence} %`} />
          <Metric
            label="Señales detectadas"
            value={String(scams.length + inconsistencies.length + risks.length)}
            tone={scams.length > 0 ? "text-bad" : undefined}
          />
        </div>
      </section>

      {/* ------------------------------------------------------- resumen */}
      <section className="card p-5 sm:p-7">
        <SectionTitle>Resumen del análisis</SectionTitle>
        <p className="mt-3 text-[0.9375rem] leading-relaxed text-text">
          {report.explanation.summary}
        </p>
        <div className="mt-4 rounded-xl bg-surface-2 p-4">
          <p className="text-sm font-semibold text-text">Recomendación</p>
          <p className="mt-1.5 text-sm leading-relaxed text-text-muted">
            {report.explanation.recommendation}
          </p>
        </div>
      </section>

      {/* --------------------------------------------------------- precio */}
      {identified ? (
        <section className="card p-5 sm:p-7">
          <SectionTitle>Precio</SectionTitle>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <PriceCard
              label="Precio pedido"
              value={eur(report.pricing.askingCents)}
              hint="Lo que pide el vendedor"
            />
            <PriceCard
              label="Valor de mercado"
              value={eur(report.pricing.marketCents)}
              hint={`Rango habitual ${eur(report.pricing.marketLowCents)} – ${eur(report.pricing.marketHighCents)}`}
            />
            <PriceCard
              label="Precio justo"
              value={eur(report.pricing.fairCents)}
              hint="Ajustado al estado y accesorios de esta unidad"
              emphasis
            />
          </div>

          <PriceScale report={report} />

          {/* En un anuncio con riesgo de fraude, un descuento enorme no es un
              ahorro: es el gancho. Presentarlo en verde junto a un aviso de
              estafa daría dos mensajes contradictorios, así que se enmarca
              como lo que es. */}
          {report.verdict === "ESTAFA_PROBABLE" ? (
            <div className="mt-5 rounded-xl bg-bad-soft p-4">
              <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                Diferencia frente al mercado
              </p>
              <p className="tnum mt-1 text-2xl font-bold text-bad">
                {report.pricing.savingCents >= 0 ? "−" : "+"}
                {eur(Math.abs(report.pricing.savingCents))}
              </p>
              <p className="mt-0.5 text-xs text-text-muted">
                {report.pricing.savingCents > 0
                  ? `Se pide un ${Math.abs(report.pricing.savingPct).toFixed(1)} % menos que el valor de mercado. Un descuento de este tamaño no es una oportunidad: es el señuelo habitual de un fraude.`
                  : `Se pide un ${Math.abs(report.pricing.savingPct).toFixed(1)} % más que el valor de mercado, además del riesgo detectado.`}
              </p>
            </div>
          ) : (
            <div className="mt-5 grid gap-3 sm:grid-cols-2">
              <div
                className={`rounded-xl p-4 ${report.pricing.savingCents >= 0 ? "bg-good-soft" : "bg-bad-soft"}`}
              >
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  {report.pricing.savingCents >= 0 ? "Ahorro estimado" : "Sobreprecio"}
                </p>
                <p
                  className={`tnum mt-1 text-2xl font-bold ${report.pricing.savingCents >= 0 ? "text-good" : "text-bad"}`}
                >
                  {eur(Math.abs(report.pricing.savingCents))}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {report.pricing.savingCents >= 0
                    ? `Un ${Math.abs(report.pricing.savingPct).toFixed(1)} % por debajo del valor de mercado`
                    : `Un ${Math.abs(report.pricing.savingPct).toFixed(1)} % por encima del valor de mercado`}
                </p>
              </div>

              <div className="rounded-xl bg-accent-soft p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
                  Margen de negociación
                </p>
                <p className="tnum mt-1 text-2xl font-bold text-accent">
                  {eur(report.pricing.negotiationUpsideCents)}
                </p>
                <p className="mt-0.5 text-xs text-text-muted">
                  {report.pricing.negotiationUpsideCents > 0
                    ? "Lo que se puede rebajar desde el precio pedido hasta el objetivo"
                    : "El precio pedido ya está en el objetivo: no hay margen que negociar"}
                </p>
              </div>
            </div>
          )}

          <p className="mt-5 text-sm leading-relaxed text-text-muted">
            {report.explanation.priceReasoning}
          </p>
        </section>
      ) : (
        <section className="card border-warn/30 bg-warn-soft p-5 sm:p-7">
          <SectionTitle>Sin valoración de precio</SectionTitle>
          <p className="mt-3 text-sm leading-relaxed text-text">
            {report.explanation.priceReasoning}
          </p>
        </section>
      )}

      {/* --------------------------------------------------- negociación */}
      {identified && report.verdict !== "ESTAFA_PROBABLE" && (
        <section className="card p-5 sm:p-7">
          <SectionTitle>Cómo negociar</SectionTitle>

          <div className="mt-4 grid gap-3 sm:grid-cols-3">
            <PriceCard
              label="Ofrece primero"
              value={eur(report.negotiation.openingOfferCents)}
              hint="Primera oferta al vendedor"
              emphasis
            />
            <PriceCard
              label="Cierra en"
              value={eur(report.negotiation.targetCents)}
              hint="Precio objetivo realista"
            />
            <PriceCard
              label="No pases de"
              value={eur(report.negotiation.walkAwayCents)}
              hint="Por encima, no compensa"
            />
          </div>

          <ul className="mt-5 space-y-2.5">
            {report.negotiation.arguments.map((argument, index) => (
              <li key={index} className="flex gap-2.5 text-sm leading-relaxed text-text-muted">
                <span aria-hidden className="mt-1.5 h-1.5 w-1.5 shrink-0 rounded-full bg-accent" />
                <span>{argument}</span>
              </li>
            ))}
          </ul>

          <figure className="mt-5 rounded-xl border border-accent/25 bg-accent-soft p-4">
            <figcaption className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Mensaje listo para enviar
            </figcaption>
            <blockquote className="mt-2 text-sm leading-relaxed text-text">
              {report.negotiation.message}
            </blockquote>
          </figure>
        </section>
      )}

      {/* ------------------------------------------------------- señales */}
      <section className="card p-5 sm:p-7">
        <SectionTitle>Señales de estafa y riesgos</SectionTitle>

        <div className="mt-4 space-y-6">
          <SignalGroup
            title="Señales de estafa"
            signals={scams}
            emptyMessage="No se han detectado señales de estafa en la información analizada."
            emptyTone="good"
          />
          {inconsistencies.length > 0 && (
            <SignalGroup title="Incoherencias en el anuncio" signals={inconsistencies} />
          )}
          <SignalGroup
            title="Riesgos a tener en cuenta"
            signals={risks}
            emptyMessage="Sin riesgos relevantes más allá de los propios de comprar entre particulares."
          />
          {positives.length > 0 && <SignalGroup title="Puntos a favor" signals={positives} />}
        </div>

        <p className="mt-5 text-sm leading-relaxed text-text-muted">
          {report.explanation.riskReasoning}
        </p>
      </section>

      {/* -------------------------------------------------------- producto */}
      <section className="card p-5 sm:p-7">
        <SectionTitle>Producto detectado</SectionTitle>
        <dl className="mt-4 grid gap-x-6 gap-y-3 sm:grid-cols-2">
          <Field label="Categoría" value={report.product.categoryLabel} />
          <Field label="Marca" value={report.product.brand ?? "Sin identificar"} />
          <Field label="Modelo" value={report.product.model ?? "Sin identificar"} />
          <Field label="Capacidad" value={storage(report.product.storageGb) ?? "No indicada"} />
          <Field label="Color" value={report.product.color ?? "No indicado"} />
          <Field label="Estado" value={conditionLabel(report.product.condition)} />
          <Field
            label="Salud de batería"
            value={report.product.batteryHealth != null ? `${report.product.batteryHealth} %` : "No indicada"}
          />
          <Field
            label="Accesorios"
            value={report.product.accessories.length > 0 ? report.product.accessories.join(", ") : "Ninguno indicado"}
          />
        </dl>

        {report.product.damages.length > 0 && (
          <div className="mt-4 rounded-xl bg-bad-soft p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Daños detectados
            </p>
            <ul className="mt-2 flex flex-wrap gap-2">
              {report.product.damages.map((damage) => (
                <li
                  key={damage}
                  className="rounded-full border border-bad/25 bg-surface px-2.5 py-1 text-xs font-medium text-bad"
                >
                  {damage}
                </li>
              ))}
            </ul>
          </div>
        )}

        <p className="mt-4 text-sm leading-relaxed text-text-muted">
          {report.explanation.conditionReasoning}
        </p>
      </section>

      {/* -------------------------------------------------------- cálculo */}
      <section className="card p-5 sm:p-7">
        <SectionTitle>Cómo se ha calculado</SectionTitle>
        <p className="mt-2 text-sm text-text-muted">
          Cada cifra del informe sale de estos pasos. No hay estimaciones opacas: puedes rehacer el
          cálculo a mano.
        </p>

        <ol className="mt-4 space-y-3">
          {report.breakdown.steps.map((step, index) => (
            <li key={index} className="flex gap-3.5">
              <span className="mt-0.5 flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-accent-soft text-xs font-bold text-accent">
                {index + 1}
              </span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-baseline justify-between gap-x-3">
                  <p className="text-sm font-semibold text-text">{step.label}</p>
                  {step.valueCents != null && (
                    <p className="tnum text-sm font-bold text-accent">{eur(step.valueCents)}</p>
                  )}
                </div>
                <p className="mt-0.5 text-xs leading-relaxed text-text-muted">{step.detail}</p>
              </div>
            </li>
          ))}
        </ol>

        {report.breakdown.caveats.length > 0 && (
          <div className="mt-5 rounded-xl border border-warn/25 bg-warn-soft p-4">
            <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
              Limitaciones de esta valoración
            </p>
            <ul className="mt-2 space-y-1.5">
              {report.breakdown.caveats.map((caveat, index) => (
                <li key={index} className="text-xs leading-relaxed text-text-muted">
                  {caveat}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      {/* ----------------------------------------------------- procedencia */}
      <section className="card bg-surface-2 p-5 sm:p-7">
        <SectionTitle>De dónde salen los datos</SectionTitle>
        <ul className="mt-3 space-y-2 text-xs leading-relaxed text-text-muted">
          <li>
            <strong className="font-semibold text-text">Entradas analizadas:</strong>{" "}
            {report.provenance.inputs.length > 0
              ? report.provenance.inputs
                  .map((i) => ({ url: "enlace del anuncio", text: "texto pegado", image: "capturas" })[i])
                  .join(", ")
              : "ninguna"}
          </li>
          <li>
            <strong className="font-semibold text-text">Identificación del producto:</strong>{" "}
            {report.provenance.aiModel
              ? `asistida por IA (${report.provenance.aiModel}), usada para ${report.provenance.aiUsedFor.join(", ")}`
              : "analizador determinista por reglas, sin IA"}
          </li>
          <li>
            <strong className="font-semibold text-text">Precio de referencia:</strong>{" "}
            {report.provenance.catalogSource ?? "sin referencia de catálogo"}
          </li>
          <li>
            <strong className="font-semibold text-text">Motor de valoración:</strong> v
            {report.engineVersion} — determinista y auditable. Ningún importe de este informe
            procede de una estimación generativa.
          </li>
        </ul>

        {report.provenance.extractionEvidence.length > 0 && (
          <details className="mt-4 group">
            <summary className="cursor-pointer text-xs font-semibold text-accent hover:underline">
              Ver las citas del anuncio que respaldan cada dato (
              {report.provenance.extractionEvidence.length})
            </summary>
            <ul className="mt-3 space-y-2">
              {report.provenance.extractionEvidence.map((item, index) => (
                <li key={index} className="rounded-lg bg-surface p-2.5 text-xs">
                  <span className="font-semibold text-text">{item.field}:</span>{" "}
                  <span className="text-text-muted italic">«{item.quote}»</span>
                </li>
              ))}
            </ul>
          </details>
        )}

        <p className="mt-4 border-t border-border pt-3 text-[0.6875rem] leading-relaxed text-text-faint">
          Informe orientativo basado en la información del anuncio y en precios oficiales de
          lanzamiento. No sustituye la comprobación presencial del producto. Verifica siempre el
          artículo antes de pagar.
        </p>
      </section>
    </div>
  );
}

// ---------------------------------------------------------------------------
// Subcomponentes
// ---------------------------------------------------------------------------

function SectionTitle({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="text-xs font-bold uppercase tracking-[0.08em] text-accent">{children}</h3>
  );
}

function Metric({
  label,
  value,
  tone,
}: {
  label: string;
  value: string;
  tone?: string;
}) {
  return (
    <div className="px-4 py-3.5">
      <p className="text-[0.6875rem] font-semibold uppercase leading-tight tracking-wider text-text-muted">
        {label}
      </p>
      <p className={`tnum mt-1 text-xl font-bold ${tone ?? "text-text"}`}>{value}</p>
    </div>
  );
}

/** Indicador circular de la valoración global. SVG puro: no necesita JS. */
function ScoreDial({ score }: { score: number }) {
  const radius = 30;
  const circumference = 2 * Math.PI * radius;
  const dash = (Math.max(0, Math.min(100, score)) / 100) * circumference;
  const color =
    score >= 75
      ? "var(--good)"
      : score >= 55
        ? "var(--accent)"
        : score >= 35
          ? "var(--warn)"
          : "var(--bad)";

  return (
    <div className="relative h-[76px] w-[76px] shrink-0">
      <svg viewBox="0 0 76 76" className="h-full w-full -rotate-90">
        <circle cx="38" cy="38" r={radius} fill="none" stroke="var(--border-strong)" strokeWidth="7" />
        <circle
          cx="38"
          cy="38"
          r={radius}
          fill="none"
          stroke={color}
          strokeWidth="7"
          strokeLinecap="round"
          strokeDasharray={`${dash} ${circumference}`}
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="tnum text-xl font-bold leading-none" style={{ color }}>
          {score}
        </span>
        <span className="text-[0.5625rem] font-medium uppercase tracking-wider text-text-muted">
          / 100
        </span>
      </div>
    </div>
  );
}

function PriceCard({
  label,
  value,
  hint,
  emphasis = false,
}: {
  label: string;
  value: string;
  hint?: string;
  emphasis?: boolean;
}) {
  return (
    <div
      className={`rounded-xl border p-4 ${emphasis ? "border-accent/30 bg-accent-soft" : "border-border bg-surface-2"}`}
    >
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className={`tnum mt-1 text-2xl font-bold ${emphasis ? "text-accent" : "text-text"}`}>
        {value}
      </p>
      {hint && <p className="mt-1 text-xs leading-snug text-text-muted">{hint}</p>}
    </div>
  );
}

/**
 * Escala visual del precio: sitúa el precio pedido sobre el rango de mercado.
 * Ayuda a ver de un vistazo si está dentro, por encima o por debajo.
 */
function PriceScale({ report }: { report: AnalysisReport }) {
  const { askingCents, marketLowCents, marketHighCents, fairCents } = report.pricing;

  const min = Math.min(marketLowCents, askingCents, fairCents) * 0.94;
  const max = Math.max(marketHighCents, askingCents, fairCents) * 1.06;
  const span = Math.max(1, max - min);
  const pos = (cents: number) => ((cents - min) / span) * 100;

  const rangeLeft = pos(marketLowCents);
  const rangeWidth = pos(marketHighCents) - rangeLeft;

  return (
    <div className="mt-6">
      <div className="relative h-2.5 rounded-full bg-surface-2">
        {/* Rango habitual de mercado */}
        <div
          className="absolute h-full rounded-full bg-accent/25"
          style={{ left: `${rangeLeft}%`, width: `${rangeWidth}%` }}
        />
        {/* Precio justo */}
        <div
          className="absolute -top-1 h-4.5 w-0.5 rounded-full bg-accent"
          style={{ left: `${pos(fairCents)}%` }}
          title={`Precio justo: ${eur(fairCents)}`}
        />
        {/* Precio pedido */}
        <div
          className="absolute -top-1.5 h-5.5 w-5.5 -translate-x-1/2 rounded-full border-[3px] border-surface shadow-md"
          style={{
            left: `${pos(askingCents)}%`,
            background:
              askingCents <= fairCents ? "var(--good)" : askingCents <= marketHighCents ? "var(--warn)" : "var(--bad)",
          }}
          title={`Precio pedido: ${eur(askingCents)}`}
        />
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-5 gap-y-1.5 text-[0.6875rem] text-text-muted">
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-2.5 w-2.5 rounded-full bg-accent/25" />
          Rango de mercado
        </span>
        <span className="flex items-center gap-1.5">
          <span aria-hidden className="h-3 w-0.5 rounded bg-accent" />
          Precio justo {eur(fairCents)}
        </span>
        <span className="flex items-center gap-1.5">
          <span
            aria-hidden
            className="h-2.5 w-2.5 rounded-full"
            style={{
              background:
                askingCents <= fairCents
                  ? "var(--good)"
                  : askingCents <= marketHighCents
                    ? "var(--warn)"
                    : "var(--bad)",
            }}
          />
          Precio pedido {eur(askingCents)}
        </span>
      </div>
    </div>
  );
}

function SignalGroup({
  title,
  signals,
  emptyMessage,
  emptyTone,
}: {
  title: string;
  signals: Signal[];
  emptyMessage?: string;
  emptyTone?: "good";
}) {
  if (signals.length === 0 && !emptyMessage) return null;

  return (
    <div>
      <h4 className="text-sm font-semibold text-text">{title}</h4>
      {signals.length === 0 ? (
        <p
          className={`mt-2 rounded-lg px-3 py-2.5 text-sm ${emptyTone === "good" ? "bg-good-soft text-good" : "bg-surface-2 text-text-muted"}`}
        >
          {emptyMessage}
        </p>
      ) : (
        <ul className="mt-2.5 space-y-2.5">
          {signals.map((signal) => {
            const severity = severityTone(signal.severity);
            return (
              <li key={signal.code} className="rounded-xl border border-border bg-surface-2 p-3.5">
                <div className="flex flex-wrap items-center gap-2">
                  <span
                    className={`rounded-md px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide ${severity.bg} ${severity.text}`}
                  >
                    {severity.label}
                  </span>
                  <p className="text-sm font-semibold text-text">{signal.title}</p>
                </div>
                <p className="mt-1.5 text-xs leading-relaxed text-text-muted">{signal.detail}</p>
                {signal.evidence && (
                  <p className="mt-2 border-l-2 border-border-strong pl-2.5 text-xs italic text-text-faint">
                    «{signal.evidence}»
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Field({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex items-baseline justify-between gap-3 border-b border-border pb-2.5">
      <dt className="text-xs font-medium text-text-muted">{label}</dt>
      <dd className="text-right text-sm font-semibold text-text">{value}</dd>
    </div>
  );
}
