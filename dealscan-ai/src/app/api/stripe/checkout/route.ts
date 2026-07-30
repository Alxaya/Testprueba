import { NextResponse } from "next/server";
import { prisma } from "@/lib/db";
import { requireUser } from "@/lib/auth";
import { createCheckoutSession } from "@/lib/stripe";
import { apiError, handleApiError, NO_STORE } from "@/lib/api";

export async function POST() {
  try {
    const user = await requireUser();

    const record = await prisma.user.findUniqueOrThrow({
      where: { id: user.id },
      select: { stripeCustomerId: true, plan: true, subscriptionStatus: true },
    });

    if (record.plan === "PREMIUM" && record.subscriptionStatus === "ACTIVE") {
      return apiError(
        "Ya tienes Premium activo. Puedes gestionar tu suscripción desde el portal de facturación.",
        409,
        "already_subscribed",
      );
    }

    const { url, customerId } = await createCheckoutSession({
      userId: user.id,
      email: user.email,
      stripeCustomerId: record.stripeCustomerId,
    });

    // Se guarda el cliente de Stripe para no crear uno nuevo en cada intento.
    if (record.stripeCustomerId !== customerId) {
      await prisma.user.update({
        where: { id: user.id },
        data: { stripeCustomerId: customerId },
      });
    }

    return NextResponse.json({ url }, { headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
