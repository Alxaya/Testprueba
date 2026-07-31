import { isAppError, type AppError } from './errors';

/**
 * Log estructurado en JSON, sin dependencias.
 *
 * Por qué JSON y no texto: en Vercel/Datadog/Sentry un log en texto plano no se
 * puede filtrar ni agregar. Con JSON, "todos los fallos de generación de la
 * organización X en la última hora" es una consulta, no una búsqueda a ojo.
 *
 * Por qué sin librería: son ~80 líneas y evita una dependencia con su propio
 * ciclo de releases en un camino crítico. Se sustituye por Sentry en F9 sin
 * tocar los llamantes, porque la interfaz es la misma.
 */

type LogLevel = 'debug' | 'info' | 'warn' | 'error';

/** Contexto que acompaña a todo log de una misma petición. */
export interface LogContext {
  requestId?: string;
  orgId?: string;
  userId?: string;
  route?: string;
  [key: string]: unknown;
}

/** Claves que nunca deben aparecer en un log, se pasen como se pasen. */
const REDACTED_KEYS = new Set([
  'password',
  'token',
  'apiKey',
  'api_key',
  'secret',
  'authorization',
  'cookie',
  'serviceRoleKey',
  'service_role_key',
  'accessToken',
  'refreshToken',
]);

/**
 * Sanea recursivamente antes de escribir.
 *
 * Depender de que "nadie loguee un secreto por error" no es una política de
 * seguridad. Esto lo hace imposible por construcción.
 */
function redact(value: unknown, depth = 0): unknown {
  if (depth > 6) return '[profundidad máxima]';
  if (value === null || typeof value !== 'object') return value;
  if (Array.isArray(value)) return value.slice(0, 50).map((item) => redact(item, depth + 1));

  const output: Record<string, unknown> = {};
  for (const [key, item] of Object.entries(value)) {
    output[key] = REDACTED_KEYS.has(key) ? '[oculto]' : redact(item, depth + 1);
  }
  return output;
}

function serializeError(error: AppError | Error): Record<string, unknown> {
  const base: Record<string, unknown> = { name: error.name, message: error.message };

  if (isAppError(error)) {
    base['code'] = error.code;
    base['expected'] = error.isExpected;
    base['context'] = redact(error.context);
  }

  // La traza solo interesa en fallos inesperados; en los esperados es ruido.
  if (!isAppError(error) || !error.isExpected) base['stack'] = error.stack;
  if (error.cause instanceof Error) base['cause'] = serializeError(error.cause);

  return base;
}

function write(level: LogLevel, message: string, context: LogContext = {}): void {
  // `debug` fuera de desarrollo solo genera coste de almacenamiento.
  if (level === 'debug' && process.env.NODE_ENV === 'production') return;

  const entry = {
    level,
    message,
    timestamp: new Date().toISOString(),
    ...(redact(context) as LogContext),
  };

  const line = JSON.stringify(entry);
  if (level === 'error') console.error(line);
  else if (level === 'warn') console.warn(line);
  else process.stdout.write(`${line}\n`);
}

export const logger = {
  debug: (message: string, context?: LogContext) => {
    write('debug', message, context);
  },
  info: (message: string, context?: LogContext) => {
    write('info', message, context);
  },
  warn: (message: string, context?: LogContext) => {
    write('warn', message, context);
  },

  /**
   * Los errores esperados (permiso, cuota, validación) se registran como `warn`:
   * si generasen alertas, el ruido acabaría ocultando los fallos reales.
   */
  error: (message: string, error: unknown, context?: LogContext) => {
    const normalized = error instanceof Error ? error : new Error(String(error));
    const level: LogLevel = isAppError(normalized) && normalized.isExpected ? 'warn' : 'error';
    write(level, message, { ...context, error: serializeError(normalized) });
  },

  /** Devuelve un logger con contexto fijo, para no repetirlo en cada llamada. */
  child: (base: LogContext) => ({
    debug: (message: string, context?: LogContext) => {
      write('debug', message, { ...base, ...context });
    },
    info: (message: string, context?: LogContext) => {
      write('info', message, { ...base, ...context });
    },
    warn: (message: string, context?: LogContext) => {
      write('warn', message, { ...base, ...context });
    },
    error: (message: string, error: unknown, context?: LogContext) => {
      logger.error(message, error, { ...base, ...context });
    },
  }),
} as const;
