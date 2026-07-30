/**
 * Sustituto de `server-only` para las pruebas.
 *
 * `server-only` es un marcador que Next.js usa en tiempo de compilación para
 * impedir que un módulo de servidor acabe en el bundle del cliente. No tiene
 * implementación en tiempo de ejecución, así que en Vitest se resuelve aquí.
 */
export {};
