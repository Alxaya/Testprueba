import type { Metadata } from "next";
import Link from "next/link";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { CompareClient } from "@/components/compare-client";

export const metadata: Metadata = { title: "Comparador" };
export const dynamic = "force-dynamic";

export default async function ComparePage() {
  const user = await requireUser();

  const candidates = await prisma.analysis.findMany({
    where: { userId: user.id, marketCents: { gt: 0 } },
    orderBy: { createdAt: "desc" },
    take: 60,
    select: {
      id: true,
      createdAt: true,
      brand: true,
      model: true,
      storageGb: true,
      conditionKey: true,
      askingCents: true,
      verdict: true,
      score: true,
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Comparador de anuncios</h1>
        <p className="mt-1 max-w-2xl text-sm text-text-muted">
          Selecciona los anuncios que estás valorando y ponlos uno al lado del otro. La comparación
          reutiliza los informes ya calculados, así que las cifras son exactamente las mismas que
          viste en cada análisis.
          {user.plan !== "PREMIUM" && (
            <> Con el plan gratuito puedes comparar 2 a la vez; con Premium, sin límite.</>
          )}
        </p>
      </header>

      {candidates.length < 2 ? (
        <div className="card p-8 text-center">
          <p className="font-semibold">Necesitas al menos dos análisis con valoración</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-text-muted">
            Analiza un par de anuncios del mismo producto y podrás compararlos aquí. Los análisis sin
            precio de mercado (modelo no identificado) no se pueden comparar.
          </p>
          <Link href="/" className="btn btn-primary mt-5">
            Analizar un anuncio
          </Link>
        </div>
      ) : (
        <CompareClient candidates={candidates} isPremium={user.plan === "PREMIUM"} />
      )}
    </div>
  );
}
