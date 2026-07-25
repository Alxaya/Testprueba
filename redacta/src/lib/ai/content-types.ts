import { ContentType } from '@prisma/client';

/**
 * Catalogo de formatos que sabe generar Redacta.
 *
 * Cada formato declara los campos de su formulario y como se traduce a
 * instrucciones para el modelo. Anadir un formato nuevo es anadir una entrada
 * aqui: el formulario, el selector y la validacion se derivan de esta
 * definicion, no hay que tocar la interfaz.
 */

export type FieldType = 'text' | 'textarea' | 'select' | 'number';

export type FieldDef = {
  name: string;
  label: string;
  type: FieldType;
  placeholder?: string;
  help?: string;
  required?: boolean;
  options?: Array<{ value: string; label: string }>;
  maxLength?: number;
};

export type ContentTypeDef = {
  id: ContentType;
  /** Segmento de URL: /app/generar/[slug] */
  slug: string;
  label: string;
  emoji: string;
  description: string;
  /** Longitud objetivo por defecto, en palabras. */
  defaultWords: number;
  fields: FieldDef[];
  /** Instrucciones especificas del formato para el modelo. */
  instructions: (input: Record<string, string>) => string;
};

const toneOptions = [
  { value: 'cercano', label: 'Cercano y natural' },
  { value: 'profesional', label: 'Profesional' },
  { value: 'divertido', label: 'Divertido y desenfadado' },
  { value: 'premium', label: 'Premium y sobrio' },
  { value: 'tecnico', label: 'Tecnico y detallado' },
  { value: 'urgente', label: 'Directo y con urgencia' },
];

