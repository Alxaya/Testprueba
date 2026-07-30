/**
 * Errores del dominio.
 *
 * Separamos el mensaje interno (para nosotros, con detalle) del mensaje
 * público (para el usuario, sin filtrar nada). Todo lo que no sea un
 * AppError se trata como fallo inesperado y jamás se muestra tal cual.
 */
export type ErrorCode =
  | "no_autenticado"
  | "sin_permiso"
  | "no_encontrado"
  | "datos_invalidos"
  | "conflicto"
  | "limite_excedido"
  | "dependencia_caida"
  | "presupuesto_agotado";

const STATUS: Record<ErrorCode, number> = {
  no_autenticado: 401,
  sin_permiso: 403,
  no_encontrado: 404,
  datos_invalidos: 422,
  conflicto: 409,
  limite_excedido: 429,
  dependencia_caida: 503,
  presupuesto_agotado: 402,
};

export class AppError extends Error {
  readonly code: ErrorCode;
  readonly httpStatus: number;
  readonly publicMessage: string;
  readonly details: Record<string, unknown> | undefined;

  constructor(
    code: ErrorCode,
    publicMessage: string,
    options?: { internalMessage?: string; details?: Record<string, unknown>; cause?: unknown },
  ) {
    super(options?.internalMessage ?? publicMessage, { cause: options?.cause });
    this.name = "AppError";
    this.code = code;
    this.httpStatus = STATUS[code];
    this.publicMessage = publicMessage;
    this.details = options?.details;
  }
}

export const notFound = (what: string) =>
  new AppError("no_encontrado", `No se ha encontrado ${what}.`);

export const invalid = (message: string, details?: Record<string, unknown>) =>
  new AppError("datos_invalidos", message, { details });

export const conflict = (message: string, details?: Record<string, unknown>) =>
  new AppError("conflicto", message, { details });

export function isAppError(error: unknown): error is AppError {
  return error instanceof AppError;
}
