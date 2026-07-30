import { NextResponse, type NextRequest } from "next/server";
import { z } from "zod";
import { prisma } from "@/lib/db";
import { createSession, pruneExpiredSessions, verifyPassword } from "@/lib/auth";
import { RATE_LIMITS, clientIp, rateLimit } from "@/lib/rate-limit";
import { apiError, handleApiError, NO_STORE } from "@/lib/api";

const schema = z.object({
  email: z.string().trim().toLowerCase().email("Introduce un correo electrónico válido."),
  password: z.string().min(1, "Introduce tu contraseña."),
});

export async function POST(request: NextRequest) {
  try {
    const ip = clientIp(request.headers);
    const body = schema.parse(await request.json());

    // El límite se aplica por IP y por cuenta: así ni se puede probar una
    // contraseña contra muchas cuentas ni muchas contraseñas contra una cuenta.
    for (const key of [`login:ip:${ip}`, `login:email:${body.email}`]) {
      const limit = rateLimit(key, RATE_LIMITS.login);
      if (!limit.allowed) {
        return apiError(
          `Demasiados intentos fallidos. Vuelve a probar en ${limit.retryAfterSeconds} segundos.`,
          429,
          "rate_limited",
        );
      }
    }

    const user = await prisma.user.findUnique({
      where: { email: body.email },
      select: { id: true, email: true, name: true, plan: true, passwordHash: true },
    });

    // Mismo mensaje y coste similar exista o no la cuenta: no se filtra qué
    // correos están registrados.
    const valid = user
      ? await verifyPassword(body.password, user.passwordHash)
      : await verifyPassword(body.password, "$2a$12$invalidinvalidinvalidinvalidinvalidinvalidinvalidinvalidin");

    if (!user || !valid) {
      return apiError("Correo o contraseña incorrectos.", 401, "invalid_credentials");
    }

    await pruneExpiredSessions();
    await createSession(user.id, {
      userAgent: request.headers.get("user-agent"),
      ip,
    });

    return NextResponse.json(
      { user: { id: user.id, email: user.email, name: user.name, plan: user.plan } },
      { headers: NO_STORE },
    );
  } catch (error) {
    return handleApiError(error);
  }
}
