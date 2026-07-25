# TODO — Redacta

Estado del proyecto por fases. Las tareas se marcan a medida que se completan y
**se verifican**: aquí solo hay `[x]` en lo que se ha probado, no en lo que se ha
escrito.

Leyenda: `[x]` hecho y verificado · `[ ]` pendiente · 🔒 bloqueante para facturar

---

## Fase 0 — Fundaciones ✅

- [x] Estructura del proyecto (Next.js 15, App Router, TypeScript estricto)
- [x] Tailwind CSS v4 con sistema de diseño propio y modo oscuro
- [x] Validación de configuración con Zod y degradación controlada
- [x] `docker-compose.yml` con PostgreSQL 16
- [x] Cabeceras de seguridad (HSTS, X-Frame-Options, nosniff, Referrer-Policy)
- [x] `.env.example` documentado variable por variable
- [x] Configuración de pruebas (Vitest)

## Fase 1 — Base de datos y autenticación ✅

- [x] Esquema Prisma con 16 tablas y comentarios
- [x] Modelo multi-tenant (`Organization` → todo cuelga de ahí)
- [x] Borrado en cascada para cumplir el derecho de supresión
- [x] Auth.js v5 con credenciales (bcrypt, coste 12)
- [x] Acceso con Google (opcional, se oculta si no está configurado)
- [x] Separación `auth.config.ts` (Edge) / `auth.ts` (Node)
- [x] Middleware de protección de rutas
- [x] Defensa en profundidad: `requireUser` / `requireAdmin` en cada página
- [x] Creación automática de organización, marca y proyecto al registrarse
- [x] Roles de plataforma (USER / ADMIN) y de organización
- [x] Seed idempotente con datos de ejemplo

## Fase 2 — Web pública y SEO ✅

- [x] Portada con propuesta de valor, formatos, comparativa y FAQ
- [x] Página de precios con tabla comparativa completa
- [x] Blog con listado y ficha de artículo
- [x] Cuatro páginas legales (aviso, privacidad, cookies, términos)
- [x] `sitemap.xml` dinámico (incluye artículos publicados)
- [x] `robots.txt` que excluye `/app`, `/admin` y `/api`
- [x] Datos estructurados: SoftwareApplication, FAQPage, BlogPosting
- [x] Open Graph, Twitter Card y URL canónicas
- [x] Diseño responsive verificado en móvil real
- [x] Modo oscuro por preferencia del sistema
- [x] Página 404 y pantalla de error controladas

## Fase 3 — Motor de IA ✅

- [x] Cliente de Anthropic con instanciación perezosa
- [x] Prompt base con 10 reglas anti-«texto de IA»
- [x] Perfil de marca inyectado en cada petición
- [x] 7 formatos de contenido con campos e instrucciones propias
- [x] Formularios derivados de la definición del formato
- [x] Streaming para evitar tiempos de espera agotados
- [x] Caché de prompt en el bloque de sistema
- [x] Control de `stop_reason: 'refusal'`
- [x] Registro de tokens, coste y duración por generación
- [x] Cuota comprobada **antes** de llamar al modelo
- [x] Las generaciones fallidas no descuentan cuota

## Fase 4 — Panel de clientes ✅

- [x] Estructura con barra lateral y cajón móvil
- [x] Resumen con consumo, accesos rápidos y actividad reciente
- [x] Aviso de perfil de marca incompleto
- [x] Generador con selector de formato
- [x] Biblioteca con filtros por formato, texto y favoritos, y paginación
- [x] Ficha de contenido con Markdown renderizado y copia al portapapeles
- [x] Proyectos con límite por plan y archivado
- [x] Perfil de marca (7 campos)
- [x] Ajustes: datos, contraseña, exportación y baja
- [x] Exportación de datos en JSON (RGPD)
- [x] Eliminación de cuenta con borrado real en cascada

## Fase 5 — Monetización ✅

