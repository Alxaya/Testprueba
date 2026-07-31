# 01 — Arquitectura del sistema

Referencia estructural del proyecto: capas, módulos, flujos de datos y reglas que el código debe cumplir.

---

## 1. Vista general

```
┌──────────────────────────────────────────────────────────────────────────┐
│  NAVEGADOR                                                                │
│  Next.js App Router · React Server Components · Tailwind · Motion         │
└───────────────┬──────────────────────────────────┬───────────────────────┘
                │ Server Actions (mutaciones)      │ Route Handlers
                │                                  │ (streaming IA, webhooks,
                │                                  │  PDF, enlace público)
┌───────────────▼──────────────────────────────────▼───────────────────────┐
│  CAPA DE APLICACIÓN (servidor, Node runtime)                              │
│                                                                           │
│  features/*/server/   ← casos de uso. Única capa que orquesta.            │
│      · valida entrada (Zod)   · autoriza (rol)   · comprueba cuota        │
│      · llama a dominio        · persiste         · audita                 │
└───────────────┬──────────────────────────────────┬───────────────────────┘
                │                                  │
┌───────────────▼──────────────┐   ┌───────────────▼──────────────────────┐
│  DOMINIO (puro, sin E/S)     │   │  ADAPTADORES (E/S)                    │
│  · pricing (impuestos)       │   │  · lib/ai      → Anthropic/OpenAI/…   │
│  · interview (slots)         │   │  · lib/supabase→ Postgres + Storage   │
│  · trades (registro oficios) │   │  · lib/pdf     → pdf-lib + fontkit    │
│  · document (esquema)        │   │  · lib/email   → Resend               │
│  100% testeable sin red      │   │  · lib/billing → Stripe               │
└──────────────────────────────┘   └───────────────┬──────────────────────┘
                                                    │
┌───────────────────────────────────────────────────▼──────────────────────┐
│  SUPABASE — Postgres (RLS) · Auth · Storage · Realtime                    │
│  La frontera de seguridad vive aquí, no en la aplicación.                 │
└──────────────────────────────────────────────────────────────────────────┘
```

**Regla de dependencia (unidireccional, verificada por ESLint):**

```
app/  →  features/  →  lib/  →  dominio puro
```

Nunca al revés. El dominio no importa nada de `lib/` ni de `features/`; por eso se puede testear en
milisegundos sin base de datos ni red.

---

## 2. Estructura de carpetas

```
ai-proposal/
├─ src/
│  ├─ app/
│  │  ├─ (marketing)/                 # landing pública, SSG, SEO
│  │  │  ├─ page.tsx
│  │  │  ├─ precios/page.tsx
│  │  │  └─ [oficio]/page.tsx         # SEO programático: /presupuesto-electricista …
│  │  ├─ (auth)/                      # login, registro, recuperación
│  │  ├─ (app)/                       # aplicación autenticada
│  │  │  ├─ layout.tsx                # shell: sidebar + topbar, sesión y org
│  │  │  ├─ dashboard/
│  │  │  ├─ presupuestos/
│  │  │  │  ├─ page.tsx               # listado: buscador, filtros, paginación
│  │  │  │  ├─ nuevo/page.tsx         # flujo IA (slots → generación)
│  │  │  │  └─ [id]/page.tsx          # editor
│  │  │  ├─ clientes/  catalogo/  plantillas/  ajustes/
│  │  ├─ p/[token]/page.tsx           # enlace público (no autenticado)
│  │  └─ api/
│  │     ├─ ai/interview/route.ts     # streaming SSE
│  │     ├─ ai/generate/route.ts      # streaming SSE
│  │     ├─ pdf/[id]/route.ts         # Node runtime
│  │     └─ webhooks/stripe/route.ts  # idempotente
│  │
│  ├─ features/                       # vertical slices; cada una con index.ts público
│  │  ├─ proposals/  { components/ server/ hooks/ schema.ts pricing.ts index.ts }
│  │  ├─ ai/         { components/ server/ interview/ trades/ prompts/ index.ts }
│  │  ├─ clients/  catalog/  templates/  sharing/  billing/  pdf/  org/
│  │
│  ├─ components/
│  │  ├─ ui/                          # primitivas: Button, Dialog, Input, Toast…
│  │  └─ patterns/                    # composites: DataTable, EmptyState, PageHeader
│  │
│  ├─ lib/
│  │  ├─ supabase/  { server.ts browser.ts admin.ts types.gen.ts }
│  │  ├─ ai/        { provider.ts registry.ts providers/ cost.ts }
│  │  ├─ pdf/       { engine/ templates/ fonts/ }
│  │  ├─ email/  auth/  rate-limit/  i18n/  errors.ts  logger.ts  env.ts
│  │
│  └─ styles/tokens.css
│
├─ supabase/
│  ├─ migrations/                     # SQL versionado, ordenado, idempotente
│  ├─ tests/                          # tests de RLS (acceso cruzado)
│  └─ seed.sql                        # catálogo base por oficio
│
├─ e2e/                               # Playwright
└─ docs/                              # este directorio
```

