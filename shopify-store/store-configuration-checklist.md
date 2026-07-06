# Checklist de configuración de tienda y lanzamiento

Esta es la lista de configuración final antes de publicar la tienda. Se ejecuta dentro del admin de Shopify (yo la aplicaré directamente vía API en cuanto tenga acceso — ver `docs/` raíz para el estado de acceso). Cada punto indica si es automatizable por mí o si requiere una acción tuya.

## 1. Cuenta y plan — requiere tu acción (identidad/pago)

- [ ] **Tú:** Crear la tienda en Shopify (registro con tu email, sin tarjeta todavía).
- [ ] **Tú:** Crear la "app personalizada" con el token de API Admin (pasos ya enviados) y compartirme dominio + token.
- [ ] **Pendiente de tu autorización:** Activar el plan de pago Shopify (~29€/mes o promo vigente) — **te preguntaré el precio exacto y pediré confirmación antes de activarlo**, no antes.

## 2. Producto y catálogo — lo hago yo vía API

- [ ] Importar el producto desde `shopify-store/product-import.csv` (o crearlo directamente vía API con la misma información).
- [ ] Crear la colección "Cuidado y aseo" para expansión futura.
- [ ] Subir imágenes de producto **en cuanto me las proporciones** (no puedo generar fotos reales del producto físico; puedo usar imágenes de stock/proveedor como placeholder temporal si me das permiso, marcándolo claramente como provisional).

## 3. Tema y contenido — lo hago yo vía API (Theme Assets)

- [ ] Aplicar paleta de colores y tipografía de marca (`docs/03-marca.md`).
- [ ] Configurar secciones de la home según `theme-setup-guide.md`.
- [ ] Crear las 7 páginas (Sobre nosotros, FAQ, y las 5 legales de `shopify-store/legal/`).
- [ ] Configurar navegación (menú principal y pie de página) enlazando todas las páginas.

## 4. Pagos — mixto

- [ ] **Lo dejo configurado yo:** activar Shopify Payments como método (vía API/admin).
- [ ] **Requiere tu acción:** completar el KYC de Shopify Payments (verificación de identidad/cuenta bancaria) — esto es una verificación que Shopify exige directamente al titular, no delegable.
- [ ] Activar PayPal Checkout como método adicional (requiere que vincules o crees tu cuenta PayPal — verificación de identidad, no delegable).

## 5. Envíos e impuestos — lo hago yo vía API

- [ ] Configurar zona de envío "España peninsular" con la tarifa definida (ver `docs/02` y `politica-envios.md`).
- [ ] Marcar Baleares/Canarias/Ceuta/Melilla como zona aparte o excluida hasta confirmar coste con el proveedor (**te preguntaré** qué política quieres antes de fijar tarifas ahí, por las particularidades aduaneras).
- [ ] Configurar impuestos: IVA español incluido en el precio (21% general, salvo que el producto tenga un tipo reducido aplicable — a confirmar).

## 6. Apps gratuitas — requiere unos clics tuyos (OAuth, no delegable por API)

Estas 3 no se pueden instalar por API, son ~10 minutos de clics tuyos:
- [ ] **Tú:** Instalar app de CJ Dropshipping desde el Shopify App Store y conectar el producto (yo te digo exactamente qué buscar/seleccionar).
- [ ] **Tú:** Instalar Judge.me (plan gratuito) y autorizar el acceso.
- [ ] **Tú:** Instalar Privy (plan gratuito) y autorizar el acceso.

El resto (Shopify Email, Shopify Inbox, Analytics) ya vienen nativos, sin instalación — los configuro yo directamente.

## 7. Analítica y tracking — lo hago yo vía API/admin

- [ ] Configurar Google Analytics 4 (necesito que me des el ID de medición `G-XXXXXXX` una vez crees la propiedad en analytics.google.com — la creación de la cuenta de Google Analytics requiere tu login, no delegable, pero es gratis y rápida).
- [ ] Configurar Meta Pixel (mismo caso: necesito el Pixel ID desde tu Meta Business Suite).
- [ ] Configurar banner de consentimiento de cookies (Shopify → Configuración → Privacidad de clientes) — lo activo yo.

## 8. Dominio — requiere tu autorización (pago)

- [ ] **Pendiente de tu autorización:** comprar dominio propio (~10-15€/año). Te propondré opciones de `docs/03-marca.md` y confirmarás cuál comprar antes de que yo lo configure.
- [ ] Mientras tanto, la tienda puede lanzarse con el subdominio `.myshopify.com` sin coste.

## 9. QA final antes de publicar — lo hago yo

- [ ] Revisar que todos los enlaces del footer funcionan.
- [ ] Revisar la tienda en vista móvil (donde vendrá la mayoría del tráfico).
- [ ] Simular una compra de prueba en modo test (Shopify Bogus Gateway) para validar el flujo de checkout completo.
- [ ] Confirmar que las páginas legales están enlazadas y accesibles desde cualquier página.
- [ ] Confirmar que el derecho de desistimiento de 14 días está reflejado correctamente en checkout (Shopify lo pide en la configuración de políticas).

## 10. Publicar

- [ ] Quitar la contraseña de "tienda en construcción" (Configuración → Contraseña de tienda) — **te avisaré justo antes de este paso**, porque es el momento en que la tienda pasa a ser pública, aunque no tenga coste en sí mismo.

---

### Resumen de puntos que requieren tu intervención (no delegables)
1. Crear cuenta Shopify + token de API (identidad).
2. Activar plan de pago Shopify (coste + tu confirmación).
3. Verificación KYC de Shopify Payments / PayPal (identidad).
4. Instalar 3 apps gratuitas por OAuth (CJ Dropshipping, Judge.me, Privy).
5. Crear cuentas de Google Analytics 4 y Meta Business Suite y pasarme los IDs (gratis, pero requiere tu login).
6. Comprar dominio (coste + tu confirmación).
7. Confirmar el momento de quitar la contraseña y publicar la tienda al público.

Todo lo demás de esta lista lo ejecuto yo en cuanto tenga el token de API.
