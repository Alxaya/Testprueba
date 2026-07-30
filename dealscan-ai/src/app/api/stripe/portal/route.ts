import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createBillingPortalSession } from "@/lib/stripe";
import { apiError, handleApiError, NO_STORE } from "@/lib/api";

export async function POST() {
  try {
    const user = await requireUser();

    const record = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { stripeCustomerId: true },
    });

    if (!record.stripeCustomerId) {
      return apiError(
        "Todavía no tienes una suscripción que gestionar.",
        400,
        "no_subscription",
      );
    }

    const url = await createBillingPortalSession(record.stripeCustomerId);
    return NextResponse.json({ url }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
