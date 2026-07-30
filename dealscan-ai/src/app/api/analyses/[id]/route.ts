import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { apiError, handleApiError, NO_STORE } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

export async function GET(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const analysis = await prisma.analysis.findFirst({
      where: { id, userId: user.id },
      include: { favorite: { select: { id: true, note: true } } },
    });
    if (!analysis) {
      return apiError("Ese análisis no existe o no es tuyo.", 404, "not_found");
    }

    return NextResponse.json(
      { analysis: { ...analysis, isFavorite: analysis.favorite !== null } },
      { headers: NO_STORE },
    );
  } catch (error) {
    return handleApiError(error);
  }
}

export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    // deleteMany con el userId en el where evita borrar análisis de otra cuenta
    // incluso si se adivina el identificador.
    const result = await prisma.analysis.deleteMany({ where: { id, userId: user.id } });
    if (result.count === 0) {
      return apiError("Ese análisis no existe o no es tuyo.", 404, "not_found");
    }

    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
