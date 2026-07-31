# Canal de curiosidades — vídeos faceless

Guiones y material visual para vídeos faceless de YouTube estilo canal de curiosidades animado (stickman doodle, MS Paint amateur).

## Vídeos

1. [`video-01/`](video-01/) — *¿Por qué tu cuerpo te despierta segundos antes de que suene la alarma?*
2. [`video-02-efecto-spotlight/`](video-02-efecto-spotlight/) — *El efecto Spotlight: por qué crees que todos te miran (y no es cierto)* (estilo Zenn: psicología + evolución humana)

Cada carpeta contiene:
- `00-ideas.md` — 5 ideas evaluadas y el tema elegido (⭐).
- `01-guion.md` — guión completo (hook, contexto, desarrollo, dato final, cierre + CTA).
- `02-bloques-visuales.md` — guión dividido en segmentos numerados de 4-6s para cambio de imagen.
- `03-prompts-imagenes.md` — prompt de imagen listo para cada segmento (estilo stickman fijo + escena específica).
- `images/` — imágenes generadas y numeradas (`01.png`, `02.png`, ...).

## Estado de la generación de imágenes (bloqueado)

Ninguna imagen se ha podido generar todavía. Se comprobó con llamadas reales de producción (no pruebas):

- **Magnific (MCP)**: tanto `images_generate` como `stock_search` devuelven `"Magnific MCP requires a premium account."` — el servicio entero requiere plan premium.
- **Artlist (MCP)**: `get_balance` confirma 0 generaciones de imagen gratis restantes y sin créditos contratados (`creditsIncluded: false`). Solo queda 1 generación de vídeo gratis, no aplicable a imágenes.
- No hay ninguna otra herramienta de generación de imágenes gratuita disponible en este entorno.

Los 81 y 89 prompts de imagen de cada vídeo están completos y listos en `03-prompts-imagenes.md` de cada carpeta — en cuanto se active una cuenta premium de Magnific o se contraten créditos de Artlist, se pueden generar y descargar todos siguiendo las instrucciones al final de cada archivo.
