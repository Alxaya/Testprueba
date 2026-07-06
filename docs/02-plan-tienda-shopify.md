# Plan de creación de la tienda Shopify

Producto elegido: **cepillo autolimpiante para mascotas**. Nombre de marca provisional usado en este plan: **"Pelusa"** (ver docs/03-marca.md para el proceso de naming completo — puedes cambiarlo antes de registrar nada).

## 0. Antes de pagar nada: coste real mínimo imprescindible

Shopify **no tiene plan gratuito indefinido** — es el único coste que no se puede evitar si quieres usar Shopify en concreto:

| Concepto | Coste | ¿Evitable? |
|---|---|---|
| Plan Shopify Basic | ~29€/mes (o ~25€/mes facturado anual) | No, si usas Shopify. Alternativa 100% gratis: **abrir tienda en un plan de prueba de 3 días + pagar 1€/mes los 3 primeros meses** (promoción habitual de Shopify) para testear casi gratis antes de comprometerte al precio completo. |
| Dominio propio (.com/.es) | ~10-15€/año | Técnicamente no (puedes lanzar con el subdominio miTienda.myshopify.com), pero **sí recomiendo pagarlo**: un dominio propio da confianza inmediata al comprador español y cuesta menos que un café al mes. |
| Pasarela de pago | 0€ de cuota, comisión ~2-2,9% + 0,25€ por transacción (Shopify Payments) | No aplica coste fijo, solo por venta realizada — no hay riesgo de pagar sin vender. |

**Antes de contratar el plan de pago te pediré confirmación explícita**, indicándote el precio exacto vigente en ese momento (Shopify cambia precios/promos con frecuencia).

Todo lo demás en este documento se puede hacer con herramientas gratuitas.

## 1. Estructura de la tienda

```
Inicio (Home)
├── Producto principal (cepillo autolimpiante) ← página estrella, enlazada desde toda la web
├── Colección "Cuidado y aseo" (para expansión futura: fuente de agua, arnés...)
├── Sobre nosotros
├── Preguntas frecuentes (FAQ)
├── Contacto
├── Política de envíos
├── Política de devoluciones
├── Política de privacidad
├── Términos y condiciones
└── Carrito / Checkout (nativo de Shopify)
```

Con un solo producto estrella al principio, la home debe **ser básicamente la página de producto** (o redirigir directamente a ella) — no dispersar la atención del visitante.

## 2. Tema (theme) — gratis primero

