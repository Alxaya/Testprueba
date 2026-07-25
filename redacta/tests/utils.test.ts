import { describe, expect, it } from 'vitest';
import {
  countWords,
  currentPeriod,
  formatCurrency,
  pluralize,
  readingMinutes,
  slugify,
  truncate,
} from '@/lib/utils';

describe('slugify', () => {
  it('normaliza acentos y espacios', () => {
    expect(slugify('Camión de Reparto Rápido')).toBe('camion-de-reparto-rapido');
  });

  it('elimina simbolos y guiones repetidos', () => {
    expect(slugify('¡Oferta!! 2x1 -- ya')).toBe('oferta-2x1-ya');
  });

  it('acota la longitud', () => {
    expect(slugify('a'.repeat(200)).length).toBeLessThanOrEqual(60);
  });
});

describe('countWords', () => {
  it('cuenta palabras ignorando espacios sobrantes', () => {
    expect(countWords('  hola   mundo  ')).toBe(2);
    expect(countWords('')).toBe(0);
  });
});

describe('truncate', () => {
  it('respeta las palabras completas y anade puntos suspensivos', () => {
    const result = truncate('uno dos tres cuatro cinco', 12);
    expect(result.endsWith('…')).toBe(true);
    expect(result.length).toBeLessThanOrEqual(13);
  });

  it('no toca los textos que caben', () => {
    expect(truncate('corto', 20)).toBe('corto');
  });
});

describe('readingMinutes', () => {
  it('devuelve al menos un minuto', () => {
    expect(readingMinutes('dos palabras')).toBe(1);
  });

  it('escala con la longitud', () => {
    expect(readingMinutes('palabra '.repeat(1000))).toBeGreaterThan(4);
  });
});

describe('currentPeriod', () => {
  it('usa el mes natural cuando no hay periodo de Stripe', () => {
    const { start, end } = currentPeriod(null);
    expect(start.getUTCDate()).toBe(1);
    expect(end.getTime()).toBeGreaterThan(start.getTime());
  });

  it('se ancla al fin de periodo de Stripe cuando existe y es futuro', () => {
    const anchor = new Date(Date.now() + 10 * 24 * 60 * 60 * 1000);
    const { start, end } = currentPeriod(anchor);
    expect(end.getTime()).toBe(anchor.getTime());
    expect(start.getTime()).toBeLessThan(end.getTime());
  });
});

describe('formatCurrency', () => {
  it('formatea centimos como euros', () => {
    expect(formatCurrency(1234)).toContain('12,34');
  });
});

describe('pluralize', () => {
  it('usa el singular con uno', () => {
    expect(pluralize(1, 'proyecto')).toBe('1 proyecto');
    expect(pluralize(1, 'proyecto activo', 'proyectos activos')).toBe('1 proyecto activo');
  });

  it('usa el plural con cero y con varios', () => {
    expect(pluralize(0, 'pieza')).toBe('0 piezas');
    expect(pluralize(3, 'pieza')).toBe('3 piezas');
  });

  it('acepta un plural irregular', () => {
    expect(pluralize(2, 'pieza guardada', 'piezas guardadas')).toBe('2 piezas guardadas');
  });
});
