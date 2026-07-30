import type { CategoryKey, ProductReference } from "./types";

/**
 * Catálogo de referencia de DealScan AI.
 *
 * IMPORTANTE — de dónde salen estos números:
 * cada entrada guarda el **PVP oficial de lanzamiento** del fabricante para el
 * mercado español (IVA incluido, variante base) y su año de salida. No son
 * precios de segunda mano inventados: el valor de mercado usado se calcula
 * después, aplicando las curvas de depreciación de `engine.ts` sobre este PVP.
 *
 * Cómo mantenerlo:
 *  - `npm run db:seed` carga este fichero en la tabla `ProductReference`.
 *  - En producción la tabla es la fuente de verdad y se refresca con datos
 *    reales de mercado mediante `scripts/import-references.ts` (ver README).
 *  - Añadir una categoría nueva = añadir su clave en `CategoryKey`, su curva en
 *    `RETENTION_CURVES` y sus modelos aquí. No hay que tocar el motor.
 */

const OFFICIAL_ES = "PVP oficial de lanzamiento en España (fabricante), IVA incl.";
const OFFICIAL_EU = "PVP oficial de lanzamiento en la UE (fabricante), IVA incl.";

/** Sobreprecio típico por almacenamiento en móviles Apple (céntimos). */
const APPLE_PHONE_STORAGE = (base: number): { gb: number; deltaCents: number }[] => {
  const tiers: { gb: number; deltaCents: number }[] = [{ gb: base, deltaCents: 0 }];
  let delta = 0;
  let gb = base;
  while (gb < 1024) {
    gb *= 2;
    delta += gb >= 1024 ? 24000 : 12000;
    tiers.push({ gb, deltaCents: delta });
  }
  return tiers;
};

/** Sobreprecio por almacenamiento en Android (más barato que Apple). */
const ANDROID_STORAGE = (base: number, steps = 2): { gb: number; deltaCents: number }[] => {
  const tiers: { gb: number; deltaCents: number }[] = [{ gb: base, deltaCents: 0 }];
  let delta = 0;
  let gb = base;
  for (let i = 0; i < steps; i++) {
    gb *= 2;
    delta += 7000;
    tiers.push({ gb, deltaCents: delta });
  }
  return tiers;
};

const FIXED = (gb: number) => [{ gb, deltaCents: 0 }];

type Draft = Omit<ProductReference, "slug" | "source"> & {
  slug?: string;
  source?: string;
};

const slugify = (brand: string, model: string) =>
  `${brand} ${model}`
    .toLowerCase()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    // "+" es significativo en los nombres comerciales (S24 vs S24+): si se
    // eliminase, ambos modelos compartirían slug y se solaparían en catálogo.
    .replace(/\+/g, " plus")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");

const build = (drafts: Draft[], defaultSource: string): ProductReference[] =>
  drafts.map((d) => ({
    ...d,
    slug: d.slug ?? slugify(d.brand, d.model),
    source: d.source ?? defaultSource,
  }));

// ---------------------------------------------------------------------------
// Móviles
// ---------------------------------------------------------------------------

