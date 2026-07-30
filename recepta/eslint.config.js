import js from "@eslint/js";
import tseslint from "typescript-eslint";

export default tseslint.config(
  { ignores: ["**/dist/**", "**/.next/**", "**/node_modules/**", "**/migrations/**"] },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    rules: {
      "@typescript-eslint/no-unused-vars": [
        "error",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
      ],
      // `disallowTypeAnnotations: false` deja pasar `typeof import(...)`, que
      // hace falta para tipar los mocks de vitest.
      "@typescript-eslint/consistent-type-imports": [
        "error",
        { prefer: "type-imports", disallowTypeAnnotations: false },
      ],
      "no-console": ["warn", { allow: ["warn", "error"] }],
      eqeqeq: ["error", "always"],
    },
  },
  {
    // Los scripts de línea de comandos sí escriben por consola.
    files: ["**/migrate.ts", "**/seed.ts", "**/scripts/**"],
    rules: { "no-console": "off" },
  },
);
