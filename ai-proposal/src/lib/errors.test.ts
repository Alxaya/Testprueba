import { describe, expect, it } from 'vitest';
import { AppError, errors, isAppError, toAppError } from './errors';

describe('AppError', () => {
  it('distingue errores esperados de fallos inesperados', () => {
    // La distinción decide si algo genera una alerta a las 3 de la mañana.
    expect(errors.forbidden().isExpected).toBe(true);
    expect(errors.quotaExceeded('ai_generations').isExpected).toBe(true);
    expect(errors.internal().isExpected).toBe(false);
  });

  it('mapea cada código a su estado HTTP', () => {
    expect(errors.unauthenticated().status).toBe(401);
    expect(errors.forbidden().status).toBe(403);
    expect(errors.notFound('el presupuesto').status).toBe(404);
    expect(errors.conflict().status).toBe(409);
    expect(errors.quotaExceeded('proposals').status).toBe(402);
    expect(errors.rateLimited(30).status).toBe(429);
    expect(errors.providerUnavailable('anthropic').status).toBe(503);
    expect(errors.internal().status).toBe(500);
  });

  it('serializa solo lo que puede verse desde fuera', () => {
    const error = new AppError('forbidden', 'No tienes permiso.', {
      context: { orgId: 'secreto' },
    });

    // El contexto es para el log, no para la respuesta HTTP: filtrarlo revelaría
    // identificadores internos a quien acaba de ser rechazado.
    expect(error.toJSON()).toEqual({ code: 'forbidden', message: 'No tienes permiso.' });
  });

  it('congela el contexto para que nadie lo mute tras construirlo', () => {
    const error = errors.validation('Falta el importe', { field: 'total' });
    expect(Object.isFrozen(error.context)).toBe(true);
  });

  it('conserva la causa original', () => {
    const cause = new Error('ECONNRESET');
    expect(errors.providerUnavailable('openai', cause).cause).toBe(cause);
  });
});

describe('toAppError', () => {
  it('deja pasar los AppError sin envolverlos', () => {
    const original = errors.notFound('el cliente');
    expect(toAppError(original)).toBe(original);
  });

  it('normaliza cualquier valor lanzado', () => {
    // En JavaScript se puede lanzar un string, un número o `undefined`; `catch`
    // entrega `unknown`. Esta función es el único punto que lidia con ello.
    for (const thrown of [new Error('boom'), 'texto suelto', 42, undefined, null]) {
      const normalized = toAppError(thrown);
      expect(isAppError(normalized)).toBe(true);
      expect(normalized.code).toBe('internal');
      // Nunca se filtra el detalle original al usuario.
      expect(normalized.userMessage).not.toContain('boom');
    }
  });
});
