import 'server-only';

import { createClient as createSupabaseClient } from '@supabase/supabase-js';
import { serverEnv, clientEnv } from '@/lib/env';
import type { Database } from './types.gen';

/**
 * ⚠️  Cliente con `service_role`: IGNORA POR COMPLETO LAS POLÍTICAS RLS.
 *
 * Un solo uso descuidado de este cliente en un camino con entrada de usuario
 * convierte cualquier fallo lógico en una fuga de datos entre clientes. Por eso
 * su uso está restringido por ESLint (`no-restricted-imports`) a:
 *
 *   · src/app/api/webhooks/**  — el proveedor de pagos no tiene sesión de usuario
 *   · scripts/**               — mantenimiento fuera de línea
 *
 * Cualquier otra necesidad aparente se resuelve con una función
 * `security definer` acotada en la base de datos (ver `get_shared_proposal`),
 * que limita el daño de un error a una fila en lugar de a toda la base.
 */
export function createAdminClient() {
  return createSupabaseClient<Database>(
    clientEnv.NEXT_PUBLIC_SUPABASE_URL,
    serverEnv().SUPABASE_SERVICE_ROLE_KEY,
    {
      auth: { autoRefreshToken: false, persistSession: false },
    },
  );
}
