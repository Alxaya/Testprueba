# Changelog

Todos los cambios relevantes de Redacta.

El formato sigue [Keep a Changelog](https://keepachangelog.com/es-ES/1.1.0/) y el
versionado es [SemVer](https://semver.org/lang/es/).

---

## [No publicado]

Pendiente antes de la 1.0: datos fiscales reales, Stripe en producción y dominio
propio. Ver [`TODO.md`](TODO.md).

---

## [0.1.0] — 2026-07-25

Primera versión funcional de extremo a extremo.

### Añadido

**Web pública y SEO**
- Portada con propuesta de valor, catálogo de formatos, comparativa frente a un
  generador genérico y preguntas frecuentes.
- Página de precios con los cuatro planes y tabla comparativa.
- Blog con listado y ficha de artículo, renderizado desde Markdown.
- Aviso legal, política de privacidad, política de cookies y términos del
  servicio.
- `sitemap.xml` dinámico y `robots.txt` que excluye panel, administración y API.
- Datos estructurados (SoftwareApplication, FAQPage, BlogPosting), Open Graph,
  Twitter Card y URL canónicas.
- Diseño responsive con modo oscuro por preferencia del sistema.

**Autenticación**
- Registro y acceso con email y contraseña (bcrypt, coste 12).
- Acceso con Google opcional; el botón se oculta si no está configurado.
- Sesiones JWT de 30 días.
- Protección de rutas en el middleware y comprobación adicional en cada página.
- Roles de plataforma (USER / ADMIN) y de organización (OWNER / ADMIN / MEMBER).

**Motor de IA**
- Generación con Claude (`claude-opus-5`), streaming y caché de prompt.
- Prompt base con diez reglas contra el estilo típico de IA, incluida la
  prohibición explícita de inventarse datos.
- Perfil de marca por cliente inyectado en cada petición.
- Siete formatos: ficha de producto, guion para redes, artículo de blog,
  metadatos SEO, anuncios, email de campaña y preguntas frecuentes.
- Formularios derivados de la definición de cada formato.
- Registro de tokens, coste estimado y duración en cada generación.

**Panel de clientes**
- Resumen con consumo del periodo, accesos rápidos y actividad reciente.
- Generador, biblioteca con filtros y paginación, y ficha de contenido con copia
  al portapapeles.
- Proyectos con límite por plan y archivado.
- Perfil de marca de siete campos.
- Ajustes con cambio de datos, cambio de contraseña, exportación en JSON y baja
  con borrado real en cascada.

**Monetización**
- Cuatro planes (Gratis, Starter 19 €, Pro 49 €, Business 99 €) definidos en
  código.
- Stripe Checkout y portal de cliente alojados.
- Webhook con verificación de firma e idempotencia mediante `ProcessedWebhook`.
- Recogida de dirección y NIF para la facturación con IVA.
- Cuota comprobada antes de llamar al modelo y tope de palabras por plan.

**Panel de administración**
- Cuadro de mando con MRR, ARR, margen bruto y coste de modelo.
- Listado de clientes, registro de generaciones con tasa de error y analítica.
- Estado de integraciones, ejecución manual de trabajos, banderas de
  funcionalidad y registro de auditoría.

**Automatizaciones**
- Cuatro trabajos programados: informe semanal, recordatorio de inactividad,
  blog automático y limpieza de histórico.
- Endpoints protegidos con secreto compartido; en producción se bloquean solos si
  falta.
- Siete plantillas de email con protección contra envíos repetidos.

**Analítica**
- Registro de eventos propio, sin cookies de terceros ni identificadores
  persistentes.
- Embudo de adquisición, series diarias, fuentes de tráfico y métricas de
  negocio.

**Documentación**
- README con instalación paso a paso y diez documentos de mantenimiento.
- `TODO.md` con el estado real por fases y `CHANGELOG.md`.

### Seguridad

- Todas las consultas de datos de cliente filtran por `organizationId`; ese
  filtro es la barrera de aislamiento, no la dificultad de adivinar una URL.
- Conversor de Markdown propio que escapa todo el HTML de entrada antes de
  generar etiquetas y limita los enlaces a `http`, `https`, `mailto` y rutas
  relativas. Cubierto con pruebas específicas.
- Cabeceras de seguridad: HSTS, X-Frame-Options, X-Content-Type-Options,
  Referrer-Policy y Permissions-Policy.
- El plan de una organización solo puede cambiarlo el webhook de Stripe.
- La analítica enviada desde el navegador se filtra por lista blanca; el usuario
  y la organización se toman siempre de la sesión del servidor.
- `src/lib/env.ts` marcado como `server-only` para que un uso indebido falle al
  compilar y no en producción.

### Corregido durante el desarrollo

Hallazgos de la verificación en navegador real:

- **La configuración se filtraba al bundle de cliente.** `lib/site.ts` importaba
  `lib/env`, que a su vez lo arrastraba a la cabecera y al panel; en el navegador
  no existen `DATABASE_URL` ni `AUTH_SECRET`, así que la validación fallaba y el
  panel mostraba la pantalla de error tras registrarse. Ahora `lib/site.ts` lee
  `NEXT_PUBLIC_APP_URL` directamente y `lib/env` está marcado como `server-only`,
  de modo que una recaída se detecta al compilar.
- **Concordancia de número en los mensajes.** Se mostraba «1 proyectos activos».
  Añadida la función `pluralize` y aplicada en las pantallas afectadas.
- **El embudo no era un embudo.** Contaba eventos brutos, de modo que un paso
  posterior podía superar al anterior (una cuenta genera muchas piezas). Ahora
  cuenta identidades únicas por paso.
- **Raíz de trazado del despliegue.** El proyecto vive en un subdirectorio de un
  repositorio con varios proyectos y Next infería mal la raíz. Fijada con
  `outputFileTracingRoot`.
- **El seed no cargaba el entorno** al ejecutarse fuera de la CLI de Prisma.
  Resuelto con `--env-file-if-exists`.

### Verificado

- 33 pruebas unitarias (Markdown y seguridad, planes y unidad económica,
  utilidades).
- 19 comprobaciones de extremo a extremo en Chromium: registro, acceso, perfil de
  marca, límite de proyectos, error controlado sin clave de IA, biblioteca,
  facturación sin Stripe, exportación RGPD, bloqueo de `/admin` a usuarios sin
  rol, panel interno, analítica, ejecución de trabajos e interfaz móvil.
- Compilación de producción sin errores ni avisos; 23 rutas generadas.

### Conocido

- `npm audit` reporta avisos en `postcss` y `sharp`, ambos dependencias internas
  de Next.js. No hay corrección sin degradar Next a la versión 9. No son
  explotables desde la aplicación: no se procesa CSS ni imágenes de usuarios.
