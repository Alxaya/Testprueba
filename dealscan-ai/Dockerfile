# syntax=docker/dockerfile:1

# ---------------------------------------------------------------------------
# DealScan AI — imagen de producción.
#
# Construcción en varias etapas para que la imagen final no lleve el código
# fuente ni las dependencias de desarrollo. Se usa la salida `standalone` de
# Next.js: arranca con `node server.js` y solo incluye lo que la app necesita.
# ---------------------------------------------------------------------------

FROM node:22-alpine AS base
# libc6-compat lo necesitan los binarios nativos del motor de Prisma en Alpine.
RUN apk add --no-cache libc6-compat
WORKDIR /app


# --- Dependencias ----------------------------------------------------------
FROM base AS deps
COPY package.json package-lock.json ./
COPY prisma ./prisma
# `npm ci` respeta el lockfile; el postinstall genera el cliente de Prisma.
RUN npm ci


# --- Compilación -----------------------------------------------------------
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# El build de Next no necesita credenciales reales, pero el esquema de
# configuración exige que DATABASE_URL y AUTH_SECRET existan. Estos valores son
# solo para la compilación: en ejecución se inyectan los reales.
ENV NEXT_TELEMETRY_DISABLED=1
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV AUTH_SECRET="build-time-placeholder-not-used-at-runtime-000000"
RUN npm run build


# --- Ejecución -------------------------------------------------------------
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# Usuario sin privilegios: el proceso no corre como root.
RUN addgroup -g 1001 -S nodejs && adduser -S nextjs -u 1001

COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=builder --chown=nextjs:nodejs /app/public ./public

# Prisma CLI, esquema y migraciones: necesarios para `prisma migrate deploy`
# al arrancar y para poder cargar el catálogo de referencia.
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.bin ./node_modules/.bin

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"

CMD ["node", "server.js"]
