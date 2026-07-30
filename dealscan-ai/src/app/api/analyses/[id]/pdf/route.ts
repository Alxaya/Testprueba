import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { buildAnalysisPdf } from "@/lib/pdf";
import { getEnv } from "@/lib/env";
import { apiError, handleApiError } from "@/lib/api";
import type { AnalysisReport } from "@/lib/valuation/types";

type Params = { params: Promise<{ id: string }> };

/**
 * Exportación del informe en PDF.
 * La exportación es una función Premium: el plan gratuito recibe 402 con el
 * motivo, no un PDF recortado.
 */
export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    if (user.plan !== "PREMIUM") {
      return apiError(
        "La exportación a PDF está incluida en el plan Premium. Puedes seguir consultando y compartiendo el informe online con tu plan actual.",
        402,
        "premium_required",
      );
    }

    const analysis = await prisma.analysis.findFirst({
      where: { id, userId: user.id },
      select: {
        id: true,
        createdAt: true,
        sourceUrl: true,
        shareToken: true,
        report: true,
        brand: true,
        model: true,
      },
    });
    if (!analysis) return apiError("Ese análisis no existe o no es tuyo.", 404, "not_found");

    const report = analysis.report as unknown as AnalysisReport;
    const pdf = await buildAnalysisPdf(report, {
      analysisId: analysis.id,
      createdAt: analysis.createdAt,
      sourceUrl: analysis.sourceUrl,
      requestedBy: user.name ?? user.email,
      shareUrl: analysis.shareToken
        ? `${getEnv().APP_URL}/informe/${analysis.shareToken}`
        : null,
    });

    const slug = [analysis.brand, analysis.model]
      .filter(Boolean)
      .join("-")
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, "-")
      .replace(/^-|-$/g, "") || "informe";

    return new Response(pdf as unknown as BodyInit, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="dealscan-${slug}-${analysis.id.slice(0, 6)}.pdf"`,
        "Cache-Control": "private, no-store",
      },
    });
  } catch (error) {
    return handleApiError(error);
  }
}
