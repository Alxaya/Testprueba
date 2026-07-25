import { defineConfig } from 'vitest/config';
import { resolve } from 'node:path';

export default defineConfig({
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // Evita que los tests toquen la base de datos real por accidente.
    env: { NODE_ENV: 'test' },
  },
  resolve: {
    alias: {
      '@': resolve(__dirname, './src'),
      // `server-only` lanza un error al importarse fuera de un Server
      // Component; en los tests se sustituye por un modulo vacio.
      'server-only': resolve(__dirname, './tests/stubs/server-only.ts'),
    },
  },
});
