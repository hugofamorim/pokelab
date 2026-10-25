import { describe, expect, it } from 'vitest';
import {
  defaultVarietyQuerySchema,
  defaultVarietyMappingSchema,
  defaultVarietiesResponseSchema,
} from './index';

// Synthetic differing entry ID proves that species and Pokémon IDs are independent.
const data = {
  species: { speciesId: 413, name: 'wormadam' },
  pokemon: { id: 900001, name: 'fixture-default' },
};
const meta = {
  source: 'pokeapi-v2',
  fetchedAt: '2026-10-22T00:00:00Z',
  stale: true,
};
describe('bounded default-variety contracts', () => {
  it('accepts canonical ordered species IDs and preserves an independent mapping', () => {
    expect(
      defaultVarietyQuerySchema.parse({ speciesIds: '413,1,999999' }),
    ).toEqual({ speciesIds: [413, 1, 999999] });
    expect(defaultVarietyMappingSchema.parse(data)).toEqual(data);
    expect(
      defaultVarietiesResponseSchema.parse({
        items: [
          { speciesId: 413, status: 'ready', data, meta },
          { speciesId: 1, status: 'unavailable', code: 'SPECIES_NOT_FOUND' },
        ],
      }).items,
    ).toHaveLength(2);
  });
  it.each([
    {},
    { speciesIds: '' },
    { speciesIds: '0' },
    { speciesIds: '01' },
    { speciesIds: '1000000' },
    { speciesIds: '-1' },
    { speciesIds: '1.5' },
    { speciesIds: '1e2' },
    { speciesIds: '1\n' },
    { speciesIds: ' 1' },
    { speciesIds: '1, 2' },
    { speciesIds: '1,' },
    { speciesIds: '1,1' },
    { speciesIds: ['1', '2'] },
    { speciesIds: 1 },
    { speciesIds: 'wormadam' },
    { speciesIds: 'https://evil.test' },
    { speciesIds: '1', generation: '1' },
    { speciesIds: '1', type: 'grass' },
    { speciesIds: Array.from({ length: 13 }, (_, i) => i + 1).join(',') },
  ])('rejects unsupported query %j', (value) => {
    expect(defaultVarietyQuerySchema.safeParse(value).success).toBe(false);
  });
  it('allows exactly twelve bounded six-digit IDs and rejects more than 83 raw characters', () => {
    const speciesIds = Array.from({ length: 12 }, (_, i) => 999999 - i).join(
      ',',
    );
    expect(speciesIds).toHaveLength(83);
    expect(
      defaultVarietyQuerySchema.parse({ speciesIds }).speciesIds,
    ).toHaveLength(12);
    expect(
      defaultVarietyQuerySchema.safeParse({ speciesIds: speciesIds + ',1' })
        .success,
    ).toBe(false);
  });
  it('rejects substituted species identity, duplicate results, bad mappings and invalid freshness', () => {
    const ready = { speciesId: 413, status: 'ready', data, meta };
    for (const invalid of [
      { items: [] },
      { items: [ready, ready] },
      { items: [{ ...ready, speciesId: 1 }] },
      {
        items: [
          {
            ...ready,
            data: {
              species: { id: 413, name: 'wormadam' },
              pokemon: data.pokemon,
            },
          },
        ],
      },
      {
        items: [
          {
            ...ready,
            data: { ...data, pokemon: { id: 0, name: 'fixture-default' } },
          },
        ],
      },
      { items: [{ ...ready, meta: { ...meta, fetchedAt: 'yesterday' } }] },
      {
        items: [{ speciesId: 1, status: 'unavailable', code: 'PRIVATE_TRACE' }],
      },
      {
        items: [
          { speciesId: 1, status: 'unavailable', code: 'POKEMON_NOT_FOUND' },
        ],
      },
    ])
      expect(defaultVarietiesResponseSchema.safeParse(invalid).success).toBe(
        false,
      );
  });
});
