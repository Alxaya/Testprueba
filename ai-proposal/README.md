# AI Proposal — presupuestos profesionales con IA

SaaS por suscripción que permite a un autónomo o a una empresa generar un presupuesto profesional
completo —con desglose de materiales, mano de obra, tiempo, garantía, condiciones, impuestos y PDF
listo para enviar— a partir de una sola frase.

> **Estado: fase de arquitectura.** Todavía no hay código de producto. La arquitectura está definida y
> documentada; la implementación arranca en la fase F0 del roadmap.

---

## Documentación

| Documento | Contenido |
|---|---|
| [`docs/00-analisis-y-decisiones.md`](docs/00-analisis-y-decisiones.md) | Análisis del problema, 12 decisiones técnicas con su justificación y alternativas descartadas, riesgos y alcance |
| [`docs/01-arquitectura.md`](docs/01-arquitectura.md) | Capas, estructura de carpetas, flujos, seguridad, rendimiento, sistema de diseño, calidad |
| [`docs/02-modelo-de-datos.md`](docs/02-modelo-de-datos.md) | Esquema completo, RLS, motor de impuestos español, numeración, índices |
| [`docs/03-motor-ia.md`](docs/03-motor-ia.md) | Adaptador multi-proveedor, registro de oficios, entrevista por *slots*, generación, evals |
| [`docs/04-roadmap.md`](docs/04-roadmap.md) | Fases F0-F9 con definición de hecho y auditoría de cierre |

**Empieza por `docs/00`**: contiene las decisiones que condicionan todo lo demás.

---

## Pila tecnológica

| Capa | Elección |
|---|---|
| Frontend | Next.js (App Router, React Server Components), TypeScript estricto |
| Estilos | Tailwind sobre tokens CSS, tema oscuro |
| Movimiento | Motion, respetando `prefers-reduced-motion` |
| Backend | Server Actions + Route Handlers (Node runtime) |
| Base de datos | Supabase — Postgres con RLS, Auth, Storage |
| IA | Adaptador propio: Anthropic / OpenAI / Google intercambiables por configuración |
| PDF | `pdf-lib` + `fontkit`, con motor de *layout* declarativo propio |
| Email | Resend + React Email |
| Pagos | Stripe (suscripciones + cuotas de uso) |
| Hosting | Vercel |
| Calidad | Vitest, Playwright, tests SQL de RLS, evals de IA, Lighthouse CI |

---

## Las cinco decisiones que más condicionan el producto

1. **Multi-tenant por organización desde la primera migración.** El ICP incluye empresas y agencias;
   un modelo por `user_id` obligaría a una migración completa en producción a los pocos meses.
2. **Dinero en enteros y motor de impuestos configurable.** IVA 21/10/4, IGIC canario, retención de
   IRPF y recargo de equivalencia. Sin esto, el presupuesto es incorrecto para media base de usuarios.
3. **El presupuesto se guarda estructurado, no como texto generado.** De ahí sale la memoria de precios
   propia de cada usuario, que es el verdadero foso defensivo del negocio.
4. **La IA es un motor de *slot filling*, no un prompt.** "Nunca generar con información insuficiente"
   es una comprobación booleana testeable, no una esperanza depositada en el modelo.
5. **La seguridad vive en la base de datos (RLS), no en la aplicación.** Un `WHERE` olvidado devuelve
   cero filas en lugar de los datos de otro cliente.

El razonamiento completo de cada una, con sus alternativas descartadas y el coste de equivocarse,
está en [`docs/00`](docs/00-analisis-y-decisiones.md).

---

## Siguiente paso

Validar la arquitectura y arrancar **F0 · Fundaciones** (ver [`docs/04`](docs/04-roadmap.md)).
