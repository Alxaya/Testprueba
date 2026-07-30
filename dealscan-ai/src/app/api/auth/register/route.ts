import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, hashPassword } from "@/lib/auth";
import { RATE_LIMITS, clientIp, rateLimit } from "@/lib/rate-limit";
import { apiError, handleApiError, NO_STORE } from "@/lib/api";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Introduce un correo electrónico válido."),
  password: z
    .string()
    .min(10, "La contraseña debe tener al menos 10 caracteres.")
    .max(200, "La contraseña es demasiado larga.")
    // Requisito mínimo real de robustez sin llegar a ser molesto.
    .refine((value) => /[a-zA-Z]/.test(value) && /\d/.test(value), {
      message: "La contraseña debe incluir al menos una letra y un número.",
    }),
  name: z.string().trim().min(1).max(80).optional(),
});

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request.headers);
    const limit = rateLimit(`register:${ip}`, RATE_LIMITS.register);
    if (!limit.allowed) {
      return apiError(
        `Demasiados intentos de registro. Vuelve a probar en ${limit.retryAfterSeconds} segundos.`,
        429,
        "rate_limited",
      );
    }

    const body = schema.parse(await request.json());

    const existing = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true },
    });
    if (existing) {
      return apiError(
        "Ya existe una cuenta con ese correo. Inicia sesión o usa otro correo.",
        409,
        "email_taken",
      );
    }

    const user = await prisma.user.create({
      data: {
        email: body.email,
        name: body.name ?? null,
        passwordHash: await hashPassword(body.password),
      },
      select: { id: true, email: true, name: true, plan: true },
    });

    await createSession(user.id, {
      userAgent: request.headers.get("user-agent"),
      ip,
    });

    return NextResponse.json({ user }, { status: 201, headers: NO_STORE });
  } catch (error) {
    return handleApiError(error);
  }
}
