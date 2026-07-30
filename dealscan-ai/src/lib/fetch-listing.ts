import "server-only";

import { lookup } from "node:dns/promises";
import { isIP } from "node:net";

/**
 * Descarga el contenido de un anuncio a partir de su URL y lo convierte en texto.
 *
 * Seguridad (SSRF): la URL la controla el usuario, así que antes de pedir nada
 * se comprueba que:
 *  - el esquema es http/https,
 *  - el host resuelve a una IP pública (no loopback, ni privada, ni link-local,
 *    ni metadatos de cloud como 169.254.169.254),
 *  - no hay redirecciones automáticas: se siguen a mano revalidando cada salto,
 *  - la respuesta es HTML/texto y no excede el tamaño máximo,
 *  - hay un tiempo límite estricto.
 */

const MAX_BYTES = 1_500_000;
const TIMEOUT_MS = 8000;
const MAX_REDIRECTS = 3;
const USER_AGENT = "DealScanAI/1.0 (+https://dealscan.ai/bot)";

export class ListingFetchError extends Error {
  constructor(
    message: string,
    readonly code:
      | "invalid_url"
      | "blocked_host"
      | "timeout"
      | "http_error"
      | "unsupported_content"
      | "too_large"
      | "empty",
  ) {
    super(message);
    this.name = "ListingFetchError";
  }
}

/** Rangos reservados que nunca deben alcanzarse desde el servidor. */
function isPrivateAddress(ip: string): boolean {
  if (isIP(ip) === 4) {
    const parts = ip.split(".").map((p) => Number.parseInt(p, 10));
    const [a = 0, b = 0] = parts;
    if (a === 10) return true; // 10.0.0.0/8
    if (a === 127) return true; // loopback
    if (a === 0) return true; // "this host"
    if (a === 169 && b === 254) return true; // link-local y metadatos de cloud
    if (a === 172 && b >= 16 && b <= 31) return true; // 172.16.0.0/12
    if (a === 192 && b === 168) return true; // 192.168.0.0/16
    if (a === 100 && b >= 64 && b <= 127) return true; // CGNAT 100.64.0.0/10
    if (a >= 224) return true; // multicast y reservado
    return false;
  }

  const normalized = ip.toLowerCase();
  if (normalized === "::1" || normalized === "::") return true;
  if (normalized.startsWith("fe80")) return true; // link-local
  if (normalized.startsWith("fc") || normalized.startsWith("fd")) return true; // ULA
  // IPv4 embebida en IPv6 (::ffff:10.0.0.1)
  const mapped = /::ffff:(\d+\.\d+\.\d+\.\d+)/.exec(normalized);
  if (mapped?.[1]) return isPrivateAddress(mapped[1]);
  return false;
}

async function assertPublicHost(hostname: string): Promise<void> {
  if (isIP(hostname)) {
    if (isPrivateAddress(hostname)) {
      throw new ListingFetchError(
        "Esa dirección apunta a una red interna y no se puede consultar.",
        "blocked_host",
      );
    }
    return;
  }

  let addresses: { address: string }[];
  try {
    addresses = await lookup(hostname, { all: true });
  } catch {
    throw new ListingFetchError(
      `No se ha podido resolver el dominio «${hostname}». Comprueba el enlace.`,
      "invalid_url",
    );
  }

  if (addresses.length === 0) {
    throw new ListingFetchError(
      `El dominio «${hostname}» no resuelve a ninguna dirección.`,
      "invalid_url",
    );
  }

  // Todas las direcciones deben ser públicas: basta una privada para bloquear
  // (defensa frente a DNS rebinding con respuestas mixtas).
  for (const { address } of addresses) {
    if (isPrivateAddress(address)) {
      throw new ListingFetchError(
        "Ese dominio apunta a una red interna y no se puede consultar.",
        "blocked_host",
      );
    }
  }
}

export interface FetchedListing {
  url: string;
  title: string | null;
  text: string;
  /** Bytes descargados, útil para trazas. */
  bytes: number;
}

export async function fetchListing(rawUrl: string): Promise<FetchedListing> {
  let url: URL;
  try {
    url = new URL(rawUrl.trim());
  } catch {
    throw new ListingFetchError("El enlace no es una URL válida.", "invalid_url");
  }

  if (url.protocol !== "http:" && url.protocol !== "https:") {
    throw new ListingFetchError("Solo se admiten enlaces http:// y https://.", "invalid_url");
  }

  let current = url;
  let response: Response | null = null;

  for (let hop = 0; hop <= MAX_REDIRECTS; hop++) {
    await assertPublicHost(current.hostname);

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
    try {
      response = await fetch(current, {
        method: "GET",
        redirect: "manual",
        signal: controller.signal,
        headers: {
          "User-Agent": USER_AGENT,
          Accept: "text/html,application/xhtml+xml,text/plain;q=0.9",
          "Accept-Language": "es-ES,es;q=0.9",
        },
      });
    } catch (error) {
      if (error instanceof Error && error.name === "AbortError") {
        throw new ListingFetchError(
          "El anuncio ha tardado demasiado en responder. Prueba a pegar el texto del anuncio directamente.",
          "timeout",
        );
      }
      throw new ListingFetchError(
        "No se ha podido acceder al enlace. Prueba a pegar el texto del anuncio o una captura.",
        "http_error",
      );
    } finally {
      clearTimeout(timer);
    }

    // Redirección: se revalida el destino antes de seguirla.
    if (response.status >= 300 && response.status < 400) {
      const location = response.headers.get("location");
      if (!location) break;
      try {
        current = new URL(location, current);
      } catch {
        throw new ListingFetchError("La redirección del anuncio no es válida.", "invalid_url");
      }
      if (current.protocol !== "http:" && current.protocol !== "https:") {
        throw new ListingFetchError(
          "La redirección apunta a un protocolo no admitido.",
          "blocked_host",
        );
      }
      continue;
    }
    break;
  }

  if (!response) {
    throw new ListingFetchError("No se ha obtenido respuesta del anuncio.", "http_error");
  }

  if (!response.ok) {
    throw new ListingFetchError(
      `El anuncio ha devuelto un error ${response.status}. Muchas plataformas bloquean la lectura automática: pega el texto del anuncio o sube una captura.`,
      "http_error",
    );
  }

  const contentType = response.headers.get("content-type") ?? "";
  if (!/text\/html|text\/plain|application\/xhtml/i.test(contentType)) {
    throw new ListingFetchError(
      `El enlace no devuelve una página web legible (${contentType || "tipo desconocido"}).`,
      "unsupported_content",
    );
  }

  const declaredLength = Number.parseInt(response.headers.get("content-length") ?? "", 10);
  if (Number.isFinite(declaredLength) && declaredLength > MAX_BYTES) {
    throw new ListingFetchError("La página del anuncio es demasiado grande.", "too_large");
  }

  const html = await readLimited(response, MAX_BYTES);
  const text = htmlToText(html);

  if (text.trim().length < 20) {
    throw new ListingFetchError(
      "La página no contiene texto legible: probablemente carga el anuncio con JavaScript. Pega el texto del anuncio o sube una captura de pantalla.",
      "empty",
    );
  }

  return {
    url: current.toString(),
    title: extractTitle(html),
    text,
    bytes: html.length,
  };
}

