import pino from "pino";
import { env, isProduction, isTest } from "@recepta/config";

/**
 * Campos que nunca deben acabar en un registro.
 *
 * Manejamos datos de salud (art. 9 RGPD): el contenido de un mensaje de un
 * paciente es dato sensible. Se registra el hecho de que hubo un mensaje,
 * nunca lo que decía.
 */
const REDACTED = [
  "req.headers.authorization",
  "req.headers.cookie",
  "*.token",
  "*.accessToken",
  "*.password",
  "*.apiKey",
  "*.body.text",
  "*.message.text",
  "*.content",
  "*.notes",
];

export const logger = pino({
  level: env().LOG_LEVEL,
  redact: { paths: REDACTED, censor: "[redactado]" },
  base: { service: "recepta" },
  timestamp: pino.stdTimeFunctions.isoTime,
  // El transporte con formato bonito arranca un worker aparte. Es cómodo en
  // desarrollo, pero en producción resta rendimiento y bajo vitest el worker
  // no llega a resolverse: cada log fallaría y tumbaría la petición.
  ...(isProduction() || isTest()
    ? {}
    : {
        transport: {
          target: "pino-pretty",
          options: { colorize: true, translateTime: "HH:MM:ss" },
        },
      }),
});

export type Logger = typeof logger;