const IPHONES: Draft[] = [
  { category: "phone", brand: "Apple", model: "iPhone 11", releaseYear: 2019, msrpCents: 80900, storageTiers: APPLE_PHONE_STORAGE(64), aliases: ["iphone 11"] },
  { category: "phone", brand: "Apple", model: "iPhone 11 Pro", releaseYear: 2019, msrpCents: 118900, storageTiers: APPLE_PHONE_STORAGE(64), aliases: ["iphone 11 pro"] },
  { category: "phone", brand: "Apple", model: "iPhone 12 mini", releaseYear: 2020, msrpCents: 80900, storageTiers: APPLE_PHONE_STORAGE(64), aliases: ["iphone 12 mini"] },
  { category: "phone", brand: "Apple", model: "iPhone 12", releaseYear: 2020, msrpCents: 90900, storageTiers: APPLE_PHONE_STORAGE(64), aliases: ["iphone 12"] },
  { category: "phone", brand: "Apple", model: "iPhone 12 Pro", releaseYear: 2020, msrpCents: 115900, storageTiers: APPLE_PHONE_STORAGE(128), aliases: ["iphone 12 pro"] },
  { category: "phone", brand: "Apple", model: "iPhone 12 Pro Max", releaseYear: 2020, msrpCents: 125900, storageTiers: APPLE_PHONE_STORAGE(128), aliases: ["iphone 12 pro max"] },
  { category: "phone", brand: "Apple", model: "iPhone 13 mini", releaseYear: 2021, msrpCents: 80900, storageTiers: APPLE_PHONE_STORAGE(128), aliases: ["iphone 13 mini"] },
  { category: "phone", brand: "Apple", model: "iPhone 13", releaseYear: 2021, msrpCents: 90900, storageTiers: APPLE_PHONE_STORAGE(128), aliases: ["iphone 13"] },
  { category: "phone", brand: "Apple", model: "iPhone 13 Pro", releaseYear: 2021, msrpCents: 115900, storageTiers: APPLE_PHONE_STORAGE(128), aliases: ["iphone 13 pro"] },
  { category: "phone", brand: "Apple", model: "iPhone 13 Pro Max", releaseYear: 2021, msrpCents: 125900, storageTiers: APPLE_PHONE_STORAGE(128), aliases: ["iphone 13 pro max"] },
  { category: "phone", brand: "Apple", model: "iPhone SE (3ª gen)", releaseYear: 2022, msrpCents: 55900, storageTiers: APPLE_PHONE_STORAGE(64), aliases: ["iphone se 2022", "iphone se 3", "iphone se tercera"] },
  { category: "phone", brand: "Apple", model: "iPhone 14", releaseYear: 2022, msrpCents: 100900, storageTiers: APPLE_PHONE_STORAGE(128), aliases: ["iphone 14"] },
  { category: "phone", brand: "Apple", model: "iPhone 14 Plus", releaseYear: 2022, msrpCents: 115900, storageTiers: APPLE_PHONE_STORAGE(128), aliases: ["iphone 14 plus"] },
  { category: "phone", brand: "Apple", model: "iPhone 14 Pro", releaseYear: 2022, msrpCents: 131900, storageTiers: APPLE_PHONE_STORAGE(128), aliases: ["iphone 14 pro"] },
  { category: "phone", brand: "Apple", model: "iPhone 14 Pro Max", releaseYear: 2022, msrpCents: 146900, storageTiers: APPLE_PHONE_STORAGE(128), aliases: ["iphone 14 pro max"] },
  { category: "phone", brand: "Apple", model: "iPhone 15", releaseYear: 2023, msrpCents: 95900, storageTiers: APPLE_PHONE_STORAGE(128), aliases: ["iphone 15"] },
  { category: "phone", brand: "Apple", model: "iPhone 15 Plus", releaseYear: 2023, msrpCents: 110900, storageTiers: APPLE_PHONE_STORAGE(128), aliases: ["iphone 15 plus"] },
  { category: "phone", brand: "Apple", model: "iPhone 15 Pro", releaseYear: 2023, msrpCents: 121900, storageTiers: APPLE_PHONE_STORAGE(128), aliases: ["iphone 15 pro"] },
  { category: "phone", brand: "Apple", model: "iPhone 15 Pro Max", releaseYear: 2023, msrpCents: 146900, storageTiers: APPLE_PHONE_STORAGE(256), aliases: ["iphone 15 pro max"] },
  { category: "phone", brand: "Apple", model: "iPhone 16", releaseYear: 2024, msrpCents: 95900, storageTiers: APPLE_PHONE_STORAGE(128), aliases: ["iphone 16"] },
  { category: "phone", brand: "Apple", model: "iPhone 16 Plus", releaseYear: 2024, msrpCents: 110900, storageTiers: APPLE_PHONE_STORAGE(128), aliases: ["iphone 16 plus"] },
  { category: "phone", brand: "Apple", model: "iPhone 16 Pro", releaseYear: 2024, msrpCents: 121900, storageTiers: APPLE_PHONE_STORAGE(128), aliases: ["iphone 16 pro"] },
  { category: "phone", brand: "Apple", model: "iPhone 16 Pro Max", releaseYear: 2024, msrpCents: 146900, storageTiers: APPLE_PHONE_STORAGE(256), aliases: ["iphone 16 pro max"] },
  { category: "phone", brand: "Apple", model: "iPhone 16e", releaseYear: 2025, msrpCents: 70900, storageTiers: APPLE_PHONE_STORAGE(128), aliases: ["iphone 16e"] },
  { category: "phone", brand: "Apple", model: "iPhone 17", releaseYear: 2025, msrpCents: 95900, storageTiers: APPLE_PHONE_STORAGE(256), aliases: ["iphone 17"] },
  { category: "phone", brand: "Apple", model: "iPhone Air", releaseYear: 2025, msrpCents: 121900, storageTiers: APPLE_PHONE_STORAGE(256), aliases: ["iphone air"] },
  { category: "phone", brand: "Apple", model: "iPhone 17 Pro", releaseYear: 2025, msrpCents: 131900, storageTiers: APPLE_PHONE_STORAGE(256), aliases: ["iphone 17 pro"] },
  { category: "phone", brand: "Apple", model: "iPhone 17 Pro Max", releaseYear: 2025, msrpCents: 146900, storageTiers: APPLE_PHONE_STORAGE(256), aliases: ["iphone 17 pro max"] },
];

