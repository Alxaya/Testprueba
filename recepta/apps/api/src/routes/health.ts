import type { FastifyInstance } from "fastify";
import { checkRedis } from "@recepta/core";
import { checkDatabase } from "@recepta/db";

/**
 * Dos sondas con propósitos distintos:
 *
 *  · /health/live  — ¿el proceso está vivo? No toca dependencias. Si esto
 *                    falla, hay que reiniciar el contenedor.
 *  · /health/ready — ¿puede atender tráfico? Comprueba base de datos y Redis.
 *                    Si falla, hay que sacarlo del balanceador, no reiniciarlo.
 *
 * Confundirlas provoca reinicios en cadena cuando lo que falla es la base
 * de datos: el orquestador mata procesos sanos y empeora la caída.
 */
export async function registerHealthRoutes(app: FastifyInstance): Promise<void> {
  const startedAt = Date.now();

  app.get("/health/live", { logLevel: "silent" }, async () => ({
    status: "ok",
    uptimeSeconds: Math.floor((Date.now() - startedAt) / 1000),
  }));

  app.get("/health/ready", { logLevel: "silent" }, async (_request, reply) => {
    const [database, cache] = await Promise.all([checkDatabase(), checkRedis()]);
    const ok = database.ok && cache.ok;
    return reply.code(ok ? 200 : 503).send({
      status: ok ? "ok" : "degradado",
      checks: { database, redis: cache },
    });
  });
}
