import { config as loadDotenv } from "dotenv";
import { z } from "zod";
import { fileURLToPath } from "node:url";
import path from "node:path";

// El .env vive en la raíz del monorepo, no junto a cada app.
const here = path.dirname(fileURLToPath(import.meta.url));
loadDotenv({ path: path.resolve(here, "../../../.env"), quiet: true });

/**
 * Variables de entorno del sistema.
 *
 * Regla: si falta algo imprescindible, el proceso no arranca. Preferimos
 * un fallo ruidoso al arrancar que un fallo silencioso a las 22:47 de un
 * sábado con un paciente esperando respuesta.
 */
const schema = z.object({
  NODE_ENV: z.enum(["development", "test", "production"]).default("development"),
  LOG_LEVEL: z.enum(["fatal", "error", "warn", "info", "debug", "trace"]).default("info"),

  API_PORT: z.coerce.number().int().positive().default(3001),
  API_HOST: z.string().default("0.0.0.0"),
  /** URL pública de la API. La usan los webhooks y los enlaces que enviamos. */
  PUBLIC_API_URL: z.string().url().default("http://localhost:3001"),

  DATABASE_URL: z.string().url(),
  REDIS_URL: z.string().url(),

  /** Clave de 32 bytes en base64 para el cifrado de campos sensibles. */
  ENCRYPTION_KEY: z.string().min(32),
  SESSION_SECRET: z.string().min(32),

  // ── Canal de WhatsApp ────────────────────────────────────────────────
  // 'simulator' permite construir y demostrar el producto entero sin
  // esperar a la aprobación de Meta como Tech Provider, que tarda semanas
  // y no depende de nosotros.
  CHANNEL_DRIVER: z.enum(["simulator", "meta"]).default("simulator"),
  META_APP_ID: z.string().optional(),
  META_APP_SECRET: z.string().optional(),
  META_VERIFY_TOKEN: z.string().optional(),
  META_GRAPH_VERSION: z.string().default("v23.0"),

  // ── Modelos ──────────────────────────────────────────────────────────
  ANTHROPIC_API_KEY: z.string().optional(),
  /** Modelo grande: razonamiento con herramientas. */
  AI_MODEL_REASONING: z.string().default("claude-sonnet-4-5"),
  /** Modelo rápido: clasificación de intención, alto volumen. */
  AI_MODEL_FAST: z.string().default("claude-haiku-4-5-20251001"),
  /** Tope de gasto diario por organización, en céntimos de euro. */
  AI_DAILY_BUDGET_CENTS: z.coerce.number().int().positive().default(500),

  /** Zona horaria por defecto de los negocios (España peninsular). */
  DEFAULT_TIMEZONE: z.string().default("Europe/Madrid"),
});

export type Env = z.infer<typeof schema>;

let cached: Env | undefined;

export function env(): Env {
  if (cached) return cached;
  const parsed = schema.safeParse(process.env);
  if (!parsed.success) {
    const detail = parsed.error.issues
      .map((i) => `  · ${i.path.join(".")}: ${i.message}`)
      .join("\n");
    throw new Error(`Configuración de entorno inválida:\n${detail}`);
  }
  cached = parsed.data;
  return cached;
}

export const isProduction = () => env().NODE_ENV === "production";
export const isTest = () => env().NODE_ENV === "test";