- Usa un **tema gratuito de Shopify**: *Dawn* (el tema por defecto, rápido y muy optimizado) o *Craft*/*Sense* si quieres algo más visual. Son gratis y de calidad profesional — **no merece la pena pagar 200-400€ por un tema de pago** al inicio; la diferencia real de conversión rara vez justifica el coste cuando aún no tienes tráfico ni datos.
- Cuándo sí pagaría un tema: si tras 2-3 meses facturando ya ves que necesitas funciones específicas (filtros avanzados, más secciones de venta cruzada) que Dawn no cubre.

## 3. Apps imprescindibles — gratis vs pago

| Función | Alternativa gratuita | Cuándo pagar |
|---|---|---|
| Proveedor/dropshipping (importar producto, sincronizar stock, procesar pedidos) | **CJ Dropshipping** (app gratuita, cobras solo el coste del producto+envío) o **BigBuy** (plan de acceso a catálogo tiene coste — ver nota abajo) | Solo si necesitas funciones premium de sourcing (agente dedicado, branding en el paquete) una vez que ya vendes con regularidad. |
| Reviews/opiniones de producto | **Judge.me** (plan gratuito permite importar reviews y mostrarlas, con marca de agua ligera) | Plan de pago (~15$/mes) solo cuando quieras reviews con fotos ilimitadas y sin marca de agua, tras validar ventas. |
| Email marketing / carrito abandonado | **Shopify Email** (incluido, hasta 10.000 emails/mes gratis) | No necesitas Klaviyo de pago al inicio; Shopify Email gratuito cubre newsletters y flujos básicos. |
| Pop-up de captación de email/descuento | **Privy** (plan gratuito) | Solo si necesitas segmentación avanzada. |
| Chat / atención al cliente | **Shopify Inbox** (gratis, incluido) | No pagar Zendesk/Gorgias al inicio, es innecesario con bajo volumen. |
| Analítica | **Shopify Analytics (básico, incluido) + Google Analytics 4 (gratis) + Meta Pixel (gratis)** | Apps de analítica avanzada solo cuando el volumen de datos lo justifique. |
| SEO | Nativo de Shopify + ajustes manuales (ver docs/05-seo.md) | Apps de SEO de pago no aportan nada que no puedas hacer gratis al principio. |

**Nota sobre BigBuy:** su acceso al catálogo dropshipping tiene una cuota mensual/anual (no es gratis) y existen quejas de usuarios sobre cargos tras cancelar la suscripción (ver fuentes en docs/01). **Te pediré confirmación explícita antes de dar de alta cualquier suscripción a BigBuy**, y te recomiendo leer bien las condiciones de baja antes de introducir tu tarjeta. Para empezar, **CJ Dropshipping es la opción sin cuota fija** y es la que recomiendo para el lanzamiento inicial.

## 4. Checkout y confianza

- Activa **Shopify Payments** (sin coste fijo) para Tarjeta, y añade **PayPal** (gratis de activar, confianza extra para el comprador español).
- Añade sellos de confianza gratuitos en el pie de página: "Pago seguro", "Envío desde España/UE", "Devolución en 30 días" (ver copy en docs/04).
- Configura textos legales obligatorios en España/UE desde el primer día (ver plantillas en docs/04): política de privacidad (RGPD), condiciones de venta, derecho de desistimiento de 14 días (obligatorio por ley para venta online en la UE — **no es opcional**, hay que cumplirlo).

## 5. Checklist de lanzamiento (orden recomendado)

1. [ ] Crear cuenta Shopify (prueba gratuita/1€ los primeros meses).
2. [ ] Elegir y confirmar naming + logo (docs/03).
3. [ ] Instalar tema gratuito Dawn y aplicar paleta/tipografía de marca.
4. [ ] Conectar CJ Dropshipping e importar el producto elegido con variantes.
5. [ ] Pegar los textos de docs/04 (home, producto, FAQ, políticas).
6. [ ] Configurar dominio propio (pedirte confirmación antes de comprarlo).
7. [ ] Activar Shopify Payments + PayPal.
8. [ ] Instalar Judge.me, Shopify Email, Shopify Inbox, Privy (todo en plan gratuito).
9. [ ] Configurar Google Analytics 4 + Meta Pixel (gratis).
10. [ ] Aplicar checklist SEO (docs/05).
11. [ ] Hacer 3-5 pedidos de prueba a tu propia dirección para verificar tiempos de envío y calidad antes de anunciar la tienda.
12. [ ] Publicar y empezar el calendario de contenido orgánico (docs/06) **antes o en paralelo** a cualquier gasto en publicidad — el objetivo es validar con tráfico orgánico primero y gastar en ads solo cuando el producto ya demuestre conversión.

## 6. Sobre la publicidad de pago

No la incluyo como paso obligatorio del lanzamiento. Mi recomendación de crecimiento (dado el objetivo de "menor presupuesto posible") es:

1. Validar primero con contenido orgánico en TikTok/Instagram (docs/06) — coste 0€, solo tiempo.
2. Si un vídeo empieza a funcionar orgánicamente, **eso es la señal** de que merece la pena poner un pequeño presupuesto de ads detrás (Spark Ads/Meta Ads) — pero esa es una decisión de inversión real y **te pediré confirmación y presupuesto máximo antes de crear ninguna campaña de pago**.
