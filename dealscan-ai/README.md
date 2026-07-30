# DealScan AI

Aplicación SaaS que analiza anuncios de productos electrónicos de segunda mano y responde a una sola pregunta: **¿merece la pena comprar esto?**

Pega el enlace, el texto o una captura del anuncio y devuelve un informe con el precio real de mercado, el ahorro estimado, las señales de estafa, los riesgos detectados y la cantidad exacta que conviene ofrecer al vendedor.

---

## Principio de diseño: ninguna cifra inventada

Es la decisión de arquitectura que condiciona todo lo demás.

| Tarea | Quién la hace |
|---|---|
| Leer el anuncio: marca, modelo, capacidad, color, estado, accesorios, daños visibles | **La IA** (Claude, con visión para las capturas) |
| Calcular precio de mercado, precio justo, ahorro, puntuación, riesgo y negociación | **Motor determinista** sobre el catálogo de referencia |

A la IA **nunca se le pide un precio**, así que no puede inventarse uno. Todos los importes salen del PVP oficial de lanzamiento del producto y de curvas de depreciación calibradas, y cada informe incluye el cálculo paso a paso para que se pueda rehacer a mano.

Consecuencias asumidas a propósito:

- Si el modelo del anuncio **no está en el catálogo**, el informe **no da ningún precio**: analiza los riesgos y dice qué dato falta. Preferimos admitir el hueco a rellenarlo.
- Si **falta `ANTHROPIC_API_KEY`**, la aplicación sigue funcionando con el extractor determinista por reglas y el informe lo indica. No hay modo demo.
- Si **falta la configuración de Stripe**, las rutas de pago responden `503` diciendo qué variable falta. No hay suscripciones simuladas.
- La base de datos arranca **sin datos de usuario**. El único `seed` que existe carga el catálogo de referencia.

---

## Arranque rápido

### Con Docker (todo incluido)

```bash
cp .env.example .env
# genera el secreto de sesión y pégalo en AUTH_SECRET
openssl rand -base64 48

docker compose up --build
```

Levanta PostgreSQL, aplica las migraciones, carga el catálogo y sirve la aplicación en <http://localhost:3000>.

### En local

```bash
npm install
cp .env.example .env          # rellena DATABASE_URL y AUTH_SECRET

npx prisma migrate deploy     # crea el esquema
npm run db:seed               # carga los 139 modelos de referencia
npm run dev                   # http://localhost:3000
```

---

## Configuración

Las variables se validan al arrancar con Zod (`src/lib/env.ts`): si falta una obligatoria, el proceso falla con un mensaje que dice exactamente cuál y cómo obtenerla.

### Obligatorias

| Variable | Para qué sirve | Cómo obtenerla |
|---|---|---|
| `DATABASE_URL` | Conexión a PostgreSQL | Con `docker compose` ya viene resuelta |
| `AUTH_SECRET` | Firma de las sesiones (mín. 32 caracteres) | `openssl rand -base64 48` |
| `APP_URL` | Base de los enlaces compartidos y de las redirecciones de Stripe | El dominio real en producción |

### Inteligencia artificial (opcional, recomendada)

| Variable | Para qué sirve | Cómo obtenerla |
|---|---|---|
| `ANTHROPIC_API_KEY` | Identificación del producto y **lectura de capturas de pantalla** | <https://console.anthropic.com> → API Keys |
| `ANTHROPIC_MODEL` | Modelo a usar (por defecto `claude-sonnet-5`) | — |

Sin esta clave: el análisis de texto y enlaces funciona igual y los precios son idénticos (no dependen de la IA); lo único que no se puede hacer es analizar imágenes, y el informe lo advierte.

### Stripe (opcional, necesaria solo para cobrar)

