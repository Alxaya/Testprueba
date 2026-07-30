import { PRODUCT_CATALOG, CATALOG_BY_SLUG } from "./catalog";
import type {
  CategoryKey,
  ConditionKey,
  ExtractedAttributes,
  ProductReference,
} from "./types";

/**
 * Extractor determinista de atributos a partir del texto de un anuncio.
 *
 * Su papel en el sistema es doble:
 *  1. Es el **fallback** cuando no hay clave de IA configurada o la llamada falla.
 *  2. Es el **verificador** de lo que devuelve la IA: si la IA dice "256 GB" y el
 *     texto dice "128 GB", el motor detecta la incoherencia (ver `risk.ts`).
 *
 * No inventa datos: cada campo que rellena queda respaldado por la cita textual
 * del anuncio que lo activó (`evidence`).
 */

export function normalize(input: string): string {
  return input
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .replace(/\s+/g, " ")
    .trim();
}

/** Recorta el fragmento del texto original alrededor de una coincidencia. */
function quoteAround(text: string, index: number, length: number): string {
  const start = Math.max(0, index - 40);
  const end = Math.min(text.length, index + length + 40);
  return (start > 0 ? "…" : "") + text.slice(start, end).trim() + (end < text.length ? "…" : "");
}

// ---------------------------------------------------------------------------
// Negaciones
// ---------------------------------------------------------------------------

const NEGATION_MARKER = /\b(sin|no incluye|no tiene|no lleva|no hay|no viene con|falta[n]?|ning[uú]n[ao]?|carece de)\b/g;

/**
 * Cierra el alcance de una negación. "sin caja ni cargador" niega ambos, pero
 * "sin caja, con cargador" solo niega la caja.
 */
const NEGATION_TERMINATOR = /[.;!?¡¿]|\bpero\b|\bincluye\b|\bcon\b|\btiene\b|\baunque\b|\bs[ií] que\b|,(?!\s*(?:ni|y|o)\b)/;

/**
 * Devuelve los tramos del texto que están bajo una negación. Se calcula una vez
 * por texto y se reutiliza para accesorios y daños: así "sin arañazos ni golpes"
 * no cuenta ninguno de los dos, que es lo que dice literalmente el anuncio.
 */
export function negatedSpans(haystack: string): [number, number][] {
  const spans: [number, number][] = [];
  const re = new RegExp(NEGATION_MARKER.source, "g");
  let m: RegExpExecArray | null;
  while ((m = re.exec(haystack)) !== null) {
    const from = m.index + m[0].length;
    const rest = haystack.slice(from);
    const term = NEGATION_TERMINATOR.exec(rest);
    // Sin terminador, la negación alcanza como máximo 60 caracteres: evita que
    // un "sin" al principio del anuncio anule todo el texto.
    const end = from + Math.min(term ? term.index : 60, 60);
    spans.push([m.index, end]);
  }
  return spans;
}

function isNegated(spans: [number, number][], index: number): boolean {
  return spans.some(([start, end]) => index >= start && index <= end);
}

// ---------------------------------------------------------------------------
// Precio
// ---------------------------------------------------------------------------

/**
 * Convierte un número escrito en formato español o inglés a céntimos.
 * "1.299,99" → 129999 · "1,299.99" → 129999 · "450" → 45000
 */
export function parseAmountToCents(raw: string): number | null {
  let s = raw.replace(/\s| /g, "");
  if (!/\d/.test(s)) return null;

  const lastComma = s.lastIndexOf(",");
  const lastDot = s.lastIndexOf(".");

  if (lastComma > -1 && lastDot > -1) {
    // El separador decimal es el que aparece más a la derecha.
    if (lastComma > lastDot) s = s.replace(/\./g, "").replace(",", ".");
    else s = s.replace(/,/g, "");
  } else if (lastComma > -1) {
    const decimals = s.length - lastComma - 1;
    // "1,299" son miles; "45,50" son decimales.
    s = decimals === 3 ? s.replace(/,/g, "") : s.replace(",", ".");
  } else if (lastDot > -1) {
    const decimals = s.length - lastDot - 1;
    s = decimals === 3 ? s.replace(/\./g, "") : s;
  }

  const value = Number.parseFloat(s);
  if (!Number.isFinite(value) || value <= 0) return null;
  return Math.round(value * 100);
}

