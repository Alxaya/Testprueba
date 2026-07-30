import { Redis } from "ioredis";
import { env } from "@recepta/config";
import { logger } from "./logger.js";

/**
 * Redis cubre tres funciones distintas y conviene no mezclarlas mentalmente:
 *  1. Deduplicación de webhooks (Meta reintenta y no puede contestarse dos veces).
 *  2. Retención de huecos mientras el paciente decide.
 *  3. Colas de trabajo (BullMQ usa su propia conexión).
 */
function build(name: string, options: Record<string, unknown> = {}): Redis {
  const client = new Redis(env().REDIS_URL, {
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    connectionName: `recepta:${name}`,
    retryStrategy: (times) => Math.min(times * 200, 5_000),
    // Importar este módulo no debe abrir una conexión: un proceso que solo
    // usa la base de datos no tiene por qué sostener un socket a Redis.
    // El arranque llama a connectRedis() para fallar pronto si no está.
    lazyConnect: true,
    ...options,
  });
  client.on("error", (error) => logger.error({ err: error, client: name }, "Error de Redis"));
  return client;
}

export const redis = build("general");

/** Conexión explícita al arrancar, para que un Redis caído se note ya. */
export async function connectRedis(): Promise<void> {
  if (redis.status === "ready" || redis.status === "connecting") return;
  await redis.connect();
}

/** BullMQ exige una conexión propia sin readyCheck. */
export const createQueueConnection = () => build("cola", { enableReadyCheck: false });

export async function checkRedis(): Promise<{ ok: boolean; latencyMs: number }> {
  const started = performance.now();
  try {
    await redis.ping();
    return { ok: true, latencyMs: Math.round(performance.now() - started) };
  } catch {
    return { ok: false, latencyMs: Math.round(performance.now() - started) };
  }
}

export async function closeRedis(): Promise<void> {
  await redis.quit().catch(() => redis.disconnect());
}