| Variable | Dónde está en el panel de Stripe |
|---|---|
| `STRIPE_SECRET_KEY` | Developers → API keys |
| `STRIPE_WEBHOOK_SECRET` | Developers → Webhooks → endpoint `POST /api/stripe/webhook` |
| `STRIPE_PRICE_ID_PREMIUM_MONTHLY` | Products → tu producto → Pricing |
| `NEXT_PUBLIC_STRIPE_PUBLISHABLE_KEY` | Developers → API keys (clave pública) |

Eventos que debe enviar el webhook: `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`, `invoice.payment_failed`.

En local: `stripe listen --forward-to localhost:3000/api/stripe/webhook`

### Límites

| Variable | Por defecto | Qué controla |
|---|---|---|
| `FREE_DAILY_LIMIT` | `5` | Análisis diarios del plan gratuito |
| `ANONYMOUS_DAILY_LIMIT` | `3` | Análisis de prueba sin cuenta, por IP (`0` para exigir registro) |

---

## El motor de valoración

`src/lib/valuation/` — el corazón del producto, sin dependencias de framework y cubierto por pruebas.

```
PVP oficial de lanzamiento (variante de almacenamiento incluida)
  × retención por antigüedad      curva propia por categoría
  × factor de marca               valor residual real por fabricante
  = valor de mercado en buen estado
  × factor de estado              nuevo 1,28 · como nuevo 1,13 · bueno 1,00 · aceptable 0,85 · deficiente 0,55
  × ajustes                       accesorios (+) · batería y daños (−)
  = PRECIO JUSTO de esta unidad concreta
```

De la ratio `precio pedido / precio justo` salen el veredicto (chollo / correcto / caro), la puntuación 0-100, la probabilidad de buena compra, el ahorro y el plan de negociación.

Detalles que importan y que están probados:

- **El riesgo es un techo, no una resta.** Un anuncio con señales graves de fraude nunca obtiene buena nota, por muy barato que sea: `score ≤ 100 − riesgo`. Un precio de gancho es lo contrario de una oportunidad.
- **Los descuentos superiores al 28 %** dejan de sumar puntos, porque a partir de ahí un precio más bajo indica un problema. El ahorro real se sigue mostrando íntegro.
- **El desgaste estético no se penaliza dos veces**: si el estado declarado ya es «aceptable», los arañazos no vuelven a restar.
- **Lo declarado frente a lo deducido**: «buen estado con algún arañazo» es buen estado; «como nuevo pero no enciende» es un producto roto. Un defecto grave manda sobre cualquier afirmación del vendedor.
- **Las contradicciones se muestran, no se resuelven en silencio**: si el vendedor dice «precintado» y describe arañazos, se valora con el estado peor y se señala la incoherencia.

### Añadir una categoría nueva

1. Añade la clave en `CategoryKey` (`src/lib/valuation/types.ts`).
2. Declara su curva de depreciación en `RETENTION_CURVES` (`engine.ts`).
3. Añade los modelos con su PVP de lanzamiento en `catalog.ts`.
4. `npm run db:seed`.

El motor no se toca.

### Mantener el catálogo

`ProductReference` es la fuente de verdad en producción: 139 modelos con su PVP oficial de lanzamiento, año de salida, variantes de almacenamiento, alias de escritura y procedencia del dato. `npm run db:seed` es idempotente y actualiza en lugar de duplicar, así que se puede reejecutar tras cada cambio del catálogo.

---

## Seguridad

- **Contraseñas** con bcrypt (coste 12). El login tarda lo mismo exista o no la cuenta, así que no se filtra qué correos están registrados.
- **Sesiones revocables de verdad**: token aleatorio de 256 bits del que solo se guarda el SHA-256; un volcado de la tabla no permite suplantar a nadie. Cerrar sesión borra la fila y el token deja de valer aunque el JWT no haya caducado. Cookie `httpOnly` + `SameSite=Lax` + `Secure` en producción.
- **Protección SSRF** en la lectura de enlaces: solo `http`/`https`, se resuelve el DNS y se rechaza cualquier IP privada, loopback, link-local o de metadatos de cloud (`169.254.169.254`), las redirecciones se siguen a mano revalidando cada salto, y hay límites de tamaño y de tiempo.
- **Autorización por consulta**: todo acceso a un análisis filtra por `userId` en el `WHERE`, así que adivinar un identificador no sirve de nada.
- **Enlaces compartidos** con token aleatorio, revocables y marcados como no indexables.
- **Webhook de Stripe** con verificación de firma sobre el cuerpo en bruto e idempotencia real: cada `event.id` se registra y los reenvíos se descartan.
- **Límite de peticiones** en registro, login y análisis; el login limita por IP *y* por cuenta.
- **Cabeceras de seguridad** (CSP, HSTS, `X-Frame-Options`, `Permissions-Policy`) en `next.config.ts`.
- Los errores internos se registran completos en el servidor y al cliente solo le llega un mensaje útil.

