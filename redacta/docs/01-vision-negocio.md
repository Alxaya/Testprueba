# 01 · Visión de negocio

Este documento explica **qué se vende y por qué el modelo funciona**. El resto de
la documentación es técnica; esta es la que hay que leer primero para entender
las decisiones.

---

## El problema

Una tienda online española con 200 productos tiene tres opciones para escribir
sus fichas:

1. **Copiar la descripción del proveedor.** Gratis, pero Google la ve duplicada
   en otras 30 tiendas y no posiciona.
2. **Contratar un redactor.** Entre 15 y 40 € por ficha. Para 200 productos son
   entre 3.000 y 8.000 €.
3. **Usar ChatGPT a mano.** Barato, pero hay que reescribir el prompt cada vez,
   el tono cambia entre piezas, se inventa datos y no queda nada organizado.

Redacta ataca la tercera: convierte "usar IA a mano" en un producto.

## Qué se vende exactamente

No se vende "acceso a una IA". Se vende:

1. **El perfil de marca persistente.** Sector, público, tono, propuesta de valor y
   prohibiciones se definen una vez y se aplican a todo. Es lo que hace que la
   pieza 50 suene igual que la pieza 1.
2. **Plantillas afinadas por formato.** Cada formato conoce sus reglas reales:
   límites de caracteres de Google y Meta, estructura de un guion de vídeo
   vertical, datos estructurados de una FAQ.
3. **Instrucciones contra los tópicos de la IA.** El prompt base
   (`src/lib/ai/client.ts`) prohíbe explícitamente aperturas de relleno,
   españolizaciones neutras y —lo más importante— **inventarse datos**.
4. **La biblioteca.** Todo queda guardado, buscable y exportable.

## Cliente objetivo

| Segmento | Por qué encaja |
| --- | --- |
| Tiendas de dropshipping y ecommerce pequeño | Muchos productos, poco presupuesto, necesidad constante de contenido |
| Agencias pequeñas y freelances de marketing | Varias marcas, el plan Business permite separarlas por proyecto |
| Pymes con web propia | Blog y páginas de servicio sin contratar redactor |

Mercado español a propósito: el contenido "en español neutro" es un problema real
y es un diferenciador defendible frente a herramientas anglosajonas.

## Unidad económica

Lo que decide si el negocio funciona es el margen por generación.

| Concepto | Valor |
| --- | --- |
| Coste de modelo por pieza (medido) | ~0,02 – 0,06 € |
| Precio del plan Starter | 19 €/mes por 100 generaciones |
| Ingreso por generación (uso máximo) | 0,19 € |
| **Margen bruto en el peor caso** | **~70 %** |

Tres cosas protegen ese margen y están implementadas:

- **Cuota estricta por plan**, comprobada *antes* de llamar al modelo
  (`assertWithinQuota`): un cliente nunca puede generar coste ilimitado.
- **Tope de palabras por pieza** según plan: acota el peor caso de una sola
  llamada.
- **Caché de prompt** en el bloque de sistema, que es el texto más largo y el que
  se repite en todas las peticiones de todos los clientes.

El coste real por cliente es visible en `/admin` (columna *Coste* y tarjeta
*Margen bruto*). Si alguna cuenta se sale de la curva, se ve ahí.

## Escalera de precios

| Plan | Precio | Generaciones | A quién va dirigido |
| --- | --- | --- | --- |
| Gratis | 0 € | 5 | Probar sin tarjeta |
| Starter | 19 € | 100 | Tienda que publica cada semana |
| Pro | 49 € | 500 | Catálogo grande, contenido continuo |
| Business | 99 € | 2.000 | Agencias con varias marcas |

El plan gratuito es adquisición, no caridad: 5 generaciones bastan para ver la
diferencia frente a una descripción de proveedor, y no para amortizar un
catálogo.

## Cómo llegan los clientes (sin intervención)

1. **SEO propio.** El blog se escribe solo (`blog-autopilot`) siguiendo un
   calendario editorial escrito a mano con intenciones de búsqueda reales. Cada
   artículo lleva metadatos, datos estructurados y entra en el sitemap.
2. **Contenido en redes.** El propio producto genera los guiones; el repositorio
   ya incluye un MCP de TikTok y un generador de vídeo reutilizables.
3. **Boca a boca.** El plan gratuito no pide tarjeta, así que compartir la
   herramienta no tiene fricción.

## Qué queda por hacer para facturar

Ver [`docs/09-legal.md`](09-legal.md). En resumen: datos fiscales del titular,
cuenta real de Stripe, dominio y revisión de los textos legales por un asesor.
