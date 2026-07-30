import Link from "next/link";
import { conditionLabel, eur, relativeDate, scoreTone, storage, verdictTone } from "@/lib/format";
import type { Verdict, ConditionKey } from "@/lib/valuation/types";

export interface AnalysisCardData {
  id: string;
  createdAt: Date;
  brand: string | null;
  model: string | null;
  storageGb: number | null;
  conditionKey: string | null;
  askingCents: number;
  marketCents: number;
  fairCents: number;
  targetCents: number;
  savingCents: number;
  verdict: Verdict;
  score: number;
  scamRisk: number;
  sourceUrl: string | null;
  isFavorite?: boolean;
}

/** Tarjeta de resumen de un análisis, usada en panel, historial y favoritos. */
export function AnalysisCard({ analysis }: { analysis: AnalysisCardData }) {
  const tone = verdictTone(analysis.verdict);
  const name =
    [analysis.brand, analysis.model].filter(Boolean).join(" ") || "Producto sin identificar";
  const details = [storage(analysis.storageGb), conditionLabel(analysis.conditionKey as ConditionKey | null)]
    .filter(Boolean)
    .join(" · ");
  const valued = analysis.marketCents > 0;

  return (
    <Link
      href={`/analisis/${analysis.id}`}
      className="card block h-full p-4 transition-shadow hover:shadow-md"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate font-semibold">{name}</p>
          <p className="mt-0.5 truncate text-xs text-text-muted">{details}</p>
        </div>
        <div className="flex shrink-0 items-center gap-2">
          {analysis.isFavorite && (
            <span aria-label="En favoritos" title="En favoritos" className="text-warn">
              <svg viewBox="0 0 24 24" fill="currentColor" className="h-4 w-4">
                <path d="M12 17.3l-5.4 3 1.4-6.1L3.3 9.9l6.2-.6L12 3.6l2.5 5.7 6.2.6-4.7 4.3 1.4 6.1z" />
              </svg>
            </span>
          )}
          <span
            className={`rounded-md px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide ${tone.bg} ${tone.text}`}
          >
            {tone.label}
          </span>
        </div>
      </div>

      <div className="mt-3.5 grid grid-cols-3 gap-2 border-t border-border pt-3">
        <Cell label="Pide" value={eur(analysis.askingCents)} />
        <Cell
          label="Justo"
          value={valued ? eur(analysis.fairCents) : "—"}
          tone={valued ? "text-accent" : undefined}
        />
        <Cell
          label={analysis.savingCents >= 0 ? "Ahorro" : "De más"}
          value={valued ? eur(Math.abs(analysis.savingCents)) : "—"}
          tone={valued ? (analysis.savingCents >= 0 ? "text-good" : "text-bad") : undefined}
        />
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-text-muted">
        <span>{relativeDate(analysis.createdAt)}</span>
        <span className="flex items-center gap-3">
          <span className={`tnum font-semibold ${scoreTone(analysis.score)}`}>
            {analysis.score}/100
          </span>
          {analysis.scamRisk >= 30 && (
            <span className="tnum font-semibold text-bad">riesgo {analysis.scamRisk}</span>
          )}
        </span>
      </div>
    </Link>
  );
}

function Cell({ label, value, tone }: { label: string; value: string; tone?: string }) {
  return (
    <div>
      <p className="text-[0.625rem] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className={`tnum mt-0.5 text-sm font-bold ${tone ?? ""}`}>{value}</p>
    </div>
  );
}
