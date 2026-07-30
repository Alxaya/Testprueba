/**
 * Formateo monetario en formato español, sin depender de `Intl`.
 *
 * Por qué a mano: `toLocaleString("es-ES")` necesita los datos de ICU completos
 * y hay entornos de ejecución (Node compilado con small-icu, algunos runtimes
 * serverless) donde devuelve "1300 €" en lugar de "1.300 €". Un importe mal
 * agrupado en una aplicación de precios es un error visible para el usuario, así
 * que la agrupación se hace de forma explícita y el resultado es idéntico en
 * cualquier entorno.
 */

/** Agrupa la parte entera con el punto de miles español. */
export function groupThousands(value: string): string {
  return value.replace(/\B(?=(\d{3})+(?!\d))/g, ".");
}

/**
 * Formatea céntimos como importe en euros.
 *  formatEuros(129999)                 → "1.300 €"
 *  formatEuros(129999, { decimals: 2 }) → "1.299,99 €"
 */
export function formatEuros(
  cents: number,
  options: { decimals?: 0 | 2; sign?: boolean } = {},
): string {
  const decimals = options.decimals ?? 0;
  const negative = cents < 0;
  const absolute = Math.abs(cents);

  let body: string;
  if (decimals === 2) {
    const whole = Math.floor(absolute / 100);
    const fraction = (absolute % 100).toString().padStart(2, "0");
    body = `${groupThousands(String(whole))},${fraction}`;
  } else {
    body = groupThousands(String(Math.round(absolute / 100)));
  }

  const prefix = negative ? "−" : options.sign && absolute > 0 ? "+" : "";
  // Espacio fino irrompible antes del símbolo, como marca la convención española.
  return `${prefix}${body} €`;
}

/** Formatea un número entero con separador de miles (sin símbolo de moneda). */
export function formatInteger(value: number): string {
  return groupThousands(String(Math.round(value)));
}

/** Formatea un porcentaje con un decimal como máximo. */
export function formatPercent(value: number, decimals = 0): string {
  const fixed = value.toFixed(decimals);
  const [whole = "0", fraction] = fixed.split(".");
  const body = groupThousands(whole.replace("-", ""));
  const sign = value < 0 ? "−" : "";
  return `${sign}${body}${fraction ? `,${fraction}` : ""} %`;
}
