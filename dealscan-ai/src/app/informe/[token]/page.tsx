import Link from "next/link";
import { notFound } from "next/navigation";
import type { Metadata } from "next";
import { prisma } from "@/lib/db";
import { ReportView } from "@/components/report-view";
import { Logo, SiteFooter } from "@/components/site-header";
import { ThemeToggle } from "@/components/theme-toggle";
import { fullDate, productTitle } from "@/lib/format";
import type { AnalysisReport } from "@/lib/valuation/types";

/**
 * Vista pública de un informe compartido.
 *
 * Solo es accesible con el token, que se genera aleatoriamente y se puede
 * revocar. No se expone el usuario propietario ni el resto de su historial, y la
 * página se marca como no indexable para que los enlaces compartidos no acaben
 * en buscadores.
 */
export const dynamic = "force-dynamic";

async function loadShared(token: string) {
  // El token es la credencial: la búsqueda exige que el análisis siga compartido.
  return prisma.analysis.findFirst({
    where: { shareToken: token },
    select: { id: true, createdAt: true, sharedAt: true, sourceUrl: true, report: true },
  });
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ token: string }>;
}): Promise<Metadata> {
  const { token } = await params;
  const analysis = await loadShared(token);
  if (!analysis) {
    return { title: "Informe no disponible", robots: { index: false, follow: false } };
  }

  const report = analysis.report as unknown as AnalysisReport;
  return {
    title: `Informe compartido · ${productTitle(report)}`,
    description: report.explanation.summary.slice(0, 200),
    robots: { index: false, follow: false },
  };
}

export default async function SharedReportPage({
  params,
}: {
  params: Promise<{ token: string }>;
}) {
  const { token } = await params;
  const analysis = await loadShared(token);
  if (!analysis) notFound();

  const report = analysis.report as unknown as AnalysisReport;

  return (
    <>
      <header className="no-print sticky top-0 z-40 border-b border-border bg-bg/85 backdrop-blur-md">
        <div className="mx-auto flex h-14 max-w-4xl items-center justify-between gap-4 px-4 sm:px-6">
          <Link href="/" className="text-[0.9375rem]">
            <Logo />
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Link href="/" className="btn btn-primary !py-2 !text-sm">
              Analizar mi anuncio
            </Link>
          </div>
        </div>
      </header>

      <main id="contenido" className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
        <div className="mb-5 rounded-xl border border-border bg-surface-2 px-4 py-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-text-muted">
            Informe compartido
          </p>
          <h1 className="mt-1 text-xl font-bold tracking-tight">{productTitle(report)}</h1>
          <p className="mt-1 text-xs text-text-muted">
            Análisis del {fullDate(analysis.createdAt)}
            {analysis.sourceUrl && (
              <>
                {" · "}
                <a
                  href={analysis.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer nofollow"
                  className="text-accent hover:underline"
                >
                  anuncio original
                </a>
              </>
            )}
          </p>
        </div>

        <ReportView report={report} />

        <section className="no-print card mt-6 p-6 text-center">
          <h2 className="font-semibold">¿Vas a comprar algo de segunda mano?</h2>
          <p className="mx-auto mt-1.5 max-w-md text-sm text-text-muted">
            Analiza el anuncio antes de pagar: precio real de mercado, señales de estafa y cuánto
            ofrecer. Gratis, con 5 análisis al día.
          </p>
          <Link href="/registro" className="btn btn-primary mt-5">
            Crear cuenta gratis
          </Link>
        </section>
      </main>

      <SiteFooter />
    </>
  );
}
