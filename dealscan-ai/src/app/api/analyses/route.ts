import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { handleApiError, NO_STORE } from "@/lib/api";

const querySchema = z.object({
  cursor: z.string().cuid().optional(),
  take: z.coerce.number().int().min(1).max(50).default(20),
  favorites: z.enum(["1", "0"]).optional(),
  verdict: z.enum(["CHOLLO", "CORRECTO", "CARO", "ESTAFA_PROBABLE"]).optional(),
  q: z.string().trim().max(120).optional(),
});

/** Historial paginado por cursor: estable aunque se creen análisis nuevos. */
export async function GET(request: NextRequest) {
  try {
    const user = await requireUser();
    const params = querySchema.parse(
      Object.fromEntries(new URL(request.url).searchParams),
    );

    const items = await prisma.analysis.findMany({
      where: {
        userId: user.id,
        ...(params.favorites === "1" ? { favorite: { isNot: null } } : {}),
        ...(params.verdict ? { verdict: params.verdict } : {}),
        ...(params.q
          ? {
              OR: [
                { model: { contains: params.q, mode: "insensitive" } },
                { brand: { contains: params.q, mode: "insensitive" } },
              ],
            }
          : {}),
      },
      orderBy: { createdAt: "desc" },
      take: params.take + 1,
      ...(params.cursor ? { cursor: { id: params.cursor }, skip: 1 } : {}),
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
        savingCents: true,
        verdict: true,
        score: true,
        buyProbability: true,
        scamRisk: true,
        sourceUrl: true,
        shareToken: true,
        favorite: { select: { id: true } },
      },
    });

    const hasMore = items.length > params.take;
    const page = hasMore ? items.slice(0, params.take) : items;

    return NextResponse.json(
      {
        items: page.map(({ favorite, ...item }) => ({
          ...item,
          isFavorite: favorite !== null,
        })),
        nextCursor: hasMore ? (page.at(-1)?.id ?? null) : null,
      },
      { headers: NO_STORE },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
