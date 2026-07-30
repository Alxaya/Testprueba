"use client";

import Link from "next/link";
import { useState } from "react";
import { conditionLabel, eur, relativeDate, riskTone, scoreTone, storage, verdictTone } from "@/lib/format";
import type { ConditionKey, Verdict } from "@/lib/valuation/types";

interface Candidate {
  id: string;
  createdAt: Date | string;
  brand: string | null;
  model: string | null;
  storageGb: number | null;
  conditionKey: string | null;
  askingCents: number;
  verdict: Verdict;
  score: number;
}

interface ComparedItem {
  id: string;
  brand: string | null;
  model: string | null;
  storageGb: number | null;
  color: string | null;
  conditionKey: string | null;
  askingCents: number;
  marketCents: number;
  fairCents: number;
  targetCents: number;
  offerCents: number;
  savingCents: number;
  verdict: Verdict;
  score: number;
  buyProbability: number;
  scamRisk: number;
  confidence: number;
  sourceUrl: string | null;
  accessories: string[];
  damages: string[];
  batteryHealth: number | null;
  scamSignals: number;
  summary: string;
}

interface CompareResponse {
  items: ComparedItem[];
  recommendation: {
    winnerId: string;
    reason: string;
    cheapestId: string;
    bestSavingId: string;
  };
}

const FREE_LIMIT = 2;

