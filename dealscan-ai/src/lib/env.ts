import { z } from "zod";

/**
 * Validación de la configuración en el arranque.
 *
 * Regla del proyecto: una credencial ausente NUNCA se sustituye por un valor
 * falso ni activa un modo "de demostración" con datos inventados. Si falta la
 * clave de IA, el análisis funciona con el extractor determinista y el informe
 * lo indica; si falta Stripe, las rutas de pago devuelven 503 explicando qué
 * variable falta. Nada se simula en silencio.
 */

const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),

  DATABASE_URL: z
    .string()
    .min(1, "DATABASE_URL es obligatoria: cadena de conexión de PostgreSQL."),

  /** Secreto para firmar las sesiones. Genera uno con `openssl rand -base64 48`. */
  AUTH_SECRET: z
    .string()
    .min(32, "AUTH_SECRET debe tener al menos 32 caracteres. Genera uno con: openssl rand -base64 48"),

  /** URL pública de la aplicación (enlaces compartidos, redirecciones de Stripe). */
  APP_URL: z.string().url().default("http://localhost:3000"),

  // --- IA (opcional: sin ella el análisis usa solo el motor determinista) ---
  ANTHROPIC_API_KEY: z.string().min(1).optional(),
  ANTHROPIC_MODEL: z.string().default("claude-sonnet-5"),

  // --- Stripe (opcional: sin ella no se pueden contratar suscripciones) ----
  STRIPE_SECRET_KEY: z.string().min(1).optional(),
  STRIPE_WEBHOOK_SECRET: z.string().min(1).optional(),
  STRIPE_PRICE_ID_PREMIUM_MONTHLY: z.string().min(1).optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().min(1).optional(),

  /** Análisis diarios del plan gratuito. */
  FREE_DAILY_LIMIT: z.coerce.number().int().positive().default(5),
  /** Análisis diarios para visitantes sin cuenta, por IP. */
  ANONYMOUS_DAILY_LIMIT: z.coerce.number().int().nonnegative().default(3),
});

export type Env = z.infer<typeof schema>;

let cached: Env | null = null;

export function getEnv(): Env {
  if (cached) return cached;

  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const issues = parsed.error.issues
      .map((i) => `  · ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(
      `Configuración inválida. Revisa tu .env (ver .env.example):\n${issues}`,
    );
  }
  cached = parsed.data;
  return cached;
}

/** true si la integración de IA está configurada y se puede usar. */
export function hasAI(): boolean {
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

/** true si Stripe está configurado por completo. */
export function hasStripe(): boolean {
  return Boolean(
    process.env.STRIPE_SECRET_KEY &&
      process.env.STRIPE_WEBHOOK_SECRET &&
      process.env.STRIPE_PRICE_ID_PREMIUM_MONTHLY,
  );
}

/** Qué credenciales faltan, para poder decírselo al usuario con precisión. */
export function missingStripeVars(): string[] {
  return [
    ["STRIPE_SECRET_KEY", process.env.STRIPE_SECRET_KEY],
    ["STRIPE_WEBHOOK_SECRET", process.env.STRIPE_WEBHOOK_SECRET],
    ["STRIPE_PRICE_ID_PREMIUM_MONTHLY", process.env.STRIPE_PRICE_ID_PREMIUM_MONTHLY],
  ]
    .filter(([, value]) => !value)
    .map(([name]) => name as string);
}
