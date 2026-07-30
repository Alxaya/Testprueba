import { describe, expect, it } from "vitest";
import { analyze, ENGINE_VERSION, VERDICT_THRESHOLDS } from "@/lib/valuation/engine";
import { extractAttributes, parseAmountToCents } from "@/lib/valuation/extract";
import { CATALOG_BY_SLUG, PRODUCT_CATALOG, msrpForVariant } from "@/lib/valuation/catalog";

/** Fecha fija para que las pruebas no dependan del año en curso. */
const NOW = new Date("2026-07-30T12:00:00Z");

function run(text: string, opts: { images?: number } = {}) {
  const attributes = extractAttributes(text);
  const askingCents = attributes.askingCents ?? 0;
  return analyze({
    attributes,
    text,
    askingCents,
    imageCount: opts.images ?? 0,
    inputs: ["text"],
    aiUsedFor: [],
    aiModel: null,
    now: NOW,
  });
}

describe("catálogo de referencia", () => {
  it("no tiene slugs duplicados", () => {
    const slugs = PRODUCT_CATALOG.map((p) => p.slug);
    expect(new Set(slugs).size).toBe(slugs.length);
  });

  it("todas las entradas tienen PVP, año y fuente", () => {
    for (const p of PRODUCT_CATALOG) {
      expect(p.msrpCents, p.slug).toBeGreaterThan(0);
      expect(p.releaseYear, p.slug).toBeGreaterThanOrEqual(2016);
      expect(p.source.length, p.slug).toBeGreaterThan(10);
      expect(p.storageTiers.length, p.slug).toBeGreaterThan(0);
    }
  });

  it("el precio sube con el almacenamiento", () => {
    const ref = CATALOG_BY_SLUG.get("apple-iphone-13")!;
    const base = msrpForVariant(ref, 128).cents;
    const big = msrpForVariant(ref, 256).cents;
    expect(big).toBeGreaterThan(base);
  });

  it("un almacenamiento desconocido no infla el precio", () => {
    const ref = CATALOG_BY_SLUG.get("apple-iphone-13")!;
    // 192 GB no existe: debe usar el tramo inferior (128), nunca el superior.
    expect(msrpForVariant(ref, 192).cents).toBe(msrpForVariant(ref, 128).cents);
  });
});

describe("parseo de importes", () => {
  it("entiende el formato español y el inglés", () => {
    expect(parseAmountToCents("1.299,99")).toBe(129999);
    expect(parseAmountToCents("1,299.99")).toBe(129999);
    expect(parseAmountToCents("450")).toBe(45000);
    expect(parseAmountToCents("450,50")).toBe(45050);
    expect(parseAmountToCents("1.200")).toBe(120000);
  });

  it("descarta lo que no es un importe", () => {
    expect(parseAmountToCents("abc")).toBeNull();
    expect(parseAmountToCents("0")).toBeNull();
  });
});

describe("extracción de atributos", () => {
  it("identifica modelo, capacidad, color, estado y precio", () => {
    const attr = extractAttributes(
      "Vendo iPhone 13 Pro 256 GB color azul, como nuevo, batería 91%. Precio: 520€. Incluye caja original y factura. Madrid.",
    );
    expect(attr.slug).toBe("apple-iphone-13-pro");
    expect(attr.brand).toBe("Apple");
    expect(attr.storageGb).toBe(256);
    expect(attr.color).toBe("Azul");
    expect(attr.condition).toBe("like_new");
    expect(attr.batteryHealth).toBe(91);
    expect(attr.askingCents).toBe(52000);
    expect(attr.accessories).toContain("Caja original");
    expect(attr.accessories).toContain("Factura de compra");
    expect(attr.location).toBe("Madrid");
  });

  it("prefiere el alias más largo (no confunde 13 con 13 Pro Max)", () => {
    expect(extractAttributes("iPhone 13 Pro Max 128GB, 600 €").slug).toBe("apple-iphone-13-pro-max");
    expect(extractAttributes("iPhone 13 128GB, 400 €").slug).toBe("apple-iphone-13");
  });

  it("no confunde la RAM con el almacenamiento", () => {
    const attr = extractAttributes("Portátil Asus Vivobook 15 con 16 GB de RAM y 512 GB SSD. 380€");
    expect(attr.storageGb).toBe(512);
  });

  it("no cuenta accesorios que el vendedor dice no incluir", () => {
    const attr = extractAttributes("iPhone 12 64GB, 300€, sin caja ni cargador");
    expect(attr.accessories).not.toContain("Caja original");
    expect(attr.accessories).not.toContain("Cargador");
  });

  it("no cuenta daños negados", () => {
    const attr = extractAttributes("Galaxy S22 128GB, 250€, sin arañazos ni golpes");
    expect(attr.damages).toHaveLength(0);
  });

  it("se queda con el peor estado cuando el anuncio se contradice", () => {
    const attr = extractAttributes("iPhone 12 como nuevo pero con la pantalla rota. 150€");
    expect(attr.condition).toBe("poor");
    // Pero conserva la afirmación original del vendedor para poder señalarla.
    expect(attr.conditionClaims).toContain("like_new");
    expect(attr.conditionClaims).toContain("poor");
  });

  it("niega toda la lista tras un «sin ... ni ...»", () => {
    const attr = extractAttributes("iPad Air 5 64GB, 350€, sin caja ni cargador ni factura");
    expect(attr.accessories).toHaveLength(0);
  });

  it("no extiende la negación más allá de un «con»", () => {
    const attr = extractAttributes("iPhone 13 128GB, 450€, sin caja pero con cargador y factura");
    expect(attr.accessories).toContain("Cargador");
    expect(attr.accessories).toContain("Factura de compra");
    expect(attr.accessories).not.toContain("Caja original");
  });

  it("ignora importes que no son el precio del producto", () => {
    const attr = extractAttributes("iPhone 14 128GB. Precio: 480€. Gastos de envío 5€.");
    expect(attr.askingCents).toBe(48000);
  });
});