const SAMSUNG_PHONES: Draft[] = [
  { category: "phone", brand: "Samsung", model: "Galaxy S21", releaseYear: 2021, msrpCents: 84900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["galaxy s21", "s21"] },
  { category: "phone", brand: "Samsung", model: "Galaxy S21+", releaseYear: 2021, msrpCents: 105900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["galaxy s21 plus", "s21+"] },
  { category: "phone", brand: "Samsung", model: "Galaxy S21 Ultra", releaseYear: 2021, msrpCents: 125900, storageTiers: ANDROID_STORAGE(128, 2), aliases: ["galaxy s21 ultra", "s21 ultra"] },
  { category: "phone", brand: "Samsung", model: "Galaxy S22", releaseYear: 2022, msrpCents: 87900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["galaxy s22", "s22"] },
  { category: "phone", brand: "Samsung", model: "Galaxy S22+", releaseYear: 2022, msrpCents: 107900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["galaxy s22 plus", "s22+"] },
  { category: "phone", brand: "Samsung", model: "Galaxy S22 Ultra", releaseYear: 2022, msrpCents: 125900, storageTiers: ANDROID_STORAGE(128, 2), aliases: ["galaxy s22 ultra", "s22 ultra"] },
  { category: "phone", brand: "Samsung", model: "Galaxy S23", releaseYear: 2023, msrpCents: 95900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["galaxy s23", "s23"] },
  { category: "phone", brand: "Samsung", model: "Galaxy S23+", releaseYear: 2023, msrpCents: 120900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["galaxy s23 plus", "s23+"] },
  { category: "phone", brand: "Samsung", model: "Galaxy S23 Ultra", releaseYear: 2023, msrpCents: 143900, storageTiers: ANDROID_STORAGE(256, 2), aliases: ["galaxy s23 ultra", "s23 ultra"] },
  { category: "phone", brand: "Samsung", model: "Galaxy S24", releaseYear: 2024, msrpCents: 90900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["galaxy s24", "s24"] },
  { category: "phone", brand: "Samsung", model: "Galaxy S24+", releaseYear: 2024, msrpCents: 115900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["galaxy s24 plus", "s24+"] },
  { category: "phone", brand: "Samsung", model: "Galaxy S24 Ultra", releaseYear: 2024, msrpCents: 145900, storageTiers: ANDROID_STORAGE(256, 2), aliases: ["galaxy s24 ultra", "s24 ultra"] },
  { category: "phone", brand: "Samsung", model: "Galaxy S25", releaseYear: 2025, msrpCents: 90900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["galaxy s25", "s25"] },
  { category: "phone", brand: "Samsung", model: "Galaxy S25+", releaseYear: 2025, msrpCents: 115900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["galaxy s25 plus", "s25+"] },
  { category: "phone", brand: "Samsung", model: "Galaxy S25 Ultra", releaseYear: 2025, msrpCents: 145900, storageTiers: ANDROID_STORAGE(256, 2), aliases: ["galaxy s25 ultra", "s25 ultra"] },
  { category: "phone", brand: "Samsung", model: "Galaxy A34", releaseYear: 2023, msrpCents: 39900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["galaxy a34", "a34"] },
  { category: "phone", brand: "Samsung", model: "Galaxy A54", releaseYear: 2023, msrpCents: 48900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["galaxy a54", "a54"] },
  { category: "phone", brand: "Samsung", model: "Galaxy A55", releaseYear: 2024, msrpCents: 47900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["galaxy a55", "a55"] },
  { category: "phone", brand: "Samsung", model: "Galaxy Z Flip5", releaseYear: 2023, msrpCents: 119900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["z flip5", "zflip 5", "galaxy z flip 5"] },
  { category: "phone", brand: "Samsung", model: "Galaxy Z Fold5", releaseYear: 2023, msrpCents: 189900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["z fold5", "zfold 5", "galaxy z fold 5"] },
  { category: "phone", brand: "Samsung", model: "Galaxy Z Flip6", releaseYear: 2024, msrpCents: 119900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["z flip6", "galaxy z flip 6"] },
  { category: "phone", brand: "Samsung", model: "Galaxy Z Fold6", releaseYear: 2024, msrpCents: 199900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["z fold6", "galaxy z fold 6"] },
];

