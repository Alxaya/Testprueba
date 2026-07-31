import 'server-only';

import { createServerClient } from '@supabase/ssr';
import { cookies } from 'next/headers';
import { clientEnv } from '@/lib/env';
import type { Database } from './types.gen';

/**
 * Cliente para Server Components, Server Actions y Route Handlers.
 *
 * Usa la clave anónima y la sesión del usuario, así que TODA consulta pasa por
 * las políticas RLS. Es el cliente por defecto: si una operación necesita saltar
 * RLS, casi siempre significa que el diseño está mal, no que haga falta
 * `service_role`.
 *
 * `server-only` hace que importarlo desde un componente de cliente sea un error
 * de compilación, no un fallo en tiempo de ejecución.
 */
export async function createClient() {
  const cookieStore = await cookies();

  return createServerClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookies: {
        getAll: () => cookieStore.getAll(),
        setAll: (cookiesToSet) => {
          try {
            for (const { name, value, options } of cookiesToSet) {
              cookieStore.set(name, value, options);
            }
          } catch {
            // Los Server Components no pueden escribir cookies. El refresco de
            // sesión lo hace el middleware, así que aquí se ignora sin riesgo.
          }
        },
      },
    },
  );
}

/**
 * Usuario autenticado, o `null`.
 *
 * Usa `getUser()` y no `getSession()`: `getSession()` lee la cookie sin
 * validarla contra el servidor de autenticación, por lo que un token manipulado
 * pasaría. Nunca debe usarse para decidir permisos.
 */
export async function getCurrentUser() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();
  return user;
}
