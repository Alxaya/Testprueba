/**
 * Sustituto de `server-only` para los tests.
 *
 * El paquete real lanza un error cuando se importa fuera de un Server
 * Component; en Vitest no hay esa distincion, asi que se reemplaza por un
 * modulo vacio. La proteccion sigue vigente donde importa: al compilar la app.
 */
export {};