export const CONTENT_TYPES: Record<ContentType, ContentTypeDef> = {
  PRODUCT_DESCRIPTION: {
    id: ContentType.PRODUCT_DESCRIPTION,
    slug: 'ficha-producto',
    label: 'Ficha de producto',
    emoji: '🛍️',
    description: 'Descripcion de venta optimizada para tienda online, con beneficios y bullets.',
    defaultWords: 350,
    fields: [
      { name: 'product', label: 'Producto', type: 'text', required: true, placeholder: 'Cepillo autolimpiante para mascotas', maxLength: 120 },
      { name: 'details', label: 'Caracteristicas y detalles', type: 'textarea', required: true, placeholder: 'Material, medidas, para que sirve, que problema resuelve...', maxLength: 1500 },
      { name: 'audience', label: 'Publico objetivo', type: 'text', placeholder: 'Duenos de perros de pelo largo', maxLength: 160 },
      { name: 'tone', label: 'Tono', type: 'select', options: toneOptions },
    ],
    instructions: (i) => `Escribe la ficha de producto completa para una tienda online espanola.

Producto: ${i.product}
Detalles aportados por el vendedor: ${i.details}
${i.audience ? `Publico objetivo: ${i.audience}` : ''}

Estructura obligatoria:
1. Un titulo comercial de maximo 60 caracteres.
2. Un parrafo de apertura que conecte con el problema del cliente antes de hablar del producto.
3. Una lista de 4 a 6 beneficios (no caracteristicas secas: traduce cada caracteristica a lo que gana el cliente).
4. Una seccion breve de especificaciones tecnicas en formato lista.
5. Un cierre con llamada a la accion.

Reglas: no inventes certificaciones, materiales, medidas ni datos que no se hayan aportado. Si falta un dato relevante, escribe el texto sin el en lugar de inventarlo.`,
  },

  BLOG_ARTICLE: {
    id: ContentType.BLOG_ARTICLE,
    slug: 'articulo-blog',
    label: 'Articulo de blog SEO',
    emoji: '📰',
    description: 'Articulo estructurado para posicionar en Google con una palabra clave concreta.',
    defaultWords: 900,
    fields: [
      { name: 'keyword', label: 'Palabra clave principal', type: 'text', required: true, placeholder: 'como quitar el pelo del sofa', maxLength: 120 },
      { name: 'angle', label: 'Enfoque o tesis', type: 'textarea', placeholder: 'Que quieres defender o resolver en el articulo', maxLength: 800 },
      { name: 'words', label: 'Longitud aproximada (palabras)', type: 'number', placeholder: '900' },
      { name: 'tone', label: 'Tono', type: 'select', options: toneOptions },
    ],
    instructions: (i) => `Escribe un articulo de blog optimizado para SEO en espanol.

Palabra clave principal: ${i.keyword}
${i.angle ? `Enfoque solicitado: ${i.angle}` : ''}

Estructura obligatoria:
1. Titulo H1 que incluya la palabra clave de forma natural.
2. Entradilla de 2-3 frases que responda a la intencion de busqueda de inmediato.
3. Entre 4 y 6 secciones con encabezados H2 (usa H3 cuando aporte).
4. Al menos una lista o tabla que facilite el escaneo del texto.
5. Un apartado final de preguntas frecuentes con 3 preguntas reales.
6. Conclusion con una accion concreta para el lector.

Reglas: cero relleno. Nada de "en el mundo actual" ni introducciones vacias. Usa la palabra clave y variantes semanticas de forma natural, sin repetirla forzadamente. No cites estudios ni cifras concretas si no te las han facilitado.`,
  },

  SEO_METADATA: {
    id: ContentType.SEO_METADATA,
    slug: 'metadatos-seo',
    label: 'Metadatos SEO',
    emoji: '🔍',
    description: 'Titulo, meta descripcion, URL y datos estructurados para una pagina.',
    defaultWords: 200,
    fields: [
      { name: 'page', label: 'Pagina o producto', type: 'text', required: true, placeholder: 'Categoria: cepillos para perros', maxLength: 160 },
      { name: 'keyword', label: 'Palabra clave', type: 'text', required: true, placeholder: 'cepillo perro pelo largo', maxLength: 120 },
      { name: 'context', label: 'Contexto adicional', type: 'textarea', placeholder: 'Que contiene la pagina, que la diferencia', maxLength: 800 },
    ],
    instructions: (i) => `Genera los metadatos SEO para esta pagina.

Pagina: ${i.page}
Palabra clave: ${i.keyword}
${i.context ? `Contexto: ${i.context}` : ''}

Devuelve exactamente estas secciones, cada una con su encabezado:
- **Title tag**: 3 alternativas, cada una de 50 a 60 caracteres, indicando el recuento exacto entre parentesis.
- **Meta description**: 3 alternativas, cada una de 140 a 155 caracteres, con el recuento entre parentesis.
- **Slug de URL**: 2 alternativas en minusculas y separadas por guiones.
- **Encabezado H1**: 1 propuesta.
- **Palabras clave secundarias**: lista de 8 terminos relacionados.
- **Datos estructurados**: un bloque JSON-LD de schema.org valido y apropiado para el tipo de pagina.

Respeta los limites de caracteres: son el motivo por el que existe este formato.`,
  },

  SOCIAL_SCRIPT: {
    id: ContentType.SOCIAL_SCRIPT,
    slug: 'guion-redes',
    label: 'Guion para redes',
    emoji: '🎬',
    description: 'Guion de video corto para TikTok, Reels o Shorts, con gancho y plano a plano.',
    defaultWords: 320,
    fields: [
      { name: 'topic', label: 'Tema o producto', type: 'text', required: true, placeholder: 'Demostracion del cepillo autolimpiante', maxLength: 160 },
      { name: 'platform', label: 'Plataforma', type: 'select', options: [
        { value: 'tiktok', label: 'TikTok' },
        { value: 'reels', label: 'Instagram Reels' },
        { value: 'shorts', label: 'YouTube Shorts' },
      ] },
      { name: 'duration', label: 'Duracion (segundos)', type: 'select', options: [
        { value: '15', label: '15 segundos' },
        { value: '30', label: '30 segundos' },
        { value: '60', label: '60 segundos' },
      ] },
      { name: 'goal', label: 'Objetivo', type: 'select', options: [
        { value: 'ventas', label: 'Vender el producto' },
        { value: 'alcance', label: 'Maximizar alcance' },
        { value: 'comunidad', label: 'Construir comunidad' },
      ] },
      { name: 'tone', label: 'Tono', type: 'select', options: toneOptions },
    ],
    instructions: (i) => `Escribe un guion de video vertical para ${i.platform || 'TikTok'} de ${i.duration || '30'} segundos.

Tema: ${i.topic}
Objetivo: ${i.goal || 'vender el producto'}

Estructura obligatoria:
1. **Gancho (0-3s)**: 3 alternativas distintas. Debe funcionar sin sonido y dar un motivo para no deslizar.
2. **Desarrollo**: guion plano a plano con marca de tiempo, indicando en cada plano que se ve en pantalla y que se dice.
3. **Cierre y llamada a la accion**.
4. **Texto en pantalla**: rotulos sugeridos por plano.
5. **Descripcion del post** con 5 a 8 hashtags en espanol, mezclando amplios y de nicho.

Reglas: frases cortas, lenguaje hablado real, nada de tono publicitario acartonado. Sin promesas de resultados que no se puedan cumplir.`,
  },

  AD_COPY: {
    id: ContentType.AD_COPY,
    slug: 'anuncios',
    label: 'Textos publicitarios',
    emoji: '📣',
    description: 'Variantes de copy para campanas de Meta Ads o Google Ads listas para testar.',
    defaultWords: 400,
    fields: [
      { name: 'product', label: 'Producto o servicio', type: 'text', required: true, maxLength: 160 },
      { name: 'platform', label: 'Plataforma', type: 'select', options: [
        { value: 'meta', label: 'Meta Ads (Facebook / Instagram)' },
        { value: 'google', label: 'Google Ads (busqueda)' },
      ] },
      { name: 'offer', label: 'Oferta o gancho', type: 'textarea', placeholder: 'Envio gratis, 2x1, garantia de 30 dias...', maxLength: 600 },
      { name: 'tone', label: 'Tono', type: 'select', options: toneOptions },
    ],
    instructions: (i) => `Escribe textos publicitarios para ${i.platform === 'google' ? 'Google Ads (red de busqueda)' : 'Meta Ads'}.

Producto: ${i.product}
${i.offer ? `Oferta o gancho: ${i.offer}` : ''}

${
  i.platform === 'google'
    ? `Devuelve:
- 10 titulos de maximo 30 caracteres (con el recuento entre parentesis).
- 4 descripciones de maximo 90 caracteres (con el recuento).
- 4 extensiones de texto destacado de maximo 25 caracteres.`
    : `Devuelve 4 variantes completas de anuncio. Cada variante con:
- Texto principal (primera linea disenada para sobrevivir al corte de "ver mas").
- Titular de maximo 40 caracteres.
- Descripcion de maximo 30 caracteres.
- Llamada a la accion sugerida.
Las 4 variantes deben atacar angulos psicologicos distintos (problema, deseo, prueba social, objecion).`
}

Reglas: cumple los limites de caracteres, no uses afirmaciones absolutas ("el mejor", "garantizado") ni nada que incumpla las politicas publicitarias.`,
  },

  EMAIL_CAMPAIGN: {
    id: ContentType.EMAIL_CAMPAIGN,
    slug: 'email',
    label: 'Email de campana',
    emoji: '✉️',
    description: 'Email de venta o newsletter con asuntos alternativos listos para testar.',
    defaultWords: 450,
    fields: [
      { name: 'goal', label: 'Objetivo del email', type: 'text', required: true, placeholder: 'Anunciar rebajas de verano', maxLength: 160 },
      { name: 'context', label: 'Contenido y detalles', type: 'textarea', required: true, placeholder: 'Productos, descuentos, fechas, condiciones', maxLength: 1500 },
      { name: 'segment', label: 'Segmento', type: 'select', options: [
        { value: 'nuevos', label: 'Suscriptores nuevos' },
        { value: 'clientes', label: 'Clientes que ya han comprado' },
        { value: 'inactivos', label: 'Inactivos / recuperacion' },
        { value: 'carrito', label: 'Carrito abandonado' },
      ] },
      { name: 'tone', label: 'Tono', type: 'select', options: toneOptions },
    ],
    instructions: (i) => `Escribe un email de campana para el segmento "${i.segment || 'clientes'}".

Objetivo: ${i.goal}
Detalles: ${i.context}

Devuelve:
1. **Asuntos**: 5 alternativas de maximo 50 caracteres, con el recuento entre parentesis.
2. **Preheader**: 2 alternativas de maximo 90 caracteres.
3. **Cuerpo del email** en parrafos cortos, con una unica llamada a la accion clara y repetida al final.
4. **Version corta** del mismo email para movil, de maximo 120 palabras.

Reglas: nada de asuntos con mayusculas sostenidas ni exceso de signos de exclamacion (activan filtros de spam). No prometas plazos ni condiciones que no se hayan indicado.`,
  },

  FAQ: {
    id: ContentType.FAQ,
    slug: 'faq',
    label: 'Preguntas frecuentes',
    emoji: '❓',
    description: 'Bloque de FAQ que resuelve objeciones de compra y gana espacio en Google.',
    defaultWords: 500,
    fields: [
      { name: 'subject', label: 'Producto, servicio o pagina', type: 'text', required: true, maxLength: 160 },
      { name: 'context', label: 'Informacion disponible', type: 'textarea', required: true, placeholder: 'Envios, devoluciones, garantia, uso, compatibilidad...', maxLength: 1500 },
      { name: 'count', label: 'Numero de preguntas', type: 'select', options: [
        { value: '5', label: '5 preguntas' },
        { value: '8', label: '8 preguntas' },
        { value: '12', label: '12 preguntas' },
      ] },
    ],
    instructions: (i) => `Escribe un bloque de preguntas frecuentes con ${i.count || '8'} preguntas.

Tema: ${i.subject}
Informacion disponible: ${i.context}

Reglas:
- Las preguntas deben estar redactadas tal y como las escribiria un cliente en Google, no como las escribiria la empresa.
- Prioriza las que bloquean una compra: plazos de envio, devoluciones, garantia, compatibilidad, precio.
- Respuestas de 2 a 4 frases, directas, sin rodeos comerciales.
- No inventes politicas de envio, plazos ni condiciones: si no constan en la informacion aportada, redacta la respuesta indicando donde consultarlo.
- Al final, incluye el bloque JSON-LD de tipo FAQPage listo para pegar.`,
  },
};

export const CONTENT_TYPE_LIST: ContentTypeDef[] = [
  CONTENT_TYPES.PRODUCT_DESCRIPTION,
  CONTENT_TYPES.SOCIAL_SCRIPT,
  CONTENT_TYPES.BLOG_ARTICLE,
  CONTENT_TYPES.SEO_METADATA,
  CONTENT_TYPES.AD_COPY,
  CONTENT_TYPES.EMAIL_CAMPAIGN,
  CONTENT_TYPES.FAQ,
];

export function contentTypeBySlug(slug: string): ContentTypeDef | undefined {
  return CONTENT_TYPE_LIST.find((t) => t.slug === slug);
}

export function contentTypeLabel(type: ContentType): string {
  return CONTENT_TYPES[type]?.label ?? type;
}
