import { defineConfig } from "drizzle-kit";
import { env } from "@recepta/config";

export default defineConfig({
  schema: "./src/schema/index.ts",
  out: "./migrations",
  dialect: "postgresql",
  dbCredentials: { url: env().DATABASE_URL },
  casing: "snake_case",
  strict: true,
  verbose: true,
});