describe("motor de valoración", () => {
  it("un iPhone reciente barato es un chollo", () => {
    const r = run("Vendo iPhone 15 128GB, como nuevo, con caja y factura. Precio: 400€");
    expect(r.verdict).toBe("CHOLLO");
    expect(r.pricing.fairCents).toBeGreaterThan(r.pricing.askingCents);
    expect(r.pricing.savingCents).toBeGreaterThan(0);
    expect(r.score).toBeGreaterThan(60);
  });

  it("un precio muy por encima del valor justo se marca como caro", () => {
    const r = run("Vendo iPhone 13 128GB en buen estado. Precio: 800€");
    expect(r.verdict).toBe("CARO");
    expect(r.pricing.savingCents).toBeLessThan(0);
    expect(r.negotiation.targetCents).toBeLessThan(r.pricing.askingCents);
  });

  it("el precio de mercado queda dentro de su propia horquilla", () => {
    const r = run("iPhone 14 Pro 256GB buen estado, 700€");
    expect(r.pricing.marketLowCents).toBeLessThan(r.pricing.marketCents);
    expect(r.pricing.marketHighCents).toBeGreaterThan(r.pricing.marketCents);
  });

  it("respeta el orden objetivo < precio pedido y oferta <= objetivo", () => {
    const r = run("Vendo MacBook Air M2 256GB, buen estado. 900€");
    expect(r.negotiation.openingOfferCents).toBeLessThanOrEqual(r.negotiation.targetCents);
    expect(r.negotiation.targetCents).toBeLessThanOrEqual(r.pricing.askingCents);
    expect(r.negotiation.walkAwayCents).toBeGreaterThan(r.negotiation.targetCents);
  });

  it("un producto más antiguo vale menos que el mismo modelo nuevo", () => {
    const old = run("Vendo iPhone 12 128GB buen estado, 300€");
    const recent = run("Vendo iPhone 16 128GB buen estado, 300€");
    expect(recent.pricing.fairCents).toBeGreaterThan(old.pricing.fairCents);
  });

  it("los daños reducen el precio justo", () => {
    const clean = run("iPhone 14 128GB buen estado, 500€");
    const broken = run("iPhone 14 128GB buen estado con la pantalla rota, 500€");
    expect(broken.pricing.fairCents).toBeLessThan(clean.pricing.fairCents);
  });

  it("los accesorios aumentan el precio justo", () => {
    const bare = run("iPhone 15 128GB buen estado, 600€");
    const loaded = run("iPhone 15 128GB buen estado con caja original, cargador y factura, 600€");
    expect(loaded.pricing.fairCents).toBeGreaterThan(bare.pricing.fairCents);
  });

  it("las consolas se deprecian menos que los móviles", () => {
    const console2020 = run("Vendo PS5 con mando, buen estado. 300€");
    expect(console2020.breakdown.retention).toBeGreaterThan(0.4);
  });

  it("nunca devuelve un precio justo negativo o cero", () => {
    const r = run("iPhone 11 64GB no enciende, para piezas, con humedad y pantalla rota. 30€");
    expect(r.pricing.fairCents).toBeGreaterThan(0);
  });
});

