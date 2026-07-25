# Redacta

**Contenido que vende, generado con IA.**

SaaS de generación de contenido para tiendas online y pymes españolas: fichas de
producto, artículos SEO, guiones para TikTok/Reels, anuncios, emails y FAQ, todo
con el tono de voz de cada marca.

El negocio es de suscripción y **autoservicio de principio a fin**: el cliente se
registra, paga con Stripe y consume sin intervención manual. Las tareas
recurrentes (avisos de cuota, recuperación de pagos, informes, publicación en el
blog) las ejecutan trabajos programados.

---

## Índice

- [Puesta en marcha en 5 minutos](#puesta-en-marcha-en-5-minutos)
- [Requisitos](#requisitos)
- [Instalación paso a paso](#instalación-paso-a-paso)
- [Cuentas de ejemplo](#cuentas-de-ejemplo)
- [Comandos disponibles](#comandos-disponibles)
- [Estructura del proyecto](#estructura-del-proyecto)
- [Configuración de las integraciones](#configuración-de-las-integraciones)
- [Documentación completa](#documentación-completa)
- [Estado del proyecto](#estado-del-proyecto)

---

## Puesta en marcha en 5 minutos

```bash
cd redacta
cp .env.example .env                       # 1. configuración
echo "AUTH_SECRET=\"$(openssl rand -base64 32)\"" >> .env
docker compose up -d                       # 2. PostgreSQL
npm install                                # 3. dependencias
npm run db:push && npm run db:seed         # 4. esquema + datos de ejemplo
npm run dev                                # 5. http://localhost:3000
```

Entra con `demo@redacta.test` / `redacta1234`.

> Sin `ANTHROPIC_API_KEY` la aplicación arranca y todo funciona **salvo la
> generación de contenido**, que devuelve un aviso claro en vez de romperse. Lo
> mismo con Stripe y Resend: sin configurar, quedan desactivados de forma
> controlada. Así puedes ver el producto entero antes de dar de alta ningún
> servicio de pago.

---

## Requisitos

| Herramienta | Versión | Para qué |
| --- | --- | --- |
| Node.js | 20 o superior | Ejecutar la aplicación |
| npm | 10 o superior | Gestionar dependencias |
| Docker | cualquiera reciente | Levantar PostgreSQL en local |
| PostgreSQL | 16 | Base de datos (la pone Docker) |

Si ya tienes un PostgreSQL propio, sáltate Docker y apunta `DATABASE_URL` a él.

---

## Instalación paso a paso

### 1. Configuración

```bash
cd redacta
cp .env.example .env
```

Abre `.env` y rellena, como mínimo:

```bash
# Genera el secreto de sesión:
openssl rand -base64 32
```

- `AUTH_SECRET` → pega el valor generado. **Obligatorio.**
- `DATABASE_URL` → el valor por defecto ya funciona con Docker.
- `NEXT_PUBLIC_APP_URL` → `http://localhost:3000` en local.

El resto son opcionales y están explicados en [`.env.example`](.env.example) y en
[`docs/`](docs/).

### 2. Base de datos

```bash
docker compose up -d          # arranca PostgreSQL en el puerto 5432
docker compose ps             # comprueba que está "healthy"
```

### 3. Dependencias y esquema

```bash
npm install
npm run db:push               # crea las 16 tablas
npm run db:seed               # datos de ejemplo (opcional pero recomendado)
```

`db:push` es cómodo en desarrollo. Para producción se usan migraciones
versionadas: ver [`docs/03-base-de-datos.md`](docs/03-base-de-datos.md).

### 4. Arrancar

```bash
npm run dev                   # desarrollo, con recarga en caliente
# o
npm run build && npm start    # como en producción
```

### 5. Comprobar que todo está bien

```bash
npm run typecheck             # tipos
npm test                      # 33 pruebas unitarias
```

---

## Cuentas de ejemplo

Las crea `npm run db:seed`:

| Cuenta | Email | Contraseña | Para qué |
| --- | --- | --- | --- |
| Cliente | `demo@redacta.test` | `redacta1234` | Panel de cliente, plan Pro con contenido |
| Administración | `admin@redacta.test` | `redacta1234` | Panel interno en `/admin` |

> Son cuentas de desarrollo. **No despliegues con el seed ejecutado en un
> entorno público.**

Para convertir tu propia cuenta en administradora, añade su email a
`ADMIN_EMAILS` en `.env` **antes** de registrarte.

---

## Comandos disponibles

| Comando | Qué hace |
| --- | --- |
| `npm run dev` | Servidor de desarrollo en http://localhost:3000 |
| `npm run build` | Compila para producción (genera el cliente de Prisma antes) |
| `npm start` | Sirve la compilación de producción |
| `npm run typecheck` | Comprueba los tipos sin compilar |
| `npm test` | Pruebas unitarias (Vitest) |
| `npm run test:watch` | Pruebas en modo vigilancia |
| `npm run db:up` / `db:down` | Arranca/para PostgreSQL con Docker |
| `npm run db:push` | Sincroniza el esquema sin crear migración (desarrollo) |
| `npm run db:migrate` | Crea una migración versionada |
| `npm run db:deploy` | Aplica migraciones (producción) |
| `npm run db:studio` | Explorador visual de la base de datos |
| `npm run db:seed` | Carga datos de ejemplo |
| `npm run setup` | Todo lo anterior de una vez, para empezar de cero |

---

## Estructura del proyecto

```
redacta/
├── prisma/
│   ├── schema.prisma          # modelo de datos (16 tablas)
│   └── seed.ts                # datos de ejemplo
├── src/
│   ├── app/
│   │   ├── (marketing)/       # web pública: portada, precios, blog, legal
│   │   ├── (auth)/            # acceso y registro
│   │   ├── app/               # panel de cliente
│   │   ├── admin/             # panel interno
│   │   ├── api/               # auth, analítica, webhook de Stripe, cron, export
│   │   ├── actions/           # Server Actions (mutaciones)
│   │   ├── sitemap.ts         # sitemap dinámico
│   │   └── robots.ts
│   ├── components/            # interfaz reutilizable
│   ├── content/legal.ts       # textos legales
│   ├── lib/
│   │   ├── ai/                # motor de generación (Claude)
│   │   ├── email/             # emails transaccionales
│   │   ├── jobs/              # trabajos programados
│   │   ├── env.ts             # validación de configuración
│   │   ├── plans.ts           # catálogo comercial y límites
│   │   ├── organization.ts    # multi-tenant y cuotas
│   │   ├── stripe.ts          # facturación
│   │   ├── analytics.ts       # analítica propia
│   │   └── metrics.ts         # métricas de negocio
│   ├── auth.ts / auth.config.ts
│   └── middleware.ts          # protección de rutas
├── tests/                     # pruebas unitarias
├── docs/                      # documentación de mantenimiento
├── docker-compose.yml
└── vercel.json                # programación de los cron
```

**Dónde tocar cada cosa:**

| Quiero… | Fichero |
| --- | --- |
| Cambiar precios o límites de plan | `src/lib/plans.ts` |
| Añadir un formato de contenido | `src/lib/ai/content-types.ts` |
| Cambiar el estilo del contenido generado | `src/lib/ai/client.ts` (`SYSTEM_CORE`) |
| Cambiar textos legales | `src/content/legal.ts` |
| Añadir un trabajo programado | `src/lib/jobs/index.ts` + `vercel.json` |
| Cambiar los emails | `src/lib/email/templates.ts` |
| Cambiar colores y componentes | `src/app/globals.css` |

---

## Configuración de las integraciones

Todas son opcionales para desarrollar. Cada una tiene su guía:

| Integración | Sin configurar | Guía |
| --- | --- | --- |
| **Anthropic** (IA) | El generador avisa y no consume cuota | [`docs/04-ia.md`](docs/04-ia.md) |
| **Stripe** (pagos) | Todas las cuentas en plan gratuito | [`docs/05-stripe.md`](docs/05-stripe.md) |
| **Resend** (email) | Los emails se escriben en consola | [`docs/06-automatizaciones.md`](docs/06-automatizaciones.md) |
| **Google OAuth** | El botón no se muestra | [`docs/02-arquitectura.md`](docs/02-arquitectura.md) |
| **Cron** | Los endpoints solo responden fuera de producción | [`docs/06-automatizaciones.md`](docs/06-automatizaciones.md) |

El panel `/admin/sistema` muestra en todo momento qué está configurado y qué no.

---

## Documentación completa

| Documento | Contenido |
| --- | --- |
| [`docs/01-vision-negocio.md`](docs/01-vision-negocio.md) | Qué se vende, a quién, unidad económica y palancas de crecimiento |
| [`docs/02-arquitectura.md`](docs/02-arquitectura.md) | Decisiones técnicas y por qué se tomaron |
| [`docs/03-base-de-datos.md`](docs/03-base-de-datos.md) | Modelo de datos, migraciones y copias de seguridad |
| [`docs/04-ia.md`](docs/04-ia.md) | Motor de generación, prompts, coste y cómo añadir formatos |
| [`docs/05-stripe.md`](docs/05-stripe.md) | Alta de productos, webhook y pruebas de pago |
| [`docs/06-automatizaciones.md`](docs/06-automatizaciones.md) | Trabajos programados, emails y blog automático |
| [`docs/07-analitica.md`](docs/07-analitica.md) | Eventos, embudo y métricas de negocio |
| [`docs/08-despliegue.md`](docs/08-despliegue.md) | Puesta en producción y lista de comprobación |
| [`docs/11-desplegar-sin-terminal.md`](docs/11-desplegar-sin-terminal.md) | **Desplegar desde el navegador, sin terminal** (móvil incluido) |
| [`docs/09-legal.md`](docs/09-legal.md) | Qué falta completar antes de facturar |
| [`docs/10-operativa.md`](docs/10-operativa.md) | Manual de incidencias y mantenimiento |

Además: [`TODO.md`](TODO.md) (estado de tareas) y [`CHANGELOG.md`](CHANGELOG.md).

---

## Estado del proyecto

Funcional de extremo a extremo y verificado con:

- **33 pruebas unitarias** (`npm test`)
- **19 comprobaciones de extremo a extremo** en navegador real: registro, acceso,
  perfil de marca, límites de plan, generación, biblioteca, facturación,
  exportación RGPD, separación cliente/administración, ejecución de trabajos y
  interfaz móvil.
- **Compilación de producción** sin errores ni avisos.

Lo que **falta antes de facturar de verdad** está en
[`docs/09-legal.md`](docs/09-legal.md) y marcado en [`TODO.md`](TODO.md): datos
fiscales del titular, alta real en Stripe y dominio propio.

---

## Licencia

Proyecto privado. Todos los derechos reservados.
