# AI Proposal — presupuestos profesionales con IA

SaaS por suscripción que permite a un autónomo o a una empresa generar un presupuesto profesional
completo —con desglose de materiales, mano de obra, tiempo, garantía, condiciones, impuestos y PDF
listo para enviar— a partir de una sola frase.

> **Estado: F0 · Fundaciones completada y auditada.** Arquitectura documentada, esquema completo de
> base de datos con RLS, batería de tests (56) en verde y CI configurado. La interfaz de usuario
> arranca en F1.

---

## Documentación

| Documento                                                              | Contenido                                                                                                        |
| ---------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------- |
| [`docs/00-analisis-y-decisiones.md`](docs/00-analisis-y-decisiones.md) | Análisis del problema, 12 decisiones técnicas con su justificación y alternativas descartadas, riesgos y alcance |
| [`docs/01-arquitectura.md`](docs/01-arquitectura.md)                   | Capas, estructura de carpetas, flujos, seguridad, rendimiento, sistema de diseño, calidad                        |
| [`docs/02-modelo-de-datos.md`](docs/02-modelo-de-datos.md)             | Esquema completo, RLS, motor de impuestos español, numeración, índices                                           |
| [`docs/03-motor-ia.md`](docs/03-motor-ia.md)                           | Adaptador multi-proveedor, registro de oficios, entrevista por _slots_, generación, evals                        |
| [`docs/04-roadmap.md`](docs/04-roadmap.md)                             | Fases F0-F9 con definición de hecho y auditoría de cierre                                                        |

**Empieza por `docs/00`**: contiene las decisiones que condicionan todo lo demás.

---

## Pila tecnológica

| Capa          | Elección                                                                        |
| ------------- | ------------------------------------------------------------------------------- |
| Frontend      | Next.js (App Router, React Server Components), TypeScript estricto              |
| Estilos       | Tailwind sobre tokens CSS, tema oscuro                                          |
| Movimiento    | Motion, respetando `prefers-reduced-motion`                                     |
| Backend       | Server Actions + Route Handlers (Node runtime)                                  |
| Base de datos | Supabase — Postgres con RLS, Auth, Storage                                      |
| IA            | Adaptador propio: Anthropic / OpenAI / Google intercambiables por configuración |
| PDF           | `pdf-lib` + `fontkit`, con motor de _layout_ declarativo propio                 |
| Email         | Resend + React Email                                                            |
| Pagos         | Stripe (suscripciones + cuotas de uso)                                          |
| Hosting       | Vercel                                                                          |
| Calidad       | Vitest, Playwright, tests SQL de RLS, evals de IA, Lighthouse CI                |

---

## Las cinco decisiones que más condicionan el producto

1. **Multi-tenant por organización desde la primera migración.** El ICP incluye empresas y agencias;
   un modelo por `user_id` obligaría a una migración completa en producción a los pocos meses.
2. **Dinero en enteros y motor de impuestos configurable.** IVA 21/10/4, IGIC canario, retención de
   IRPF y recargo de equivalencia. Sin esto, el presupuesto es incorrecto para media base de usuarios.
3. **El presupuesto se guarda estructurado, no como texto generado.** De ahí sale la memoria de precios
   propia de cada usuario, que es el verdadero foso defensivo del negocio.
4. **La IA es un motor de _slot filling_, no un prompt.** "Nunca generar con información insuficiente"
   es una comprobación booleana testeable, no una esperanza depositada en el modelo.
5. **La seguridad vive en la base de datos (RLS), no en la aplicación.** Un `WHERE` olvidado devuelve
   cero filas en lugar de los datos de otro cliente.

El razonamiento completo de cada una, con sus alternativas descartadas y el coste de equivocarse,
está en [`docs/00`](docs/00-analisis-y-decisiones.md).

---

## Puesta en marcha

```bash
cp .env.example .env.local     # y rellenar
npm ci
npm run db:reset               # aplica migraciones + catálogo base (requiere DATABASE_URL)
npm run dev
```

`npm run verify` ejecuta la puerta completa de calidad: tipos, lint, formato, tests unitarios,
tests de base de datos y build. Es lo mismo que ejecuta el CI.

---

## Estado por fases

| Fase                           | Estado     |
| ------------------------------ | ---------- |
| F0 · Fundaciones               | Completada |
| F1 · Auth, organización, shell | Siguiente  |
| F2 · Motor de IA               | Pendiente  |
| F3 · Editor                    | Pendiente  |
| F4 · PDF                       | Pendiente  |
| F5 · Envío y compartir         | Pendiente  |
| F6 · CRM y productividad       | Pendiente  |
| F7 · Suscripción               | Pendiente  |
| F8 · Diseño, móvil y SEO       | Pendiente  |
| F9 · Endurecimiento            | Pendiente  |

Detalle y definición de hecho de cada fase en [`docs/04`](docs/04-roadmap.md).

### Hallazgos de la auditoría de F0

Tres bugs reales detectados por los tests, no por inspección visual (detalle en
[`docs/02` §8](docs/02-modelo-de-datos.md)):

1. **Recursión infinita** en la política RLS de `memberships` al consultarse a sí misma.
2. **Numeración y salida de borrador** debían ser atómicas; separadas, violaban su propia restricción.
3. **Paginación por cursor rota** por truncamiento de microsegundos al convertir `timestamptz` a `Date`.

Y dos problemas de rendimiento medidos: el listado sin filtro explícito por `org_id` (251 ms → 0,82 ms)
y la búsqueda a texto completo, que bajo RLS no puede usar el índice GIN.
