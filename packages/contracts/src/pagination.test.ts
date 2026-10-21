import { describe, expect, it } from 'vitest';
import { pokemonListQuerySchema, pokemonPageSchema } from './pagination';

describe('pagination contracts', () => {
  it('defaults to the first 20 entries', () => {
    expect(pokemonListQuerySchema.parse({})).toEqual({ page: 1, pageSize: 20 });
  });
  it('accepts bounded integer query strings', () => {
    expect(
      pokemonListQuerySchema.parse({ page: '1000', pageSize: '50' }),
    ).toEqual({ page: 1000, pageSize: 50 });
  });
  it.each([
    { page: '0' },
    { page: '-1' },
    { page: '1.5' },
    { page: '1e2' },
    { page: '01' },
    { page: '' },
    { page: ' 1' },
    { page: '1\n' },
    { pageSize: '2\n' },
    { page: '1001' },
    { page: '999999999999999999' },
    { page: ['1', '2'] },
    { page: 1 },
    { pageSize: '0' },
    { pageSize: '51' },
    { pageSize: 'NaN' },
    { pageSize: ['1', '2'] },
    { search: 'pika' },
    { type: 'grass' },
    { generation: '1' },
    { offset: '0' },
    { url: 'https://example.com' },
  ])('rejects ambiguous, unbounded or unsupported parameters %j', (query) => {
    expect(pokemonListQuerySchema.safeParse(query).success).toBe(false);
  });
  const item = { id: 1, name: 'bulbasaur' };
  it('accepts a final partial page and an empty page beyond the total', () => {
    expect(
      pokemonPageSchema.safeParse({
        items: [item],
        page: 2,
        pageSize: 2,
        total: 3,
        hasNext: false,
      }).success,
    ).toBe(true);
    expect(
      pokemonPageSchema.safeParse({
        items: [],
        page: 3,
        pageSize: 2,
        total: 3,
        hasNext: false,
      }).success,
    ).toBe(true);
  });
  it.each([
    { items: [item, item], page: 1, pageSize: 2, total: 2, hasNext: false },
    { items: [item], page: 1, pageSize: 2, total: 10, hasNext: true },
    { items: [item], page: 1, pageSize: 1, total: 2, hasNext: false },
    { items: [], page: 1, pageSize: 1, total: 0, hasNext: true },
    { items: [], page: 1, pageSize: 1, total: -1, hasNext: false },
  ])('rejects inconsistent pagination metadata %j', (page) => {
    expect(pokemonPageSchema.safeParse(page).success).toBe(false);
  });
});
