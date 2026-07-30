import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { getCurrentUser } from "@/lib/auth";
import { ReportView } from "@/components/report-view";
import { SiteFooter, SiteHeader } from "@/components/site-header";
import { AnalysisActions } from "@/components/analysis-actions";
import { fullDate, productTitle } from "@/lib/format";
import type { AnalysisReport } from "@/lib/valuation/types";

export const dynamic = "force-dynamic";

async function loadAnalysis(id: string, userId: string) {
  return prisma.analysis.findFirst({
    where: { id, userId },
    select: {
      id: true,
      createdAt: true,
      sourceUrl: true,
      shareToken: true,
      report: true,
      favorite: { select: { id: true, note: true } },
    },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ id: string }>;
}): Promise<Metadata> {
  const user = await getCurrentUser();
  if (!user) return { title: "Informe" };

  const { id } = await params;
  const analysis = await loadAnalysis(id, user.id);
  if (!analysis) return { title: "Informe no encontrado" };

  const report = analysis.report as unknown as AnalysisReport;
  return {
    title: `Informe · ${productTitle(report)}`,
    robots: { index: false, follow: false },
  };
}

export default async function AnalysisPage({ params }: { params: Promise<{ id: string }> }) {
  const user = await getCurrentUser();
  const { id } = await params;

  if (!user) redirect(`/entrar?next=/analisis/${id}`);

  const analysis = await loadAnalysis(id, user.id);
  if (!analysis) notFound();

  const report = analysis.report as unknown as AnalysisReport;

  return (
    <>
      <SiteHeader user={user} />

      <main id="contenido" className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <nav className="no-print mb-5 text-sm">
          <Link href="/panel/historial" className="text-text-muted hover:text-accent">
            ← Volver al historial
          </Link>
        </nav>

        <header className="mb-5">
          <h1 className="text-2xl font-bold tracking-tight">{productTitle(report)}</h1>
          <p className="mt-1 text-sm text-text-muted">
            Analizado el {fullDate(analysis.createdAt)}
            {analysis.sourceUrl && (
              <>
                {" · "}
                <a
                  href={analysis.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-accent hover:underline"
                >
                  ver el anuncio original
                </a>
              </>
            )}
          </p>
        </header>

        <div className="no-print mb-6">
          <AnalysisActions
            analysisId={analysis.id}
            isFavorite={analysis.favorite !== null}
            favoriteNote={analysis.favorite?.note ?? null}
            shareToken={analysis.shareToken}
            isPremium={user.plan === "PREMIUM"}
          />
        </div>

        <ReportView report={report} />
      </main>

      <SiteFooter />
    </>
  );
}