describe("detección de estafas", () => {
  it("marca el pago fuera de plataforma como riesgo crítico", () => {
    const r = run(
      "Vendo iPhone 15 Pro 256GB precintado. Precio 350€. Estoy en el extranjero, te lo envío y me pagas por Bizum o transferencia bancaria por adelantado. Urge vender.",
    );
    expect(r.verdict).toBe("ESTAFA_PROBABLE");
    expect(r.scamRisk).toBeGreaterThanOrEqual(VERDICT_THRESHOLDS.scamOverride);
    const codes = r.signals.map((s) => s.code);
    expect(codes).toContain("off_platform_payment");
    expect(codes).toContain("seller_abroad");
    // El precio pedido está muy por debajo del mercado: debe saltar alguna de
    // las dos reglas de precio (muy bajo / imposiblemente bajo).
    expect(codes.some((c) => c.startsWith("price_"))).toBe(true);
    expect(r.explanation.recommendation).toMatch(/No compres/i);
  });

  it("clasifica como imposible un precio ridículo frente al mercado", () => {
    const r = run("Vendo MacBook Pro 14 M4 512GB precintado, con factura. 250€. Solo envío, pago por Bizum.");
    expect(r.signals.map((s) => s.code)).toContain("price_impossibly_low");
  });

  it("detecta el bloqueo por cuenta iCloud", () => {
    const r = run("iPhone 13 128GB, 300€. Está bloqueado por iCloud, no recuerdo la contraseña de iCloud.");
    expect(r.signals.map((s) => s.code)).toContain("account_locked");
  });

  it("detecta la incoherencia entre «nuevo» y daños", () => {
    const r = run("iPhone 14 128GB precintado sin abrir, 700€. Tiene algún arañazo en la pantalla.");
    expect(r.signals.map((s) => s.code)).toContain("inconsistent_new_with_damage");
  });

  it("no penaliza un anuncio precintado a precio razonable", () => {
    const r = run("Vendo iPhone 16 128GB precintado sin abrir, con factura y garantía. 850€");
    expect(r.signals.map((s) => s.code)).not.toContain("sealed_but_cheap");
    expect(r.verdict).not.toBe("ESTAFA_PROBABLE");
  });

  it("un anuncio limpio tiene riesgo bajo y señales positivas", () => {
    const r = run(
      "Vendo iPhone 15 128GB en perfecto estado, batería 98%, con caja original, cargador y factura de compra con garantía hasta 2026. Entrega en mano en Madrid. 620€",
    );
    expect(r.scamRisk).toBeLessThan(20);
    expect(r.signals.some((s) => s.kind === "positive")).toBe(true);
  });
});

describe("coherencia entre riesgo y puntuación", () => {
  it("un anuncio con riesgo alto nunca obtiene buena puntuación, aunque sea baratísimo", () => {
    const r = run(
      "Vendo iPhone 16 Pro 128GB precintado. 480€. Estoy en Alemania trabajando, te lo envío y me pagas por Bizum antes. Urge vender, primera persona que pague.",
    );
    expect(r.verdict).toBe("ESTAFA_PROBABLE");
    // El techo de riesgo debe imponerse sobre el atractivo del precio.
    expect(r.score).toBeLessThanOrEqual(100 - r.scamRisk);
    expect(r.buyProbability).toBeLessThanOrEqual(100 - r.scamRisk);
    expect(r.score).toBeLessThan(50);
  });

  it("el ahorro real se sigue mostrando íntegro pese al techo de puntuación", () => {
    const r = run(
      "Vendo iPhone 16 Pro 128GB precintado. 480€. Estoy en Alemania, pago por Bizum adelantado.",
    );
    expect(r.pricing.savingCents).toBeGreaterThan(0);
  });
});

