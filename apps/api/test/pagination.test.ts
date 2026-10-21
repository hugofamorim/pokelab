import { jest } from '@jest/globals';
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import fixture from './fixtures/pokemon-page.json' with { type: 'json' };
import detail from './fixtures/pikachu.json' with { type: 'json' };
import { pokemonPageResponseSchema } from '@pokelab/contracts';
import { PokeApiAdapter } from '../src/pokeapi-adapter.js';
import { CatalogService } from '../src/catalog.service.js';
import { AppModule } from '../src/app.module.js';
import { ApiErrorFilter } from '../src/errors.js';
import { CONFIG } from '../src/config.js';
import type { Config } from '../src/config.js';
import { RESOURCE_CACHE } from '../src/cache.js';
import type { CacheEntry, ResourceCache } from '../src/cache.js';

class MemoryCache implements ResourceCache {
  readonly entries = new Map<string, CacheEntry>();
  async get(key: string) {
    return this.entries.get(key) ?? null;
  }
  async set(key: string, entry: CacheEntry) {
    this.entries.set(key, entry);
  }
}
const config: Config = {
  DATABASE_URL: 'postgresql://unused:unused@localhost/unused',
  PORT: 3001,
  POKEAPI_TIMEOUT_MS: 100,
  POKEAPI_CACHE_TTL_SECONDS: 86400,
};
const response = (body: unknown = fixture, status = 200) =>
  new Response(JSON.stringify(body), { status });
const query = { page: 1, pageSize: 2 };

