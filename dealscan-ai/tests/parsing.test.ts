import { describe, expect, it } from "vitest";
import { htmlToText } from "@/lib/fetch-listing";
import { negatedSpans, normalize, extractPrice } from "@/lib/valuation/extract";
import { eur, storage, verdictTone, scoreTone, riskTone } from "@/lib/format";
import { formatEuros, formatPercent } from "@/lib/money";

describe("extracción de texto de una página de anuncio", () => {
  it("prioriza los metadatos Open Graph y el JSON-LD", () => {
    const html = `
      <html><head>
        <title>Wallapop</title>
        <meta property="og:title" content="iPhone 14 Pro 256GB" />
        <meta property="og:description" content="Buen estado, con caja. 620 euros" />
        <script type="application/ld+json">
          {"@type":"Product","name":"iPhone 14 Pro","offers":{"price":620,"priceCurrency":"EUR"}}
        </script>
      </head>
      <body><script>var x = "no debe aparecer";</script>
        <div>Descripción del anuncio: batería al 89%.</div>
      </body></html>`;

    const text = htmlToText(html);
    expect(text).toContain("iPhone 14 Pro 256GB");
    expect(text).toContain("620 euros");
    expect(text).toContain("price: 620");
    expect(text).toContain("batería al 89%");
    // El contenido de <script> no debe filtrarse al texto analizado.
    expect(text).not.toContain("no debe aparecer");
  });

  it("decodifica entidades HTML", () => {
    const text = htmlToText("<p>Precio: 450&nbsp;&euro; &amp; negociable</p>");
    expect(text).toContain("450 €");
    expect(text).toContain("& negociable");
  });

  it("limita el tamaño del texto extraído", () => {
    const text = htmlToText(`<p>${"palabra ".repeat(5000)}</p>`);
    expect(text.length).toBeLessThanOrEqual(12_000);
  });
});

describe("alcance de las negaciones", () => {
  it("cubre toda la enumeración tras «sin»", () => {
    const text = normalize("sin caja ni cargador ni factura");
    const spans = negatedSpans(text);
    // Todos los elementos enumerados caen dentro del mismo tramo negado.
    const end = Math.max(...spans.map(([, e]) => e));
    expect(end).toBeGreaterThanOrEqual(text.indexOf("factura"));
  });

  it("se corta al llegar a «pero con»", () => {
    const text = normalize("sin caja pero con cargador");
    const spans = negatedSpans(text);
    const end = Math.max(...spans.map(([, e]) => e));
    expect(end).toBeLessThan(text.indexOf("cargador"));
  });

  it("no se extiende más allá de una frase", () => {
    const text = normalize("sin factura. Incluye cargador original");
    const spans = negatedSpans(text);
    const end = Math.max(...spans.map(([, e]) => e));
    expect(end).toBeLessThan(text.indexOf("cargador"));
  });
});

describe("detección del precio pedido", () => {
  it("prefiere el precio explícito sobre otras cifras", () => {
    const result = extractPrice("iPhone 15. Precio: 540€. Lo compré por 959€ hace dos años.");
    expect(result?.cents).toBe(54000);
  });

  it("descarta los gastos de envío", () => {
    const result = extractPrice("Vendo por 300€, gastos de envío 6€");
    expect(result?.cents).toBe(30000);
  });

  it("entiende el símbolo delante del importe", () => {
    expect(extractPrice("Vendo iPhone. € 450")?.cents).toBe(45000);
  });

  it("devuelve null si no hay precio", () => {
    expect(extractPrice("Vendo iPhone 14 en buen estado, 128GB")).toBeNull();
  });
});

describe("formateo", () => {
  it("formatea euros en formato español", () => {
    expect(eur(129999)).toBe("1.300 €");
    expect(eur(45000)).toBe("450 €");
    expect(eur(45050, { decimals: true })).toBe("450,50 €");
  });

  it("formatea el almacenamiento", () => {
    expect(storage(128)).toBe("128 GB");
    expect(storage(1024)).toBe("1 TB");
    expect(storage(2048)).toBe("2 TB");
    expect(storage(null)).toBeNull();
  });

  it("asigna un tono a cada veredicto", () => {
    for (const verdict of ["CHOLLO", "CORRECTO", "CARO", "ESTAFA_PROBABLE"] as const) {
      const tone = verdictTone(verdict);
      expect(tone.label.length).toBeGreaterThan(3);
      expect(tone.text).toMatch(/^text-/);
    }
  });

  it("el tono de la puntuación empeora al bajar la nota", () => {
    expect(scoreTone(90)).toBe("text-good");
    expect(scoreTone(20)).toBe("text-bad");
    expect(riskTone(80)).toBe("text-bad");
    expect(riskTone(5)).toBe("text-good");
  });
});

describe("formateo monetario independiente de ICU", () => {
  it("agrupa los miles con punto en cualquier entorno", () => {
    // Esta prueba es la que garantiza que la aplicación no muestre "1300 €"
    // en runtimes sin los datos completos de ICU.
    expect(formatEuros(129999)).toBe("1.300 €");
    expect(formatEuros(100000000)).toBe("1.000.000 €");
    expect(formatEuros(45000)).toBe("450 €");
    expect(formatEuros(99)).toBe("1 €");
  });

  it("respeta los decimales cuando se piden", () => {
    expect(formatEuros(129999, { decimals: 2 })).toBe("1.299,99 €");
    expect(formatEuros(45050, { decimals: 2 })).toBe("450,50 €");
    expect(formatEuros(5, { decimals: 2 })).toBe("0,05 €");
  });

  it("marca los importes negativos", () => {
    expect(formatEuros(-6200)).toBe("−62 €");
  });

  it("formatea porcentajes en formato español", () => {
    expect(formatPercent(12.5, 1)).toBe("12,5 %");
    expect(formatPercent(48)).toBe("48 %");
    expect(formatPercent(-11.2, 1)).toBe("−11,2 %");
  });
});
