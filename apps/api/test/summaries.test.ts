import { jest } from '@jest/globals';
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import fixture from './fixtures/pikachu.json' with { type: 'json' };
import { pokemonSummariesResponseSchema } from '@pokelab/contracts';
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
  POKEAPI_TIMEOUT_MS: 1000,
  POKEAPI_CACHE_TTL_SECONDS: 86400,
};
const response = (body: unknown = fixture, status = 200) =>
  new Response(JSON.stringify(body), { status });
// Synthetic fixture variants test scheduling and form identity; never displayed as real data.
const variant = (id: number) => ({
  ...fixture,
  id,
  name: `entry-${id}`,
  is_default: false,
});
const idFrom = (url: unknown) => Number(String(url).split('/').at(-1));
const create = (
  fetcher: typeof fetch,
  cache: ResourceCache = new MemoryCache(),
) =>
  new CatalogService(
    cache,
    new PokeApiAdapter(1000, fetcher, async () => {}),
    config,
  );

describe('bounded summary enrichment', () => {
  it('reuses detail cache across service instances and projects only card fields', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () => response());
    const cache = new MemoryCache();
    const detail = await create(fetcher, cache).get('25');
    const result = await create(fetcher, cache).summaries({ ids: '25' });
    expect(pokemonSummariesResponseSchema.safeParse(result).success).toBe(true);
    expect(result.items[0]).toMatchObject({
      id: 25,
      status: 'ready',
      data: {
        name: 'pikachu',
        types: ['electric'],
        artwork: detail.data.artwork,
      },
      meta: detail.meta,
    });
    expect(result.items[0]).not.toHaveProperty('data.stats');
    expect(result.items[0]).not.toHaveProperty('data.abilities');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('bounds a cold twelve-ID batch to two workers, preserves order and deduplicates batches', async () => {
    const releases: (() => void)[] = [];
    let active = 0,
      peak = 0;
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async (url) => {
      active++;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active--;
      return response(variant(idFrom(url)));
    });
    const service = create(fetcher);
    const ids = [10025, 25, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12];
    const first = service.summaries({ ids: ids.join(',') });
    const duplicate = service.summaries({ ids: ids.join(',') });
    for (let i = 0; i < 6; i++) {
      await new Promise((resolve) => setImmediate(resolve));
      expect(releases.length).toBe(2);
      releases.splice(0).forEach((release) => release());
    }
    const [result, repeated] = await Promise.all([first, duplicate]);
    expect(result).toEqual(repeated);
    expect(peak).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(12);
    expect(result.items.map((item) => item.id)).toEqual(ids);
    expect(result.items[0]).toMatchObject({
      data: { id: 10025, species: { id: 25 }, isDefault: false },
    });
    expect(pokemonSummariesResponseSchema.safeParse(result).success).toBe(true);
  });
  it('shares detail in-flight work and rejects a third distinct batch until slots release', async () => {
    const releases: (() => void)[] = [];
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async (url) => {
      await new Promise<void>((resolve) => releases.push(resolve));
      return response(variant(idFrom(url)));
    });
    const service = create(fetcher);
    const detail = service.get('25');
    const one = service.summaries({ ids: '25,26' });
    const two = service.summaries({ ids: '27,28' });
    await expect(service.summaries({ ids: '29' })).rejects.toMatchObject({
      code: 'CATALOG_BUSY',
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetcher).toHaveBeenCalledTimes(4);
    releases.splice(0).forEach((release) => release());
    await Promise.all([detail, one, two]);
    fetcher.mockImplementation(async () => response());
    expect((await service.summaries({ ids: '25' })).items[0]?.status).toBe(
      'ready',
    );
  });
  it('keeps partial success, missing artwork, 404 and sanitized failures explicit', async () => {
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async (url) => {
      const id = idFrom(url);
      if (id === 26) return response({}, 404);
      if (id === 27) return response({}, 503);
      if (id === 28) return response({ secret: 'private trace' });
      return response({
        ...fixture,
        sprites: { other: { 'official-artwork': { front_default: null } } },
      });
    });
    const result = await create(fetcher).summaries({ ids: '25,26,27,28' });
    expect(result.items).toMatchObject([
      { id: 25, status: 'ready', data: { artwork: null } },
      { id: 26, status: 'unavailable', code: 'POKEMON_NOT_FOUND' },
      { id: 27, status: 'unavailable', code: 'UPSTREAM_UNAVAILABLE' },
      { id: 28, status: 'unavailable', code: 'INVALID_UPSTREAM' },
    ]);
    expect(JSON.stringify(result)).not.toContain('private trace');
    expect(fetcher).toHaveBeenCalledTimes(5);
  });
  it('keeps source freshness per item when stale data rescues an outage', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () => response());
    const cache = new MemoryCache(),
      service = create(fetcher, cache);
    const first = await service.get('25');
    for (const entry of cache.entries.values()) entry.expiresAt = new Date(0);
    fetcher.mockRejectedValue(new Error('offline'));
    expect((await service.summaries({ ids: '25,26' })).items).toMatchObject([
      { id: 25, status: 'ready', meta: { ...first.meta, stale: true } },
      { id: 26, status: 'unavailable', code: 'UPSTREAM_UNAVAILABLE' },
    ]);
  });
  it('does not use detail slots beyond the shared global limit', async () => {
    const releases: (() => void)[] = [];
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async (url) => {
      await new Promise<void>((resolve) => releases.push(resolve));
      return response(variant(idFrom(url)));
    });
    const service = create(fetcher);
    const pending = ['1', '2', '3', '4'].map((id) => service.get(id));
    expect((await service.summaries({ ids: '25,26' })).items).toEqual([
      { id: 25, status: 'unavailable', code: 'CATALOG_BUSY' },
      { id: 26, status: 'unavailable', code: 'CATALOG_BUSY' },
    ]);
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetcher).toHaveBeenCalledTimes(4);
    releases.forEach((release) => release());
    await Promise.all(pending);
  });
  it('rejects poisoned numeric cache entries and mismatched upstream IDs', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () => response());
    const cache = new MemoryCache(),
      service = create(fetcher, cache);
    await service.get('25');
    cache.entries.set(
      'pokeapi-v2:normalized-v1:pokemon/26',
      cache.entries.get('pokeapi-v2:normalized-v1:pokemon/25')!,
    );
    expect((await service.summaries({ ids: '26' })).items).toEqual([
      { id: 26, status: 'unavailable', code: 'INVALID_UPSTREAM' },
    ]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('reports cache outages without upstream fan-out', async () => {
    const fetcher = jest.fn<typeof fetch>();
    const cache: ResourceCache = {
      get: async () => {
        throw new Error('database secret');
      },
      set: async () => {},
    };
    expect(
      (await create(fetcher, cache).summaries({ ids: '25,26' })).items,
    ).toEqual([
      { id: 25, status: 'unavailable', code: 'CACHE_UNAVAILABLE' },
      { id: 26, status: 'unavailable', code: 'CACHE_UNAVAILABLE' },
    ]);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('caps a twelve-ID outage at 24 upstream attempts and recovers afterward', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () => response({}, 503));
    const service = create(fetcher),
      ids = Array.from({ length: 12 }, (_, i) => i + 1).join(',');
    const result = await service.summaries({ ids });
    expect(result.items.every((item) => item.status === 'unavailable')).toBe(
      true,
    );
    expect(fetcher).toHaveBeenCalledTimes(24);
    fetcher.mockImplementation(async () => response());
    expect((await service.summaries({ ids: '25' })).items[0]?.status).toBe(
      'ready',
    );
  });
});

