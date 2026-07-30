import { env } from "@recepta/config";
import { logger, connectRedis, closeRedis } from "@recepta/core";
import { checkDatabase, closeDatabase } from "@recepta/db";
import { buildServer } from "./server.js";

async function main(): Promise<void> {
  // Fallar aquí es barato; fallar en la primera petición de un paciente, no.
  await connectRedis();
  const database = await checkDatabase();
  if (!database.ok) throw new Error("No hay conexión con la base de datos");

  const app = await buildServer();

  await app.listen({ port: env().API_PORT, host: env().API_HOST });
  logger.info(
    { port: env().API_PORT, canal: env().CHANNEL_DRIVER, entorno: env().NODE_ENV },
    "API en marcha",
  );

  /**
   * Parada ordenada: dejamos de aceptar peticiones, terminamos las que están
   * en vuelo y solo entonces cerramos base de datos y Redis. Cortar en seco
   * dejaría mensajes a medio procesar y conversaciones sin respuesta.
   */
  let closing = false;
  const shutdown = async (signal: string) => {
    if (closing) return;
    closing = true;
    logger.info({ signal }, "Parando la API");

    const forced = setTimeout(() => {
      logger.error("La parada ordenada ha excedido 15 s, se fuerza la salida");
      process.exit(1);
    }, 15_000);
    forced.unref();

    try {
      await app.close();
      await Promise.allSettled([closeDatabase(), closeRedis()]);
      logger.info("API parada correctamente");
      process.exit(0);
    } catch (error) {
      logger.error({ err: error }, "Fallo durante la parada");
      process.exit(1);
    }
  };

  process.on("SIGTERM", () => void shutdown("SIGTERM"));
  process.on("SIGINT", () => void shutdown("SIGINT"));

  process.on("unhandledRejection", (reason) => {
    logger.fatal({ err: reason }, "Promesa rechazada sin capturar");
    void shutdown("unhandledRejection");
  });
  process.on("uncaughtException", (error) => {
    logger.fatal({ err: error }, "Excepción sin capturar");
    void shutdown("uncaughtException");
  });
}

main().catch((error) => {
  logger.fatal({ err: error }, "No se ha podido arrancar la API");
  process.exit(1);
});