const PRICE_PATTERNS: RegExp[] = [
  /(?:precio|pvp|vendo\s+por|lo\s+vendo\s+por|pido)\s*[:\-]?\s*([\d.,]+)\s*(?:€|eur|euros?)?/gi,
  /([\d.,]+)\s*(?:€|eur\b|euros?)/gi,
  /(?:€|eur)\s*([\d.,]+)/gi,
];

/** Precio pedido. Descarta cifras que claramente no son el precio del producto. */
export function extractPrice(text: string): { cents: number; quote: string } | null {
  const candidates: { cents: number; quote: string; index: number; priority: number }[] = [];

  PRICE_PATTERNS.forEach((pattern, priority) => {
    const re = new RegExp(pattern.source, pattern.flags);
    let m: RegExpExecArray | null;
    while ((m = re.exec(text)) !== null) {
      const group = m[1];
      if (!group) continue;
      const cents = parseAmountToCents(group);
      if (cents == null) continue;
      // Los importes fuera de este rango no son precios de producto de 2ª mano
      // (suelen ser capacidades, años, códigos postales o números de teléfono).
      if (cents < 1000 || cents > 100_000_00) continue;
      const before = normalize(text.slice(Math.max(0, m.index - 30), m.index));
      // "por 40€ más te llevo...", "gastos de envío 5€" no son el precio.
      if (/(env[ií]o|portes|gastos|comisi[oó]n|garant[ií]a de|financia)/.test(before)) continue;
      candidates.push({ cents, quote: quoteAround(text, m.index, m[0].length), index: m.index, priority });
    }
  });

  if (candidates.length === 0) return null;
  // Se prioriza el patrón más explícito ("precio: X") y, dentro del mismo
  // patrón, la primera aparición: en los anuncios el precio va al principio.
  candidates.sort((a, b) => a.priority - b.priority || a.index - b.index);
  const best = candidates[0]!;
  return { cents: best.cents, quote: best.quote };
}

// ---------------------------------------------------------------------------
// Modelo y marca
// ---------------------------------------------------------------------------

interface ModelMatch {
  reference: ProductReference;
  quote: string;
  matchedAlias: string;
}

/**
 * Identifica el modelo buscando alias del catálogo en el texto.
 * Gana el alias más largo: así "iphone 13 pro max" no se confunde con "iphone 13".
 */
export function matchModel(text: string): ModelMatch | null {
  const haystack = normalize(text);
  let best: { ref: ProductReference; alias: string; index: number } | null = null;

  for (const ref of PRODUCT_CATALOG) {
    const aliases = [normalize(`${ref.brand} ${ref.model}`), normalize(ref.model), ...ref.aliases.map(normalize)];
    for (const alias of aliases) {
      if (alias.length < 3) continue;
      // Coincidencia por límites de palabra para evitar falsos positivos
      // como "s21" dentro de "s215".
      const re = new RegExp(`(?<![a-z0-9])${escapeRegExp(alias)}(?![a-z0-9])`);
      const m = re.exec(haystack);
      if (!m) continue;
      if (!best || alias.length > best.alias.length) {
        best = { ref, alias, index: m.index };
      }
    }
  }

  if (!best) return null;
  return {
    reference: best.ref,
    matchedAlias: best.alias,
    quote: quoteAround(haystack, best.index, best.alias.length),
  };
}

