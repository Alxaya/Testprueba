# 08 · Despliegue

---

## Opción recomendada: Vercel + PostgreSQL gestionado

Es la vía con menos mantenimiento: los cron ya están declarados en
`vercel.json`.

### 1. Base de datos

Crea una en Neon, Supabase o RDS. Copia la cadena de conexión (con `sslmode=require`).

### 2. Proyecto

Importa el repositorio en Vercel y configura:

- **Root Directory:** `redacta`
- **Build Command:** `npm run build` (ya ejecuta `prisma generate`)

### 3. Variables de entorno

| Variable | Valor |
| --- | --- |
| `DATABASE_URL` | Cadena de conexión de producción |
| `AUTH_SECRET` | `openssl rand -base64 32` (uno **nuevo**, no el de desarrollo) |
| `NEXT_PUBLIC_APP_URL` | `https://tu-dominio.com` |
| `AUTH_URL` | `https://tu-dominio.com` |
| `ANTHROPIC_API_KEY` | Clave de producción |
| `STRIPE_SECRET_KEY` | `sk_live_...` |
| `STRIPE_WEBHOOK_SECRET` | Secreto del webhook de producción |
| `STRIPE_PRICE_*` | IDs de precio de **producción** |
| `RESEND_API_KEY` | Clave de Resend |
| `EMAIL_FROM` | Remitente con dominio verificado |
| `CRON_SECRET` | `openssl rand -hex 32` |
| `ADMIN_EMAILS` | Tu email |

### 4. Esquema

```bash
DATABASE_URL="postgresql://..." npx prisma migrate deploy
```

**No ejecutes el seed en producción.**

### 5. Comprobación

```bash
curl -I https://tu-dominio.com/
curl https://tu-dominio.com/robots.txt
curl -s https://tu-dominio.com/sitemap.xml | head
```

Regístrate con el email de `ADMIN_EMAILS` y comprueba que `/admin` es accesible y
que `/admin/sistema` muestra todas las integraciones en verde.

---

## Alternativa: servidor propio con Docker

```dockerfile
FROM node:22-alpine AS deps
WORKDIR /app
COPY package*.json ./
RUN npm ci

FROM node:22-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npx prisma generate && npm run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/package.json ./
COPY --from=builder /app/prisma ./prisma
EXPOSE 3000
CMD ["npm", "start"]
```

Con esta opción los cron los pones tú (crontab o systemd timers), según
[`docs/06-automatizaciones.md`](06-automatizaciones.md).

---

## Lista de comprobación antes de abrir al público

### Seguridad
- [ ] `AUTH_SECRET` **distinto** del de desarrollo
- [ ] `CRON_SECRET` configurado (si no, los endpoints se bloquean solos en producción)
- [ ] HTTPS activo (las cabeceras HSTS ya se envían)
- [ ] Copias de seguridad automáticas de la base de datos, con restauración probada

### Facturación
- [ ] Claves de Stripe en modo producción
- [ ] Webhook de producción creado y verificado
- [ ] Portal de cliente configurado
- [ ] Prueba de cobro real de 1 € y reembolso

### Legal — bloqueante
- [ ] Datos fiscales del titular en `src/content/legal.ts` (buscar `[PENDIENTE]`)
- [ ] Textos legales revisados por un asesor
- [ ] Ver [`docs/09-legal.md`](09-legal.md)

### SEO
- [ ] Dominio propio configurado
- [ ] Alta en Google Search Console y envío del sitemap
- [ ] `NEXT_PUBLIC_APP_URL` con el dominio final (afecta a las URL canónicas)

### Operativa
- [ ] `ADMIN_EMAILS` con tu email **antes** de registrarte
- [ ] Seed **no** ejecutado
- [ ] Cron verificados: lánzalos a mano desde `/admin/sistema`
- [ ] Dominio de email verificado en Resend (SPF, DKIM, DMARC)

---

## Actualizar en caliente

```bash
git pull
npm ci
npx prisma migrate deploy    # si hay migraciones nuevas
npm run build
pm2 restart redacta          # o el gestor que uses
```

En Vercel basta con hacer push; las migraciones hay que ejecutarlas aparte.

---

## Vulnerabilidades conocidas de dependencias

`npm audit` reporta avisos en `postcss` y `sharp`, ambos **dependencias internas
de Next.js**. No hay corrección disponible sin degradar Next a la versión 9, lo
que no es aceptable. Se resolverán cuando Next publique una versión con las
dependencias actualizadas. Ninguna es explotable desde la aplicación: no
procesamos CSS ni imágenes subidas por usuarios.

Revísalo periódicamente con `npm audit` y actualiza Next cuando salga el parche.