- [x] Catálogo de 4 planes con límites
- [x] Stripe Checkout alojado
- [x] Portal de cliente (tarjeta, facturas, bajas)
- [x] Webhook con verificación de firma
- [x] Idempotencia mediante `ProcessedWebhook`
- [x] Sincronización de plan, estado y periodo
- [x] Recogida de dirección y NIF para IVA
- [x] Vuelta automática a plan gratuito al cancelar
- [x] Email al activarse la suscripción y al fallar un cobro
- [x] El plan **solo** cambia desde el webhook

## Fase 6 — Panel de administración ✅

- [x] Cuadro de mando: MRR, ARR, margen bruto, altas y bajas
- [x] Coste de modelo y coste medio por pieza
- [x] Listado de clientes con búsqueda y paginación
- [x] Registro de generaciones con filtro por estado y tasa de error
- [x] Analítica: embudo, fuentes, eventos y series diarias
- [x] Estado de integraciones de un vistazo
- [x] Ejecución manual de trabajos programados
- [x] Banderas de funcionalidad
- [x] Registro de auditoría

## Fase 7 — Automatizaciones ✅

- [x] 4 trabajos programados con endpoint protegido por secreto
- [x] Informe semanal por email
- [x] Recordatorio de inactividad
- [x] Blog automático desde calendario editorial
- [x] Limpieza de datos históricos (180 días)
- [x] 7 plantillas de email
- [x] Protección contra envíos repetidos
- [x] Aviso de cuota al 80 %, una vez por periodo
- [x] Modo simulado sin `RESEND_API_KEY`
- [x] Programación declarada en `vercel.json`

## Fase 8 — Analíticas ✅

- [x] Registro de eventos propio, sin cookies de terceros
- [x] Identificador anónimo por sesión (no persistente)
- [x] Lista blanca de eventos aceptados desde el navegador
- [x] Embudo por identidades únicas, no por eventos
- [x] Series diarias y ranking de fuentes
- [x] Métricas de negocio con margen real
- [x] Gráficas accesibles con tabla equivalente

## Fase 9 — Documentación y verificación ✅

- [x] README con instalación paso a paso
- [x] 10 documentos de mantenimiento en `docs/`
- [x] `CHANGELOG.md`
- [x] Este `TODO.md`
- [x] 33 pruebas unitarias en verde
- [x] 19 comprobaciones de extremo a extremo en navegador real
- [x] Compilación de producción sin errores ni avisos

---

## Pendiente antes de facturar 🔒

- [ ] 🔒 Completar datos fiscales en `src/content/legal.ts` (buscar `[PENDIENTE]`)
- [ ] 🔒 Email de contacto real en `src/lib/site.ts`
- [ ] 🔒 Revisión de los textos legales por un asesor
- [ ] 🔒 Cuenta de Stripe en modo producción con productos y webhook
- [ ] 🔒 Alta censal y fiscal
- [ ] 🔒 Dominio propio y `NEXT_PUBLIC_APP_URL` definitivo
- [ ] 🔒 Copias de seguridad automáticas con restauración probada
- [ ] Verificar dominio de email en Resend (SPF, DKIM, DMARC)
- [ ] Alta en Google Search Console y envío del sitemap

## Mejoras identificadas (no bloqueantes)

**Producto**
- [ ] Generación por lotes desde CSV de catálogo (requiere cola de trabajos)
- [ ] Regenerar una pieza cambiando solo el tono
- [ ] Historial de versiones por pieza
- [ ] Exportación a CSV además de JSON
- [ ] Integración directa con Shopify y WooCommerce
- [ ] Votación de calidad para afinar los prompts con datos reales

**Técnicas**
- [ ] ISR en blog y portada cuando haya tráfico suficiente
- [ ] Cuentas de equipo (el modelo ya lo soporta)
- [ ] API pública para el plan Business
- [ ] Recuperación de contraseña por email
- [ ] Pruebas de extremo a extremo dentro del repositorio (hoy son externas)
- [ ] Actualizar Next.js cuando corrija los avisos de `postcss` y `sharp`

**Negocio**
- [ ] Plan anual con descuento
- [ ] Programa de recomendación
- [ ] Página de casos de uso por sector
