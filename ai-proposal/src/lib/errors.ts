/**
 * Jerarquía de errores de aplicación.
 *
 * Razón de existir: distinguir sin ambigüedad entre un error *esperado* (el
 * usuario no tiene permiso, ha superado su cuota, el dato no existe) y un fallo
 * *inesperado* (bug, caída de un proveedor).
 *
 * Los primeros se muestran al usuario tal cual y no deben generar alertas.
 * Los segundos se registran con traza completa, se alertan, y al usuario se le
 * enseña un mensaje genérico: un `stack trace` en pantalla es una fuga de
 * información sobre la infraestructura.
 */

export type ErrorCode =
  | 'unauthenticated'
  | 'forbidden'
  | 'not_found'
  | 'validation'
  | 'conflict'
  | 'quota_exceeded'
  | 'rate_limited'
  | 'provider_unavailable'
  | 'internal';

const HTTP_STATUS: Record<ErrorCode, number> = {
  unauthenticated: 401,
  forbidden: 403,
  not_found: 404,
  validation: 422,
  conflict: 409,
  quota_exceeded: 402,
  rate_limited: 429,
  provider_unavailable: 503,
  internal: 500,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  /** Seguro para mostrar al usuario final. Siempre en español y sin jerga técnica. */
  readonly userMessage: string;
  /** Contexto estructurado para el log. Nunca debe contener secretos ni PII innecesaria. */
  readonly context: Readonly<Record<string, unknown>>;

  constructor(
    code: ErrorCode,
    userMessage: string,
    options: { cause?: unknown; context?: Record<string, unknown> } = {},
  ) {
    super(`[${code}] ${userMessage}`, options.cause === undefined ? {} : { cause: options.cause });
    this.name = 'AppError';
    this.code = code;
    this.userMessage = userMessage;
    this.context = Object.freeze({ ...options.context });
  }

  get status(): number {
    return HTTP_STATUS[this.code];
  }

  /** ¿Merece una alerta? Los errores de negocio son parte del funcionamiento normal. */
  get isExpected(): boolean {
    return this.code !== 'internal';
  }

  toJSON(): { code: ErrorCode; message: string } {
    return { code: this.code, message: this.userMessage };
  }
}

/* ── Constructores ────────────────────────────────────────────────────────
   Fuerzan un mensaje coherente para cada situación en todo el producto.     */

export const errors = {
  unauthenticated: () =>
    new AppError('unauthenticated', 'Necesitas iniciar sesión para continuar.'),

  forbidden: (context?: Record<string, unknown>) =>
    new AppError('forbidden', 'No tienes permiso para realizar esta acción.', {
      context: context ?? {},
    }),

  notFound: (entity: string) =>
    new AppError('not_found', `No se ha encontrado ${entity}.`, { context: { entity } }),

  validation: (userMessage: string, context?: Record<string, unknown>) =>
    new AppError('validation', userMessage, { context: context ?? {} }),

  /** Edición concurrente: el documento cambió en otro sitio (docs/01, §5). */
  conflict: (
    userMessage = 'Este contenido se ha modificado en otro sitio. Recarga para ver la versión actual.',
  ) => new AppError('conflict', userMessage),

  quotaExceeded: (metric: string) =>
    new AppError(
      'quota_exceeded',
      'Has alcanzado el límite de tu plan. Mejora el plan para continuar.',
      {
        context: { metric },
      },
    ),

  rateLimited: (retryAfterSeconds: number) =>
    new AppError(
      'rate_limited',
      'Demasiadas peticiones. Espera unos segundos e inténtalo de nuevo.',
      {
        context: { retryAfterSeconds },
      },
    ),

  providerUnavailable: (provider: string, cause?: unknown) =>
    new AppError(
      'provider_unavailable',
      'El servicio no está disponible ahora mismo. Inténtalo en unos minutos.',
      {
        cause,
        context: { provider },
      },
    ),

  internal: (cause?: unknown, context?: Record<string, unknown>) =>
    new AppError('internal', 'Ha ocurrido un error inesperado. Ya estamos al tanto.', {
      cause,
      context: context ?? {},
    }),
} as const;

export function isAppError(value: unknown): value is AppError {
  return value instanceof AppError;
}

/**
 * Convierte cualquier valor lanzado en un `AppError`.
 *
 * `catch` en TypeScript entrega `unknown` porque en JavaScript se puede lanzar
 * cualquier cosa, incluido un string. Esta función es el único sitio del código
 * que tiene que lidiar con esa realidad.
 */
export function toAppError(value: unknown): AppError {
  if (isAppError(value)) return value;
  return errors.internal(value);
}
