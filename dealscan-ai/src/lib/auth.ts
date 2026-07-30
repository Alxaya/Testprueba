import "server-only";

import { createHash, randomBytes, timingSafeEqual } from "node:crypto";
import bcrypt from "bcryptjs";
import { SignJWT, jwtVerify } from "jose";
import { cookies } from "next/headers";
import { prisma } from "./db";
import { getEnv } from "./env";
import type { Plan } from "@prisma/client";

/**
 * Autenticación por sesión propia:
 *  - Contraseñas con bcrypt (coste 12).
 *  - Token de sesión aleatorio de 256 bits; en la base de datos solo se guarda
 *    su SHA-256, así que un volcado de la tabla no permite suplantar a nadie.
 *  - El token viaja en una cookie httpOnly + SameSite=Lax + Secure en producción,
 *    envuelto en un JWT firmado que permite validar sin consultar la base de
 *    datos en cada navegación.
 *  - La sesión es revocable de verdad: al cerrar sesión o cambiar la contraseña
 *    se borra la fila y el token deja de servir aunque el JWT no haya expirado.
 */

const SESSION_COOKIE = "dealscan_session";
const SESSION_TTL_DAYS = 30;
const BCRYPT_ROUNDS = 12;

export interface SessionUser {
  id: string;
  email: string;
  name: string | null;
  plan: Plan;
}

function secretKey(): Uint8Array {
  return new TextEncoder().encode(getEnv().AUTH_SECRET);
}

function hashToken(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

export async function hashPassword(password: string): Promise<string> {
  return bcrypt.hash(password, BCRYPT_ROUNDS);
}

export async function verifyPassword(password: string, hash: string): Promise<boolean> {
  return bcrypt.compare(password, hash);
}

/** Comparación en tiempo constante para tokens de compartición. */
export function safeEqual(a: string, b: string): boolean {
  const bufA = Buffer.from(a);
  const bufB = Buffer.from(b);
  if (bufA.length !== bufB.length) return false;
  return timingSafeEqual(bufA, bufB);
}

export async function createSession(
  userId: string,
  meta: { userAgent?: string | null; ip?: string | null } = {},
): Promise<void> {
  const token = randomBytes(32).toString("base64url");
  const expiresAt = new Date(Date.now() + SESSION_TTL_DAYS * 24 * 60 * 60 * 1000);

  await prisma.session.create({
    data: {
      userId,
      tokenHash: hashToken(token),
      expiresAt,
      userAgent: meta.userAgent?.slice(0, 255) ?? null,
      ip: meta.ip ?? null,
    },
  });

  const jwt = await new SignJWT({ sub: userId, tkn: token })
    .setProtectedHeader({ alg: "HS256" })
    .setIssuedAt()
    .setExpirationTime(expiresAt)
    .sign(secretKey());

  const store = await cookies();
  store.set(SESSION_COOKIE, jwt, {
    httpOnly: true,
    sameSite: "lax",
    secure: process.env.NODE_ENV === "production",
    path: "/",
    expires: expiresAt,
  });
}

export async function destroySession(): Promise<void> {
  const store = await cookies();
  const jwt = store.get(SESSION_COOKIE)?.value;

  if (jwt) {
    try {
      const { payload } = await jwtVerify(jwt, secretKey());
      const token = payload.tkn;
      if (typeof token === "string") {
        await prisma.session.deleteMany({ where: { tokenHash: hashToken(token) } });
      }
    } catch {
      // Token ilegible: basta con borrar la cookie.
    }
  }
  store.delete(SESSION_COOKIE);
}

/** Usuario de la petición actual, o null si no hay sesión válida. */
export async function getCurrentUser(): Promise<SessionUser | null> {
  const store = await cookies();
  const jwt = store.get(SESSION_COOKIE)?.value;
  if (!jwt) return null;

  let userId: string;
  let token: string;
  try {
    const { payload } = await jwtVerify(jwt, secretKey());
    if (typeof payload.sub !== "string" || typeof payload.tkn !== "string") return null;
    userId = payload.sub;
    token = payload.tkn;
  } catch {
    return null;
  }

  const session = await prisma.session.findUnique({
    where: { tokenHash: hashToken(token) },
    select: {
      expiresAt: true,
      userId: true,
      user: { select: { id: true, email: true, name: true, plan: true } },
    },
  });

  // La fila debe existir (sesión no revocada), no estar caducada y pertenecer
  // al mismo usuario que dice el JWT.
  if (!session || session.expiresAt < new Date() || session.userId !== userId) {
    return null;
  }
  return session.user;
}

export async function requireUser(): Promise<SessionUser> {
  const user = await getCurrentUser();
  if (!user) {
    throw new UnauthorizedError();
  }
  return user;
}

export class UnauthorizedError extends Error {
  constructor() {
    super("Necesitas iniciar sesión para continuar.");
    this.name = "UnauthorizedError";
  }
}

/** Borra las sesiones caducadas. Se invoca desde el login para no acumular filas. */
export async function pruneExpiredSessions(): Promise<void> {
  await prisma.session.deleteMany({ where: { expiresAt: { lt: new Date() } } });
}