**Regla de fronteras** (`eslint-plugin-boundaries`): `features/proposals` puede importar
`features/clients` **solo** a través de `features/clients/index.ts`. Importar
`features/clients/server/queries` desde otra _feature_ es error de compilación en CI.
Esto es lo que impide que en 6 meses el proyecto sea una bola de barro.

---

## 3. Elección de mecanismo por operación

No todo se hace igual. Criterio explícito:

| Operación                     | Mecanismo                                            | Motivo                                                                 |
| ----------------------------- | ---------------------------------------------------- | ---------------------------------------------------------------------- |
| Leer datos para pintar página | **RSC** con cliente Supabase de servidor             | Cero JS al cliente, sin _waterfall_ cliente-servidor                   |
| Crear/editar/borrar           | **Server Action**                                    | Tipado extremo a extremo, revalidación integrada, sin API que mantener |
| Generación IA                 | **Route Handler + SSE**                              | Server Actions no hacen _streaming_ de respuestas parciales            |
| PDF                           | **Route Handler, runtime Node**                      | `pdf-lib` + fuentes necesitan Node; Edge no sirve                      |
| Webhook Stripe                | **Route Handler**                                    | Debe ser URL pública estable con verificación de firma                 |
| Enlace público                | **RSC** + RPC `security definer`                     | Sin sesión; el token entra por parámetro, no por cookie                |
| Autoguardado                  | **Server Action** con _debounce_ + versión optimista | Simple y suficiente; sin WebSocket                                     |

**Runtimes:** Edge para middleware (rápido, cerca del usuario). Node para todo lo demás.
El _streaming_ de IA funciona en Node sin problema y evita mantener dos rutas de código.

---

## 4. Flujo principal: de la frase al PDF

```
Usuario escribe: "Instalar un termo eléctrico de 100 litros"
   │
   ▼
[1] CLASIFICAR  ── modelo pequeño ──► { trade: "fontaneria", confianza: 0.94 }
   │                                    (caché por hash del texto)
   ▼
[2] EXTRAER     ── modelo pequeño ──► slots detectados:
   │                                    capacidad=100L, tipo_trabajo=instalación
   ▼
[3] COMPLETITUD ── CÓDIGO, no IA ──► faltan: ubicación, sustitución/nueva,
   │                                          marca, provincia, ¿retirada del viejo?
   │
   ├─ ¿faltan obligatorios? ──► SÍ ──► [4] PREGUNTAR (una pantalla, chips)
   │                                        │ el usuario responde en ~10 s
   │                                        └──► vuelve a [3]
   │
   └─ NO ──► [5] CONTEXTO DE PRECIOS
                  · catálogo propio de la organización
                  · últimos 5 presupuestos similares del mismo usuario  ← el foso
                  · catálogo base del oficio (semilla)
                  ▼
             [6] GENERAR ── modelo potente, salida estructurada ──► JSON
                  │  validación Zod → falla → reintento de reparación (máx. 2)
                  │                        → falla → plantilla determinista
                  ▼
             [7] CALCULAR TOTALES ── función pura, en servidor, autoritativa
                  ▼
             [8] PERSISTIR ── RPC transaccional: cabecera + líneas + versión v1
                  ▼
             [9] EDITOR  ── autoguardado, historial de cambios
                  ▼
            [10] PDF · Email · Enlace compartido
```

Puntos donde el sistema **se niega a avanzar**: [3] sin slots obligatorios, y [6] si la salida no valida
contra el esquema. Ambos son código determinista, no criterio del modelo.

---

## 5. Autoguardado, concurrencia e historial

**Problema.** Dos pestañas abiertas, o pestaña + móvil. El guardado ingenuo (_last write wins_) hace
desaparecer trabajo del usuario sin avisar.

**Solución.**

1. Cada `proposal` tiene `version int`.
2. El cliente guarda con _debounce_ de 1,5 s enviando `expected_version`.
3. El RPC `save_proposal` comprueba `version = expected_version`:
   - **Coincide** → aplica, `version + 1`, devuelve la nueva versión.
   - **No coincide** → devuelve `409` con el documento actual; la UI muestra
     _"Este presupuesto se ha modificado en otro sitio"_ y ofrece recargar o forzar.
4. **Historial**: no se crea una versión por pulsación. Se crea un _snapshot_ en
   `proposal_versions` cuando (a) han pasado >2 min desde el último _snapshot_ y hay cambios,
   (b) el usuario pulsa guardar, o (c) cambia el estado (enviado/aceptado). Se conservan las últimas 30
   más todas las de cambio de estado.

**Descartado:** CRDT / edición colaborativa en tiempo real. Un presupuesto lo edita una persona;
la complejidad no se paga.

---

## 6. Seguridad