const XIAOMI_PHONES: Draft[] = [
  { category: "phone", brand: "Xiaomi", model: "Redmi Note 12", releaseYear: 2023, msrpCents: 24900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["redmi note 12"] },
  { category: "phone", brand: "Xiaomi", model: "Redmi Note 13 Pro", releaseYear: 2024, msrpCents: 39900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["redmi note 13 pro"] },
  { category: "phone", brand: "Xiaomi", model: "Redmi Note 14 Pro", releaseYear: 2025, msrpCents: 39900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["redmi note 14 pro"] },
  { category: "phone", brand: "Xiaomi", model: "Poco X6 Pro", releaseYear: 2024, msrpCents: 36900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["poco x6 pro"] },
  { category: "phone", brand: "Xiaomi", model: "Xiaomi 13", releaseYear: 2023, msrpCents: 99900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["xiaomi 13"] },
  { category: "phone", brand: "Xiaomi", model: "Xiaomi 13T", releaseYear: 2023, msrpCents: 64900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["xiaomi 13t"] },
  { category: "phone", brand: "Xiaomi", model: "Xiaomi 13T Pro", releaseYear: 2023, msrpCents: 89900, storageTiers: ANDROID_STORAGE(512, 1), aliases: ["xiaomi 13t pro"] },
  { category: "phone", brand: "Xiaomi", model: "Xiaomi 14", releaseYear: 2024, msrpCents: 99900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["xiaomi 14"], source: OFFICIAL_EU },
  { category: "phone", brand: "Xiaomi", model: "Xiaomi 14 Ultra", releaseYear: 2024, msrpCents: 149900, storageTiers: FIXED(512), aliases: ["xiaomi 14 ultra"], source: OFFICIAL_EU },
  { category: "phone", brand: "Xiaomi", model: "Xiaomi 15", releaseYear: 2025, msrpCents: 109900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["xiaomi 15"], source: OFFICIAL_EU },
];

const PIXEL_PHONES: Draft[] = [
  { category: "phone", brand: "Google", model: "Pixel 6", releaseYear: 2021, msrpCents: 64900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["pixel 6"] },
  { category: "phone", brand: "Google", model: "Pixel 6a", releaseYear: 2022, msrpCents: 45900, storageTiers: FIXED(128), aliases: ["pixel 6a"] },
  { category: "phone", brand: "Google", model: "Pixel 7", releaseYear: 2022, msrpCents: 64900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["pixel 7"] },
  { category: "phone", brand: "Google", model: "Pixel 7 Pro", releaseYear: 2022, msrpCents: 89900, storageTiers: ANDROID_STORAGE(128, 2), aliases: ["pixel 7 pro"] },
  { category: "phone", brand: "Google", model: "Pixel 7a", releaseYear: 2023, msrpCents: 50900, storageTiers: FIXED(128), aliases: ["pixel 7a"] },
  { category: "phone", brand: "Google", model: "Pixel 8", releaseYear: 2023, msrpCents: 79900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["pixel 8"] },
  { category: "phone", brand: "Google", model: "Pixel 8 Pro", releaseYear: 2023, msrpCents: 109900, storageTiers: ANDROID_STORAGE(128, 2), aliases: ["pixel 8 pro"] },
  { category: "phone", brand: "Google", model: "Pixel 8a", releaseYear: 2024, msrpCents: 54900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["pixel 8a"] },
  { category: "phone", brand: "Google", model: "Pixel 9", releaseYear: 2024, msrpCents: 89900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["pixel 9"] },
  { category: "phone", brand: "Google", model: "Pixel 9 Pro", releaseYear: 2024, msrpCents: 109900, storageTiers: ANDROID_STORAGE(128, 2), aliases: ["pixel 9 pro"] },
  { category: "phone", brand: "Google", model: "Pixel 9a", releaseYear: 2025, msrpCents: 54900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["pixel 9a"] },
  { category: "phone", brand: "Google", model: "Pixel 10", releaseYear: 2025, msrpCents: 89900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["pixel 10"] },
];

const ONEPLUS_PHONES: Draft[] = [
  { category: "phone", brand: "OnePlus", model: "OnePlus 9", releaseYear: 2021, msrpCents: 71900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["oneplus 9", "one plus 9"] },
  { category: "phone", brand: "OnePlus", model: "OnePlus 10 Pro", releaseYear: 2022, msrpCents: 89900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["oneplus 10 pro"] },
  { category: "phone", brand: "OnePlus", model: "OnePlus Nord 3", releaseYear: 2023, msrpCents: 49900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["oneplus nord 3", "nord 3"] },
  { category: "phone", brand: "OnePlus", model: "OnePlus 11", releaseYear: 2023, msrpCents: 84900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["oneplus 11"] },
  { category: "phone", brand: "OnePlus", model: "OnePlus 12", releaseYear: 2024, msrpCents: 94900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["oneplus 12"] },
  { category: "phone", brand: "OnePlus", model: "OnePlus 12R", releaseYear: 2024, msrpCents: 64900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["oneplus 12r"] },
  { category: "phone", brand: "OnePlus", model: "OnePlus 13", releaseYear: 2025, msrpCents: 102900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["oneplus 13"] },
];

// ---------------------------------------------------------------------------
// Tablets
// ---------------------------------------------------------------------------

