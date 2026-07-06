# Guía de configuración del tema Dawn (gratuito)

Sigue esta guía en orden dentro de **Admin de Shopify → Tienda online → Temas → Dawn → Personalizar**. No requiere ningún pago; Dawn viene incluido gratis en cualquier plan de Shopify.

## 1. Instalar el tema

1. Ve a **Tienda online → Temas**.
2. En "Explorar temas gratuitos", busca **Dawn** y pulsa "Añadir a la biblioteca de temas".
3. Actívalo como tema publicado (o trabaja en un borrador y publícalo al final, para no dejar la tienda a medias visible).

## 2. Colores (Personalizar → Configuración del tema → Colores)

Crea un esquema de color nuevo llamado "Pelusa" con estos valores exactos (de `docs/03-marca.md`):

| Campo en Dawn | Valor |
|---|---|
| Background 1 (fondo principal) | `#FBF7F2` |
| Background 2 (fondo secundario/secciones) | `#F1E9DE` |
| Text (texto principal) | `#2B2620` |
| Button background (botón principal) | `#E8A93B` |
| Button text | `#2B2620` |
| Button background secundario (outline) | `#D97757` |
| Border (bordes/líneas) | `#7A8B6F` |

Aplica este esquema como el esquema "por defecto" en todas las secciones nuevas que crees.

## 3. Tipografía (Personalizar → Configuración del tema → Tipografía)

- **Fuente de encabezados:** cambia a **Fraunces** (disponible en la librería de Google Fonts integrada en Dawn).
- **Fuente de cuerpo de texto:** cambia a **Inter**.
- Deja los tamaños por defecto de Dawn la primera vez; ajústalos solo si al ver la tienda en móvil algo se ve demasiado grande/pequeño.

## 4. Logo y favicon (Personalizar → Configuración del tema → Logo)

- Sube el logo generado en Canva/Hatchful (ver `docs/03-marca.md`).
- Ancho de logo recomendado: 120-140px en escritorio.
- Sube también el favicon (versión cuadrada simple del icono, sin texto).

## 5. Estructura de la home (Personalizar → añade/edita secciones en este orden)

1. **Image banner** (sección superior)
   - Imagen: foto de la mascota siendo cepillada con Pelusa.
   - Heading: `Menos pelo en el sofá. Más mimos con tu mascota.`
   - Texto: `El cepillo autolimpiante que convierte 10 minutos de cepillado en 10 segundos de limpieza. Envío rápido desde España/UE. 🐾`
   - Botón: texto `Quiero el mío`, enlace → tu producto.

2. **Featured product** (justo debajo)
   - Selecciona el producto "Cepillo Autolimpiante para Perros y Gatos".
   - Activa "mostrar precio de comparación" para que se vea el ahorro (19,90€ vs 29,90€).

3. **Multicolumn** (sección "Cómo funciona")
   - 3 columnas: "1. Cepilla", "2. Pulsa el botón", "3. Retira la pelusa" (textos completos en `docs/04-copywriting-tienda.md`, sección "Cómo funciona"), cada una con un icono/foto del paso.

4. **Rich text** (bullets de beneficios)
   - Pega los 5 bullets de beneficios de `docs/04` (autolimpieza en 1 segundo, cepillado sin tirones, etc.).

5. **Collapsible content** (para la FAQ corta)
   - Añade cada pregunta de la sección "Manejo de objeciones" de `docs/04` como un bloque colapsable independiente.

6. **Email signup / Newsletter**
   - Texto: `Suscríbete y llévate un 10% de descuento en tu primer pedido 🐾`
   - Esto conecta automáticamente con Shopify Email para el flujo de bienvenida (ver `docs/07-automatizacion.md`).

7. **Footer**
   - Añade enlaces a: Sobre nosotros, FAQ completa, Política de Envíos, Política de Devoluciones, Política de Privacidad, Política de Cookies, Aviso Legal.
   - Añade los sellos de confianza como texto o iconos: "Pago seguro 🔒 · Envío desde España/UE 🚚 · Devolución en 14 días 🐾".
   - Añade iconos/enlaces a Instagram y TikTok de la marca.

## 6. Página de producto (Personalizar → Páginas de producto)

- Activa el bloque **"Reseñas de producto"** una vez instales Judge.me (paso en `store-configuration-checklist.md`).
- Añade bloque de texto enriquecido bajo la galería con el contenido completo de la ficha de producto (`docs/04`, sección 2 completa: gancho, bullets, cómo funciona, FAQ).
- Activa "Envío calculado en el checkout" y "Impuestos incluidos en el precio" (ver checklist de configuración).

## 7. Páginas legales

Crea 6 páginas en **Tienda online → Páginas** con el contenido de la carpeta `shopify-store/legal/`:
1. Sobre nosotros → contenido de `docs/04-copywriting-tienda.md`, sección 3.
2. Preguntas frecuentes → contenido de `docs/04-copywriting-tienda.md`, sección 4.
3. Aviso Legal y Condiciones de Venta → `legal/aviso-legal-condiciones.md`
4. Política de Privacidad → `legal/politica-privacidad.md`
5. Política de Cookies → `legal/politica-cookies.md`
6. Política de Envíos → `legal/politica-envios.md`
7. Política de Devoluciones → `legal/politica-devoluciones.md`

Enlaza todas desde el pie de página (paso 5.7 de arriba).

## 8. Comprobación final visual

Antes de publicar, revisa en el propio previsualizador de Dawn (icono de móvil arriba) que:
- [ ] La home se ve bien en móvil (la mayoría del tráfico vendrá de TikTok/Instagram).
- [ ] Los colores tienen buen contraste (texto legible sobre fondo).
- [ ] Los enlaces del footer funcionan y apuntan a las páginas correctas.
- [ ] El botón de compra es visible sin hacer scroll en móvil (above the fold).

No hace falta ningún tema de pago ni ninguna app de diseño adicional para completar esta configuración.
