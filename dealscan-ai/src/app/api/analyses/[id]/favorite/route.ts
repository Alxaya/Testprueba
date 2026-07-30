import { NextResponse } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError, handleApiError, NO_STORE } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

const schema = z.object({ note: z.string().trim().max(500).optional() });

/** Marca el análisis como favorito (idempotente). */
export async function POST(request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;
    const body = schema.parse(await request.json().catch(() => ({})));

    const owned = await prisma.analysis.findFirst({
      where: { id, userId: user.id },
      select: { id: true },
    });
    if (!owned) return apiError("Ese análisis no existe o no es tuyo.", 404, "not_found");

    const favorite = await prisma.favorite.upsert({
      where: { analysisId: id },
      create: { analysisId: id, userId: user.id, note: body.note ?? null },
      update: { note: body.note ?? null },
      select: { id: true, note: true, createdAt: true },
    });

    return NextResponse.json({ favorite, isFavorite: true }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    await prisma.favorite.deleteMany({ where: { analysisId: id, userId: user.id } });
    return NextResponse.json({ isFavorite: false }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
