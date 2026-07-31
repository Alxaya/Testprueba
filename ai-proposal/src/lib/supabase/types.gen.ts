/**
 * MARCADOR DE POSICIÓN — este fichero NO está generado todavía.
 *
 * Los tipos reales los produce el CLI de Supabase contra la base de datos:
 *
 *     npm run db:types
 *
 * que ejecuta `supabase gen types typescript --local` y sobrescribe este
 * fichero por completo. Requiere un proyecto Supabase (local o remoto) en
 * marcha, cosa que aún no existe en F0.
 *
 * Se deja este marcador en lugar de un esquema escrito a mano por una razón:
 * unos tipos mantenidos manualmente divergen del SQL en cuanto alguien añade
 * una columna, y entonces el compilador da por buenas consultas que fallan en
 * producción. Un marcador honesto es preferible a un tipo que miente.
 *
 * `unknown` en Row/Insert/Update es deliberado: obliga a regenerar antes de
 * escribir la primera consulta real (F1), en vez de permitir que el código
 * crezca sobre tipos falsos.
 */

export interface Database {
  public: {
    Tables: Record<string, { Row: Record<string, unknown>; Insert: Record<string, unknown>; Update: Record<string, unknown>; Relationships: [] }>;
    Views: Record<string, never>;
    Functions: Record<string, never>;
    Enums: Record<string, never>;
    CompositeTypes: Record<string, never>;
  };
}
