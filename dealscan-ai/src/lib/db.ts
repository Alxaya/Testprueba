import { PrismaClient } from "@prisma/client";

/**
 * Cliente Prisma único por proceso. En desarrollo se guarda en `globalThis`
 * para que el hot reload no abra una conexión nueva en cada recarga.
 */
const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}