/** Lee el cuerpo sin superar el límite de bytes, cortando el stream si hace falta. */
async function readLimited(response: Response, maxBytes: number): Promise<string> {
  if (!response.body) return "";
  const reader = response.body.getReader();
  const decoder = new TextDecoder("utf-8");
  let received = 0;
  let out = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    received += value.byteLength;
    if (received > maxBytes) {
      await reader.cancel();
      out += decoder.decode(value.slice(0, Math.max(0, maxBytes - (received - value.byteLength))));
      break;
    }
    out += decoder.decode(value, { stream: true });
  }
  return out;
}

function extractTitle(html: string): string | null {
  const ogTitle = /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i.exec(html);
  if (ogTitle?.[1]) return decodeEntities(ogTitle[1]).trim().slice(0, 200);
  const title = /<title[^>]*>([\s\S]*?)<\/title>/i.exec(html);
  if (title?.[1]) return decodeEntities(stripTags(title[1])).trim().slice(0, 200);
  return null;
}

/**
 * Convierte HTML en texto plano priorizando el contenido del anuncio: se
 * conservan la descripción de Open Graph y los metadatos de precio, que es
 * donde las plataformas de segunda mano publican los datos estructurados.
 */
export function htmlToText(html: string): string {
  const chunks: string[] = [];

  const metas = [
    /<meta[^>]+property=["']og:title["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']og:description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+name=["']description["'][^>]+content=["']([^"']+)["']/i,
    /<meta[^>]+property=["']product:price:amount["'][^>]+content=["']([^"']+)["']/i,
  ];
  for (const re of metas) {
    const m = re.exec(html);
    if (m?.[1]) chunks.push(decodeEntities(m[1]));
  }

  // Datos estructurados JSON-LD: nombre, descripción y precio del producto.
  const jsonLd = /<script[^>]+type=["']application\/ld\+json["'][^>]*>([\s\S]*?)<\/script>/gi;
  let ld: RegExpExecArray | null;
  while ((ld = jsonLd.exec(html)) !== null) {
    const body = ld[1];
    if (!body) continue;
    try {
      const data = JSON.parse(body.trim());
      collectJsonLd(data, chunks);
    } catch {
      // JSON-LD malformado: se ignora.
    }
  }

  const body = html
    .replace(/<script[\s\S]*?<\/script>/gi, " ")
    .replace(/<style[\s\S]*?<\/style>/gi, " ")
    .replace(/<noscript[\s\S]*?<\/noscript>/gi, " ")
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<(br|\/p|\/div|\/li|\/h[1-6])>/gi, "\n")
    .replace(/<[^>]+>/g, " ");

  chunks.push(decodeEntities(body));

  return chunks
    .join("\n")
    .replace(/[ \t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.length > 0)
    .join("\n")
    .slice(0, 12_000);
}

function collectJsonLd(node: unknown, out: string[], depth = 0): void {
  if (depth > 6 || node == null) return;
  if (Array.isArray(node)) {
    for (const item of node) collectJsonLd(item, out, depth + 1);
    return;
  }
  if (typeof node !== "object") return;

  const record = node as Record<string, unknown>;
  for (const key of ["name", "description", "price", "color", "itemCondition", "model"]) {
    const value = record[key];
    if (typeof value === "string" && value.trim().length > 0) out.push(`${key}: ${value}`);
    if (typeof value === "number") out.push(`${key}: ${value}`);
  }
  for (const value of Object.values(record)) {
    if (typeof value === "object") collectJsonLd(value, out, depth + 1);
  }
}

function stripTags(input: string): string {
  return input.replace(/<[^>]+>/g, " ");
}

function decodeEntities(input: string): string {
  return input
    .replace(/&nbsp;/gi, " ")
    .replace(/&amp;/gi, "&")
    .replace(/&lt;/gi, "<")
    .replace(/&gt;/gi, ">")
    .replace(/&quot;/gi, '"')
    .replace(/&#0?39;|&apos;/gi, "'")
    .replace(/&euro;/gi, "€")
    .replace(/&#(\d+);/g, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 10)))
    .replace(/&#x([0-9a-f]+);/gi, (_, code: string) => String.fromCodePoint(Number.parseInt(code, 16)));
}
