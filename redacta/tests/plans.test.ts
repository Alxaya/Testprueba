import { describe, expect, it } from 'vitest';
import { PlanId } from '@prisma/client';
import { PLANS, PLAN_ORDER, estimateCostCents, formatPrice, getPlan } from '@/lib/plans';

describe('catalogo de planes', () => {
  it('define los cuatro planes en orden de precio creciente', () => {
    expect(PLAN_ORDER).toHaveLength(4);
    const prices = PLAN_ORDER.map((id) => PLANS[id].priceCents);
    expect(prices).toEqual([...prices].sort((a, b) => a - b));
  });

  it('cada plan superior incluye mas generaciones que el anterior', () => {
    const limits = PLAN_ORDER.map((id) => PLANS[id].limits.generationsPerMonth);
    expect(limits).toEqual([...limits].sort((a, b) => a - b));
  });

  it('solo el plan gratuito es gratis', () => {
    expect(getPlan(PlanId.FREE).priceCents).toBe(0);
    for (const id of PLAN_ORDER.filter((p) => p !== PlanId.FREE)) {
      expect(PLANS[id].priceCents).toBeGreaterThan(0);
    }
  });

  it('marca un unico plan como recomendado', () => {
    expect(PLAN_ORDER.filter((id) => PLANS[id].highlighted)).toHaveLength(1);
  });
});

describe('formatPrice', () => {
  it('muestra los importes enteros sin decimales', () => {
    expect(formatPrice(0)).toBe('0 €');
    expect(formatPrice(1900)).toBe('19 €');
    expect(formatPrice(9900)).toBe('99 €');
  });

  it('usa coma decimal para importes no enteros', () => {
    expect(formatPrice(1950)).toBe('19,50 €');
  });
});

describe('estimateCostCents', () => {
  it('devuelve 0 cuando no se consumen tokens', () => {
    expect(estimateCostCents(0, 0)).toBe(0);
  });

  it('penaliza mas los tokens de salida que los de entrada', () => {
    expect(estimateCostCents(0, 100_000)).toBeGreaterThan(estimateCostCents(100_000, 0));
  });

  it('mantiene el coste de una generacion tipica muy por debajo del precio del plan', () => {
    // ~1.000 tokens de entrada y ~1.500 de salida: la unidad economica debe
    // dejar margen holgado incluso en el plan mas barato.
    const cost = estimateCostCents(1000, 1500);
    expect(cost).toBeLessThan(PLANS.STARTER.priceCents / PLANS.STARTER.limits.generationsPerMonth);
  });
});