export function CompareClient({
  candidates,
  isPremium,
}: {
  candidates: Candidate[];
  isPremium: boolean;
}) {
  const [selected, setSelected] = useState<string[]>([]);
  const [result, setResult] = useState<CompareResponse | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const maxSelectable = isPremium ? 10 : FREE_LIMIT;

  function toggle(id: string) {
    setError(null);
    setSelected((current) => {
      if (current.includes(id)) return current.filter((item) => item !== id);
      if (current.length >= maxSelectable) {
        setError(
          isPremium
            ? `Puedes comparar hasta ${maxSelectable} anuncios a la vez.`
            : `El plan gratuito compara ${FREE_LIMIT} anuncios a la vez. Con Premium la comparación es ilimitada.`,
        );
        return current;
      }
      return [...current, id];
    });
  }

  async function compare() {
    if (selected.length < 2) return;
    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const response = await fetch("/api/compare", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ids: selected }),
      });
      const data = await response.json();
      if (!response.ok) {
        setError(data.error ?? "No se ha podido comparar.");
        return;
      }
      setResult(data as CompareResponse);
    } catch {
      setError("No se ha podido conectar con el servidor.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="space-y-6">
      {/* Selección */}
      <section className="card p-4 sm:p-5">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-accent">
            Elige los anuncios ({selected.length}/{maxSelectable})
          </h2>
          <button
            type="button"
            onClick={compare}
            disabled={selected.length < 2 || loading}
            className="btn btn-primary !py-2 !text-sm"
          >
            {loading ? "Comparando…" : "Comparar"}
          </button>
        </div>

        {error && (
          <p role="alert" className="mt-3 rounded-lg border border-bad/30 bg-bad-soft px-3 py-2 text-sm text-bad">
            {error}
          </p>
        )}

        <ul className="mt-4 grid max-h-96 gap-2 overflow-y-auto sm:grid-cols-2">
          {candidates.map((candidate) => {
            const active = selected.includes(candidate.id);
            const tone = verdictTone(candidate.verdict);
            const name =
              [candidate.brand, candidate.model].filter(Boolean).join(" ") || "Sin identificar";
            return (
              <li key={candidate.id}>
                <label
                  className={`flex cursor-pointer items-start gap-3 rounded-xl border p-3 transition-colors ${
                    active ? "border-accent bg-accent-soft" : "border-border hover:bg-surface-2"
                  }`}
                >
                  <input
                    type="checkbox"
                    checked={active}
                    onChange={() => toggle(candidate.id)}
                    className="mt-0.5 h-4 w-4 shrink-0 accent-[var(--accent)]"
                  />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{name}</span>
                    <span className="mt-0.5 block truncate text-xs text-text-muted">
                      {[storage(candidate.storageGb), conditionLabel(candidate.conditionKey as ConditionKey | null)]
                        .filter(Boolean)
                        .join(" · ")}
                    </span>
                    <span className="mt-1 flex items-center gap-2 text-xs">
                      <span className="tnum font-bold">{eur(candidate.askingCents)}</span>
                      <span className={`rounded px-1.5 py-0.5 text-[0.625rem] font-bold uppercase ${tone.bg} ${tone.text}`}>
                        {tone.label}
                      </span>
                      <span className="text-text-faint">{relativeDate(candidate.createdAt)}</span>
                    </span>
                  </span>
                </label>
              </li>
            );
          })}
        </ul>
      </section>

      {/* Resultado */}
      {result && (
        <div className="rise space-y-4">
          <section className="card border-accent/30 bg-accent-soft p-5">
            <h2 className="text-sm font-bold uppercase tracking-wider text-accent">
              Recomendación
            </h2>
            <p className="mt-2 text-[0.9375rem] leading-relaxed text-text">
              {result.recommendation.reason}
            </p>
          </section>

          <section className="card overflow-x-auto">
            <table className="w-full min-w-[640px] border-collapse text-sm">
              <caption className="sr-only">Comparación de los anuncios seleccionados</caption>
              <thead>
                <tr className="border-b border-border">
                  <th scope="col" className="p-3 text-left text-xs font-semibold uppercase tracking-wider text-text-muted">
                    Concepto
                  </th>
                  {result.items.map((item) => {
                    const isWinner = item.id === result.recommendation.winnerId;
                    return (
                      <th
                        key={item.id}
                        scope="col"
                        className={`min-w-40 p-3 text-left ${isWinner ? "bg-good-soft" : ""}`}
                      >
                        <span className="block font-semibold">
                          {[item.brand, item.model].filter(Boolean).join(" ") || "Sin identificar"}
                        </span>
                        <span className="mt-0.5 block text-xs font-normal text-text-muted">
                          {[storage(item.storageGb), item.color].filter(Boolean).join(" · ") || "—"}
                        </span>
                        {isWinner && (
                          <span className="mt-1.5 inline-block rounded-md bg-good px-2 py-0.5 text-[0.625rem] font-bold uppercase tracking-wide text-white">
                            Mejor opción
                          </span>
                        )}
                      </th>
                    );
                  })}
                </tr>
              </thead>
              <tbody>
                <Row
                  label="Veredicto"
                  items={result.items}
                  render={(item) => {
                    const tone = verdictTone(item.verdict);
                    return (
                      <span className={`rounded-md px-2 py-0.5 text-xs font-bold uppercase ${tone.bg} ${tone.text}`}>
                        {tone.label}
                      </span>
                    );
                  }}
                />
                <Row
                  label="Valoración global"
                  items={result.items}
                  render={(item) => (
                    <span className={`tnum font-bold ${scoreTone(item.score)}`}>{item.score}/100</span>
                  )}
                  best={(items) => Math.max(...items.map((i) => i.score))}
                  metric={(item) => item.score}
                />
                <Row
                  label="Precio pedido"
                  items={result.items}
                  render={(item) => <span className="tnum font-semibold">{eur(item.askingCents)}</span>}
                  best={(items) => Math.min(...items.map((i) => i.askingCents))}
                  metric={(item) => item.askingCents}
                />
                <Row
                  label="Precio justo"
                  items={result.items}
                  render={(item) => <span className="tnum text-accent">{eur(item.fairCents)}</span>}
                />
                <Row
                  label="Ahorro frente a mercado"
                  items={result.items}
                  render={(item) => (
                    <span className={`tnum font-semibold ${item.savingCents >= 0 ? "text-good" : "text-bad"}`}>
                      {item.savingCents >= 0 ? "" : "−"}
                      {eur(Math.abs(item.savingCents))}
                    </span>
                  )}
                  best={(items) => Math.max(...items.map((i) => i.savingCents))}
                  metric={(item) => item.savingCents}
                />
                <Row
                  label="Precio a negociar"
                  items={result.items}
                  render={(item) => <span className="tnum">{eur(item.targetCents)}</span>}
                />
                <Row
                  label="Ofrecer primero"
                  items={result.items}
                  render={(item) => <span className="tnum">{eur(item.offerCents)}</span>}
                />
                <Row
                  label="Probabilidad de buena compra"
                  items={result.items}
                  render={(item) => <span className="tnum">{item.buyProbability} %</span>}
                  best={(items) => Math.max(...items.map((i) => i.buyProbability))}
                  metric={(item) => item.buyProbability}
                />
                <Row
                  label="Riesgo de estafa"
                  items={result.items}
                  render={(item) => (
                    <span className={`tnum font-semibold ${riskTone(item.scamRisk)}`}>
                      {item.scamRisk}/100
                    </span>
                  )}
                  best={(items) => Math.min(...items.map((i) => i.scamRisk))}
                  metric={(item) => item.scamRisk}
                />
                <Row
                  label="Señales de estafa"
                  items={result.items}
                  render={(item) => <span className="tnum">{item.scamSignals}</span>}
                />
                <Row
                  label="Estado"
                  items={result.items}
                  render={(item) => <span>{conditionLabel(item.conditionKey as ConditionKey | null)}</span>}
                />
                <Row
                  label="Batería"
                  items={result.items}
                  render={(item) => (
                    <span className="tnum">
                      {item.batteryHealth != null ? `${item.batteryHealth} %` : "—"}
                    </span>
                  )}
                />
                <Row
                  label="Accesorios"
                  items={result.items}
                  render={(item) => (
                    <span className="text-xs text-text-muted">
                      {item.accessories.length > 0 ? item.accessories.join(", ") : "Ninguno"}
                    </span>
                  )}
                />
                <Row
                  label="Daños"
                  items={result.items}
                  render={(item) => (
                    <span className="text-xs text-text-muted">
                      {item.damages.length > 0 ? item.damages.join(", ") : "Ninguno"}
                    </span>
                  )}
                />
                <Row
                  label="Informe"
                  items={result.items}
                  render={(item) => (
                    <Link href={`/analisis/${item.id}`} className="text-xs font-semibold text-accent hover:underline">
                      Abrir →
                    </Link>
                  )}
                />
              </tbody>
            </table>
          </section>
        </div>
      )}
    </div>
  );
}

/**
 * Fila de la tabla. Si se aportan `best` y `valueOf`, resalta la celda ganadora
 * de ese criterio concreto: así se ve de un vistazo quién gana en cada concepto.
 */
function Row({
  label,
  items,
  render,
  best,
  metric,
}: {
  label: string;
  items: ComparedItem[];
  render: (item: ComparedItem) => React.ReactNode;
  best?: (items: ComparedItem[]) => number;
  metric?: (item: ComparedItem) => number;
}) {
  const bestValue = best && metric ? best(items) : null;

  return (
    <tr className="border-b border-border last:border-0">
      <th scope="row" className="p-3 text-left text-xs font-medium text-text-muted">
        {label}
      </th>
      {items.map((item) => {
        const isBest =
          bestValue !== null && metric ? metric(item) === bestValue && items.length > 1 : false;
        return (
          <td key={item.id} className={`p-3 ${isBest ? "bg-good-soft" : ""}`}>
            {render(item)}
          </td>
        );
      })}
    </tr>
  );
}
