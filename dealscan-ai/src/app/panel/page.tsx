import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { getQuotaStatus } from "@/lib/quota";
import { AnalysisCard } from "@/components/analysis-card";
import { eur } from "@/lib/format";

export const metadata: Metadata = { title: "Panel" };
export const dynamic = "force-dynamic";

export default async function PanelPage() {
  const user = await requireUser();
  const quota = await getQuotaStatus(user.id, user.plan);

  const [recent, totals, favoriteCount, bestDeal] = await Promise.all([
    prisma.analysis.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 4,
      select: analysisCardSelect,
    }),
    prisma.analysis.aggregate({
      where: { userId: user.id },
      _count: { id: true },
      _sum: { savingCents: true },
      _avg: { score: true },
    }),
    prisma.favorite.count({ where: { userId: user.id } }),
    prisma.analysis.findFirst({
      where: { userId: user.id, verdict: "CHOLLO" },
      orderBy: { savingCents: "desc" },
      select: analysisCardSelect,
    }),
  ]);

  const totalAnalyses = totals._count.id;
  // Solo se suman los ahorros positivos: un sobreprecio no es un "ahorro negativo"
  // que compense otro análisis.
  const positiveSavings = await prisma.analysis.aggregate({
    where: { userId: user.id, savingCents: { gt: 0 } },
    _sum: { savingCents: true },
  });

  return (
    <div className="space-y-7">
      <header className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight">
            Hola{user.name ? `, ${user.name}` : ""}
          </h1>
          <p className="mt-1 text-sm text-text-muted">
            {user.plan === "PREMIUM"
              ? "Plan Premium activo · análisis ilimitados"
              : `Plan gratuito · te quedan ${quota.remaining} de ${quota.limit} análisis hoy`}
          </p>
        </div>
        <Link href="/" className="btn btn-primary">
          Analizar un anuncio
        </Link>
      </header>

      {/* Métricas reales de la cuenta */}
      <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <StatCard label="Análisis realizados" value={String(totalAnalyses)} />
        <StatCard
          label="Ahorro potencial detectado"
          value={eur(positiveSavings._sum.savingCents ?? 0)}
          hint="Suma de los anuncios por debajo de mercado"
          tone="text-good"
        />
        <StatCard
          label="Valoración media"
          value={totalAnalyses > 0 ? `${Math.round(totals._avg.score ?? 0)}/100` : "—"}
        />
        <StatCard label="Favoritos guardados" value={String(favoriteCount)} />
      </section>

      {user.plan === "FREE" && quota.remaining === 0 && (
        <section className="card border-warn/30 bg-warn-soft p-5">
          <h2 className="font-semibold">Has agotado los análisis de hoy</h2>
          <p className="mt-1.5 text-sm text-text-muted">
            Tu cuota se renueva a las 00:00 UTC. Con Premium tendrías análisis ilimitados,
            exportación en PDF y comparador sin límite.
          </p>
          <Link href="/panel/suscripcion" className="btn btn-primary mt-4">
            Ver Premium
          </Link>
        </section>
      )}

      {bestDeal && (
        <section>
          <h2 className="text-sm font-bold uppercase tracking-wider text-accent">
            Tu mejor oportunidad detectada
          </h2>
          <div className="mt-3">
            <AnalysisCard analysis={bestDeal} />
          </div>
        </section>
      )}

      <section>
        <div className="flex items-baseline justify-between gap-3">
          <h2 className="text-sm font-bold uppercase tracking-wider text-accent">
            Análisis recientes
          </h2>
          {totalAnalyses > 4 && (
            <Link href="/panel/historial" className="text-sm font-semibold text-accent hover:underline">
              Ver todo el historial →
            </Link>
          )}
        </div>

        {recent.length === 0 ? (
          <div className="card mt-3 p-8 text-center">
            <p className="font-semibold">Todavía no has analizado ningún anuncio</p>
            <p className="mx-auto mt-1.5 max-w-md text-sm text-text-muted">
              Pega el enlace, el texto o una captura de un anuncio y tendrás el informe completo en
              segundos.
            </p>
            <Link href="/" className="btn btn-primary mt-5">
              Analizar mi primer anuncio
            </Link>
          </div>
        ) : (
          <ul className="mt-3 grid gap-3 sm:grid-cols-2">
            {recent.map((analysis) => (
              <li key={analysis.id}>
                <AnalysisCard analysis={analysis} />
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}

function StatCard({
  label,
  value,
  hint,
  tone,
}: {
  label: string;
  value: string;
  hint?: string;
  tone?: string;
}) {
  return (
    <div className="card p-4">
      <p className="text-[0.6875rem] font-semibold uppercase tracking-wider text-text-muted">
        {label}
      </p>
      <p className={`tnum mt-1 text-2xl font-bold ${tone ?? ""}`}>{value}</p>
      {hint && <p className="mt-0.5 text-xs text-text-muted">{hint}</p>}
    </div>
  );
}

export const analysisCardSelect = {
  id: true,
  createdAt: true,
  brand: true,
  model: true,
  storageGb: true,
  conditionKey: true,
  askingCents: true,
  marketCents: true,
  fairCents: true,
  targetCents: true,
  savingCents: true,
  verdict: true,
  score: true,
  scamRisk: true,
  sourceUrl: true,
} as const;
