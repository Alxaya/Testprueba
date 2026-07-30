import { defineConfig } from "vitest/config";
import { fileURLToPath } from "node:url";
import path from "node:path";

const root = path.dirname(fileURLToPath(import.meta.url));
const src = (pkg: string, entry = "index") => path.resolve(root, `${pkg}/src/${entry}.ts`);

/**
 * Un único proceso de tests para todo el monorepo: más rápido que arrancar
 * vitest por paquete y con una sola configuración que mantener.
 *
 * Los paquetes internos se apuntan a sus fuentes con alias, no con la
 * condición de exportación "development". Cambiar las condiciones de
 * resolución de forma global rompe la interoperabilidad de las dependencias
 * CommonJS de terceros, que dejan de exportar lo que Fastify espera.
 */
export default defineConfig({
  resolve: {
    alias: [
      { find: /^@recepta\/db\/schema$/, replacement: src("packages/db", "schema/index") },
      { find: /^@recepta\/db$/, replacement: src("packages/db") },
      { find: /^@recepta\/core$/, replacement: src("packages/core") },
      { find: /^@recepta\/config$/, replacement: src("packages/config") },
    ],
  },
  test: {
    environment: "node",
    include: ["{apps,packages}/*/src/**/*.test.ts"],
    restoreMocks: true,
    coverage: {
      provider: "v8",
      include: ["{apps,packages}/*/src/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts", "**/*.config.ts"],
      reporter: ["text", "html"],
    },
  },
});
