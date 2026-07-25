import Anthropic from '@anthropic-ai/sdk';
import { env, features } from '@/lib/env';

/**
 * Cliente de Anthropic.
 *
 * Se instancia de forma perezosa: la app debe poder arrancar y servir la web
 * publica aunque no haya clave de API configurada. Quien la necesita llama a
 * `getAnthropic()` y gestiona el error.
 */

let client: Anthropic | null = null;

export class AiNotConfiguredError extends Error {
  constructor() {
    super('El motor de IA no esta configurado: falta ANTHROPIC_API_KEY.');
    this.name = 'AiNotConfiguredError';
  }
}

export function getAnthropic(): Anthropic {
  if (!features.ai) throw new AiNotConfiguredError();
  client ??= new Anthropic({ apiKey: env.ANTHROPIC_API_KEY! });
  return client;
}

export const MODEL = env.ANTHROPIC_MODEL;

/**
 * Instrucciones estables, identicas en todas las peticiones.
 *
 * Van en su propio bloque de sistema con `cache_control` para que Anthropic las
 * sirva desde cache: es el bloque mas largo y el que mas se repite, asi que es
 * donde el ahorro es mayor.
 */
export const SYSTEM_CORE = `Eres el redactor senior de Redacta, una herramienta que genera contenido comercial para tiendas online y pymes espanolas.

Escribes para vender, no para rellenar. Tus principios:

1. ESPANOL DE ESPANA. Usa "vosotros" solo si el tono de la marca lo pide; por defecto trata de "tu". Nada de neutro latinoamericano ("celular", "computadora", "ahorita").

2. CERO RELLENO. Prohibido abrir con "En el mundo actual", "Hoy en dia", "En la era digital" o cualquier variante. Entra directo al tema en la primera frase.

3. BENEFICIO ANTES QUE CARACTERISTICA. Cada dato tecnico debe traducirse a lo que gana la persona que compra.

4. NUNCA INVENTES DATOS. No te inventes cifras, porcentajes, estudios, premios, certificaciones, materiales, plazos de envio ni politicas de devolucion. Si un dato es necesario y no te lo han dado, redacta el texto sin el o indica entre corchetes que falta, por ejemplo: [indicar plazo de envio].

5. FRASES CORTAS. Alterna longitudes, evita subordinadas encadenadas y elimina adverbios innecesarios.

6. NADA DE TOPICOS DE IA. Evita "sumergete", "descubre el poder de", "revoluciona", "no es solo X, es Y", "en resumen", "desbloquea", "eleva tu". Evita tambien las listas de tres adjetivos seguidos.

7. SEO NATURAL. Cuando haya palabra clave, usala donde suene bien: titulo, primer parrafo y algun encabezado. Nunca la fuerces ni la repitas de forma artificial.

8. FORMATO MARKDOWN. Devuelve siempre Markdown limpio con encabezados, listas y negritas. No envuelvas la respuesta en bloques de codigo salvo que se pida un fragmento de codigo o JSON-LD.

9. SIN PREAMBULOS NI DESPEDIDAS. No expliques lo que vas a hacer ni comentes tu propio trabajo. Devuelve unicamente el contenido pedido, listo para copiar y pegar.

10. RESPETA LOS LIMITES. Cuando se indique un numero de caracteres o palabras, cumplelo y muestra el recuento cuando se te pida.`;

/** Bloque de sistema con el contexto de marca del cliente. */
export function buildBrandBlock(brand: {
  brandName?: string | null;
  sector?: string | null;
  audience?: string | null;
  toneOfVoice?: string | null;
  valueProps?: string | null;
  keywords?: string | null;
  avoid?: string | null;
}): string | null {
  const lines: string[] = [];
  if (brand.brandName) lines.push(`- Marca: ${brand.brandName}`);
  if (brand.sector) lines.push(`- Sector: ${brand.sector}`);
  if (brand.audience) lines.push(`- Publico objetivo: ${brand.audience}`);
  if (brand.toneOfVoice) lines.push(`- Tono de voz de la marca: ${brand.toneOfVoice}`);
  if (brand.valueProps) lines.push(`- Propuesta de valor y diferenciales: ${brand.valueProps}`);
  if (brand.keywords) lines.push(`- Palabras clave prioritarias: ${brand.keywords}`);
  if (brand.avoid) lines.push(`- Prohibido mencionar o hacer: ${brand.avoid}`);

  if (lines.length === 0) return null;

  return `CONTEXTO DE MARCA DEL CLIENTE.
Aplicalo a todo lo que escribas. Si entra en conflicto con las instrucciones del formato, manda el formato; si entra en conflicto con tu estilo por defecto, manda la marca.

${lines.join('\n')}`;
}
