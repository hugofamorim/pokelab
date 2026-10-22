import { describe, expect, it } from 'vitest';
import {
  generationSpeciesQuerySchema,
  generationSpeciesIndexSchema,
  generationSpeciesPageSchema,
  GENERATION_NAMES,
  GENERATION_LIMITS,
} from './generation';
import {
  generationSpeciesPageResponseSchema,
  pokemonReferenceSchema,
} from './index';

const generation = { id: 1, name: 'generation-i' };
const items = [
  { speciesId: 1, name: 'bulbasaur' },
  { speciesId: 413, name: 'wormadam' },
];
describe('species-introduction generation contracts', () => {
  it('requires a generation and defaults bounded pagination', () => {
    for (const id of GENERATION_NAMES.keys())
      expect(
        generationSpeciesQuerySchema.parse({ generation: String(id + 1) }),
      ).toEqual({ generation: id + 1, page: 1, pageSize: 20 });
    expect(
      generationSpeciesQuerySchema.parse({
        generation: '9',
        page: '1000',
        pageSize: '50',
      }),
    ).toEqual({ generation: 9, page: 1000, pageSize: 50 });
  });
  it.each([
    {},
    { generation: '' },
    { generation: '0' },
    { generation: '10' },
    { generation: '01' },
    { generation: '1\n' },
    { generation: ' 1' },
    { generation: '1.0' },
    { generation: '1e0' },
    { generation: 1 },
    { generation: 'generation-i' },
    { generation: ['1', '2'] },
    { generation: '1,2' },
    { generation: '1', type: 'grass' },
    { generation: '1', search: '25' },
    { generation: '1', page: '0' },
    { generation: '1', page: '01' },
    { generation: '1', pageSize: '51' },
    { generation: '1', page: ['1', '2'] },
    { generation: '1', url: 'https://evil.test' },
  ])('rejects unsupported or ambiguous input %j', (query) => {
    expect(generationSpeciesQuerySchema.safeParse(query).success).toBe(false);
  });
  it('keeps species references structurally distinct from entry references', () => {
    const result = generationSpeciesIndexSchema.parse({ generation, items });
    expect(result.items[1]).toEqual({ speciesId: 413, name: 'wormadam' });
    expect(pokemonReferenceSchema.safeParse(result.items[1]).success).toBe(
      false,
    );
    expect(
      generationSpeciesIndexSchema.safeParse({
        generation,
        items: [{ id: 413, name: 'wormadam' }],
      }).success,
    ).toBe(false);
  });
  it('rejects duplicate IDs/names, unsorted membership and wrong generation identities', () => {
    for (const value of [
      { generation: { id: 1, name: 'generation-ii' }, items },
      { generation: { id: 10, name: 'generation-x' }, items },
      { generation, items: [...items].reverse() },
      { generation, items: [items[0], items[0]] },
      { generation, items: [items[0], { speciesId: 2, name: 'bulbasaur' }] },
    ])
      expect(generationSpeciesIndexSchema.safeParse(value).success).toBe(false);
    expect(
      generationSpeciesIndexSchema.safeParse({ generation, items: [] }).success,
    ).toBe(true);
  });
  it('bounds membership separately from pages', () => {
    const members = Array.from(
      { length: GENERATION_LIMITS.maxMembers },
      (_, index) => ({
        speciesId: index + 1,
        name: `fixture-species-${index + 1}`,
      }),
    );
    expect(
      generationSpeciesIndexSchema.safeParse({ generation, items: members })
        .success,
    ).toBe(true);
    expect(
      generationSpeciesIndexSchema.safeParse({
        generation,
        items: [...members, { speciesId: 10001, name: 'fixture-extra' }],
      }).success,
    ).toBe(false);
  });
  it('validates page consistency, order, bounds and original source metadata', () => {
    const page = {
      generation,
      items,
      page: 1,
      pageSize: 20,
      total: 2,
      hasNext: false,
    };
    const meta = {
      source: 'pokeapi-v2',
      fetchedAt: '2026-10-21T00:00:00Z',
      stale: true,
    };
    expect(
      generationSpeciesPageResponseSchema.parse({ ...page, meta }),
    ).toEqual({ ...page, meta });
    for (const invalid of [
      { ...page, total: 3 },
      { ...page, hasNext: true },
      { ...page, items: [...items].reverse() },
      { ...page, items: [items[0], items[0]] },
      { ...page, page: 1001 },
      { ...page, pageSize: 51 },
      { ...page, items: [], page: 2, hasNext: true },
    ])
      expect(generationSpeciesPageSchema.safeParse(invalid).success).toBe(
        false,
      );
    expect(
      generationSpeciesPageSchema.parse({ ...page, items: [], page: 1000 }),
    ).toMatchObject({ items: [], hasNext: false });
  });
});