const IPADS: Draft[] = [
  { category: "tablet", brand: "Apple", model: "iPad (9ª gen)", releaseYear: 2021, msrpCents: 37900, storageTiers: [{ gb: 64, deltaCents: 0 }, { gb: 256, deltaCents: 16000 }], aliases: ["ipad 9", "ipad 9a", "ipad novena"] },
  { category: "tablet", brand: "Apple", model: "iPad (10ª gen)", releaseYear: 2022, msrpCents: 58900, storageTiers: [{ gb: 64, deltaCents: 0 }, { gb: 256, deltaCents: 16000 }], aliases: ["ipad 10", "ipad 10a", "ipad decima"] },
  { category: "tablet", brand: "Apple", model: "iPad (11ª gen)", releaseYear: 2025, msrpCents: 40900, storageTiers: [{ gb: 128, deltaCents: 0 }, { gb: 256, deltaCents: 12000 }, { gb: 512, deltaCents: 24000 }], aliases: ["ipad 11", "ipad 11a"] },
  { category: "tablet", brand: "Apple", model: "iPad Air (4ª gen)", releaseYear: 2020, msrpCents: 64900, storageTiers: [{ gb: 64, deltaCents: 0 }, { gb: 256, deltaCents: 16000 }], aliases: ["ipad air 4"] },
  { category: "tablet", brand: "Apple", model: "iPad Air (5ª gen)", releaseYear: 2022, msrpCents: 78900, storageTiers: [{ gb: 64, deltaCents: 0 }, { gb: 256, deltaCents: 16000 }], aliases: ["ipad air 5", "ipad air m1"] },
  { category: "tablet", brand: "Apple", model: 'iPad Air 11" (M2)', releaseYear: 2024, msrpCents: 71900, storageTiers: [{ gb: 128, deltaCents: 0 }, { gb: 256, deltaCents: 12000 }, { gb: 512, deltaCents: 36000 }], aliases: ["ipad air m2", "ipad air 11 m2"] },
  { category: "tablet", brand: "Apple", model: 'iPad Air 11" (M3)', releaseYear: 2025, msrpCents: 71900, storageTiers: [{ gb: 128, deltaCents: 0 }, { gb: 256, deltaCents: 12000 }, { gb: 512, deltaCents: 36000 }], aliases: ["ipad air m3", "ipad air 11 m3"] },
  { category: "tablet", brand: "Apple", model: "iPad mini (6ª gen)", releaseYear: 2021, msrpCents: 54900, storageTiers: [{ gb: 64, deltaCents: 0 }, { gb: 256, deltaCents: 16000 }], aliases: ["ipad mini 6"] },
  { category: "tablet", brand: "Apple", model: "iPad mini (A17 Pro)", releaseYear: 2024, msrpCents: 60900, storageTiers: [{ gb: 128, deltaCents: 0 }, { gb: 256, deltaCents: 12000 }, { gb: 512, deltaCents: 36000 }], aliases: ["ipad mini 7", "ipad mini a17"] },
  { category: "tablet", brand: "Apple", model: 'iPad Pro 11" (M1)', releaseYear: 2021, msrpCents: 89900, storageTiers: [{ gb: 128, deltaCents: 0 }, { gb: 256, deltaCents: 12000 }, { gb: 512, deltaCents: 36000 }, { gb: 1024, deltaCents: 72000 }], aliases: ["ipad pro 11 m1"] },
  { category: "tablet", brand: "Apple", model: 'iPad Pro 11" (M2)', releaseYear: 2022, msrpCents: 104900, storageTiers: [{ gb: 128, deltaCents: 0 }, { gb: 256, deltaCents: 12000 }, { gb: 512, deltaCents: 36000 }, { gb: 1024, deltaCents: 72000 }], aliases: ["ipad pro 11 m2"] },
  { category: "tablet", brand: "Apple", model: 'iPad Pro 11" (M4)', releaseYear: 2024, msrpCents: 121900, storageTiers: [{ gb: 256, deltaCents: 0 }, { gb: 512, deltaCents: 24000 }, { gb: 1024, deltaCents: 60000 }], aliases: ["ipad pro 11 m4"] },
  { category: "tablet", brand: "Apple", model: 'iPad Pro 12.9" (M2)', releaseYear: 2022, msrpCents: 144900, storageTiers: [{ gb: 128, deltaCents: 0 }, { gb: 256, deltaCents: 12000 }, { gb: 512, deltaCents: 36000 }, { gb: 1024, deltaCents: 72000 }], aliases: ["ipad pro 12.9 m2", "ipad pro 12,9 m2"] },
  { category: "tablet", brand: "Apple", model: 'iPad Pro 13" (M4)', releaseYear: 2024, msrpCents: 156900, storageTiers: [{ gb: 256, deltaCents: 0 }, { gb: 512, deltaCents: 24000 }, { gb: 1024, deltaCents: 60000 }], aliases: ["ipad pro 13 m4"] },
];