| Capa           | Control                                                                                                                                                                         |
| -------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Transporte     | HTTPS obligatorio, HSTS                                                                                                                                                         |
| Cabeceras      | CSP estricta (sin `unsafe-inline` en scripts), `X-Frame-Options`, `Referrer-Policy`, `Permissions-Policy`                                                                       |
| Sesión         | Supabase Auth, cookies `httpOnly` + `Secure` + `SameSite=Lax`, refresco en middleware                                                                                           |
| Autorización   | RLS en **todas** las tablas + comprobación de rol en la capa de aplicación (defensa en profundidad)                                                                             |
| Secretos       | Validados al arrancar con Zod (`lib/env.ts`); la aplicación **no arranca** si falta uno. `service_role` solo en _scripts_ y webhooks, nunca en un camino con entrada de usuario |
| Entrada        | Todo `input` pasa por Zod en el límite del servidor. Sin excepciones                                                                                                            |
| Ficheros       | Storage privado; acceso por URL firmada con caducidad corta                                                                                                                     |
| Rate limiting  | Por IP y por organización en rutas de IA, envío de email y enlaces públicos                                                                                                     |
| IA             | Texto de usuario delimitado y marcado como no fiable; sin herramientas con efectos expuestas al modelo; salida validada por esquema; nunca renderizada como HTML                |
| Auditoría      | `audit_log` para acciones sensibles: cambio de estado, envío, compartir, borrado, cambios de rol                                                                                |
| Enlace público | Token de 256 bits, en BD solo el hash; caducidad, revocación, límite de peticiones                                                                                              |

---

## 7. Rendimiento

**Objetivos (presupuesto de rendimiento, verificado en CI con Lighthouse):**

| Métrica                  | Objetivo        |
| ------------------------ | --------------- |
| LCP (landing, móvil 4G)  | < 1,8 s         |
| INP                      | < 200 ms        |
| CLS                      | < 0,05          |
| JS inicial de la app     | < 180 KB gzip   |
| Generación IA, p50 / p95 | < 12 s / < 25 s |
| PDF, p95                 | < 1,5 s         |
| Consulta de listado, p95 | < 120 ms        |

**Cómo se consigue:**

- RSC por defecto; `"use client"` solo en componentes con estado o animación.
- `next/font` con _subsetting_ y `display: swap`.
- Paginación **por cursor** (`keyset`), no `OFFSET` — a 10.000 presupuestos `OFFSET` se degrada.
- Índices deliberados: `(org_id, created_at desc)`, `(org_id, status)`, GIN sobre `search_vector`.
- Búsqueda a texto completo con `tsvector` generado + `unaccent` (para que "reformas" encuentre "Reformás").
- Caché de clasificación/extracción por hash de entrada.
- Motion solo sobre `transform` y `opacity` (compuestas en GPU); nunca animar `width`/`top`.
- `prefers-reduced-motion` respetado globalmente — requisito de accesibilidad, no opcional.

---

## 8. Sistema de diseño

**Tokens** en `styles/tokens.css` como variables CSS: `--bg`, `--surface`, `--border`, `--text`,
`--muted`, `--accent`, radios, sombras, duraciones y curvas de animación. Tailwind consume los tokens.
Cambiar la marca entera = editar un fichero.

**Estética objetivo** (referencias Linear / Stripe / Raycast):

- Oscuro por defecto, con fondos casi-negros no puros (`#0A0A0C`), superficies elevadas por
  luminosidad y borde de 1 px, no por sombras pesadas.
- Un único color de acento, usado con moderación.
- Tipografía: Inter (interfaz) + tabulares para importes — que los números no bailen al actualizarse.
- Movimiento con intención: 150-250 ms, `cubic-bezier(0.32, 0.72, 0, 1)`. Las animaciones comunican
  jerarquía y causa-efecto, no decoran.
- Estados vacíos, de carga (_skeletons_ con la forma real del contenido) y de error diseñados, no improvisados.

**Accesibilidad (WCAG 2.2 AA, no negociable):** contraste ≥ 4,5:1, foco visible siempre, navegación
completa por teclado, `aria-live` para autoguardado y generación, primitivas sobre Radix (semántica y
gestión de foco resueltas), objetivos táctiles ≥ 44 px.

---

## 9. Calidad y CI

| Nivel         | Herramienta                                             | Qué cubre                                                |
| ------------- | ------------------------------------------------------- | -------------------------------------------------------- |
| Tipos         | TypeScript `strict` + `noUncheckedIndexedAccess`        | Contratos                                                |
| Unitario      | Vitest                                                  | Dominio puro: impuestos, slots, layout PDF, adaptador IA |
| Base de datos | SQL en `supabase/tests`                                 | **Aislamiento RLS entre organizaciones**                 |
| Integración   | Vitest + Supabase local                                 | Server Actions y RPC contra Postgres real                |
| E2E           | Playwright                                              | Registro → generar → editar → PDF → compartir            |
| IA            | _Golden set_ de 40 casos por oficio                     | Que la salida valide y los precios estén en rango        |
| Rendimiento   | Lighthouse CI                                           | Presupuesto de la §7                                     |
| Seguridad     | `npm audit`, escaneo de secretos, revisión de cabeceras | Regresiones                                              |

**Puerta de CI:** sin _typecheck_, lint, tests unitarios, tests de RLS y build en verde, no se mergea.

**Observabilidad:** Sentry (errores + trazas), logs estructurados JSON con `request_id` y `org_id`,
PostHog (embudo: registro → primer presupuesto → primer envío → conversión a pago).
La métrica norte del producto es **tiempo hasta el primer presupuesto enviado**.