describe('resource-page adapter', () => {
  it('performs one bounded request and returns only entry references', async () => {
    const fetcher = jest.fn<typeof fetch>().mockResolvedValue(response());
    const page = await new PokeApiAdapter(100, fetcher).list(query);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://pokeapi.co/api/v2/pokemon/?limit=2&offset=0',
    );
    expect(page).toEqual({
      items: [
        { id: 1, name: 'bulbasaur' },
        { id: 2, name: 'ivysaur' },
      ],
      page: 1,
      pageSize: 2,
      total: fixture.count,
      hasNext: true,
    });
    expect(page.items[0]).not.toHaveProperty('species');
    expect(page.items[0]).not.toHaveProperty('artwork');
  });
  it('constructs offsets arithmetically and ignores next/previous URLs', async () => {
    const fetcher = jest.fn<typeof fetch>().mockResolvedValue(
      response({
        ...fixture,
        next: 'https://evil.test',
        previous: 'http://localhost/private',
      }),
    );
    await new PokeApiAdapter(100, fetcher).list({ page: 2, pageSize: 2 });
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://pokeapi.co/api/v2/pokemon/?limit=2&offset=2',
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('handles a final partial page and an empty out-of-range page', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({ count: 3, results: fixture.results.slice(0, 1) }),
      )
      .mockResolvedValueOnce(response({ count: 3, results: [] }));
    const adapter = new PokeApiAdapter(100, fetcher);
    expect(await adapter.list({ page: 2, pageSize: 2 })).toMatchObject({
      total: 3,
      hasNext: false,
      items: [{ id: 1 }],
    });
    expect(await adapter.list({ page: 3, pageSize: 2 })).toMatchObject({
      total: 3,
      hasNext: false,
      items: [],
    });
  });
  it('accepts up to 50 results without detail fan-out', async () => {
    const results = Array.from({ length: 50 }, (_, i) => ({
      name: `entry-${i + 1}`,
      url: `https://pokeapi.co/api/v2/pokemon/${i + 1}/`,
    }));
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValue(response({ count: 50, results }));
    expect(
      (await new PokeApiAdapter(100, fetcher).list({ page: 1, pageSize: 50 }))
        .items,
    ).toHaveLength(50);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    { page: 0, pageSize: 2 },
    { page: 1001, pageSize: 2 },
    { page: 1, pageSize: 51 },
    { page: 1.5, pageSize: 2 },
  ])('rejects invalid adapter pagination before fetch: %j', async (value) => {
    const fetcher = jest.fn<typeof fetch>();
    await expect(
      new PokeApiAdapter(100, fetcher).list(value),
    ).rejects.toMatchObject({ status: 400 });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { count: -1, results: [] },
    { count: 1, results: fixture.results },
    { count: fixture.count, results: [] },
    { count: 2, results: [fixture.results[0], fixture.results[0]] },
    { count: 1, results: [{ name: 'bulbasaur', url: 'https://evil.test/1/' }] },
    {
      count: 1,
      results: [
        {
          name: 'bulbasaur',
          url: 'https://pokeapi.co/api/v2/pokemon-species/1/',
        },
      ],
    },
    {
      count: 1,
      results: [
        {
          name: 'bulbasaur',
          url: 'https://pokeapi.co/api/v2/pokemon/1/?secret=1',
        },
      ],
    },
    {
      count: 1,
      results: [
        {
          name: 'bulbasaur',
          url: 'https://pokeapi.co/api/v2/pokemon/1000000/',
        },
      ],
    },
    { count: 3, results: [...fixture.results, fixture.results[0]] },
  ])(
    'rejects malformed, excessive or unsafe pages without retries: %j',
    async (body) => {
      const fetcher = jest
        .fn<typeof fetch>()
        .mockImplementation(async () => response(body));
      await expect(
        new PokeApiAdapter(100, fetcher).list(query),
      ).rejects.toMatchObject({ status: 502 });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('retries transient failures once and treats a missing listing as unavailable', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValueOnce(response());
    const adapter = new PokeApiAdapter(100, fetcher, async () => {});
    expect((await adapter.list(query)).total).toBe(fixture.count);
    fetcher.mockReset().mockImplementation(async () => response({}, 404));
    await expect(adapter.list(query)).rejects.toMatchObject({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('paginated service cache and global admission', () => {
  it('deduplicates equivalent/default queries, persists pages and separates page sizes', async () => {
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async (url) => {
      const limit = Number(new URL(String(url)).searchParams.get('limit'));
      return response({
        ...fixture,
        count: 2,
        results: fixture.results.slice(0, limit),
      });
    });
    const cache = new MemoryCache();
    const adapter = new PokeApiAdapter(100, fetcher);
    const service = new CatalogService(cache, adapter, config);
    const [first, duplicate] = await Promise.all([
      service.list({}),
      service.list({ page: '1', pageSize: '20' }),
    ]);
    expect(first).toEqual(duplicate);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(await new CatalogService(cache, adapter, config).list({})).toEqual(
      first,
    );
    await service.list({ pageSize: '1' });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('serves validated stale pages during an outage, preserving freshness', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () => response());
    const cache = new MemoryCache();
    const service = new CatalogService(
      cache,
      new PokeApiAdapter(100, fetcher, async () => {}),
      config,
    );
    const first = await service.list({ pageSize: '2' });
    for (const entry of cache.entries.values()) entry.expiresAt = new Date(0);
    fetcher.mockRejectedValue(new Error('offline'));
    expect(await service.list({ pageSize: '2' })).toEqual({
      ...first,
      meta: { ...first.meta, stale: true },
    });
  });
  it('does not serve a valid page cached under the wrong query key', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () => response({ ...fixture, count: 2 }));
    const cache = new MemoryCache();
    const service = new CatalogService(
      cache,
      new PokeApiAdapter(100, fetcher, async () => {}),
      config,
    );
    const first = await service.list({ pageSize: '2' });
    cache.entries.set('pokeapi-v2:normalized-v1:pokemon-page/2/2', {
      payload: first,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 10000),
    });
    fetcher.mockRejectedValue(new Error('offline'));
    await expect(
      service.list({ page: '2', pageSize: '2' }),
    ).rejects.toMatchObject({ status: 503 });
  });
  it('shares four slots between page and detail requests and releases them after failure', async () => {
    const releases: (() => void)[] = [];
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(
        () =>
          new Promise((resolve) =>
            releases.push(() => resolve(response({}, 404))),
          ),
      );
    const service = new CatalogService(
      new MemoryCache(),
      new PokeApiAdapter(1000, fetcher, async () => {}),
      config,
    );
    const pending = ['1', '2', '3', '4'].map((id) =>
      service.get(id).catch(() => null),
    );
    await expect(service.list({})).rejects.toMatchObject({
      code: 'CATALOG_BUSY',
    });
    await new Promise((resolve) => setImmediate(resolve));
    releases.forEach((release) => release());
    await Promise.all(pending);
    fetcher.mockImplementation(async () => response());
    expect((await service.list({ pageSize: '2' })).items).toHaveLength(2);
  });
  it('rejects unknown query fields and database outages without upstream requests', async () => {
    const fetcher = jest.fn<typeof fetch>();
    const cache: ResourceCache = {
      get: async () => {
        throw new Error('internal detail');
      },
      set: async () => {},
    };
    const service = new CatalogService(
      cache,
      new PokeApiAdapter(100, fetcher),
      config,
    );
    await expect(service.list({ search: 'pika' })).rejects.toMatchObject({
      code: 'INVALID_PAGINATION',
    });
    await expect(service.list({})).rejects.toMatchObject({
      code: 'CACHE_UNAVAILABLE',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('GET /v1/pokemon', () => {
  let app: INestApplication;
  const fetcher = jest
    .fn<typeof fetch>()
    .mockImplementation(async (url) =>
      String(url).includes('?')
        ? response({ ...fixture, count: 2 })
        : response(detail),
    );
  beforeAll(async () => {
    const { Test } = await import('@nestjs/testing');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CONFIG)
      .useValue(config)
      .overrideProvider(RESOURCE_CACHE)
      .useValue(new MemoryCache())
      .overrideProvider(PokeApiAdapter)
      .useValue(new PokeApiAdapter(100, fetcher, async () => {}))
      .compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new ApiErrorFilter());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('defaults to a cached page and keeps the detail route functional', async () => {
    const first = await request(app.getHttpServer())
      .get('/v1/pokemon')
      .expect(200);
    expect(pokemonPageResponseSchema.safeParse(first.body).success).toBe(true);
    expect(first.body).toMatchObject({
      page: 1,
      pageSize: 20,
      total: 2,
      hasNext: false,
    });
    const duplicate = await request(app.getHttpServer())
      .get('/v1/pokemon?page=1&pageSize=20')
      .expect(200);
    expect(duplicate.body).toEqual(first.body);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      (await request(app.getHttpServer()).get('/v1/pokemon/25').expect(200))
        .body.data.id,
    ).toBe(25);
  });
  it.each([
    'page=0',
    'page=1001',
    'pageSize=51',
    'page=1&page=2',
    'pageSize=1&pageSize=2',
    'page=1.2',
    'search=pika',
    'type=grass',
    'generation=1',
    'offset=0',
  ])('returns a safe 400 for %s', async (queryString) => {
    const before = fetcher.mock.calls.length;
    const result = await request(app.getHttpServer())
      .get(`/v1/pokemon?${queryString}`)
      .expect(400);
    expect(result.body).toMatchObject({
      code: 'INVALID_PAGINATION',
      requestId: expect.any(String),
    });
    expect(result.body).not.toHaveProperty('stack');
    expect(fetcher).toHaveBeenCalledTimes(before);
  });
  it('returns safe upstream failures and a valid empty page', async () => {
    fetcher.mockImplementation(async () => response({}, 503));
    const failure = await request(app.getHttpServer())
      .get('/v1/pokemon?page=2&pageSize=1')
      .expect(503);
    expect(failure.body).toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      requestId: expect.any(String),
    });
    fetcher.mockImplementation(async () => response({ count: 2, results: [] }));
    expect(
      (
        await request(app.getHttpServer())
          .get('/v1/pokemon?page=3&pageSize=1')
          .expect(200)
      ).body,
    ).toMatchObject({ items: [], total: 2, hasNext: false });
  });
});