function escapeRegExp(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

/** Marca detectada aunque el modelo exacto no esté en catálogo. */
const BRAND_HINTS: { brand: string; category: CategoryKey; patterns: RegExp }[] = [
  { brand: "Apple", category: "phone", patterns: /\biphone\b/ },
  { brand: "Apple", category: "tablet", patterns: /\bipad\b/ },
  { brand: "Apple", category: "laptop", patterns: /\bmacbook\b/ },
  { brand: "Apple", category: "watch", patterns: /\bapple watch\b/ },
  { brand: "Samsung", category: "phone", patterns: /\b(galaxy s\d|galaxy a\d|galaxy z)\b/ },
  { brand: "Samsung", category: "tablet", patterns: /\bgalaxy tab\b/ },
  { brand: "Samsung", category: "watch", patterns: /\bgalaxy watch\b/ },
  { brand: "Xiaomi", category: "phone", patterns: /\b(xiaomi|redmi|poco)\b/ },
  { brand: "Google", category: "phone", patterns: /\bpixel\b/ },
  { brand: "OnePlus", category: "phone", patterns: /\bone\s?plus\b/ },
  { brand: "Sony", category: "console", patterns: /\b(ps4|ps5|playstation)\b/ },
  { brand: "Microsoft", category: "console", patterns: /\bxbox\b/ },
  { brand: "Nintendo", category: "console", patterns: /\b(switch|nintendo)\b/ },
  { brand: "Valve", category: "console", patterns: /\bsteam deck\b/ },
  { brand: "Dell", category: "laptop", patterns: /\bdell\b/ },
  { brand: "Lenovo", category: "laptop", patterns: /\b(lenovo|thinkpad|ideapad)\b/ },
  { brand: "HP", category: "laptop", patterns: /\b(hp|pavilion|omen|envy)\b/ },
  { brand: "Asus", category: "laptop", patterns: /\b(asus|vivobook|zenbook|rog)\b/ },
  { brand: "Acer", category: "laptop", patterns: /\b(acer|aspire|nitro)\b/ },
  { brand: "MSI", category: "laptop", patterns: /\bmsi\b/ },
  { brand: "Huawei", category: "laptop", patterns: /\bmatebook\b/ },
];

export function guessBrand(text: string): { brand: string; category: CategoryKey } | null {
  const haystack = normalize(text);
  for (const hint of BRAND_HINTS) {
    if (hint.patterns.test(haystack)) return { brand: hint.brand, category: hint.category };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Almacenamiento, color, estado
// ---------------------------------------------------------------------------

export function extractStorage(text: string): { gb: number; quote: string } | null {
  const re = /(\d{2,4})\s?(gb|g\b|tb)\b/gi;
  let m: RegExpExecArray | null;
  const found: { gb: number; quote: string }[] = [];
  while ((m = re.exec(text)) !== null) {
    const n = Number.parseInt(m[1]!, 10);
    const unit = m[2]!.toLowerCase();
    const gb = unit === "tb" ? n * 1024 : n;
    // Solo capacidades reales de producto.
    if (![16, 32, 64, 128, 256, 512, 825, 1024, 2048, 4096].includes(gb)) continue;
    // "8 GB de RAM" no es almacenamiento.
    const after = normalize(text.slice(m.index + m[0].length, m.index + m[0].length + 15));
    if (/^\s*(de\s+)?ram/.test(after)) continue;
    found.push({ gb, quote: quoteAround(text, m.index, m[0].length) });
  }
  if (found.length === 0) return null;
  // Con varias capacidades, la mayor suele ser el almacenamiento (la menor, la RAM).
  found.sort((a, b) => b.gb - a.gb);
  return found[0]!;
}

const COLORS: { key: string; label: string; patterns: RegExp }[] = [
  { key: "black", label: "Negro", patterns: /\b(negro|black|space black|negro espacial|medianoche|midnight|grafito|graphite)\b/ },
  { key: "white", label: "Blanco", patterns: /\b(blanco|white|starlight|blanco estrella|plata|silver)\b/ },
  { key: "blue", label: "Azul", patterns: /\b(azul|blue|sierra blue|azul alpino|pacific blue)\b/ },
  { key: "green", label: "Verde", patterns: /\b(verde|green|alpine green)\b/ },
  { key: "red", label: "Rojo", patterns: /\b(rojo|red|product red)\b/ },
  { key: "purple", label: "Morado", patterns: /\b(morado|purpura|violeta|purple|lila|lavanda)\b/ },
  { key: "pink", label: "Rosa", patterns: /\b(rosa|pink)\b/ },
  { key: "yellow", label: "Amarillo", patterns: /\b(amarillo|yellow)\b/ },
  { key: "gold", label: "Oro", patterns: /\b(oro|dorado|gold)\b/ },
  { key: "titanium", label: "Titanio", patterns: /\b(titanio|titanium|desert titanium|titanio natural)\b/ },
  { key: "gray", label: "Gris", patterns: /\b(gris|gray|grey|space gray|gris espacial)\b/ },
  { key: "orange", label: "Naranja", patterns: /\b(naranja|orange)\b/ },
];

export function extractColor(text: string): { key: string; label: string; quote: string } | null {
  const haystack = normalize(text);
  for (const color of COLORS) {
    const m = color.patterns.exec(haystack);
    if (m) {
      return { key: color.key, label: color.label, quote: quoteAround(haystack, m.index, m[0].length) };
    }
  }
  return null;
}

/**
 * Reglas de estado, clasificadas por tipo de afirmación:
 *  - `explicit`: el vendedor declara el estado ("buen estado", "precintado").
 *  - `inferred`: se deduce de un desperfecto menor ("algún arañazo").
 *  - `severe`:   defecto grave que manda sobre cualquier declaración.
 *
 * El orden importa: "buen estado con algún arañazo mínimo" es buen estado —el
 * arañazo ya está implícito en esa declaración—, mientras que "como nuevo pero
 * con la pantalla rota" es un producto roto por mucho que diga «como nuevo».
 */
type ConditionEvidenceKind = "explicit" | "inferred" | "severe";

const CONDITION_RULES: {
  condition: ConditionKey;
  patterns: RegExp;
  score: number;
  kind: ConditionEvidenceKind;
}[] = [
  { condition: "new", kind: "explicit", score: 5, patterns: /\b(precintad[oa]|sin abrir|nuevo a estrenar|sellad[oa]|nuevo sin usar|new sealed)\b/ },
  { condition: "like_new", kind: "explicit", score: 4, patterns: /\b(como nuevo|impecable|perfecto estado|estado impecable|sin un rasgu[nñ]o|10\/10|a estrenar|apenas usado)\b/ },
  { condition: "good", kind: "explicit", score: 3, patterns: /\b(buen estado|muy buen estado|bien cuidado|funciona perfectamente|9\/10|8\/10|se[nñ]ales m[ií]nimas)\b/ },
  { condition: "fair", kind: "explicit", score: 2, patterns: /\b(estado aceptable|estado regular|bastante usad[oa]|7\/10|6\/10)\b/ },
  { condition: "fair", kind: "inferred", score: 2, patterns: /\b(se[nñ]ales de uso|usad[oa] con marcas|marcas de uso|algun ara[nñ]azo|algunos ara[nñ]azos)\b/ },
  { condition: "poor", kind: "severe", score: 1, patterns: /\b(para piezas|no funciona|pantalla rota|averiad[oa]|no enciende|no arranca|placa da[nñ]ada)\b/ },
  { condition: "poor", kind: "inferred", score: 1, patterns: /\b(muy usado|golpead[oa]|mal estado)\b/ },
];

export function extractCondition(
  text: string,
): { condition: ConditionKey; quote: string; claims: ConditionKey[] } | null {
  const haystack = normalize(text);
  // El estado peor detectado manda para valorar: si dice "como nuevo" pero
  // "pantalla rota", el producto está roto y así se valora.
  // Se guardan además TODAS las afirmaciones de estado encontradas: la
  // diferencia entre lo que el vendedor afirma y lo que describe es
  // precisamente la incoherencia que hay que enseñar al usuario.
  const matches: {
    condition: ConditionKey;
    quote: string;
    score: number;
    kind: ConditionEvidenceKind;
  }[] = [];

  for (const rule of CONDITION_RULES) {
    const m = rule.patterns.exec(haystack);
    if (!m) continue;
    matches.push({
      condition: rule.condition,
      quote: quoteAround(haystack, m.index, m[0].length),
      score: rule.score,
      kind: rule.kind,
    });
  }
  if (matches.length === 0) return null;

  const claims = [...new Set(matches.map((m) => m.condition))];
  const worstOf = (kind: ConditionEvidenceKind) =>
    matches.filter((m) => m.kind === kind).sort((a, b) => a.score - b.score)[0];

  // Un defecto grave manda sobre cualquier declaración del vendedor. Si no hay
  // ninguno, la declaración explícita gana a lo simplemente deducido.
  const chosen = worstOf("severe") ?? worstOf("explicit") ?? worstOf("inferred")!;

  return { condition: chosen.condition, quote: chosen.quote, claims };
}

export function extractBatteryHealth(text: string): { pct: number; quote: string } | null {
  const re = /(?:bater[ií]a|battery|salud)[^\d%]{0,25}(\d{2,3})\s?%|(\d{2,3})\s?%[^\d]{0,15}(?:bater[ií]a|battery|salud)/i;
  const m = re.exec(text);
  if (!m) return null;
  const pct = Number.parseInt((m[1] ?? m[2])!, 10);
  if (pct < 1 || pct > 100) return null;
  return { pct, quote: quoteAround(text, m.index, m[0].length) };
}

const ACCESSORY_RULES: { label: string; patterns: RegExp }[] = [
  { label: "Caja original", patterns: /\b(caja original|con caja|en su caja|caja incluida)\b/ },
  { label: "Cargador", patterns: /\b(cargador|adaptador de corriente|con cargador)\b/ },
  { label: "Cable", patterns: /\b(cable|cable de carga|cable usb|cable lightning|cable tipo c)\b/ },
  { label: "Auriculares", patterns: /\b(auriculares|airpods incluidos|cascos)\b/ },
  { label: "Funda", patterns: /\b(funda|carcasa|case)\b/ },
  { label: "Protector de pantalla", patterns: /\b(protector de pantalla|cristal templado|protector)\b/ },
  { label: "Factura de compra", patterns: /\b(factura|ticket de compra|recibo|comprobante de compra)\b/ },
  { label: "Garantía vigente", patterns: /\b(con garant[ií]a|garant[ií]a hasta|garant[ií]a de \d|a[nñ]o de garant[ií]a|en garant[ií]a)\b/ },
  { label: "Mando adicional", patterns: /\b(mando adicional|dos mandos|2 mandos|mando extra)\b/ },
  { label: "Juegos incluidos", patterns: /\b(juegos incluidos|con juegos|incluye juegos)\b/ },
  { label: "Teclado / Apple Pencil", patterns: /\b(apple pencil|magic keyboard|teclado incluido|smart keyboard)\b/ },
];

export function extractAccessories(text: string): { labels: string[]; evidence: { field: string; quote: string }[] } {
  const haystack = normalize(text);
  const spans = negatedSpans(haystack);
  const labels: string[] = [];
  const evidence: { field: string; quote: string }[] = [];
  for (const rule of ACCESSORY_RULES) {
    const m = rule.patterns.exec(haystack);
    if (!m) continue;
    // No se cuenta como incluido lo que el vendedor dice que NO trae.
    if (isNegated(spans, m.index)) continue;
    labels.push(rule.label);
    evidence.push({ field: `accesorio:${rule.label}`, quote: quoteAround(haystack, m.index, m[0].length) });
  }
  return { labels, evidence };
}

const DAMAGE_RULES: { label: string; patterns: RegExp }[] = [
  { label: "Pantalla rota o agrietada", patterns: /\b(pantalla rota|pantalla agrietada|cristal roto|grieta|agrietad[oa]|pantalla rajada)\b/ },
  { label: "Arañazos", patterns: /\b(ara[nñ]azos?|rayad[oa]|rayas en|marcas de ara[nñ]azo)\b/ },
  { label: "Golpes o abolladuras", patterns: /\b(golpes?|abolladura|abollad[oa]|marcas de golpe|esquina golpeada)\b/ },
  { label: "Pantalla no original / reparada", patterns: /\b(pantalla cambiada|pantalla no original|pantalla gen[eé]rica|reparad[oa] en|cambio de pantalla)\b/ },
  { label: "Batería sustituida no oficial", patterns: /\b(bater[ií]a cambiada|bater[ií]a gen[eé]rica|bater[ií]a no original)\b/ },
  { label: "Daño por humedad o agua", patterns: /\b(humedad|mojad[oa]|ca[ií]do al agua|da[nñ]o por agua)\b/ },
  { label: "Píxeles muertos o manchas en pantalla", patterns: /\b(p[ií]xel(es)? muertos?|mancha en la pantalla|burn.?in|quemado de pantalla)\b/ },
  { label: "Problemas de carga", patterns: /\b(no carga|falla la carga|puerto de carga da[nñ]ado|carga intermitente)\b/ },
  { label: "Face ID / sensor no funciona", patterns: /\b(face id no|touch id no|sensor no funciona|c[aá]mara no funciona)\b/ },
  { label: "No enciende / para piezas", patterns: /\b(no enciende|para piezas|para repuesto|no arranca)\b/ },
];

export function extractDamages(text: string): { labels: string[]; evidence: { field: string; quote: string }[] } {
  const haystack = normalize(text);
  const spans = negatedSpans(haystack);
  const labels: string[] = [];
  const evidence: { field: string; quote: string }[] = [];
  for (const rule of DAMAGE_RULES) {
    const m = rule.patterns.exec(haystack);
    if (!m) continue;
    // "sin arañazos ni golpes" no describe daños: describe su ausencia.
    if (isNegated(spans, m.index)) continue;
    labels.push(rule.label);
    evidence.push({ field: `daño:${rule.label}`, quote: quoteAround(haystack, m.index, m[0].length) });
  }
  return { labels, evidence };
}

export function extractDeclaredYear(text: string): { year: number; quote: string } | null {
  const currentYear = new Date().getFullYear();
  const re = /\b(?:comprad[oa]|adquirid[oa]|de|del|a[nñ]o)\s+(?:en\s+)?(20\d{2})\b/i;
  const m = re.exec(text);
  if (m) {
    const year = Number.parseInt(m[1]!, 10);
    if (year >= 2010 && year <= currentYear) {
      return { year, quote: quoteAround(text, m.index, m[0].length) };
    }
  }
  const ageRe = /\b(\d{1,2})\s+a[nñ]os?\s+(?:de\s+)?(?:uso|antig[uü]edad)\b/i;
  const am = ageRe.exec(text);
  if (am) {
    const years = Number.parseInt(am[1]!, 10);
    if (years >= 0 && years <= 20) {
      return { year: currentYear - years, quote: quoteAround(text, am.index, am[0].length) };
    }
  }
  return null;
}

const SPANISH_LOCATIONS =
  /\b(madrid|barcelona|valencia|sevilla|zaragoza|malaga|murcia|palma|bilbao|alicante|cordoba|valladolid|vigo|gijon|granada|coruna|vitoria|santander|pamplona|almeria|donostia|san sebastian|toledo|salamanca|badajoz|tenerife|las palmas|mallorca|ibiza)\b/;

export function extractLocation(text: string): { location: string; quote: string } | null {
  const haystack = normalize(text);
  const m = SPANISH_LOCATIONS.exec(haystack);
  if (!m) return null;
  const raw = m[0]!;
  return {
    location: raw.charAt(0).toUpperCase() + raw.slice(1),
    quote: quoteAround(haystack, m.index, raw.length),
  };
}

// ---------------------------------------------------------------------------
// Extracción completa
// ---------------------------------------------------------------------------

export function extractAttributes(text: string): ExtractedAttributes {
  const evidence: { field: string; quote: string }[] = [];

  const model = matchModel(text);
  const brandHint = guessBrand(text);
  const storage = extractStorage(text);
  const color = extractColor(text);
  const condition = extractCondition(text);
  const battery = extractBatteryHealth(text);
  const accessories = extractAccessories(text);
  const damages = extractDamages(text);
  const price = extractPrice(text);
  const declaredYear = extractDeclaredYear(text);
  const location = extractLocation(text);

  if (model) evidence.push({ field: "modelo", quote: model.quote });
  if (storage) evidence.push({ field: "almacenamiento", quote: storage.quote });
  if (color) evidence.push({ field: "color", quote: color.quote });
  if (condition) evidence.push({ field: "estado", quote: condition.quote });
  if (battery) evidence.push({ field: "batería", quote: battery.quote });
  if (price) evidence.push({ field: "precio", quote: price.quote });
  if (declaredYear) evidence.push({ field: "año", quote: declaredYear.quote });
  if (location) evidence.push({ field: "ubicación", quote: location.quote });
  evidence.push(...accessories.evidence, ...damages.evidence);

  return {
    brand: model?.reference.brand ?? brandHint?.brand ?? null,
    model: model?.reference.model ?? null,
    slug: model?.reference.slug ?? null,
    category: model?.reference.category ?? brandHint?.category ?? null,
    storageGb: storage?.gb ?? null,
    color: color?.label ?? null,
    condition: condition?.condition ?? null,
    conditionClaims: condition?.claims ?? [],
    batteryHealth: battery?.pct ?? null,
    accessories: accessories.labels,
    damages: damages.labels,
    askingCents: price?.cents ?? null,
    declaredYear: declaredYear?.year ?? null,
    location: location?.location ?? null,
    evidence,
  };
}

/** Une los atributos de la IA con los deterministas. La IA tiene prioridad,
 *  pero solo cuando aporta un valor y el determinista no lo contradice. */
export function mergeAttributes(
  ai: Partial<ExtractedAttributes>,
  rules: ExtractedAttributes,
): ExtractedAttributes {
  const slug = ai.slug && CATALOG_BY_SLUG.has(ai.slug) ? ai.slug : rules.slug;
  const reference = slug ? CATALOG_BY_SLUG.get(slug) : undefined;

  return {
    brand: reference?.brand ?? ai.brand ?? rules.brand,
    model: reference?.model ?? ai.model ?? rules.model,
    slug: slug ?? null,
    category: reference?.category ?? ai.category ?? rules.category,
    storageGb: rules.storageGb ?? ai.storageGb ?? null,
    color: ai.color ?? rules.color,
    // El estado peor entre IA y reglas: no se sobreestima la calidad.
    condition: worstCondition(ai.condition ?? null, rules.condition),
    conditionClaims: unique([
      ...(ai.conditionClaims ?? []),
      ...(ai.condition ? [ai.condition] : []),
      ...rules.conditionClaims,
    ]) as ConditionKey[],
    batteryHealth: rules.batteryHealth ?? ai.batteryHealth ?? null,
    accessories: unique([...(ai.accessories ?? []), ...rules.accessories]),
    damages: unique([...(ai.damages ?? []), ...rules.damages]),
    askingCents: rules.askingCents ?? ai.askingCents ?? null,
    declaredYear: rules.declaredYear ?? ai.declaredYear ?? null,
    location: ai.location ?? rules.location,
    evidence: [...rules.evidence, ...(ai.evidence ?? [])],
  };
}

const CONDITION_RANK: Record<ConditionKey, number> = {
  new: 5,
  like_new: 4,
  good: 3,
  fair: 2,
  poor: 1,
};

export function worstCondition(
  a: ConditionKey | null,
  b: ConditionKey | null,
): ConditionKey | null {
  if (!a) return b;
  if (!b) return a;
  return CONDITION_RANK[a] <= CONDITION_RANK[b] ? a : b;
}

function unique(values: string[]): string[] {
  return [...new Set(values.filter((v) => typeof v === "string" && v.trim().length > 0))];
}
