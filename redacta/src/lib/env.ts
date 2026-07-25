import 'server-only';
import { z } from 'zod';

/**
 * Validacion centralizada de variables de entorno.
 *
 * `server-only` es deliberado: en el navegador solo existen las variables
 * NEXT_PUBLIC_*, asi que si este modulo acabara en un bundle de cliente la
 * validacion fallaria en tiempo de ejecucion y romperia la pagina. Con esta
 * importacion, ese error aparece al compilar en lugar de en produccion.
 *
 * Criterio de diseno: la app arranca aunque falten integraciones opcionales
 * (Stripe, Resend, Google OAuth). Cada modulo consulta su bandera `isXEnabled`
 * y degrada de forma controlada. Solo las variables realmente imprescindibles
 * (base de datos, secreto de sesion, URL publica) detienen el arranque.
 */

const schema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  // Imprescindibles
  DATABASE_URL: z.string().min(1, 'DATABASE_URL es obligatoria'),
  AUTH_SECRET: z.string().min(1, 'AUTH_SECRET es obligatoria (openssl rand -base64 32)'),
  NEXT_PUBLIC_APP_URL: z.string().url().default('http://localhost:3000'),

  // Opcionales
  AUTH_URL: z.string().url().optional(),
  AUTH_GOOGLE_ID: z.string().optional(),
  AUTH_GOOGLE_SECRET: z.string().optional(),

  ANTHROPIC_API_KEY: z.string().optional(),
  ANTHROPIC_MODEL: z.string().default('claude-opus-5'),

  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY: z.string().optional(),
  STRIPE_PRICE_STARTER_MONTHLY: z.string().optional(),
  STRIPE_PRICE_PRO_MONTHLY: z.string().optional(),
  STRIPE_PRICE_BUSINESS_MONTHLY: z.string().optional(),

  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('Redacta <onboarding@resend.dev>'),

  CRON_SECRET: z.string().optional(),
  ADMIN_EMAILS: z.string().default(''),
});

/** Convierte "" en undefined: un .env con claves vacias no debe fingir estar configurado. */
function clean(raw: NodeJS.ProcessEnv): Record<string, string | undefined> {
  const out: Record<string, string | undefined> = {};
  for (const [key, value] of Object.entries(raw)) {
    out[key] = value === '' ? undefined : value;
  }
  return out;
}

function load() {
  // Durante `next build` no siempre hay .env cargado (p. ej. al analizar rutas
  // estaticas en CI). En ese caso usamos valores neutros para no romper el build:
  // el arranque real si validara.
  const isBuildPhase = process.env.NEXT_PHASE === 'phase-production-build';
  const parsed = schema.safeParse(clean(process.env));

  if (!parsed.success) {
    const issues = parsed.error.issues.map((i) => `  - ${i.path.join('.')}: ${i.message}`).join('\n');
    if (isBuildPhase || process.env.NODE_ENV === 'test') {
      return schema.parse(
        clean({
          ...process.env,
          DATABASE_URL: process.env.DATABASE_URL ?? 'postgresql://build:build@localhost:5432/build',
          AUTH_SECRET: process.env.AUTH_SECRET ?? 'build-time-placeholder-secret',
        }),
      );
    }
    throw new Error(`Configuracion de entorno invalida:\n${issues}\n\nRevisa tu fichero .env (ver .env.example).`);
  }

  return parsed.data;
}

export const env = load();

/** Integraciones activas segun lo que este configurado. */
export const features = {
  ai: Boolean(env.ANTHROPIC_API_KEY),
  stripe: Boolean(env.STRIPE_SECRET_KEY && env.STRIPE_WEBHOOK_SECRET),
  email: Boolean(env.RESEND_API_KEY),
  googleAuth: Boolean(env.AUTH_GOOGLE_ID && env.AUTH_GOOGLE_SECRET),
  cron: Boolean(env.CRON_SECRET),
} as const;

/** Emails que reciben rol ADMIN automaticamente al registrarse. */
export const adminEmails = env.ADMIN_EMAILS.split(',')
  .map((e) => e.trim().toLowerCase())
  .filter(Boolean);

export const isProduction = env.NODE_ENV === 'production';
