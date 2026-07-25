/** Utilidades compartidas, sin dependencias externas. */

/** Une clases condicionales: cn('a', false && 'b', 'c') -> 'a c' */
export function cn(...classes: Array<string | false | null | undefined>): string {
  return classes.filter(Boolean).join(' ');
}

/** Convierte texto libre en un slug apto para URL. */
export function slugify(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9\s-]/g, '')
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-')
    .slice(0, 60);
}

/** Slug unico anadiendo un sufijo aleatorio corto. */
export function uniqueSlug(input: string): string {
  const suffix = Math.random().toString(36).slice(2, 7);
  const base = slugify(input) || 'org';
  return `${base}-${suffix}`;
}

export function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export function formatDate(date: Date | string, locale = 'es-ES'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleDateString(locale, { day: '2-digit', month: 'short', year: 'numeric' });
}

export function formatDateTime(date: Date | string, locale = 'es-ES'): string {
  const d = typeof date === 'string' ? new Date(date) : date;
  return d.toLocaleString(locale, {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function formatNumber(n: number, locale = 'es-ES'): string {
  return new Intl.NumberFormat(locale).format(n);
}

/** Centimos -> "1.234,56 €" */
export function formatCurrency(cents: number, locale = 'es-ES'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency: 'EUR' }).format(cents / 100);
}

/** Inicio y fin del periodo mensual actual, o del periodo de Stripe si existe. */
export function currentPeriod(anchor?: Date | null): { start: Date; end: Date } {
  const now = new Date();
  if (anchor && anchor > now) {
    const start = new Date(anchor);
    start.setMonth(start.getMonth() - 1);
    return { start, end: new Date(anchor) };
  }
  const start = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
  const end = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth() + 1, 1));
  return { start, end };
}

/** Minutos de lectura estimados (200 palabras/minuto). */
export function readingMinutes(text: string): number {
  return Math.max(1, Math.round(countWords(text) / 200));
}

/**
 * Concordancia de numero: pluralize(1, 'proyecto') -> "1 proyecto".
 * Evita mensajes como "1 proyectos", que delatan una interfaz descuidada.
 */
export function pluralize(count: number, singular: string, plural = `${singular}s`): string {
  return `${formatNumber(count)} ${count === 1 ? singular : plural}`;
}

/** Trunca respetando palabras completas. */
export function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return `${text.slice(0, max).replace(/\s+\S*$/, '')}…`;
}
