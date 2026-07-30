import "server-only";

import Anthropic from "@anthropic-ai/sdk";
import { z } from "zod";
import { getEnv, hasAI } from "../env";
import { PRODUCT_CATALOG } from "../valuation/catalog";
import type { ExtractedAttributes } from "../valuation/types";

/**
 * Capa de IA: identificación de producto y lectura de imágenes.
 *
 * Qué hace la IA y qué NO hace:
 *  - SÍ: leer el anuncio y las capturas, y devolver los atributos observados
 *    (modelo, capacidad, color, estado, accesorios, daños visibles).
 *  - NO: estimar precios ni puntuaciones. Todas las cifras del informe las
 *    calcula el motor determinista sobre el catálogo de referencia. La IA no
 *    puede inventar un valor de mercado porque nunca se le pide uno.
 *
 * Credencial necesaria: ANTHROPIC_API_KEY (https://console.anthropic.com).
 * Sin ella la aplicación sigue funcionando con el extractor por reglas y el
 * informe lo indica en el apartado de procedencia de los datos.
 */

/** Esquema de lo que se le permite devolver a la IA. Nada más entra al motor. */
const aiAttributesSchema = z.object({
  slug: z.string().nullable(),
  brand: z.string().nullable(),
  model: z.string().nullable(),
  storageGb: z.number().int().positive().nullable(),
  color: z.string().nullable(),
  condition: z.enum(["new", "like_new", "good", "fair", "poor"]).nullable(),
  batteryHealth: z.number().int().min(1).max(100).nullable(),
  accessories: z.array(z.string()).max(15),
  damages: z.array(z.string()).max(15),
  askingCents: z.number().int().positive().nullable(),
  location: z.string().nullable(),
  /** Observaciones de las imágenes: daños o detalles que el texto no menciona. */
  visualFindings: z.array(z.string()).max(10),
  /** Citas textuales del anuncio que respaldan cada dato. */
  evidence: z
    .array(z.object({ field: z.string(), quote: z.string() }))
    .max(20),
});

export type AIAttributes = z.infer<typeof aiAttributesSchema>;

export interface AIResult {
  attributes: Partial<ExtractedAttributes>;
  visualFindings: string[];
  model: string;
  usedFor: ("extraction" | "vision")[];
}

export interface AIImageInput {
  /** Contenido en base64, sin el prefijo `data:`. */
  base64: string;
  mediaType: "image/jpeg" | "image/png" | "image/webp" | "image/gif";
}

/** Lista compacta de modelos válidos: obliga a la IA a elegir uno del catálogo. */
function catalogPrompt(): string {
  return PRODUCT_CATALOG.map((p) => `${p.slug} = ${p.brand} ${p.model}`).join("\n");
}

const SYSTEM_PROMPT = `Eres el módulo de extracción de datos de DealScan AI, una herramienta que analiza anuncios de productos electrónicos de segunda mano en España.

Tu ÚNICA tarea es leer el anuncio (texto y/o imágenes) y devolver los datos objetivos que observas.

REGLAS ESTRICTAS:
1. NO estimes precios de mercado, valoraciones ni puntuaciones. Eso lo calcula otro módulo. El único precio que devuelves es el que el vendedor pide, si aparece.
2. NO inventes datos. Si algo no aparece en el anuncio, devuelve null o una lista vacía. Es mejor un campo vacío que un dato supuesto.
3. Para "slug" debes elegir EXACTAMENTE uno de los identificadores de la lista de catálogo. Si el producto del anuncio no está en la lista, devuelve null. No inventes identificadores.
4. Para "condition" usa el estado que el vendedor declara. Si describe un defecto grave (pantalla rota, no enciende, mojado), usa "poor" aunque el vendedor diga otra cosa.
5. En "damages" incluye solo daños concretos mencionados en el texto O visibles claramente en las imágenes. En "visualFindings" describe lo que ves en las imágenes que el texto NO menciona (por ejemplo: "grieta en la esquina inferior derecha de la pantalla, visible en la segunda captura").
6. En "evidence" copia fragmentos literales del anuncio que respalden los campos que rellenas.
7. "askingCents" en céntimos de euro (450 € = 45000).
8. "accessories" en español y con estas etiquetas exactas cuando apliquen: "Caja original", "Cargador", "Cable", "Auriculares", "Funda", "Protector de pantalla", "Factura de compra", "Garantía vigente", "Mando adicional", "Juegos incluidos", "Teclado / Apple Pencil".

Responde ÚNICAMENTE con un objeto JSON válido, sin texto adicional ni bloques de código.

CATÁLOGO DE MODELOS VÁLIDOS (slug = nombre):
${catalogPrompt()}`;

