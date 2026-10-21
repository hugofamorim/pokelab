import { describe, expect, it } from 'vitest';
import { POKEMON_TYPES, toMetric } from './index';
describe('domain values', () => {
  it('defines exactly 18 distinct modern types', () =>
    expect(new Set(POKEMON_TYPES).size).toBe(18));
  it('converts upstream measurements without rounding', () => {
    expect(toMetric(4)).toBe(0.4);
    expect(toMetric(60)).toBe(6);
    expect(toMetric(0)).toBe(0);
  });
  it.each([-1, NaN, Infinity])('rejects invalid measurement %s', (value) =>
    expect(() => toMetric(value)).toThrow(RangeError),
  );
});