describe("estado declarado frente a estado deducido", () => {
  it("«buen estado con algún arañazo» sigue siendo buen estado", () => {
    const attr = extractAttributes(
      "iPhone 14 Pro 256GB. Buen estado, algún arañazo mínimo en el marco, pantalla perfecta. 620€",
    );
    expect(attr.condition).toBe("good");
  });

  it("un defecto grave manda sobre lo que declare el vendedor", () => {
    const attr = extractAttributes("iPhone 13 128GB impecable, aunque no enciende. 120€");
    expect(attr.condition).toBe("poor");
  });

  it("no penaliza dos veces el desgaste estético ya incluido en el estado", () => {
    const conArañazos = run("iPhone 14 128GB estado aceptable con arañazos. 400€");
    const sinMencion = run("iPhone 14 128GB estado aceptable. 400€");
    // Mismo estado declarado ⇒ mismo precio justo: el arañazo ya está dentro.
    expect(conArañazos.pricing.fairCents).toBe(sinMencion.pricing.fairCents);
  });

  it("sí penaliza el desgaste cuando el estado declarado es mejor", () => {
    const limpio = run("iPhone 14 128GB como nuevo. 500€");
    const rayado = run("iPhone 14 128GB como nuevo, tiene arañazos. 500€");
    expect(rayado.pricing.fairCents).toBeLessThan(limpio.pricing.fairCents);
  });
});

describe("plan de negociación", () => {
  it("la oferta inicial nunca supera el objetivo, ni con precios de gancho", () => {
    const casos = [
      "iPhone 16 Pro 128GB precintado, 480€, pago por Bizum adelantado, estoy en el extranjero",
      "iPhone 15 128GB buen estado, 250€",
      "MacBook Pro 14 M4 512GB como nuevo, 3000€",
      "PS5 Slim buen estado, 100€",
    ];
    for (const texto of casos) {
      const r = run(texto);
      expect(r.negotiation.openingOfferCents, texto).toBeLessThanOrEqual(r.negotiation.targetCents);
      expect(r.negotiation.targetCents, texto).toBeLessThanOrEqual(r.pricing.askingCents);
    }
  });
});

describe("calibración frente a precios reales de mercado", () => {
  /**
   * Comprueba que el valor de mercado calculado cae dentro del rango en el que
   * estos modelos se venden realmente de segunda mano en buen estado. Es la
   * prueba que detecta una curva de depreciación mal calibrada.
   */
  const expectations: { text: string; minEur: number; maxEur: number }[] = [
    { text: "iPhone 13 128GB buen estado, 1€", minEur: 280, maxEur: 400 },
    { text: "iPhone 14 128GB buen estado, 1€", minEur: 350, maxEur: 480 },
    { text: "iPhone 15 128GB buen estado, 1€", minEur: 450, maxEur: 590 },
    { text: "Galaxy S23 128GB buen estado, 1€", minEur: 280, maxEur: 420 },
    { text: "MacBook Air M2 256GB buen estado, 1€", minEur: 550, maxEur: 750 },
    { text: "PS5 Slim buen estado, 1€", minEur: 300, maxEur: 420 },
    { text: "iPad Air 5 64GB buen estado, 1€", minEur: 250, maxEur: 380 },
    { text: "Xbox Series X buen estado, 1€", minEur: 220, maxEur: 320 },
    { text: "Nintendo Switch OLED buen estado, 1€", minEur: 180, maxEur: 270 },
    { text: "Pixel 8 128GB buen estado, 1€", minEur: 250, maxEur: 380 },
    { text: "Redmi Note 13 Pro 256GB buen estado, 1€", minEur: 120, maxEur: 220 },
  ];

  for (const { text, minEur, maxEur } of expectations) {
    it(`${text.split(",")[0]} → entre ${minEur} € y ${maxEur} €`, () => {
      const market = run(text).pricing.marketCents / 100;
      expect(market).toBeGreaterThanOrEqual(minEur);
      expect(market).toBeLessThanOrEqual(maxEur);
    });
  }
});

describe("producto no identificado", () => {
  it("no afirma que el precio es correcto cuando no ha valorado nada", () => {
    const r = run("Vendo un móvil marca desconocida en buen estado por 200€");
    // Decir "precio correcto" sin haber calculado ningún precio sería afirmar
    // algo que el motor no sabe.
    expect(r.verdict).toBe("SIN_VALORAR");
  });

  it("no inventa un precio de mercado", () => {
    const r = run("Vendo un móvil marca desconocida en buen estado por 200€");
    expect(r.pricing.marketCents).toBe(0);
    expect(r.pricing.fairCents).toBe(0);
    expect(r.breakdown.reference).toBeNull();
    expect(r.explanation.priceReasoning).toMatch(/no estima precios|no se genera ninguna cifra/i);
  });

  it("sigue analizando los riesgos aunque no identifique el producto", () => {
    const r = run(
      "Vendo dispositivo por 100€. Estoy en el extranjero, pago por Bizum adelantado y te lo envío.",
    );
    expect(r.scamRisk).toBeGreaterThan(40);
    expect(r.signals.length).toBeGreaterThan(0);
  });
});

