import Link from "next/link";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { AnalysisCard } from "@/components/analysis-card";
import { analysisCardSelect } from "@/app/panel/page";

export const metadata: Metadata = { title: "Favoritos" };
export const dynamic = "force-dynamic";

export default async function FavoritesPage() {
  const user = await requireUser();

  const favorites = await prisma.favorite.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
    select: {
      id: true,
      note: true,
      createdAt: true,
      analysis: { select: analysisCardSelect },
    },
  });

  return (
    <div className="space-y-6">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Favoritos</h1>
        <p className="mt-1 text-sm text-text-muted">
          {favorites.length === 0
            ? "Marca un análisis como favorito para tenerlo a mano aquí."
            : `${favorites.length} ${favorites.length === 1 ? "anuncio guardado" : "anuncios guardados"}.`}
        </p>
      </header>

      {favorites.length === 0 ? (
        <div className="card p-8 text-center">
          <p className="font-semibold">Todavía no tienes favoritos</p>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-text-muted">
            Abre cualquier informe y pulsa «Guardar en favoritos» para seguirle la pista al anuncio.
          </p>
          <Link href="/panel/historial" className="btn btn-ghost mt-5">
            Ver mi historial
          </Link>
        </div>
      ) : (
        <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {favorites.map((favorite) => (
            <li key={favorite.id} className="space-y-2">
              <AnalysisCard analysis={{ ...favorite.analysis, isFavorite: true }} />
              {favorite.note && (
                <p className="rounded-lg bg-surface-2 px-3 py-2 text-xs italic text-text-muted">
                  {favorite.note}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
