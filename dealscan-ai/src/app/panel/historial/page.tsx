import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { AnalysisCard } from "@/components/analysis-card";
import { analysisCardSelect } from "@/app/panel/page";
import type { Verdict } from "@/lib/valuation/types";

export const metadata: Metadata = { title: "Historial" };
export const dynamic = "force-dynamic";

const PAGE_SIZE = 24;

const FILTERS: { value: string; label: string }[] = [
  { value: "", label: "Todos" },
  { value: "CHOLLO", label: "Chollos" },
  { value: "CORRECTO", label: "Precio correcto" },
  { value: "CARO", label: "Caros" },
  { value: "ESTAFA_PROBABLE", label: "Riesgo de estafa" },
  { value: "SIN_VALORAR", label: "Sin valorar" },
];

export default async function HistoryPage({
  searchParams,
}: {
  searchParams: Promise<{ verdicto?: string; pagina?: string }>;
}) {
  const user = await requireUser();
  const params = await searchParams;

  const verdict = FILTERS.some((f) => f.value === params.verdicto && f.value)
    ? (params.verdicto as Verdict)
    : null;
  const page = Math.max(1, Number.parseInt(params.pagina ?? "1", 10) || 1);

  const where = { userId: user.id, ...(verdict ? { verdict } : {}) };

  const [items, total] = await Promise.all([
    prisma.analysis.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (page - 1) * PAGE_SIZE,
      take: PAGE_SIZE,
      select: { ...analysisCardSelect, favorite: { select: { id: true } } },
    }),
    prisma.analysis.count({ where }),
  ]);

  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Historial de análisis</h1>
        <p className="mt-1 text-sm text-text-muted">
          {total} {total === 1 ? "análisis guardado" : "análisis guardados"}
          {verdict ? " con este filtro" : ""}.
        </p>
      </header>

      <nav aria-label="Filtrar por veredicto" className="-mx-1 flex gap-1.5 overflow-x-auto pb-1">
        {FILTERS.map((filter) => {
          const active = (filter.value || null) === verdict;
          return (
            <Link
              key={filter.value || "all"}
              href={filter.value ? `/panel/historial?verdicto=${filter.value}` : "/panel/historial"}
              className={`shrink-0 rounded-lg border px-3 py-1.5 text-sm font-medium transition-colors ${
                active
                  ? "border-accent bg-accent-soft text-accent"
                  : "border-border text-text-muted hover:bg-surface-2 hover:text-text"
              }`}
            >
              {filter.label}
            </Link>
          );
        })}
      </nav>

      {items.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-semibold">No hay análisis que mostrar</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-text-muted">
            {verdict
              ? "Ningún análisis coincide con este filtro. Prueba con otro o analiza un anuncio nuevo."
              : "Analiza tu primer anuncio y aparecerá aquí con su informe completo."}
          </p>
          <Link href="/" className="btn btn-primary mt-5">
            Analizar un anuncio
          </Link>
        </div>
      ) : (
        <>
          <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {items.map(({ favorite, ...analysis }) => (
              <li key={analysis.id}>
                <AnalysisCard analysis={{ ...analysis, isFavorite: favorite !== null }} />
              </li>
            ))}
          </ul>

          {totalPages > 1 && (
            <nav aria-label="Paginación" className="flex items-center justify-center gap-2">
              {page > 1 && (
                <Link
                  href={buildHref(page - 1, verdict)}
                  className="btn btn-ghost !py-2 !text-sm"
                  rel="prev"
                >
                  ← Anterior
                </Link>
              )}
              <span className="tnum px-3 text-sm text-text-muted">
                Página {page} de {totalPages}
              </span>
              {page < totalPages && (
                <Link
                  href={buildHref(page + 1, verdict)}
                  className="btn btn-ghost !py-2 !text-sm"
                  rel="next"
                >
                  Siguiente →
                </Link>
              )}
            </nav>
          )}
        </>
      )}
    </div>
  );
}

function buildHref(page: number, verdict: Verdict | null): string {
  const params = new URLSearchParams();
  if (verdict) params.set("verdicto", verdict);
  if (page > 1) params.set("pagina", String(page));
  const query = params.toString();
  return query ? `/panel/historial?${query}` : "/panel/historial";
}
