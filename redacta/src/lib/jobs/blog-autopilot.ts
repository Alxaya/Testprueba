import { prisma } from '@/lib/prisma';
import { getAnthropic, MODEL, SYSTEM_CORE } from '@/lib/ai/client';
import { features } from '@/lib/env';
import { markdownToPlain } from '@/lib/markdown';
import { readingMinutes, slugify, truncate } from '@/lib/utils';
import type { JobResult } from './index';

/**
 * Blog automatico.
 *
 * Es marketing de contenidos que se ejecuta solo: cada vez que corre, elige el
 * siguiente tema del calendario editorial que aun no se ha publicado, lo
 * escribe con nuestro propio motor y lo publica.
 *
 * El calendario esta escrito a mano a proposito: los temas se eligen por
 * intencion de busqueda real, no los inventa el modelo.
 */

type Topic = {
  keyword: string;
  title: string;
  angle: string;
  tags: string[];
  emoji: string;
};

export const EDITORIAL_CALENDAR: Topic[] = [
  {
    keyword: 'como escribir fichas de producto que vendan',
    title: 'Como escribir fichas de producto que vendan (con estructura y ejemplos)',
    angle:
      'Explicar la estructura que convierte: problema, beneficios, especificaciones, prueba y llamada a la accion. Con ejemplos de antes y despues.',
    tags: ['ecommerce', 'copywriting'],
    emoji: '🛍️',
  },
  {
    keyword: 'errores seo tienda online',
    title: '9 errores de SEO que cometen casi todas las tiendas online espanolas',
    angle:
      'Errores concretos y como corregirlos: titles duplicados, categorias sin texto, fichas copiadas del proveedor, paginacion mal resuelta.',
    tags: ['seo', 'ecommerce'],
    emoji: '🔍',
  },
  {
    keyword: 'guiones tiktok para tiendas',
    title: 'Guiones de TikTok para tiendas online: 7 estructuras que funcionan',
    angle:
      'Siete estructuras de video corto aplicadas a producto fisico, con el gancho de los tres primeros segundos desarrollado.',
    tags: ['redes sociales', 'contenido'],
    emoji: '🎬',
  },
  {
    keyword: 'meta descripcion perfecta',
    title: 'La meta descripcion perfecta: longitud, formula y ejemplos reales',
    angle:
      'Que caracteres cuentan de verdad, por que Google la reescribe y como redactarla para ganar clics.',
    tags: ['seo'],
    emoji: '📝',
  },
  {
    keyword: 'email carrito abandonado',
    title: 'Emails de carrito abandonado: la secuencia de 3 correos que recupera ventas',
    angle:
      'Tiempos de envio, asunto de cada correo, que decir y que no, y cuando conviene incluir descuento.',
    tags: ['email marketing', 'ecommerce'],
    emoji: '✉️',
  },
  {
    keyword: 'contenido con ia sin que parezca ia',
    title: 'Contenido con IA sin que parezca IA: guia practica',
    angle:
      'Las senales que delatan un texto generado y como evitarlas: aperturas de relleno, adjetivos vacios, estructuras repetidas y datos inventados.',
    tags: ['ia', 'contenido'],
    emoji: '🤖',
  },
  {
    keyword: 'preguntas frecuentes tienda online',
    title: 'Como escribir las FAQ de tu tienda para resolver objeciones (y aparecer en Google)',
    angle:
      'Que preguntas incluir segun las objeciones que bloquean la compra y como marcarlas con datos estructurados.',
    tags: ['seo', 'ecommerce'],
    emoji: '❓',
  },
  {
    keyword: 'calendario de contenido para ecommerce',
    title: 'Calendario de contenido para ecommerce: como planificar un mes en una tarde',
    angle:
      'Metodo de reparto por formatos y canales, con una plantilla mensual concreta y realista para una tienda pequena.',
    tags: ['contenido', 'productividad'],
    emoji: '🗓️',
  },
];

/** Genera y publica el siguiente articulo pendiente del calendario. */
export async function generateBlogPost(): Promise<JobResult> {
  if (!features.ai) {
    return {
      job: 'blog-autopilot',
      ok: false,
      processed: 0,
      details: 'ANTHROPIC_API_KEY no configurada: no se puede generar el articulo.',
    };
  }

  const existing = await prisma.blogPost.findMany({ select: { slug: true } });
  const publishedSlugs = new Set(existing.map((p) => p.slug));

  const topic = EDITORIAL_CALENDAR.find((t) => !publishedSlugs.has(slugify(t.title)));

  if (!topic) {
    return {
      job: 'blog-autopilot',
      ok: true,
      processed: 0,
      details: 'El calendario editorial esta al dia: no quedan temas pendientes.',
    };
  }

  const prompt = `Escribe un articulo completo para el blog de Redacta.

Titulo: ${topic.title}
Palabra clave principal: ${topic.keyword}
Enfoque: ${topic.angle}

Estructura obligatoria:
1. Entradilla de 2-3 frases que responda de inmediato a la intencion de busqueda. Sin encabezado H1: el titulo ya se muestra aparte.
2. Entre 5 y 7 secciones con encabezado H2.
3. Al menos una lista y una tabla comparativa.
4. Ejemplos concretos aplicados a una tienda online espanola.
5. Un cierre con 3 acciones que el lector pueda hacer hoy mismo.

Longitud: entre 1.100 y 1.400 palabras. No menciones a Redacta mas de una vez y solo si viene a cuento.`;

  try {
    const stream = getAnthropic().messages.stream({
      model: MODEL,
      max_tokens: 8000,
      output_config: { effort: 'medium' },
      system: [
        { type: 'text', text: SYSTEM_CORE, cache_control: { type: 'ephemeral' } },
        {
          type: 'text',
          text: 'Escribes para el blog de Redacta: publico de tiendas online y pymes espanolas, nivel intermedio. Tono practico y directo, sin vender la herramienta.',
        },
      ],
      messages: [{ role: 'user', content: prompt }],
    });

    const message = await stream.finalMessage();

    if (message.stop_reason === 'refusal') {
      return {
        job: 'blog-autopilot',
        ok: false,
        processed: 0,
        details: 'El modelo rechazo la peticion.',
      };
    }

    const contentMd = message.content
      .filter((b): b is Extract<typeof b, { type: 'text' }> => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    if (!contentMd) throw new Error('Respuesta vacia del modelo.');

    const plain = markdownToPlain(contentMd);
    const excerpt = truncate(plain, 180);

    const post = await prisma.blogPost.create({
      data: {
        slug: slugify(topic.title),
        title: topic.title,
        excerpt,
        contentMd,
        tags: topic.tags,
        coverEmoji: topic.emoji,
        seoTitle: truncate(topic.title, 60),
        seoDescription: truncate(plain, 155),
        readingMinutes: readingMinutes(contentMd),
        generatedByAi: true,
        published: true,
        publishedAt: new Date(),
      },
    });

    return {
      job: 'blog-autopilot',
      ok: true,
      processed: 1,
      details: `Publicado "${post.title}" (/blog/${post.slug}).`,
    };
  } catch (error) {
    const message = error instanceof Error ? error.message : 'error desconocido';
    console.error('[blog-autopilot] fallo la generacion', error);
    return { job: 'blog-autopilot', ok: false, processed: 0, details: message };
  }
}