describe('GET /v1/pokemon/summaries', () => {
  let app: INestApplication;
  const fetcher = jest
    .fn<typeof fetch>()
    .mockImplementation(async () => response());
  beforeAll(async () => {
    const { Test } = await import('@nestjs/testing');
    const module = await Test.createTestingModule({ imports: [AppModule] })
      .overrideProvider(CONFIG)
      .useValue(config)
      .overrideProvider(RESOURCE_CACHE)
      .useValue(new MemoryCache())
      .overrideProvider(PokeApiAdapter)
      .useValue(new PokeApiAdapter(1000, fetcher, async () => {}))
      .compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new ApiErrorFilter());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('routes before dynamic detail and returns validated real fixture data', async () => {
    const result = await request(app.getHttpServer())
      .get('/v1/pokemon/summaries?ids=25')
      .expect(200);
    expect(pokemonSummariesResponseSchema.safeParse(result.body).success).toBe(
      true,
    );
    expect(result.body.items[0]).toMatchObject({
      status: 'ready',
      data: { id: 25, name: 'pikachu', types: ['electric'] },
    });
  });
  it.each([
    '',
    'ids=',
    'ids=1&ids=2',
    'ids=25&page=1',
    'ids=01',
    'ids=25%0A',
    'ids=1,1',
    'ids=1,2,3,4,5,6,7,8,9,10,11,12,13',
  ])('rejects %s without a fetch', async (query) => {
    const before = fetcher.mock.calls.length;
    const result = await request(app.getHttpServer())
      .get('/v1/pokemon/summaries?' + query)
      .expect(400);
    expect(result.body).toMatchObject({
      code: 'INVALID_SUMMARY_QUERY',
      requestId: expect.any(String),
    });
    expect(fetcher).toHaveBeenCalledTimes(before);
  });
  it('uses HTTP 200 for unavailable items without exposing errors', async () => {
    fetcher.mockImplementation(async () => response({}, 404));
    expect(
      (
        await request(app.getHttpServer())
          .get('/v1/pokemon/summaries?ids=26')
          .expect(200)
      ).body,
    ).toEqual({
      items: [{ id: 26, status: 'unavailable', code: 'POKEMON_NOT_FOUND' }],
    });
  });
});
