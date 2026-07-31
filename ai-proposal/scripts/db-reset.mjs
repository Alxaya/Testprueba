/**
 * Reconstruye la base de datos desde cero: bootstrap + todas las migraciones.
 *
 * Existe para que los tests de RLS sean repetibles. Un test que solo pasa la
 * primera vez, o que depende de datos de una ejecución anterior, no es una red
 * de seguridad: es una fuente de falsos positivos.
 *
 * Efecto secundario valioso: verifica en cada ejecución que las migraciones
 * aplican limpiamente en orden sobre una base vacía, que es exactamente lo que
 * ocurrirá en producción.
 *
 * Uso:  DATABASE_URL=postgresql://… node scripts/db-reset.mjs
 */
import { readFile, readdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  console.error('DATABASE_URL no está definida.');
  process.exit(1);
}

// Salvaguarda: este script destruye datos. Que no pueda apuntarse a producción
// por un despiste de variables de entorno.
if (
  /supabase\.co|amazonaws\.com/.test(connectionString) &&
  process.env.ALLOW_REMOTE_RESET !== 'yes'
) {
  console.error(
    'Se ha detectado una base remota. Aborta: usa ALLOW_REMOTE_RESET=yes si es intencionado.',
  );
  process.exit(1);
}

const client = new pg.Client({ connectionString });
await client.connect();

try {
  await client.query(`
    drop schema if exists public cascade;
    drop schema if exists auth cascade;
    drop schema if exists extensions cascade;
    create schema public;
  `);

  const files = [
    join(root, 'supabase/tests/00-bootstrap.sql'),
    ...(await readdir(join(root, 'supabase/migrations')))
      .filter((name) => name.endsWith('.sql'))
      .sort()
      .map((name) => join(root, 'supabase/migrations', name)),
    join(root, 'supabase/seed.sql'),
  ];

  for (const file of files) {
    await client.query(await readFile(file, 'utf8'));
  }

  console.log(`Base reconstruida: ${String(files.length)} ficheros aplicados.`);
} finally {
  await client.end();
}
