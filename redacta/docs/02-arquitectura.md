# 02 · Arquitectura

Decisiones técnicas y el motivo de cada una. Si algo te parece raro, probablemente
esté explicado aquí.

---

## Vista general

```
Navegador
    │
    ├── Web pública (SSR + estático)          → SEO, sitemap, blog
    ├── Panel de cliente  /app                → sesión obligatoria
    └── Panel interno     /admin              → sesión + rol ADMIN
    │
    ▼
Next.js 15 (App Router)
    │
    ├── middleware.ts        → decide acceso en el borde
    ├── Server Components    → leen datos directamente de PostgreSQL
    ├── Server Actions       → todas las mutaciones
    └── Route Handlers       → webhook de Stripe, analítica, cron, exportación
    │
    ▼
PostgreSQL (Prisma)          Anthropic (Claude)     Stripe        Resend
```

## Stack y por qué

| Pieza | Elección | Motivo |
| --- | --- | --- |
| Framework | Next.js 15, App Router | Una sola base de código para web pública (SEO) y aplicación; los Server Components evitan montar una API intermedia |
| Lenguaje | TypeScript estricto | El dinero y las cuotas no toleran errores de tipo silenciosos |
| Base de datos | PostgreSQL + Prisma | Relacional porque los datos lo son; Prisma da tipos derivados del esquema |
| Autenticación | Auth.js v5 | Estándar del ecosistema, soporta credenciales y OAuth con el mismo modelo |
| Estilos | Tailwind CSS v4 | Configuración en CSS, sin fichero JS aparte; componentes propios en `globals.css` |
| Pagos | Stripe | Checkout y portal alojados: no tocamos datos de tarjeta |
| IA | Claude (`claude-opus-5`) | Calidad de redacción en español y control estricto de instrucciones |
| Emails | Resend | API simple, buena entregabilidad |
| Pruebas | Vitest | Rápido y sin configuración |

## Decisiones que conviene entender

### Multi-tenant desde el primer día

Todo cuelga de `Organization`, incluso cuando el cliente es una sola persona.
Abrir cuentas de equipo más adelante es añadir filas en `Membership`, no una
migración dolorosa.

**Consecuencia práctica:** toda consulta de datos de cliente filtra por
`organizationId`. Ese filtro es la barrera de seguridad —no el hecho de que la
URL sea difícil de adivinar—. Ver `src/app/app/biblioteca/[id]/page.tsx`.

### El plan vive en código, no en base de datos

`src/lib/plans.ts` define precios, límites y ventajas. La base de datos solo
guarda **qué plan** tiene cada organización.

Ventaja: cambiar precios es un despliegue, queda en el historial de git y no
requiere migración ni script de datos.

### Autenticación partida en dos ficheros

- `src/auth.config.ts` — ligero, sin base de datos. Lo usa el **middleware**, que
  se ejecuta en runtime Edge, donde no existen ni Prisma ni bcrypt.
- `src/auth.ts` — completo, con adaptador de Prisma y credenciales. Runtime Node.

Si se mezclan, el middleware falla al desplegar. Es el error más común al tocar
autenticación en Next.

### Defensa en profundidad en las rutas protegidas

El middleware bloquea `/app` y `/admin`, **y además** cada página llama a
`requireUser()` / `requireAdmin()`. Es redundante a propósito: si alguien cambia
el `matcher` del middleware, la segunda comprobación evita una fuga de datos.

### `server-only` en la configuración

`src/lib/env.ts` importa `server-only`. En el navegador solo existen las
variables `NEXT_PUBLIC_*`, así que si ese módulo acabara en un bundle de cliente,
la validación fallaría en tiempo de ejecución y rompería la página.

> Esto ocurrió durante el desarrollo: `lib/site.ts` importaba `env` y lo arrastró
> al cliente a través de la cabecera. Con `server-only` el error aparece al
> compilar. Por eso `lib/site.ts` lee `process.env.NEXT_PUBLIC_APP_URL`
> directamente y **no debe importar `lib/env`**.

### Server Actions para todas las mutaciones

No hay API REST propia para el panel. Las mutaciones son Server Actions
(`src/app/actions/`), lo que da protección CSRF automática, tipado extremo a
extremo y formularios que funcionan sin JavaScript.

Los Route Handlers quedan para lo que *tiene* que ser HTTP: webhook de Stripe,
recepción de analítica, trabajos programados y descarga de datos.

### Conversor de Markdown propio

`src/lib/markdown.ts` no usa librería. El subconjunto que necesitamos es pequeño
y una dependencia menos es una superficie de ataque menos. **Escapa todo el HTML
antes de aplicar ninguna regla**, y limita los enlaces a `http`, `https`,
`mailto` y rutas relativas. Está cubierto por pruebas específicas de seguridad.

### Analítica propia

Los eventos se guardan en nuestra base de datos. Motivos: cumple el RGPD sin
banner de cookies (no hay identificadores persistentes), permite cruzar producto
con negocio en la misma consulta, y no depende de un tercero.

El identificador anónimo vive en `sessionStorage` y muere al cerrar la pestaña.

### El estado de facturación se copia, pero Stripe manda

La organización guarda una copia de `plan`, `subscriptionStatus` y fechas para
decidir límites sin llamar a la API de Stripe en cada petición. Esa copia **solo**
la actualiza el webhook. Ninguna acción del navegador cambia el plan.

## Flujos clave

### Generación de contenido

```
Formulario → generateAction (Server Action)
   ├── valida los campos declarados por el formato
   ├── comprueba la cuota  ← antes de gastar dinero
   ├── construye los bloques de sistema (base cacheado + marca)
   ├── llama a Claude con streaming
   ├── comprueba stop_reason === 'refusal'
   ├── guarda la generación y suma el consumo
   ├── registra el evento y avisa si se pasa del 80 %
   └── redirige a la ficha del contenido
```

### Suscripción

```
Cliente → startCheckoutAction → Stripe Checkout (alojado)
                                      │
                                      ▼
                            webhook /api/stripe/webhook
                                      │
                       verifica firma → comprueba idempotencia
                                      │
                            syncSubscription() → cambia el plan
```

## Rendimiento

- Las páginas del panel son `force-dynamic`: muestran datos que cambian.
- Blog y web pública podrían pasar a ISR cuando haya tráfico; hoy son dinámicas
  para que la compilación no dependa de la base de datos.
- El consumo se agrega en `UsagePeriod` en vez de contar filas de `Generation`,
  para que el panel siga siendo rápido cuando el histórico crezca.
- El bloque de sistema del prompt va marcado con `cache_control`.

## Límites conocidos

| Límite | Cuándo importa | Qué hacer |
| --- | --- | --- |
| Una organización por usuario | Al abrir cuentas de equipo | Ya está modelado; tocar `getOrganizationForUser` |
| Sin cola de trabajos | Generación por lotes de catálogo | Añadir una cola (por ejemplo, Inngest o pg-boss) |
| Analítica en la tabla principal | Con mucho tráfico | Particionar por fecha o mover a un almacén aparte |
| Generación síncrona | Piezas muy largas | Ya se usa streaming; para lotes, cola |