const ANDROID_TABLETS: Draft[] = [
  { category: "tablet", brand: "Samsung", model: "Galaxy Tab S8", releaseYear: 2022, msrpCents: 74900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["galaxy tab s8", "tab s8"] },
  { category: "tablet", brand: "Samsung", model: "Galaxy Tab S9", releaseYear: 2023, msrpCents: 89900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["galaxy tab s9", "tab s9"] },
  { category: "tablet", brand: "Samsung", model: "Galaxy Tab S10+", releaseYear: 2024, msrpCents: 121900, storageTiers: ANDROID_STORAGE(256, 1), aliases: ["galaxy tab s10 plus", "tab s10+"] },
  { category: "tablet", brand: "Samsung", model: "Galaxy Tab A9+", releaseYear: 2023, msrpCents: 24900, storageTiers: ANDROID_STORAGE(64, 1), aliases: ["galaxy tab a9 plus", "tab a9+"] },
  { category: "tablet", brand: "Xiaomi", model: "Xiaomi Pad 6", releaseYear: 2023, msrpCents: 39900, storageTiers: ANDROID_STORAGE(128, 1), aliases: ["xiaomi pad 6"] },
  { category: "tablet", brand: "Lenovo", model: "Tab P11", releaseYear: 2021, msrpCents: 29900, storageTiers: ANDROID_STORAGE(64, 1), aliases: ["lenovo tab p11", "tab p11"] },
];

// ---------------------------------------------------------------------------
// Portátiles
// ---------------------------------------------------------------------------

const MACBOOKS: Draft[] = [
  { category: "laptop", brand: "Apple", model: "MacBook Air 13 (M1)", releaseYear: 2020, msrpCents: 112900, storageTiers: [{ gb: 256, deltaCents: 0 }, { gb: 512, deltaCents: 23000 }, { gb: 1024, deltaCents: 46000 }], aliases: ["macbook air m1"] },
  { category: "laptop", brand: "Apple", model: "MacBook Air 13 (M2)", releaseYear: 2022, msrpCents: 151900, storageTiers: [{ gb: 256, deltaCents: 0 }, { gb: 512, deltaCents: 23000 }, { gb: 1024, deltaCents: 46000 }], aliases: ["macbook air m2"] },
  { category: "laptop", brand: "Apple", model: "MacBook Air 13 (M3)", releaseYear: 2024, msrpCents: 129900, storageTiers: [{ gb: 256, deltaCents: 0 }, { gb: 512, deltaCents: 23000 }, { gb: 1024, deltaCents: 46000 }], aliases: ["macbook air m3"] },
  { category: "laptop", brand: "Apple", model: "MacBook Air 13 (M4)", releaseYear: 2025, msrpCents: 119900, storageTiers: [{ gb: 256, deltaCents: 0 }, { gb: 512, deltaCents: 23000 }, { gb: 1024, deltaCents: 46000 }], aliases: ["macbook air m4"] },
  { category: "laptop", brand: "Apple", model: "MacBook Pro 13 (M1)", releaseYear: 2020, msrpCents: 144900, storageTiers: [{ gb: 256, deltaCents: 0 }, { gb: 512, deltaCents: 23000 }], aliases: ["macbook pro 13 m1"] },
  { category: "laptop", brand: "Apple", model: "MacBook Pro 14 (M1 Pro)", releaseYear: 2021, msrpCents: 244900, storageTiers: [{ gb: 512, deltaCents: 0 }, { gb: 1024, deltaCents: 46000 }], aliases: ["macbook pro 14 m1 pro"] },
  { category: "laptop", brand: "Apple", model: "MacBook Pro 14 (M3)", releaseYear: 2023, msrpCents: 194900, storageTiers: [{ gb: 512, deltaCents: 0 }, { gb: 1024, deltaCents: 46000 }], aliases: ["macbook pro 14 m3"] },
  { category: "laptop", brand: "Apple", model: "MacBook Pro 14 (M4)", releaseYear: 2024, msrpCents: 184900, storageTiers: [{ gb: 512, deltaCents: 0 }, { gb: 1024, deltaCents: 46000 }], aliases: ["macbook pro 14 m4"] },
  { category: "laptop", brand: "Apple", model: "MacBook Pro 16 (M3 Pro)", releaseYear: 2023, msrpCents: 309900, storageTiers: [{ gb: 512, deltaCents: 0 }, { gb: 1024, deltaCents: 46000 }], aliases: ["macbook pro 16 m3 pro"] },
];

