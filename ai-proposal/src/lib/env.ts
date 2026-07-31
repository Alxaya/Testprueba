import { z } from 'zod';

/**
 * Validación de la configuración en el arranque (docs/01, §6).
 *
 * Motivo: un secreto ausente o mal escrito debe romper el despliegue de forma
 * ruidosa e inmediata, no producir un `undefined` que viaje por el código y
 * reviente tres capas más abajo, en producción, con un mensaje inútil.
 *
 * Separación estricta servidor/cliente: `serverEnv` lanza si se toca desde el
 * navegador, de modo que es imposible filtrar una clave por accidente.
 */

const clientSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: 'NEXT_PUBLIC_SUPABASE_URL debe ser una URL válida' }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1),
  NEXT_PUBLIC_SITE_URL: z.url().default('http://localhost:3000'),
});

const serverSchema = z.object({
  NODE_ENV: z.enum(['development', 'test', 'production']).default('development'),

  /** Ignora RLS. Solo webhooks y scripts (docs/01, §6). */
  SUPABASE_SERVICE_ROLE_KEY: z.string().min(1),

  /** Conexión directa a Postgres. Solo la usan migraciones y tests de RLS. */
  DATABASE_URL: z.string().min(1).optional(),
});

/**
 * En el cliente, Next sustituye `process.env.NEXT_PUBLIC_*` en tiempo de build,
 * por lo que hay que leer cada clave de forma literal: un acceso dinámico
 * (`process.env[key]`) se compila a `undefined`.
 */
function readClientEnv(): z.infer<typeof clientSchema> {
  const parsed = clientSchema.safeParse({
    NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
    NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
  });

  if (!parsed.success) throw new Error(formatIssues('cliente', parsed.error));
  return parsed.data;
}

function readServerEnv(): z.infer<typeof serverSchema> {
  if (typeof window !== 'undefined') {
    throw new Error(
      'serverEnv se ha importado desde el cliente: revisa las directivas "use server"/"use client".',
    );
  }

  const parsed = serverSchema.safeParse({
    NODE_ENV: process.env.NODE_ENV,
    SUPABASE_SERVICE_ROLE_KEY: process.env.SUPABASE_SERVICE_ROLE_KEY,
    DATABASE_URL: process.env.DATABASE_URL,
  });

  if (!parsed.success) throw new Error(formatIssues('servidor', parsed.error));
  return parsed.data;
}

function formatIssues(scope: string, error: z.ZodError): string {
  const details = error.issues
    .map((issue) => `  · ${issue.path.join('.') || '(raíz)'}: ${issue.message}`)
    .join('\n');
  return `Configuración de ${scope} inválida:\n${details}\n\nRevisa .env.example.`;
}

export const clientEnv = readClientEnv();

/**
 * Perezoso a propósito: así el bundle de cliente nunca ejecuta la validación de
 * servidor, y los tests que no tocan la base de datos no necesitan sus claves.
 */
let cachedServerEnv: z.infer<typeof serverSchema> | undefined;
export function serverEnv(): z.infer<typeof serverSchema> {
  cachedServerEnv ??= readServerEnv();
  return cachedServerEnv;
}

export const isProduction = process.env.NODE_ENV === 'production';
export const isTest = process.env.NODE_ENV === 'test';
