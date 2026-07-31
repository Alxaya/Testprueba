import { defineConfig } from 'vitest/config';
import { fileURLToPath } from 'node:url';

/**
 * Dos proyectos con necesidades opuestas:
 *
 *  · `unit` — dominio puro. Milisegundos, sin E/S, ejecutable en paralelo.
 *  · `db`   — políticas RLS contra un Postgres real. Comparte una base, así que
 *             debe ejecutarse en un único hilo: en paralelo, los datos sembrados
 *             de un fichero interferirían con los de otro.
 */
export default defineConfig({
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  test: {
    projects: [
      {
        extends: true,
        test: {
          name: 'unit',
          include: ['src/**/*.test.ts'],
          environment: 'node',
        },
      },
      {
        extends: true,
        test: {
          name: 'db',
          include: ['supabase/tests/**/*.test.ts'],
          environment: 'node',
          globalSetup: ['./supabase/tests/global-setup.ts'],
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
