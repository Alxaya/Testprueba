// @ts-check
import nextCoreWebVitals from 'eslint-config-next/core-web-vitals';
import tseslint from 'typescript-eslint';

/**
 * Fronteras entre módulos (docs/01, §2).
 *
 * La regla que impide que este proyecto se convierta en una bola de barro:
 * una *feature* solo puede consumir otra a través de su `index.ts` público.
 * Los imports internos de una feature se hacen con rutas relativas (`./server/x`),
 * de modo que un import profundo del tipo `@/features/<otra>/<interno>` solo
 * puede aparecer cuando alguien está atravesando una frontera indebida.
 */
const FEATURE_INTERNALS = {
  group: ['@/features/*/*'],
  message:
    'Importa la feature por su API pública (`@/features/<nombre>`). Dentro de la propia feature usa rutas relativas.',
};

const SERVICE_ROLE = {
  group: ['@/lib/supabase/admin'],
  message:
    'El cliente `service_role` ignora RLS. Solo puede usarse en webhooks y scripts (ver docs/01, §6).',
};

export default tseslint.config(
  { ignores: ['.next/**', 'node_modules/**', 'coverage/**', 'src/lib/supabase/types.gen.ts'] },

  ...nextCoreWebVitals,
  ...tseslint.configs.strictTypeChecked,
  ...tseslint.configs.stylisticTypeChecked,

  {
    languageOptions: {
      parserOptions: { projectService: true, tsconfigRootDir: import.meta.dirname },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': [
        'error',
        { argsIgnorePattern: '^_', varsIgnorePattern: '^_' },
      ],
      '@typescript-eslint/consistent-type-imports': [
        'error',
        { prefer: 'type-imports', fixStyle: 'inline-type-imports' },
      ],
      '@typescript-eslint/no-explicit-any': 'error',
      '@typescript-eslint/no-floating-promises': 'error',
      '@typescript-eslint/switch-exhaustiveness-check': 'error',
      eqeqeq: ['error', 'always', { null: 'ignore' }],
      'no-console': ['error', { allow: ['warn', 'error'] }],
      'no-restricted-imports': ['error', { patterns: [FEATURE_INTERNALS, SERVICE_ROLE] }],
    },
  },

  // El dominio puro no puede depender de infraestructura: es lo que lo hace
  // testeable en milisegundos y portable a otro runtime.
  {
    files: ['src/lib/pricing/**', 'src/features/*/domain/**'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@/lib/supabase*', '@/app/*', '@/features/*'],
              message: 'El dominio debe ser puro (sin E/S).',
            },
          ],
        },
      ],
    },
  },

  // Excepciones deliberadas y acotadas al uso del cliente con `service_role`.
  {
    files: ['src/app/api/webhooks/**', 'scripts/**', 'src/lib/supabase/admin.ts'],
    rules: { 'no-restricted-imports': ['error', { patterns: [FEATURE_INTERNALS] }] },
  },

  // Ficheros JS/MJS fuera del programa de TypeScript (configuración de PostCSS,
  // scripts de mantenimiento). Las reglas que necesitan tipos no pueden
  // aplicarse aquí, y forzarlas solo produce errores de parseo.
  {
    files: ['**/*.mjs', '**/*.js'],
    extends: [tseslint.configs.disableTypeChecked],
    rules: { '@typescript-eslint/no-unsafe-call': 'off' },
  },

  {
    files: ['**/*.test.ts', '**/*.spec.ts', 'e2e/**', 'scripts/**', '*.config.*'],
    rules: {
      '@typescript-eslint/no-non-null-assertion': 'off',
      'no-console': 'off',
    },
  },
);