---

## Rendimiento

El objetivo de carga por debajo de 2 s se cumple con margen:

| Medida | Resultado |
|---|---|
| TTFB de la portada (build de producción) | ~21 ms |
| JS compartido en el primer render | 102 kB |
| Análisis completo de un anuncio (motor de reglas) | ~30 ms |

Decisiones que lo sostienen: componentes de servidor por defecto (solo el formulario, el comparador y las acciones son cliente), el informe se renderiza en el servidor, cero dependencias de UI, fuentes del sistema, SVG en línea en lugar de iconos por librería, y salida `standalone` en Docker.

---

## Comandos

```bash
npm run dev          # desarrollo
npm run build        # compilación de producción
npm start            # servir la compilación
npm test             # 70 pruebas (motor de valoración, extracción, formateo)
npm run typecheck    # TypeScript en modo estricto
npm run db:seed      # cargar/actualizar el catálogo de referencia
npx prisma studio    # inspeccionar la base de datos
```

---

## Estructura

```
prisma/
  schema.prisma            modelo de datos (importes siempre en céntimos)
  seed.ts                  carga del catálogo de referencia
src/
  app/
    page.tsx               portada con el analizador
    como-funciona/         el método de valoración, explicado
    precios/               planes
    entrar/ registro/      acceso
    panel/                 resumen · historial · favoritos · comparador · suscripción
    analisis/[id]/         informe propio
    informe/[token]/       informe compartido públicamente
    api/                   analyze · analyses · compare · auth · stripe · health
  components/
    analyzer-form.tsx      las tres entradas: texto, enlace y capturas
    report-view.tsx        el informe (compartido por las tres vistas)
    compare-client.tsx     comparador
  lib/
    valuation/             MOTOR: catalog · extract · risk · engine · types
    ai/anthropic.ts        extracción con IA (jamás precios)
    analysis-service.ts    orquestación del análisis
    fetch-listing.ts       descarga del anuncio con protección SSRF
    auth.ts quota.ts       sesiones y cuotas
    stripe.ts pdf.ts       suscripciones e informes en PDF
    money.ts               formato monetario español sin depender de ICU
tests/                     pruebas del motor, de la extracción y del formateo
```

---

## Notas de producción

- **Escalado horizontal**: el limitador de peticiones y la cuota anónima viven en memoria del proceso. Con varias instancias hay que sustituirlos por Redis (una clave por IP y ventana con TTL); la interfaz de `rate-limit.ts` ya está preparada para el cambio. La cuota de los usuarios registrados está en PostgreSQL y funciona con cualquier número de instancias.
- **Imágenes**: por defecto solo se guarda el hash SHA-256, el tipo y el tamaño de cada captura, no el contenido. El campo `storageKey` de `AnalysisImage` está listo para apuntar a S3/R2 si se decide conservarlas.
- **Formato monetario**: se calcula a mano a propósito. `Intl` necesita los datos completos de ICU y hay runtimes donde devolvería «1300 €» en lugar de «1.300 €»; en una aplicación de precios eso es un error visible.
- **Migraciones**: `prisma migrate deploy` en el arranque del contenedor (el servicio `migrate` de `docker-compose.yml` lo hace antes de levantar la aplicación).
