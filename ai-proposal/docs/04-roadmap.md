# 04 — Roadmap por fases

**Regla del proyecto:** no se empieza una fase si la anterior no ha pasado su auditoría.
Cada fase termina con el mismo ritual de cierre (§ _Auditoría de fase_), y su
**Definición de Hecho (DoD)** es una lista de comprobaciones objetivas, no una opinión.

---

## Auditoría de fase (obligatoria al cerrar cada fase)

1. **Corrección** — `tsc --noEmit`, ESLint sin avisos, todos los tests en verde.
2. **Revisión de errores** — repaso del diff buscando: casos límite, errores no gestionados,
   condiciones de carrera, estados de carga/vacío/error ausentes.
3. **Seguridad** — ¿alguna consulta sin RLS? ¿algún `input` sin validar? ¿algún secreto expuesto al
   cliente? ¿alguna ruta sin comprobación de rol?
4. **Rendimiento** — consultas N+1, índices que faltan, `useEffect` innecesarios, JS enviado al
   cliente, tamaño del _bundle_ frente al presupuesto de la §7 del doc 01.
5. **Refactor** — duplicación eliminada, nombres correctos, ficheros muertos borrados,
   dependencias sin uso desinstaladas.
6. **Accesibilidad** — teclado, foco, contraste, lectores de pantalla en las pantallas nuevas.
7. **Documentación** — decisiones nuevas o desviaciones registradas en `docs/`.

Solo entonces: commit, push y luz verde para la fase siguiente.

---

## F0 · Fundaciones

**Objetivo:** un esqueleto sobre el que se pueda construir rápido durante un año sin arrepentimientos.

- Proyecto Next.js (App Router) con TypeScript en modo estricto
  (`strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`).
- Tailwind + `styles/tokens.css` (tema oscuro, tokens de color/espaciado/movimiento).
- ESLint + Prettier + **reglas de fronteras entre módulos** (doc 01, §2).
- `lib/env.ts`: validación de variables de entorno con Zod al arrancar.
- `lib/errors.ts` (jerarquía de errores de aplicación), `lib/logger.ts` (JSON estructurado).
- Supabase local, primera migración: **todas** las tablas del doc 02, con RLS y políticas.
- Generación de tipos TypeScript desde el esquema (`types.gen.ts`).
- `seed.sql`: catálogo base de los 9 oficios.
- Vitest + Playwright configurados. GitHub Actions: typecheck, lint, test, tests de RLS, build.

**DoD:** `npm run verify` (typecheck + lint + test + tests RLS + build) pasa en CI desde cero.
Los tests de aislamiento entre organizaciones pasan para **todas** las tablas.

---

## F1 · Autenticación, organización y _shell_

- Registro / acceso (email + contraseña, y OAuth con Google).
- Creación automática de organización en el primer acceso (trigger + RPC transaccional).
- _Onboarding_: nombre del negocio, oficio principal, NIF, logo, perfil fiscal.
- Middleware de sesión, protección de rutas, refresco de token.
- _Shell_ de la aplicación: barra lateral, barra superior, selector de organización, menú de usuario.
- Invitaciones por email y gestión de roles (owner / admin / member).
- Primitivas de UI sobre Radix: Button, Input, Select, Dialog, Sheet, Toast, Tooltip, DropdownMenu,
  Skeleton, EmptyState — todas con estados de foco, error y carga.

**DoD:** un usuario nuevo se registra, completa el _onboarding_ y ve el dashboard vacío bien diseñado.
E2E: registro → onboarding → dashboard. Un usuario de la organización A no puede ver nada de la B
(verificado por test, no por inspección).

---

## F2 · Motor de IA

- `lib/ai`: interfaz `LlmProvider`, registro, política de enrutado por _tier_, coste, reintentos,
  _failover_, caché, contabilidad en `ai_requests`.
- Implementaciones: Anthropic, OpenAI, Google (las tres, para demostrar que el adaptador funciona).
- `features/ai/trades`: los 9 oficios + genérico, con sus slots y catálogos base.
- Motor de entrevista: clasificar → extraer → completitud → preguntar.
- Endpoint `/api/ai/interview` y `/api/ai/generate` con SSE.
- UI de la entrevista: **una pantalla, chips pulsables**, barra de completitud,
  botón "generar con lo que hay".
- Generación con _streaming_ y parseo parcial (las secciones aparecen a medida que llegan).
- Validación posterior: rangos de precio, coherencia, deduplicación, enganche con el catálogo.
- Arnés de evals + _golden set_ inicial.

**DoD:** "Instalar un termo eléctrico de 100 litros" produce preguntas correctas y, tras responderlas,
un presupuesto estructurado válido. Los evals superan los umbrales del doc 03, §6.
Cambiar de proveedor es cambiar una variable de entorno — demostrado en test.

---

## F3 · Editor de presupuestos

- `pricing.ts`: `computeTotals` puro, con tests exhaustivos (IVA 21/10/4/7, IRPF, recargo de
  equivalencia, redondeos, descuentos).
- Editor: líneas arrastrables, edición en línea, autocompletado desde el catálogo, cálculo en vivo.
- Autoguardado con _debounce_ + versión optimista + detección de conflicto (doc 01, §5).
- Historial de cambios con vista de diferencias y restauración.
- Duplicar presupuesto. Guardar como plantilla. Aplicar plantilla.
- Máquina de estados: borrador → listo → enviado → visto → aceptado/rechazado/caducado.
- Numeración al salir de borrador (doc 02, §5).

