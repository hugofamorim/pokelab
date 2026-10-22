import { describe, expect, it } from 'vitest';
import { POKEMON_TYPES } from '@pokelab/pokemon-domain';
import {
  pokemonCatalogQuerySchema,
  pokemonTypeIndexSchema,
  TYPE_FILTER_LIMITS,
} from './type-filter';
import { pokemonCatalogPageResponseSchema } from './index';

describe('single-type catalog contracts', () => {
  it('keeps unfiltered defaults and accepts all eighteen canonical types', () => {
    expect(pokemonCatalogQuerySchema.parse({})).toEqual({
      page: 1,
      pageSize: 20,
    });
    for (const type of POKEMON_TYPES)
      expect(
        pokemonCatalogQuerySchema.parse({ type, page: '1000', pageSize: '50' }),
      ).toEqual({ type, page: 1000, pageSize: 50 });
  });
  it.each([
    { type: '' },
    { type: 'Electric' },
    { type: ' electric' },
    { type: 'electric\n' },
    { type: 'electric,water' },
    { type: ['electric', 'water'] },
    { type: 'stellar' },
    { type: '13' },
    { type: 'https://evil.test' },
    { type: 'electric', search: 'pikachu' },
    { type: 'electric', generation: '1' },
    { type: 'electric', page: '01' },
    { type: 'electric', page: '1\n' },
    { type: 'electric', pageSize: '51' },
  ])('rejects ambiguous/unsupported queries %j', (query) => {
    expect(pokemonCatalogQuerySchema.safeParse(query).success).toBe(false);
  });
  it('requires unique ascending entry IDs and unique names, allowing empty membership', () => {
    const items = [
      { id: 25, name: 'pikachu' },
      { id: 10036, name: 'raichu-alola' },
    ];
    expect(
      pokemonTypeIndexSchema.safeParse({ type: 'electric', items }).success,
    ).toBe(true);
    expect(
      pokemonTypeIndexSchema.safeParse({ type: 'electric', items: [] }).success,
    ).toBe(true);
    for (const invalid of [
      [...items].reverse(),
      [items[0], items[0]],
      [items[0], { id: 26, name: 'pikachu' }],
    ])
      expect(
        pokemonTypeIndexSchema.safeParse({ type: 'electric', items: invalid })
          .success,
      ).toBe(false);
  });
  it('bounds membership independently of page size and preserves optional filter identity', () => {
    const items = Array.from(
      { length: TYPE_FILTER_LIMITS.maxMembers },
      (_, i) => ({ id: i + 1, name: `entry-${i + 1}` }),
    );
    expect(
      pokemonTypeIndexSchema.safeParse({ type: 'normal', items }).success,
    ).toBe(true);
    expect(
      pokemonTypeIndexSchema.safeParse({
        type: 'normal',
        items: [...items, { id: 10001, name: 'entry-10001' }],
      }).success,
    ).toBe(false);
    const page = {
      items: [{ id: 25, name: 'pikachu' }],
      page: 1,
      pageSize: 20,
      total: 1,
      hasNext: false,
      meta: {
        source: 'pokeapi-v2',
        fetchedAt: '2026-10-21T00:00:00Z',
        stale: false,
      },
    };
    expect(pokemonCatalogPageResponseSchema.parse(page)).not.toHaveProperty(
      'type',
    );
    expect(
      pokemonCatalogPageResponseSchema.parse({ ...page, type: 'electric' })
        .type,
    ).toBe('electric');
  });
});
