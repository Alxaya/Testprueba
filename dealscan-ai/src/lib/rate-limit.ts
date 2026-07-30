import "server-only";

/**
 * Limitador de peticiones por ventana deslizante, en memoria del proceso.
 *
 * Protege los endpoints sensibles (login, registro, análisis) de fuerza bruta y
 * abuso. Con varias instancias detrás de un balanceador hay que sustituirlo por
 * Redis: la interfaz es la misma, solo cambia el almacén (ver README).
 */

interface Bucket {
  timestamps: number[];
}

const buckets = new Map<string, Bucket>();

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  retryAfterSeconds: number;
}

export function rateLimit(
  key: string,
  options: { limit: number; windowMs: number },
): RateLimitResult {
  const now = Date.now();
  const cutoff = now - options.windowMs;

  const bucket = buckets.get(key) ?? { timestamps: [] };
  bucket.timestamps = bucket.timestamps.filter((t) => t > cutoff);

  if (bucket.timestamps.length >= options.limit) {
    const oldest = bucket.timestamps[0] ?? now;
    buckets.set(key, bucket);
    return {
      allowed: false,
      remaining: 0,
      retryAfterSeconds: Math.max(1, Math.ceil((oldest + options.windowMs - now) / 1000)),
    };
  }

  bucket.timestamps.push(now);
  buckets.set(key, bucket);

  // Limpieza perezosa para que el mapa no crezca sin control.
  if (buckets.size > 20_000) {
    for (const [k, v] of buckets) {
      if (v.timestamps.every((t) => t <= cutoff)) buckets.delete(k);
    }
  }

  return {
    allowed: true,
    remaining: options.limit - bucket.timestamps.length,
    retryAfterSeconds: 0,
  };
}

/** IP del cliente teniendo en cuenta los proxies habituales. */
export function clientIp(headers: Headers): string {
  const forwarded = headers.get("x-forwarded-for");
  if (forwarded) {
    const first = forwarded.split(",")[0]?.trim();
    if (first) return first;
  }
  return headers.get("x-real-ip") ?? headers.get("cf-connecting-ip") ?? "unknown";
}

export const RATE_LIMITS = {
  login: { limit: 8, windowMs: 15 * 60 * 1000 },
  register: { limit: 5, windowMs: 60 * 60 * 1000 },
  analyze: { limit: 20, windowMs: 60 * 1000 },
  share: { limit: 30, windowMs: 60 * 1000 },
} as const;
