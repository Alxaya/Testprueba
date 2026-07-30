import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError, handleApiError, NO_STORE } from "@/lib/api";
import type { AnalysisReport } from "@/lib/valuation/types";
import { formatEuros } from "@/lib/money";

/**
 * Comparador de anuncios.
 *
 * El plan gratuito compara hasta 2 anuncios a la vez; Premium no tiene límite.
 * La comparación no recalcula nada: reutiliza los informes ya guardados, así que
 * las cifras que se comparan son exactamente las que vio el usuario.
 */
const FREE_COMPARE_LIMIT = 2;

const schema = z.object({
  ids: z.array(z.string().cuid()).min(2, "Selecciona al menos dos análisis para comparar.").max(10),
});

export async function POST(request: NextRequest) {
  try {
    const user = await requireUser();
    const body = schema.parse(await request.json());

    if (user.plan !== "PREMIUM" && body.ids.length > FREE_COMPARE_LIMIT) {
      return apiError(
        `El plan gratuito compara ${FREE_COMPARE_LIMIT} anuncios a la vez. Con Premium la comparación es ilimitada.`,
        402,
        "premium_required",
        { limit: FREE_COMPARE_LIMIT },
      );
    }

    const analyses = await prisma.analysis.findMany({
      where: { id: { in: body.ids }, userId: user.id },
      select: {
        id: true,
        createdAt: true,
        brand: true,
        model: true,
        storageGb: true,
        color: true,
        conditionKey: true,
        askingCents: true,
        marketCents: true,
        fairCents: true,
        targetCents: true,
        offerCents: true,
        savingCents: true,
        verdict: true,
        score: true,
        buyProbability: true,
        scamRisk: true,
        confidence: true,
        sourceUrl: true,
        report: true,
      },
    });

    if (analyses.length !== body.ids.length) {
      return apiError(
        "Alguno de los análisis seleccionados no existe o no es tuyo.",
        404,
        "not_found",
      );
    }

    const items = analyses
      .map((analysis) => {
        const report = analysis.report as unknown as AnalysisReport;
        return {
          ...analysis,
          report: undefined,
          accessories: report.product.accessories,
          damages: report.product.damages,
          batteryHealth: report.product.batteryHealth,
          scamSignals: report.signals.filter((s) => s.kind === "scam").length,
          summary: report.explanation.summary,
        };
      })
      // Mismo orden que pidió el usuario.
      .sort((a, b) => body.ids.indexOf(a.id) - body.ids.indexOf(b.id));

    // La recomendación combina puntuación y riesgo: gana el que tenga mejor
    // nota global y, a igualdad, el de menor riesgo de estafa.
    const ranked = [...items].sort(
      (a, b) => b.score - a.score || a.scamRisk - b.scamRisk,
    );
    const winner = ranked[0]!;

    const cheapest = [...items].sort((a, b) => a.askingCents - b.askingCents)[0]!;
    const bestSaving = [...items].sort((a, b) => b.savingCents - a.savingCents)[0]!;

    return NextResponse.json(
      {
        items,
        recommendation: {
          winnerId: winner.id,
          reason: buildComparisonReason(winner, cheapest, bestSaving, items.length),
          cheapestId: cheapest.id,
          bestSavingId: bestSaving.id,
        },
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

type ComparedItem = {
  id: string;
  brand: string | null;
  model: string | null;
  storageGb: number | null;
  score: number;
  scamRisk: number;
  askingCents: number;
  savingCents: number;
};

function buildComparisonReason(
  winner: ComparedItem,
  cheapest: ComparedItem,
  bestSaving: ComparedItem,
  total: number,
): string {
  const parts = [
    `De los ${total} anuncios comparados, ${describe(winner)} es el que mejor equilibra precio y riesgo: ${winner.score}/100 con un riesgo de estafa de ${winner.scamRisk}/100.`,
  ];

  if (cheapest.id !== winner.id) {
    parts.push(
      `${describe(cheapest)} es más barato (${eur(cheapest.askingCents)} frente a ${eur(winner.askingCents)}), pero su valoración global es menor (${cheapest.score}/100)${cheapest.scamRisk > winner.scamRisk ? ` y su riesgo es más alto (${cheapest.scamRisk}/100)` : ""}.`,
    );
  }

  // Solo tiene sentido hablar de "mayor ahorro" si alguien está de verdad por
  // debajo del mercado: un sobreprecio menor que otro no es un ahorro.
  if (bestSaving.id !== winner.id && bestSaving.savingCents > Math.max(0, winner.savingCents)) {
    parts.push(
      `El mayor ahorro frente al mercado lo ofrece ${describe(bestSaving)} (${eur(bestSaving.savingCents)}), a costa de una nota global peor.`,
    );
  } else if (winner.savingCents <= 0 && cheapest.savingCents <= 0) {
    parts.push(
      "Ninguno de los anuncios está por debajo de su valor de mercado: en todos conviene negociar antes de comprar.",
    );
  }

  return parts.join(" ");
}

/**
 * Nombre con el que referirse a un anuncio en el texto. Se añade el precio
 * cuando el modelo es el mismo, que es el caso habitual al comparar: sin él, la
 * explicación repetiría dos veces el mismo nombre y no se entendería.
 */
function describe(item: ComparedItem): string {
  const name = [item.brand, item.model].filter(Boolean).join(" ");
  if (!name) return `el anuncio de ${eur(item.askingCents)}`;
  return `el ${name} de ${eur(item.askingCents)}`;
}

function eur(cents: number): string {
  return formatEuros(cents);
}
