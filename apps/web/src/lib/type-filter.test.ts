import { afterEach, describe, expect, it, vi } from 'vitest';
import { POKEMON_TYPES } from '@pokelab/pokemon-domain';
import { parseCatalogQuery, catalogReturnHref } from './catalog-search';
import { catalogHref, catalogDetailHref } from './catalog';
import { getCatalogPage } from './catalog-server';

afterEach(() => vi.unstubAllGlobals());

describe('single-type catalog navigation', () => {
  it.each(POKEMON_TYPES)(
    'round-trips canonical %s through query and return URLs',
    (type) => {
      expect(parseCatalogQuery({ type })).toEqual({
        kind: 'browse',
        page: 1,
        type,
      });
      const url = new URL(catalogHref(2, type), 'http://web.test');
      expect(parseCatalogQuery(Object.fromEntries(url.searchParams))).toEqual({
        kind: 'browse',
        page: 2,
        type,
      });
      const detail = new URL(catalogDetailHref(25, 2, type), url);
      expect(catalogReturnHref(Object.fromEntries(detail.searchParams))).toBe(
        catalogHref(2, type),
      );
    },
  );
  it.each([
    { type: 'Electric' },
    { type: 'electric ' },
    { type: 'unknown' },
    { type: ['grass', 'water'] },
    { type: 'grass,water' },
    { type: '' },
    { type: 'grass', search: '' },
    { type: 'grass', search: '25' },
    { type: 'grass', page: '01' },
    { type: 'grass', generation: '1' },
  ])('rejects ambiguous or unsupported filters %j', (query) => {
    expect(parseCatalogQuery(query)).toEqual({ kind: 'invalid' });
  });
  it('rejects unsafe or conflicting return values as a whole', () => {
    for (const input of [
      { fromType: 'https://evil.test', fromPage: '2' },
      { fromType: ['grass', 'water'] },
      { fromType: 'grass', fromSearch: '25' },
      { fromType: 'grass', fromPage: '0' },
    ])
      expect(catalogReturnHref(input)).toBe(catalogHref(1));
    expect(catalogReturnHref({ fromType: 'grass' })).toBe(
      catalogHref(1, 'grass'),
    );
  });
});

describe('filtered server response identity', () => {
  const payload = {
    items: [{ id: 25, name: 'pikachu' }],
    page: 1,
    pageSize: 12,
    total: 1,
    hasNext: false,
    meta: {
      source: 'pokeapi-v2',
      fetchedAt: '2026-10-21T00:00:00Z',
      stale: true,
    },
  };
  it('constructs a bounded API query and preserves original freshness', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(
        new Response(JSON.stringify({ ...payload, type: 'electric' })),
      );
    vi.stubGlobal('fetch', fetcher);
    expect(await getCatalogPage(1, 'electric')).toEqual({
      ...payload,
      type: 'electric',
    });
    const url = new URL(String(fetcher.mock.calls[0]?.[0]));
    expect(url.pathname + url.search).toBe(
      '/v1/pokemon?page=1&pageSize=12&type=electric',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('refuses missing, substituted and unexpected type identity', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response(JSON.stringify(payload)))
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...payload, type: 'grass' })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ ...payload, type: 'electric' })),
      );
    vi.stubGlobal('fetch', fetcher);
    expect(await getCatalogPage(1, 'electric')).toBeNull();
    expect(await getCatalogPage(1, 'electric')).toBeNull();
    expect(await getCatalogPage(1)).toBeNull();
  });
});
