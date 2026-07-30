import { drizzle } from "drizzle-orm/postgres-js";
import { sql } from "drizzle-orm";
import postgres from "postgres";
import { env, isProduction } from "@recepta/config";
import * as schema from "./schema/index.js";

/**
 * Conexión a PostgreSQL.
 *
 * El pool es único por proceso. Cada consulta de negocio pasa por
 * `withTenant`, que fija el identificador de organización en la sesión para
 * que las políticas de Row-Level Security lo apliquen dentro del motor.
 * Un olvido de `where organizationId = ...` en el código no filtra datos:
 * la base de datos no los devuelve.
 */
const queryClient = postgres(env().DATABASE_URL, {
  max: isProduction() ? 20 : 5,
  idle_timeout: 30,
  connect_timeout: 10,
  // Los timestamps viajan en UTC; la conversión a hora local del negocio
  // es responsabilidad del dominio, nunca de la base de datos.
  types: {},
  onnotice: () => {},
});

export const db = drizzle(queryClient, { schema, casing: "snake_case" });

export type Database = typeof db;
export type TenantDatabase = Parameters<Parameters<Database["transaction"]>[0]>[0];

/** Identificador de organización: marca de tipo para no confundirlo con otros ids. */
export type OrganizationId = string & { readonly __brand: "OrganizationId" };

/**
 * Ejecuta trabajo dentro de una transacción con el tenant fijado.
 *
 * `set_config(..., true)` es local a la transacción, así que la conexión
 * vuelve limpia al pool y no puede arrastrar el tenant de otra petición.
 */
export async function withTenant<T>(
  organizationId: string,
  fn: (tx: TenantDatabase) => Promise<T>,
): Promise<T> {
  return db.transaction(async (tx) => {
    await tx.execute(sql`select set_config('app.organization_id', ${organizationId}, true)`);
    return fn(tx);
  });
}

/**
 * Trabajo de sistema sin tenant (migraciones, tareas programadas globales,
 * webhooks antes de resolver a qué organización pertenecen).
 *
 * Se nombra así de explícitamente a propósito: cada uso debe saltar a la
 * vista en una revisión de código.
 */
export async function withoutTenantIsolation<T>(fn: (tx: TenantDatabase) => Promise<T>): Promise<T> {
  return db.transaction(fn);
}

export async function checkDatabase(): Promise<{ ok: boolean; latencyMs: number }> {
  const started = performance.now();
  try {
    await queryClient`select 1`;
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { ok: false, latencyMs: Math.round(performance.now() - started) };
  }
}

export async function closeDatabase(): Promise<void> {
  await queryClient.end({ timeout: 5 });
}

export { sql };
