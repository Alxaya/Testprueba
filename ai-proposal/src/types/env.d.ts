/**
 * Declaración de las variables de entorno del proyecto.
 *
 * Sin esto, `process.env` es un índice `Record<string, string | undefined>` y
 * `noPropertyAccessFromIndexSignature` obliga a escribir `process.env['X']`.
 * Eso importa más de lo que parece: Next sustituye `process.env.NEXT_PUBLIC_*`
 * en tiempo de compilación buscando el acceso por punto, así que forzar la
 * notación de corchetes puede dejar la variable sin sustituir y llegar como
 * `undefined` al navegador.
 *
 * Declararlas aquí resuelve las dos cosas a la vez: acceso por punto válido y
 * autocompletado real de las variables que existen.
 *
 * Mantener sincronizado con .env.example y con src/lib/env.ts.
 */
declare namespace NodeJS {
  interface ProcessEnv {
    readonly NODE_ENV: 'development' | 'production' | 'test';

    readonly NEXT_PUBLIC_SUPABASE_URL?: string;
    readonly NEXT_PUBLIC_SUPABASE_ANON_KEY?: string;
    readonly NEXT_PUBLIC_SITE_URL?: string;

    readonly SUPABASE_SERVICE_ROLE_KEY?: string;
    readonly DATABASE_URL?: string;

    readonly CI?: string;
    readonly PLAYWRIGHT_BASE_URL?: string;
    readonly PLAYWRIGHT_CHROMIUM_PATH?: string;
  }
}