let client: Anthropic | null = null;

function getClient(): Anthropic {
  if (!client) {
    const env = getEnv();
    if (!env.ANTHROPIC_API_KEY) {
      throw new AIUnavailableError();
    }
    client = new Anthropic({ apiKey: env.ANTHROPIC_API_KEY, maxRetries: 2 });
  }
  return client;
}

export class AIUnavailableError extends Error {
  constructor() {
    super(
      "La integración de IA no está configurada. Añade ANTHROPIC_API_KEY a las variables de entorno (se obtiene en https://console.anthropic.com). Mientras no esté, el análisis usa el extractor por reglas.",
    );
    this.name = "AIUnavailableError";
  }
}

/**
 * Extrae los atributos del anuncio con Claude. Devuelve null si la IA no está
 * configurada o si la respuesta no cumple el esquema: en ambos casos el análisis
 * continúa con el extractor determinista, nunca con datos inventados.
 */
export async function extractWithAI(args: {
  text: string;
  images?: AIImageInput[];
  signal?: AbortSignal;
}): Promise<AIResult | null> {
  if (!hasAI()) return null;

  const env = getEnv();
  const images = args.images ?? [];

  const content: Anthropic.MessageParam["content"] = [];

  for (const [index, image] of images.entries()) {
    content.push({
      type: "text",
      text: `Captura ${index + 1} del anuncio:`,
    });
    content.push({
      type: "image",
      source: { type: "base64", media_type: image.mediaType, data: image.base64 },
    });
  }

  content.push({
    type: "text",
    text: args.text.trim().length > 0
      ? `Texto del anuncio:\n\n${args.text.trim()}`
      : "El anuncio no incluye texto: extrae todo lo que puedas de las imágenes.",
  });

  try {
    const response = await getClient().messages.create(
      {
        model: env.ANTHROPIC_MODEL,
        max_tokens: 2048,
        temperature: 0,
        system: SYSTEM_PROMPT,
        messages: [{ role: "user", content }],
      },
      { signal: args.signal },
    );

    const raw = response.content
      .filter((block): block is Anthropic.TextBlock => block.type === "text")
      .map((block) => block.text)
      .join("");

    const parsed = parseJsonObject(raw);
    if (!parsed) return null;

    const validated = aiAttributesSchema.safeParse(parsed);
    if (!validated.success) return null;

    const data = validated.data;
    const usedFor: ("extraction" | "vision")[] = ["extraction"];
    if (images.length > 0) usedFor.push("vision");

    return {
      model: env.ANTHROPIC_MODEL,
      usedFor,
      visualFindings: data.visualFindings,
      attributes: {
        slug: data.slug,
        brand: data.brand,
        model: data.model,
        storageGb: data.storageGb,
        color: data.color,
        condition: data.condition,
        conditionClaims: data.condition ? [data.condition] : [],
        batteryHealth: data.batteryHealth,
        accessories: data.accessories,
        // Los hallazgos visuales entran como daños detectados por imagen.
        damages: [...data.damages, ...data.visualFindings],
        askingCents: data.askingCents,
        location: data.location,
        evidence: data.evidence,
      },
    };
  } catch (error) {
    // Un fallo de la IA no puede tumbar el análisis: se degrada al motor de
    // reglas y el informe indica que la IA no participó.
    console.error("[dealscan] extracción con IA fallida:", error);
    return null;
  }
}

/** Extrae el primer objeto JSON de una respuesta de texto. */
function parseJsonObject(raw: string): unknown | null {
  const trimmed = raw.trim().replace(/^```(?:json)?/i, "").replace(/```$/, "").trim();
  const start = trimmed.indexOf("{");
  const end = trimmed.lastIndexOf("}");
  if (start === -1 || end === -1 || end <= start) return null;
  try {
    return JSON.parse(trimmed.slice(start, end + 1));
  } catch {
    return null;
  }
}
