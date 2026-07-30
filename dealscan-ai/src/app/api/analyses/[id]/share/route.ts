import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { ensureShareToken } from "@/lib/analysis-service";
import { getEnv } from "@/lib/env";
import { handleApiError, NO_STORE } from "@/lib/api";

type Params = { params: Promise<{ id: string }> };

/** Crea el enlace público del informe. */
export async function POST(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    const token = await ensureShareToken(id, user.id);
    const url = `${getEnv().APP_URL}/informe/${token}`;

    return NextResponse.json({ token, url }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}

/** Revoca el enlace público: quien lo tuviera deja de poder abrirlo. */
export async function DELETE(_request: Request, { params }: Params) {
  try {
    const user = await requireUser();
    const { id } = await params;

    await prisma.analysis.updateMany({
      where: { id, userId: user.id },
      data: { shareToken: null, sharedAt: null },
    });

    return NextResponse.json({ ok: true }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
