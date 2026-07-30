import { migrate } from "drizzle-orm/postgres-js/migrator";
import { fileURLToPath } from "node:url";
import path from "node:path";
import { db, closeDatabase } from "./client.js";

const migrationsFolder = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  "../migrations",
);

async function main() {
  console.log(`Aplicando migraciones desde ${migrationsFolder}`);
  await migrate(db, { migrationsFolder });
  console.log("Migraciones aplicadas.");
  await closeDatabase();
}

main().catch(async (error) => {
  console.error("Fallo al migrar:", error);
  await closeDatabase().catch(() => {});
  process.exit(1);
});