describe("estructura del informe", () => {
  it("incluye todos los apartados exigidos del informe", () => {
    const r = run(
      "Vendo iPhone 14 Pro 256GB azul, buen estado, batería 89%, con caja y cargador. 650€. Madrid, entrega en mano.",
    );
    expect(r.engineVersion).toBe(ENGINE_VERSION);
    expect(r.pricing.marketCents).toBeGreaterThan(0);
    expect(["CHOLLO", "CORRECTO", "CARO", "ESTAFA_PROBABLE", "SIN_VALORAR"]).toContain(r.verdict);
    expect(r.score).toBeGreaterThanOrEqual(1);
    expect(r.score).toBeLessThanOrEqual(100);
    expect(r.buyProbability).toBeGreaterThanOrEqual(1);
    expect(r.scamRisk).toBeGreaterThanOrEqual(0);
    expect(r.negotiation.targetCents).toBeGreaterThan(0);
    expect(r.negotiation.arguments.length).toBeGreaterThan(0);
    expect(r.negotiation.message.length).toBeGreaterThan(40);
    expect(r.breakdown.steps.length).toBeGreaterThanOrEqual(4);
    expect(r.explanation.summary.length).toBeGreaterThan(40);
    expect(r.explanation.priceReasoning.length).toBeGreaterThan(40);
    expect(r.explanation.riskReasoning.length).toBeGreaterThan(20);
    expect(r.explanation.recommendation.length).toBeGreaterThan(20);
    expect(r.provenance.extractionEvidence.length).toBeGreaterThan(0);
  });

  it("cada paso del cálculo es auditable", () => {
    const r = run("iPhone 15 Pro 256GB como nuevo con caja, 800€");
    for (const step of r.breakdown.steps) {
      expect(step.label.length).toBeGreaterThan(3);
      expect(step.detail.length).toBeGreaterThan(10);
    }
  });
});

describe("negociación cuando el anuncio ya es un chollo", () => {
  it("recomienda cerrar al precio pedido en lugar de regatear", () => {
    const r = run("Vendo iPhone 15 128GB negro, como nuevo, batería 97%, con caja, cargador y factura. 430€");
    expect(r.verdict).toBe("CHOLLO");
    // La oferta de apertura es el propio precio pedido: no se sugiere rebajar.
    expect(r.negotiation.openingOfferCents).toBe(r.pricing.askingCents);
    // Y el mensaje no le cita al vendedor su propio precio como referencia
    // de mercado, que era el error: acepta el precio explícitamente.
    expect(r.negotiation.message).toMatch(/me encaja el precio|lo cerramos tal cual/i);
    expect(r.negotiation.message).not.toMatch(/se están cerrando alrededor/i);
    // Los argumentos hablan de verificar y de rapidez, no de descuentos.
    expect(r.negotiation.arguments.join(" ")).toMatch(/no hay margen que ganar/i);
  });

  it("sigue proponiendo una rebaja cuando el precio está por encima del justo", () => {
    const r = run("Vendo iPhone 15 128GB buen estado. 700€");
    expect(r.negotiation.openingOfferCents).toBeLessThan(r.pricing.askingCents);
    expect(r.negotiation.arguments.join(" ")).toMatch(/por encima de lo que vale/i);
  });
});

describe("coherencia del texto del informe", () => {
  it("no llama «ahorro» al descuento de un anuncio fraudulento", () => {
    const r = run(
      "Vendo iPhone 16 Pro 128GB precintado. 480€. Estoy en Alemania, me pagas por Bizum antes del envío. Urge vender.",
    );
    expect(r.verdict).toBe("ESTAFA_PROBABLE");
    expect(r.explanation.priceReasoning).not.toMatch(/el ahorro frente al mercado/i);
    expect(r.explanation.priceReasoning).toMatch(/señuelo/i);
  });

  it("sí lo llama ahorro cuando la compra es legítima", () => {
    const r = run("Vendo iPhone 15 128GB como nuevo con caja y factura. 430€");
    expect(r.explanation.priceReasoning).toMatch(/el ahorro frente al mercado/i);
  });

  it("escribe los porcentajes con coma decimal", () => {
    const r = run("iPhone 14 Pro 256GB buen estado con caja y cargador, 620€");
    // "46.03 %" sería incorrecto en español; debe ser "46,03 %".
    expect(r.explanation.priceReasoning).not.toMatch(/\d+\.\d+ %/);
  });
});
