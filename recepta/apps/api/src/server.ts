import Fastify, {
  type FastifyBaseLogger,
  type FastifyError,
  type FastifyInstance,
} from "fastify";
import helmet from "@fastify/helmet";
import cookie from "@fastify/cookie";
import rateLimit from "@fastify/rate-limit";
import sensible from "@fastify/sensible";
import { env, isProduction } from "@recepta/config";
import { logger, isAppError, redis } from "@recepta/core";
import { registerHealthRoutes } from "./routes/health.js";

export interface BuildServerOptions {
  /**
   * Limitar el ritmo contra Redis para que el tope sea del conjunto y no de
   * cada instancia. Se desactiva en los tests, que no deben necesitar
   * infraestructura levantada para comprobar el contrato de una ruta.
   */
  distributedRateLimit?: boolean;
}

export async function buildServer(options: BuildServerOptions = {}): Promise<FastifyInstance> {
  const { distributedRateLimit = true } = options;

  const app = Fastify({
    // El cast mantiene los genéricos por defecto de Fastify: sin él, el tipo
    // concreto de pino se propaga a cada módulo de rutas y los vuelve
    // incompatibles entre sí.
    loggerInstance: logger as FastifyBaseLogger,
    // Confiamos en la cabecera del proxy solo en producción, donde sabemos
    // que hay uno delante. En local, confiar en ella permitiría falsear la IP.
    trustProxy: isProduction(),
    requestIdHeader: "x-request-id",
    bodyLimit: 1_048_576, // 1 MB: los webhooks de Meta son pequeños.
  });

  await app.register(sensible);
  await app.register(helmet, { contentSecurityPolicy: isProduction() });
  await app.register(cookie, {
    secret: env().SESSION_SECRET,
    parseOptions: { httpOnly: true, sameSite: "lax", secure: isProduction(), path: "/" },
  });

  await app.register(rateLimit, {
    global: true,
    max: 300,
    timeWindow: "1 minute",
    ...(distributedRateLimit ? { redis } : {}),
    keyGenerator: (request) => request.ip,
    // Los webhooks de Meta llegan en ráfagas legítimas y no deben limitarse
    // por IP: su control de admisión es la firma, no el ritmo.
    allowList: (request) => request.url.startsWith("/webhooks/"),
  });

  // Fastify 5 tipa el error como `unknown` si no se le dice otra cosa.
  app.setErrorHandler<FastifyError>((error, request, reply) => {
    if (isAppError(error)) {
      request.log.warn({ code: error.code, err: error }, "Error de aplicación");
      return reply
        .code(error.httpStatus)
        .send({ error: { code: error.code, message: error.publicMessage, details: error.details } });
    }

    if (error.validation) {
      return reply.code(422).send({
        error: { code: "datos_invalidos", message: "Los datos enviados no son válidos." },
      });
    }

    if (error.statusCode && error.statusCode < 500) {
      return reply
        .code(error.statusCode)
        .send({ error: { code: "peticion_invalida", message: error.message } });
    }

    // Nada de detalles internos hacia fuera: se registran, no se devuelven.
    request.log.error({ err: error }, "Error no controlado");
    return reply.code(500).send({
      error: {
        code: "error_interno",
        message: "Algo ha fallado por nuestra parte. Ya estamos avisados.",
        requestId: request.id,
      },
    });
  });

  app.setNotFoundHandler((request, reply) =>
    reply.code(404).send({ error: { code: "no_encontrado", message: "Ruta no encontrada." } }),
  );

  await app.register(registerHealthRoutes);

  return app;
}