const WINDOWS_LAPTOPS: Draft[] = [
  { category: "laptop", brand: "Dell", model: "XPS 13 (9315)", releaseYear: 2022, msrpCents: 139900, storageTiers: [{ gb: 512, deltaCents: 0 }, { gb: 1024, deltaCents: 20000 }], aliases: ["dell xps 13", "xps 13"] },
  { category: "laptop", brand: "Lenovo", model: "ThinkPad X1 Carbon Gen 11", releaseYear: 2023, msrpCents: 189900, storageTiers: [{ gb: 512, deltaCents: 0 }, { gb: 1024, deltaCents: 20000 }], aliases: ["thinkpad x1 carbon", "x1 carbon"] },
  { category: "laptop", brand: "Lenovo", model: "IdeaPad 3 15", releaseYear: 2021, msrpCents: 54900, storageTiers: [{ gb: 256, deltaCents: 0 }, { gb: 512, deltaCents: 8000 }], aliases: ["ideapad 3"] },
  { category: "laptop", brand: "HP", model: "Pavilion 15", releaseYear: 2022, msrpCents: 79900, storageTiers: [{ gb: 512, deltaCents: 0 }, { gb: 1024, deltaCents: 12000 }], aliases: ["hp pavilion 15", "pavilion 15"] },
  { category: "laptop", brand: "Asus", model: "Vivobook 15", releaseYear: 2022, msrpCents: 64900, storageTiers: [{ gb: 512, deltaCents: 0 }, { gb: 1024, deltaCents: 12000 }], aliases: ["vivobook 15"] },
  { category: "laptop", brand: "Asus", model: "ROG Zephyrus G14", releaseYear: 2023, msrpCents: 189900, storageTiers: [{ gb: 1024, deltaCents: 0 }], aliases: ["rog zephyrus g14", "zephyrus g14"] },
  { category: "laptop", brand: "Acer", model: "Aspire 5", releaseYear: 2022, msrpCents: 69900, storageTiers: [{ gb: 512, deltaCents: 0 }, { gb: 1024, deltaCents: 12000 }], aliases: ["acer aspire 5", "aspire 5"] },
  { category: "laptop", brand: "MSI", model: "Katana 15", releaseYear: 2023, msrpCents: 119900, storageTiers: [{ gb: 512, deltaCents: 0 }, { gb: 1024, deltaCents: 15000 }], aliases: ["msi katana 15", "katana 15"] },
  { category: "laptop", brand: "Huawei", model: "MateBook D15", releaseYear: 2021, msrpCents: 69900, storageTiers: [{ gb: 512, deltaCents: 0 }], aliases: ["matebook d15"] },
];

// ---------------------------------------------------------------------------
// Smartwatches
// ---------------------------------------------------------------------------

const WATCHES: Draft[] = [
  { category: "watch", brand: "Apple", model: "Apple Watch Series 7", releaseYear: 2021, msrpCents: 42900, storageTiers: FIXED(32), aliases: ["apple watch series 7", "watch series 7", "apple watch s7"] },
  { category: "watch", brand: "Apple", model: "Apple Watch SE (2ª gen)", releaseYear: 2022, msrpCents: 29900, storageTiers: FIXED(32), aliases: ["apple watch se 2", "watch se 2022"] },
  { category: "watch", brand: "Apple", model: "Apple Watch Series 8", releaseYear: 2022, msrpCents: 49900, storageTiers: FIXED(32), aliases: ["apple watch series 8", "apple watch s8"] },
  { category: "watch", brand: "Apple", model: "Apple Watch Ultra", releaseYear: 2022, msrpCents: 99900, storageTiers: FIXED(32), aliases: ["apple watch ultra"] },
  { category: "watch", brand: "Apple", model: "Apple Watch Series 9", releaseYear: 2023, msrpCents: 44900, storageTiers: FIXED(64), aliases: ["apple watch series 9", "apple watch s9"] },
  { category: "watch", brand: "Apple", model: "Apple Watch Ultra 2", releaseYear: 2023, msrpCents: 89900, storageTiers: FIXED(64), aliases: ["apple watch ultra 2"] },
  { category: "watch", brand: "Apple", model: "Apple Watch Series 10", releaseYear: 2024, msrpCents: 44900, storageTiers: FIXED(64), aliases: ["apple watch series 10", "apple watch s10"] },
  { category: "watch", brand: "Apple", model: "Apple Watch Series 11", releaseYear: 2025, msrpCents: 44900, storageTiers: FIXED(64), aliases: ["apple watch series 11", "apple watch s11"] },
  { category: "watch", brand: "Samsung", model: "Galaxy Watch6", releaseYear: 2023, msrpCents: 31900, storageTiers: FIXED(16), aliases: ["galaxy watch6", "galaxy watch 6"] },
  { category: "watch", brand: "Samsung", model: "Galaxy Watch7", releaseYear: 2024, msrpCents: 31900, storageTiers: FIXED(32), aliases: ["galaxy watch7", "galaxy watch 7"] },
];

// ---------------------------------------------------------------------------
// Consolas
// ---------------------------------------------------------------------------

