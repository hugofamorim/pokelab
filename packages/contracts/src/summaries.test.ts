import { describe, expect, it } from 'vitest';
import {
  pokemonSummaryQuerySchema,
  pokemonSummariesResponseSchema,
} from './index';

describe('card summary contracts', () => {
  it('accepts twelve canonical unique IDs, preserving order and form IDs', () => {
    const ids = [10025, 25, 3, 4, 5, 6, 7, 8, 9, 10, 11, 999999];
    expect(pokemonSummaryQuerySchema.parse({ ids: ids.join(',') })).toEqual({
      ids,
    });
  });
  it.each([
    {},
    { ids: '' },
    { ids: '0' },
    { ids: '01' },
    { ids: '-1' },
    { ids: '1.5' },
    { ids: '1e2' },
    { ids: '1000000' },
    { ids: '1,1' },
    { ids: '1, 2' },
    { ids: '1\n' },
    { ids: '1,' },
    { ids: ['1', '2'] },
    { ids: 25 },
    { ids: 'https://evil.test' },
    { ids: 'pikachu' },
    { ids: '1', page: '1' },
    { ids: Array.from({ length: 13 }, (_, i) => i + 1).join(',') },
  ])('rejects invalid/unbounded query %j', (query) => {
    expect(pokemonSummaryQuerySchema.safeParse(query).success).toBe(false);
  });
  it('accepts unavailable results without invented data and rejects inconsistent IDs', () => {
    const item = {
      id: 25,
      status: 'unavailable',
      code: 'UPSTREAM_UNAVAILABLE',
    };
    expect(
      pokemonSummariesResponseSchema.safeParse({ items: [item] }).success,
    ).toBe(true);
    expect(
      pokemonSummariesResponseSchema.safeParse({ items: [item, item] }).success,
    ).toBe(false);
    expect(
      pokemonSummariesResponseSchema.safeParse({ items: [] }).success,
    ).toBe(false);
    expect(
      pokemonSummariesResponseSchema.safeParse({
        items: [{ ...item, code: 'INTERNAL_SECRET' }],
      }).success,
    ).toBe(false);
    expect(
      pokemonSummariesResponseSchema.safeParse({
        items: [
          {
            id: 25,
            status: 'ready',
            data: {
              id: 26,
              name: 'raichu',
              species: { id: 26, name: 'raichu' },
              isDefault: true,
              artwork: null,
              types: ['electric'],
            },
            meta: {
              source: 'pokeapi-v2',
              fetchedAt: new Date(0).toISOString(),
              stale: false,
            },
          },
        ],
      }).success,
    ).toBe(false);
  });
});
