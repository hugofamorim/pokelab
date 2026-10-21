import { afterEach, describe, expect, it, vi } from 'vitest';
import { pokemonResponseSchema } from '@pokelab/contracts';
import {
  catalogReturnHref,
  normalizeSearch,
  parseCatalogQuery,
  searchHref,
} from './catalog-search';
import { getSearchResult } from './pokemon-search';
import captured from '../../../api/test/fixtures/catalog-details.json';

afterEach(() => vi.unstubAllGlobals());
describe('exact search URL semantics', () => {
  it('normalizes case/outer whitespace and distinguishes blank from malformed input', () => {
    expect(normalizeSearch('  BULBASAUR  ')).toBe('bulbasaur');
    expect(normalizeSearch('25')).toBe('25');
    expect(normalizeSearch('mr-mime')).toBe('mr-mime');
    expect(normalizeSearch('   ')).toBe('');
    expect(normalizeSearch('a'.repeat(65))).toBeNull();
    expect(parseCatalogQuery({ search: '' })).toEqual({
      kind: 'browse',
      page: 1,
    });
  });
  it('keeps pagination and exact lookup separate', () => {
    expect(parseCatalogQuery({ page: '2' })).toEqual({
      kind: 'browse',
      page: 2,
    });
    expect(parseCatalogQuery({ search: ' PIKACHU ' })).toEqual({
      kind: 'search',
      term: 'pikachu',
    });
    expect(searchHref('pikachu')).toBe('/pokedex?search=pikachu');
  });
  it.each([
    { search: ['pikachu', '25'] },
    { search: '25', page: '1' },
    { search: 'pikachu', type: 'electric' },
    { search: 'https://evil.test' },
    { search: '../25' },
    { search: '25/abilities' },
    { search: '01' },
    { search: '0' },
    { search: '1000000' },
    { search: '1.5' },
    { search: 'pika chu' },
    { search: '<script>' },
    { search: 'a'.repeat(65) },
  ])('rejects invalid or ambiguous input before a fetch %j', (query) => {
    expect(parseCatalogQuery(query)).toEqual({ kind: 'invalid' });
  });
  it('constructs only internal validated return links', () => {
    expect(catalogReturnHref({ fromSearch: ' PIKACHU ' })).toBe(
      '/pokedex?search=pikachu',
    );
    expect(catalogReturnHref({ fromPage: '2' })).toBe('/pokedex?page=2');
    for (const value of [
      { fromSearch: 'https://evil.test' },
      { fromSearch: ['25', '26'] },
      { fromSearch: '25', fromPage: '2' },
      { fromPage: '0' },
    ])
      expect(catalogReturnHref(value)).toBe('/pokedex?page=1');
  });
});
describe('bounded server-side exact lookup', () => {
  const data = captured[0]!;
  const payload = pokemonResponseSchema.parse({
    data,
    meta: {
      source: 'pokeapi-v2',
      fetchedAt: '2026-10-21T00:00:00Z',
      stale: false,
    },
  });
  it('fetches one normalized detail and preserves freshness', async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify(payload)));
    vi.stubGlobal('fetch', fetcher);
    expect(await getSearchResult(' BULBASAUR ')).toEqual({
      kind: 'ready',
      value: payload,
    });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain(
      '/v1/pokemon/bulbasaur',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect((await getSearchResult('1')).kind).toBe('ready');
  });
  it('refuses a schema-valid response for a different name or ID', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockImplementation(async () => new Response(JSON.stringify(payload))),
    );
    expect(await getSearchResult('pikachu')).toEqual({ kind: 'error' });
    expect(await getSearchResult('25')).toEqual({ kind: 'error' });
  });
  it('does not make calls for empty, excessive or unsafe input', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    for (const value of ['', 'https://evil.test', 'a'.repeat(65)])
      expect(await getSearchResult(value)).toEqual({ kind: 'invalid' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('distinguishes absence, malformed data and network outages', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response('{}'))
      .mockRejectedValueOnce(new Error('internal trace'));
    vi.stubGlobal('fetch', fetcher);
    expect(await getSearchResult('pika')).toEqual({ kind: 'missing' });
    expect(await getSearchResult('bulbasaur')).toEqual({ kind: 'error' });
    expect(await getSearchResult('bulbasaur')).toEqual({ kind: 'error' });
  });
});
