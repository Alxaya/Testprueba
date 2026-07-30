# Recepta

Recepcionista con IA sobre WhatsApp para negocios de cita previa.
Diseño completo del producto en [`../whatsapp-saas/`](../whatsapp-saas/).

---

## La pregunta que gobierna cada línea de código

> **¿Esto ayuda a conseguir clientes o a vender más?**
> Si la respuesta es no, no se construye ahora.

Esto no es un lema: es un criterio de aceptación. Antes de abrir un fichero,
la función tiene que superarlo. Si no lo supera, va al roadmap, no al MVP.

Lo que sí lo supera, y por qué:

| Función | Por qué entra en el MVP |
|---|---|
| Motor de agenda con disponibilidad real | Es el foso. Sin esto somos un chatbot y Meta lo hace gratis |
| Recordatorios anti no-show | Es el argumento de venta: 18.000–35.000 €/año recuperables |
| Lista de espera automática | Rellena huecos sin trabajo humano. Se demuestra en una demo |
| Bandeja compartida con toma de control | Sin esto, una clínica no se atreve a activarlo |
| Marcador de ROI en euros | Es la infraestructura de retención. Sin esto, cancelan en el mes 3 |
| Alta autoservicio en 30 min | Cada paso manual multiplica el coste de adquisición |

Lo que **no** entra, aunque sea tentador: constructor visual de flujos,
multicanal, campañas de marketing, voz, marca blanca, API pública.
Están en el roadmap con fecha; no antes.

---

## Estado

| Fase | Contenido | Estado |
|---|---|---|
| 1 | Esqueleto: monorepo, configuración, base de datos, Redis, API, sondas, CI | ✅ terminada |
| 2 | Esquema de datos con RLS y aislamiento multi-tenant | ⬜ |
| 3 | Motor de agenda y disponibilidad | ⬜ |
| 4 | Canal de WhatsApp tras adaptador (simulador + Meta) | ⬜ |
| 5 | Motor de IA con guardarraíles | ⬜ |
| 6 | Recordatorios y lista de espera | ⬜ |
| 7 | Panel y bandeja compartida | ⬜ |
| 8 | Alta, suscripción y despliegue | ⬜ |

Ninguna fase se da por cerrada sin: tests que la cubran, `typecheck` y `lint`
en verde, y el rendimiento medido donde importe.

---

## Arranque en local

Requisitos: Node 22+, pnpm 10+, Docker.

```bash
cp .env.example .env          # y genera los secretos: openssl rand -base64 32
pnpm install
pnpm services:up              # Postgres 16 + pgvector, y Redis 7
pnpm dev                      # API en http://localhost:3001
```

Comprobar que responde:

```bash
curl localhost:3001/health/ready
```

### Comandos

| Comando | Qué hace |
|---|---|
| `pnpm dev` | API en modo desarrollo con recarga |
| `pnpm test` | Tests de todos los paquetes |
| `pnpm typecheck` | TypeScript estricto en todo el monorepo |
| `pnpm lint` | ESLint |
| `pnpm db:generate` | Genera migraciones a partir del esquema |
| `pnpm db:migrate` | Aplica migraciones |
| `pnpm services:up` / `services:down` | Levanta o para Postgres y Redis |

---

## Estructura

```
recepta/
├── apps/
│   ├── api/            Fastify: HTTP, webhooks y procesos de trabajo
│   └── web/            Next.js: el panel  (fase 7)
└── packages/
    ├── config/         Variables de entorno validadas
    ├── db/             Esquema Drizzle, migraciones y acceso con RLS
    └── core/           Dominio: agenda, IA, conversaciones, canal
```

---

## Decisiones que conviene conocer antes de tocar el código

**El canal de WhatsApp vive detrás de un adaptador.** El alta como Tech
Provider de Meta tarda semanas y no depende de nosotros. Con
`CHANNEL_DRIVER=simulator` se desarrolla, se prueba y se demuestra el
producto entero sin esperar. Cuando llegue la aprobación se cambia la
variable y nada más.

**Los paquetes internos son unidades compilables de verdad.** Cada uno emite
`dist` con sus tipos y declara sus propias dependencias. En desarrollo y en
tests se resuelven a las fuentes TypeScript (condición `development` para
`tsx`, alias en `vitest.config.ts`); en producción, a `dist`. Nada se
empaqueta dentro de otro paquete: empaquetar dependencias CommonJS de
terceros en un bundle ESM las rompe.

**El aislamiento entre clínicas lo aplica PostgreSQL, no el código.** Todo
acceso pasa por `withTenant()`, que fija la organización en la sesión y deja
que Row-Level Security haga cumplir la frontera. Un `where` olvidado no
filtra datos de otra clínica. `withoutTenantIsolation()` existe, se llama
así de largo a propósito, y cada uso debe justificarse en la revisión.

**La IA nunca es la fuente de la verdad.** No sabe precios ni huecos: los
pide a una herramienta que consulta la base de datos. Si la herramienta
falla, escala a un humano; no improvisa.

**Manejamos datos de salud** (art. 9 RGPD). El contenido de los mensajes no
se registra nunca en los logs: se registra que hubo un mensaje, no lo que
decía. La lista de campos censurados está en `packages/core/src/logger.ts`.
