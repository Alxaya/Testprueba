import "server-only";

import { prisma } from "./db";
import { getEnv } from "./env";
import type { Plan } from "@prisma/client";

/**
 * Control de cuota de análisis.
 *
 * - Premium: sin límite.
 * - Gratuito: FREE_DAILY_LIMIT análisis por día natural (UTC).
 * - Visitante sin cuenta: ANONYMOUS_DAILY_LIMIT por IP y día.
 *
 * El contador se incrementa de forma atómica con `upsert`, así que dos
 * peticiones simultáneas no pueden colarse por encima del límite.
 */

export interface QuotaStatus {
  allowed: boolean;
  limit: number | null; // null = ilimitado
  used: number;
  remaining: number | null;
  resetsAt: Date;
  plan: Plan | "ANONYMOUS";
}

function startOfUtcDay(date = new Date()): Date {
  return new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate()));
}

function nextUtcDay(date = new Date()): Date {
  const day = startOfUtcDay(date);
  return new Date(day.getTime() + 24 * 60 * 60 * 1000);
}

export async function getQuotaStatus(userId: string, plan: Plan): Promise<QuotaStatus> {
  const env = getEnv();
  const day = startOfUtcDay();

  if (plan === "PREMIUM") {
    const usage = await prisma.dailyUsage.findUnique({
      where: { userId_day: { userId, day } },
      select: { count: true },
    });
    return {
      allowed: true,
      limit: null,
      used: usage?.count ?? 0,
      remaining: null,
      resetsAt: nextUtcDay(),
      plan,
    };
  }

  const usage = await prisma.dailyUsage.findUnique({
    where: { userId_day: { userId, day } },
    select: { count: true },
  });
  const used = usage?.count ?? 0;
  const limit = env.FREE_DAILY_LIMIT;

  return {
    allowed: used < limit,
    limit,
    used,
    remaining: Math.max(0, limit - used),
    resetsAt: nextUtcDay(),
    plan,
  };
}

/**
 * Consume una unidad de cuota. Devuelve el estado resultante.
 * Lanza `QuotaExceededError` si el usuario ya había agotado el límite.
 */
export async function consumeQuota(userId: string, plan: Plan): Promise<QuotaStatus> {
  const env = getEnv();
  const day = startOfUtcDay();

  const usage = await prisma.dailyUsage.upsert({
    where: { userId_day: { userId, day } },
    create: { userId, day, count: 1 },
    update: { count: { increment: 1 } },
    select: { count: true },
  });

  if (plan === "PREMIUM") {
    return {
      allowed: true,
      limit: null,
      used: usage.count,
      remaining: null,
      resetsAt: nextUtcDay(),
      plan,
    };
  }

  const limit = env.FREE_DAILY_LIMIT;
  if (usage.count > limit) {
    // Se devuelve el contador a su valor previo: el análisis no se ha hecho.
    await prisma.dailyUsage.update({
      where: { userId_day: { userId, day } },
      data: { count: { decrement: 1 } },
    });
    throw new QuotaExceededError(limit, nextUtcDay());
  }

  return {
    allowed: true,
    limit,
    used: usage.count,
    remaining: Math.max(0, limit - usage.count),
    resetsAt: nextUtcDay(),
    plan,
  };
}

export class QuotaExceededError extends Error {
  constructor(
    readonly limit: number,
    readonly resetsAt: Date,
  ) {
    super(
      `Has agotado tus ${limit} análisis gratuitos de hoy. Se renuevan a las 00:00 UTC o puedes pasar a Premium para tener análisis ilimitados.`,
    );
    this.name = "QuotaExceededError";
  }
}

// ---------------------------------------------------------------------------
// Cuota anónima (por IP)
// ---------------------------------------------------------------------------

/**
 * Contador en memoria para visitantes sin cuenta. Es deliberadamente local al
 * proceso: sirve para que cualquiera pueda probar el producto sin registrarse,
 * no como control de seguridad. La cuota real y auditable es la de usuarios
 * autenticados, que vive en PostgreSQL.
 *
 * Con varias instancias, sustituir por Redis (una clave por IP y día con TTL).
 */
const anonymousUsage = new Map<string, { count: number; day: number }>();

export function consumeAnonymousQuota(ip: string): QuotaStatus {
  const env = getEnv();
  const limit = env.ANONYMOUS_DAILY_LIMIT;
  const today = startOfUtcDay().getTime();

  const current = anonymousUsage.get(ip);
  const used = current && current.day === today ? current.count : 0;

  if (used >= limit) {
    return {
      allowed: false,
      limit,
      used,
      remaining: 0,
      resetsAt: nextUtcDay(),
      plan: "ANONYMOUS",
    };
  }

  anonymousUsage.set(ip, { count: used + 1, day: today });

  // Limpieza perezosa para que el mapa no crezca sin control.
  if (anonymousUsage.size > 10_000) {
    for (const [key, value] of anonymousUsage) {
      if (value.day !== today) anonymousUsage.delete(key);
    }
  }

  return {
    allowed: true,
    limit,
    used: used + 1,
    remaining: Math.max(0, limit - used - 1),
    resetsAt: nextUtcDay(),
    plan: "ANONYMOUS",
  };
}
