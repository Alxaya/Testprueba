import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

/**
 * Reconstruye la base antes de la batería de tests de base de datos.
 *
 * Se ejecuta en un proceso aparte a propósito: así el reset usa exactamente el
 * mismo script que el desarrollador ejecuta a mano (`npm run db:reset`), y no
 * puede haber divergencia entre "como se prepara en CI" y "como se prepara en
 * local" — una fuente clásica de fallos que solo aparecen en CI.
 */
export default function setup(): void {
  const script = fileURLToPath(new URL('../../scripts/db-reset.mjs', import.meta.url));
  execFileSync(process.execPath, [script], { stdio: 'inherit' });
}
