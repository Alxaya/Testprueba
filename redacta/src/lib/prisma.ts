import { PrismaClient } from '@prisma/client';
import { isProduction } from './env';

/**
 * Cliente Prisma unico.
 *
 * En desarrollo Next recarga los modulos en cada cambio; sin este cache
 * global se abririan decenas de pools de conexiones hasta agotar PostgreSQL.
 */

const globalForPrisma = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: isProduction ? ['error'] : ['error', 'warn'],
  });

if (!isProduction) globalForPrisma.prisma = prisma;