**DoD:** los totales cuadran al céntimo entre editor, base de datos y PDF en 30 casos de test.
Editar en dos pestañas produce un aviso de conflicto, nunca pérdida silenciosa de datos.

---

## F4 · PDF

- Motor de _layout_ declarativo sobre `pdf-lib`: bloques, medición, paginación, cabecera/pie.
- Fuentes TTF embebidas con _subsetting_ (acentos, ñ, €).
- Tres plantillas: Clásica, Moderna, Minimal. Logo y color de acento de la organización.
- Numeración "página X de Y", secciones de garantía, condiciones, supuestos y exclusiones.
- Almacenamiento en Storage privado, caché por hash de contenido, descarga con URL firmada.

**DoD:** PDF correcto en A4 con 1, 15 y 60 líneas (paginación incluida). p95 < 1,5 s.
Texto seleccionable y con acentos correctos. Verificado en Acrobat, Preview y Chrome.

---

## F5 · Envío, compartir y seguimiento

- Envío por email con plantillas (React Email + Resend), dominio verificado (SPF/DKIM/DMARC).
- Enlace público: token de 256 bits, hash en BD, caducidad, revocación, contraseña opcional.
- Página pública del presupuesto: diseño premium, responsive, con botones **Aceptar** y **Rechazar**.
- Seguimiento: "visto hace 10 min", historial de eventos, notificación al profesional.
- Recordatorio automático a los N días sin respuesta (configurable).

**DoD:** el flujo completo funciona en móvil real. Un enlace revocado o caducado devuelve 404.
El token no aparece en ningún log. La ruta pública no usa `service_role` (verificado por test).

---

## F6 · CRM ligero y productividad

- Clientes: CRUD, buscador, importación CSV, ficha con histórico de presupuestos y tasa de aceptación.
- Catálogo (materiales / mano de obra / servicios): CRUD, importación CSV, precios y costes.
- Plantillas por oficio.
- Listado de presupuestos: búsqueda a texto completo, filtros combinables (estado, cliente, oficio,
  fechas, importe), orden, paginación por cursor, acciones en lote.
- Dashboard con métricas reales: total presupuestado, tasa de aceptación, importe medio, margen,
  presupuestos pendientes de respuesta.
- Paleta de comandos (⌘K) y atajos de teclado.

**DoD:** listado con 10.000 presupuestos de prueba responde en p95 < 120 ms. Búsqueda insensible a
acentos y mayúsculas. Todo operable por teclado.

---

## F7 · Suscripción

- Stripe: productos, precios, Checkout, Portal del cliente, webhooks **idempotentes**.
- Planes con límites: presupuestos/mes, generaciones de IA, usuarios, plantillas, marca propia.
- `assertQuota()`: **una sola** puerta en servidor para todo consumo medido.
- Avisos al acercarse al límite y pantallas de mejora de plan.
- Panel interno de márgenes: coste de IA por organización frente a ingresos (desde `ai_requests`).

**DoD:** simulación completa del ciclo (alta, subida de plan, impago, cancelación, reactivación) con
webhooks repetidos y desordenados. Superar la cuota bloquea en servidor, no solo en la interfaz.

---

## F8 · Pulido: diseño, movimiento, móvil, SEO

- Landing pública: propuesta de valor, demo interactiva, precios, testimonios, FAQ.
- **SEO programático**: `/presupuesto-electricista`, `/presupuesto-fontanero`, … una página por oficio,
  con metadatos, datos estructurados JSON-LD, `sitemap.xml`, `robots.txt`, Open Graph dinámico.
- Sistema de movimiento: transiciones de página, entradas escalonadas de listas, _layout animations_,
  microinteracciones en botones y estados, transiciones de vista. Todo respetando `prefers-reduced-motion`.
- Móvil: navegación inferior, hojas deslizantes, gestos, objetivos táctiles ≥ 44 px, PWA instalable.
- Auditoría de accesibilidad WCAG 2.2 AA completa.

**DoD:** Lighthouse ≥ 95 en las cuatro categorías, en móvil. Presupuesto de rendimiento del doc 01, §7
cumplido. Probado en iPhone SE (pantalla pequeña real) y en Android de gama media.

---

## F9 · Endurecimiento y lanzamiento

- Sentry, logs estructurados, PostHog con el embudo de activación.
- Cabeceras de seguridad (CSP estricta), _rate limiting_ en todas las rutas públicas.
- Pruebas de carga: 100 usuarios concurrentes generando presupuestos.
- Copias de seguridad y ensayo real de restauración (una copia sin restauración probada no es una copia).
- RGPD: exportación y borrado de datos, política de privacidad, registro de tratamientos, cookies.
- Estados legales: aviso de que la herramienta no sustituye asesoría fiscal.
- _Runbook_ de incidentes y guía de despliegue.

**DoD:** revisión de seguridad completa sin hallazgos de severidad alta o media. Restauración de copia
verificada. Alertas configuradas y probadas.

---

## Orden de dependencias

```
F0 ──► F1 ──► F2 ──► F3 ──► F4 ──► F5 ──► F6 ──► F7 ──► F8 ──► F9
                      └──────────► F6 (parte de catálogo, en paralelo si conviene)
```

F2 y F3 son el corazón del producto: si algo debe llevarse el tiempo extra, es ahí.
F8 no es "maquillaje": en este mercado el diseño es parte del argumento de venta — el usuario compra
la herramienta porque el PDF que manda a _su_ cliente le hace parecer más profesional.
