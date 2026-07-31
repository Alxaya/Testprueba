import { createBrowserClient } from '@supabase/ssr';
import { clientEnv } from '@/lib/env';
import type { Database } from './types.gen';

/**
 * Cliente de navegador. Solo para lo que necesita ejecutarse en el cliente:
 * suscripciones en tiempo real y flujos de autenticación.
 *
 * La lectura de datos para pintar la interfaz se hace en Server Components:
 * evita el viaje de ida y vuelta cliente→servidor y no envía la consulta al
 * bundle.
 *
 * `isSingleton` deja una sola instancia por pestaña. Es importante: cada
 * instancia abre su propio temporizador de refresco de sesión y su propio
 * WebSocket de Realtime, y varias compitiendo por refrescar el mismo token
 * provocan cierres de sesión intermitentes.
 */
export function createClient() {
  return createBrowserClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    clientEnv.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { isSingleton: true },
  );
}