const CONSOLES: Draft[] = [
  { category: "console", brand: "Sony", model: "PlayStation 4 Pro", releaseYear: 2016, msrpCents: 39900, storageTiers: FIXED(1024), aliases: ["ps4 pro", "playstation 4 pro"] },
  { category: "console", brand: "Sony", model: "PlayStation 5", releaseYear: 2020, msrpCents: 49900, storageTiers: FIXED(825), aliases: ["ps5", "playstation 5"] },
  { category: "console", brand: "Sony", model: "PlayStation 5 Digital", releaseYear: 2020, msrpCents: 39900, storageTiers: FIXED(825), aliases: ["ps5 digital", "ps5 edicion digital"] },
  { category: "console", brand: "Sony", model: "PlayStation 5 Slim", releaseYear: 2023, msrpCents: 54900, storageTiers: FIXED(1024), aliases: ["ps5 slim"] },
  { category: "console", brand: "Sony", model: "PlayStation 5 Pro", releaseYear: 2024, msrpCents: 79900, storageTiers: FIXED(2048), aliases: ["ps5 pro"] },
  { category: "console", brand: "Microsoft", model: "Xbox Series S", releaseYear: 2020, msrpCents: 29900, storageTiers: FIXED(512), aliases: ["xbox series s"] },
  { category: "console", brand: "Microsoft", model: "Xbox Series X", releaseYear: 2020, msrpCents: 49900, storageTiers: FIXED(1024), aliases: ["xbox series x"] },
  { category: "console", brand: "Nintendo", model: "Switch", releaseYear: 2017, msrpCents: 32900, storageTiers: FIXED(32), aliases: ["nintendo switch"] },
  { category: "console", brand: "Nintendo", model: "Switch Lite", releaseYear: 2019, msrpCents: 21900, storageTiers: FIXED(32), aliases: ["switch lite"] },
  { category: "console", brand: "Nintendo", model: "Switch OLED", releaseYear: 2021, msrpCents: 34900, storageTiers: FIXED(64), aliases: ["switch oled"] },
  { category: "console", brand: "Nintendo", model: "Switch 2", releaseYear: 2025, msrpCents: 46900, storageTiers: FIXED(256), aliases: ["switch 2", "nintendo switch 2"] },
  { category: "console", brand: "Valve", model: "Steam Deck OLED", releaseYear: 2023, msrpCents: 56900, storageTiers: [{ gb: 512, deltaCents: 0 }, { gb: 1024, deltaCents: 10000 }], aliases: ["steam deck oled"] },
];

export const PRODUCT_CATALOG: ProductReference[] = [
  ...build(IPHONES, OFFICIAL_ES),
  ...build(SAMSUNG_PHONES, OFFICIAL_ES),
  ...build(XIAOMI_PHONES, OFFICIAL_ES),
  ...build(PIXEL_PHONES, OFFICIAL_ES),
  ...build(ONEPLUS_PHONES, OFFICIAL_ES),
  ...build(IPADS, OFFICIAL_ES),
  ...build(ANDROID_TABLETS, OFFICIAL_ES),
  ...build(MACBOOKS, OFFICIAL_ES),
  ...build(WINDOWS_LAPTOPS, OFFICIAL_ES),
  ...build(WATCHES, OFFICIAL_ES),
  ...build(CONSOLES, OFFICIAL_ES),
];

export const CATALOG_BY_SLUG = new Map(PRODUCT_CATALOG.map((p) => [p.slug, p]));

export const CATALOG_BRANDS: string[] = [
  ...new Set(PRODUCT_CATALOG.map((p) => p.brand)),
].sort();

export function catalogByCategory(category: CategoryKey): ProductReference[] {
  return PRODUCT_CATALOG.filter((p) => p.category === category);
}

/** Precio de referencia (PVP nuevo) para un modelo y almacenamiento dados. */
export function msrpForVariant(
  ref: ProductReference,
  storageGb: number | null,
): { cents: number; matchedGb: number | null } {
  if (storageGb == null) {
    return { cents: ref.msrpCents, matchedGb: ref.storageTiers[0]?.gb ?? null };
  }
  const exact = ref.storageTiers.find((t) => t.gb === storageGb);
  if (exact) {
    return { cents: ref.msrpCents + exact.deltaCents, matchedGb: exact.gb };
  }
  // Si el almacenamiento no está en catálogo, se interpola con el tramo más
  // cercano por debajo para no inventar un precio superior al real.
  const sorted = [...ref.storageTiers].sort((a, b) => a.gb - b.gb);
  let chosen = sorted[0]!;
  for (const tier of sorted) {
    if (tier.gb <= storageGb) chosen = tier;
  }
  return { cents: ref.msrpCents + chosen.deltaCents, matchedGb: chosen.gb };
}
