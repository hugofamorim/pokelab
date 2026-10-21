import { afterEach, describe, expect, it, vi } from 'vitest';
import { catalogHref, parseCatalogPage, parseSummaryBatch } from './catalog';
import { getCatalogPage, getSummaryBatch } from './catalog-server';
import { GET } from '../app/api/catalog/summaries/route';

const meta = {
  source: 'pokeapi-v2',
  fetchedAt: '2026-10-21T00:00:00Z',
  stale: false,
};
const unavailable = (id: number) => ({
  id,
  status: 'unavailable',
  code: 'UPSTREAM_UNAVAILABLE',
});
const page = {
  items: [{ id: 25, name: 'pikachu' }],
  page: 1,
  pageSize: 12,
  total: 1,
  hasNext: false,
  meta,
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('catalog query and boundaries', () => {
  it('uses fixed page size and bounded shareable page URLs', () => {
    expect(parseCatalogPage({})).toBe(1);
    expect(parseCatalogPage({ page: '1000' })).toBe(1000);
    expect(catalogHref(2)).toBe('/pokedex?page=2');
  });
  it.each([
    { page: '0' },
    { page: '1001' },
    { page: '01' },
    { page: '1\n' },
    { page: ['1', '2'] },
    { search: 'pika' },
    { pageSize: '12' },
    { type: 'grass' },
  ])('rejects unsupported UI queries %j', (query) => {
    expect(parseCatalogPage(query)).toBeNull();
  });
  it('rejects omitted, reordered, duplicate and unexpected summary IDs', () => {
    const items = [unavailable(1), unavailable(25)];
    expect(parseSummaryBatch({ items }, [1, 25])).toEqual({ items });
    for (const invalid of [
      items.slice(0, 1),
      [...items].reverse(),
      [items[0], items[0]],
      [items[0], unavailable(26)],
    ])
      expect(parseSummaryBatch({ items: invalid }, [1, 25])).toBeNull();
  });
});
describe('server catalog client and same-origin summary gateway', () => {
  it('constructs only bounded Nest paths and validates page identity', async () => {
    const fetcher = vi
      .fn()
      .mockImplementation(async () => new Response(JSON.stringify(page)));
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('API_URL', 'http://api.internal:3001');
    expect(await getCatalogPage(1)).toEqual(page);
    expect(String(fetcher.mock.calls[0]?.[0])).toBe(
      'http://api.internal:3001/v1/pokemon?page=1&pageSize=12',
    );
    expect(await getCatalogPage(2)).toBeNull();
    expect(await getCatalogPage(0)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('returns unavailable for malformed pages, HTTP failures and network errors', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}'))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }))
      .mockRejectedValueOnce(new Error('private trace'));
    vi.stubGlobal('fetch', fetcher);
    for (let i = 0; i < 3; i++) expect(await getCatalogPage(1)).toBeNull();
  });
  it('validates summary batches before and after upstream access', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [unavailable(25)] })),
      )
      .mockResolvedValueOnce(
        new Response(JSON.stringify({ items: [unavailable(26)] })),
      );
    vi.stubGlobal('fetch', fetcher);
    expect(await getSummaryBatch({ ids: '25' })).toEqual({
      items: [unavailable(25)],
    });
    expect(await getSummaryBatch({ ids: '25' })).toBeNull();
    expect(await getSummaryBatch({ ids: '25,25' })).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([
    '',
    'ids=25&ids=26',
    'ids=25&url=https://evil.test',
    'ids=25%0A',
    'ids=01',
  ])('gateway rejects %s without upstream access', async (query) => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(
      (await GET(new Request('http://web.test/api/catalog/summaries?' + query)))
        .status,
    ).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('returns no-store results and sanitizes gateway failures', async () => {
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockResolvedValueOnce(
          new Response(JSON.stringify({ items: [unavailable(25)] })),
        )
        .mockRejectedValueOnce(new Error('database password trace')),
    );
    const result = await GET(
      new Request('http://web.test/api/catalog/summaries?ids=25'),
    );
    expect(result.status).toBe(200);
    expect(result.headers.get('cache-control')).toBe('no-store');
    expect(await result.json()).toEqual({ items: [unavailable(25)] });
    const failure = await GET(
      new Request('http://web.test/api/catalog/summaries?ids=25'),
    );
    expect(failure.status).toBe(503);
    expect(await failure.json()).toEqual({ code: 'CATALOG_UNAVAILABLE' });
  });
});
