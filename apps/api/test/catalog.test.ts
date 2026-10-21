import { jest } from '@jest/globals';
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import fixture from './fixtures/pikachu.json' with { type: 'json' };
import { AppModule } from '../src/app.module.js';
import { CatalogService } from '../src/catalog.service.js';
import { PokeApiAdapter } from '../src/pokeapi-adapter.js';
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
  DATABASE_URL: 'postgresql://test:test@localhost/test',
  PORT: 3001,
  POKEAPI_TIMEOUT_MS: 100,
  POKEAPI_CACHE_TTL_SECONDS: 86400,
};
const response = (data: unknown = fixture, status = 200) =>
  new Response(JSON.stringify(data), { status });

describe('PokéAPI boundary', () => {
  it('normalizes a captured response and uses canonical paths only', async () => {
    const fetcher = jest.fn<typeof fetch>().mockResolvedValue(response());
    const p = await new PokeApiAdapter(100, fetcher).get(' PIKACHU ');
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://pokeapi.co/api/v2/pokemon/pikachu',
    );
    expect(p).toMatchObject({
      id: 25,
      name: 'pikachu',
      species: { id: 25 },
      heightMeters: 0.4,
      weightKg: 6,
      types: ['electric'],
    });
    expect(p.stats).toHaveLength(6);
    expect(p).not.toHaveProperty('sprites');
  });
  it('keeps form and species IDs separate', async () => {
    const fetcher = jest.fn<typeof fetch>().mockResolvedValue(
      response({
        ...fixture,
        id: 10080,
        name: 'pikachu-rock-star',
        is_default: false,
      }),
    );
    expect(await new PokeApiAdapter(100, fetcher).get('10080')).toMatchObject({
      id: 10080,
      species: { id: 25 },
      isDefault: false,
    });
  });
  it.each(['../25', 'https://evil.test', '0', '9999999'])(
    'rejects %s before fetch',
    async (id) => {
      const fetcher = jest.fn<typeof fetch>();
      await expect(
        new PokeApiAdapter(100, fetcher).get(id),
      ).rejects.toMatchObject({ status: 400 });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it('rejects invalid types, duplicate stats and unapproved artwork', async () => {
    const invalid = [
      { ...fixture, types: [{ slot: 1, type: { name: 'invented' } }] },
      { ...fixture, stats: Array(6).fill(fixture.stats[0]) },
      {
        ...fixture,
        sprites: {
          other: {
            'official-artwork': {
              front_default: 'https://evil.test/image.png',
            },
          },
        },
      },
    ];
    for (const data of invalid)
      await expect(
        new PokeApiAdapter(
          100,
          jest.fn<typeof fetch>().mockResolvedValue(response(data)),
        ).get('25'),
      ).rejects.toMatchObject({ status: 502 });
  });
  it('allows unavailable artwork and abilities', async () => {
    const p = await new PokeApiAdapter(
      100,
      jest
        .fn<typeof fetch>()
        .mockResolvedValue(
          response({ ...fixture, abilities: [], sprites: {} }),
        ),
    ).get('25');
    expect(p.artwork).toBeNull();
    expect(p.abilities).toEqual([]);
  });
  it('does not retry not-found or schema errors', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValue(response({}, 404));
    await expect(
      new PokeApiAdapter(100, fetcher).get('unknown'),
    ).rejects.toMatchObject({ status: 404 });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('retries transient failure once', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValueOnce(response());
    expect(
      (await new PokeApiAdapter(100, fetcher, async () => {}).get('25')).id,
    ).toBe(25);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('aborts timed-out requests with a bounded retry', async () => {
    const fetcher = jest.fn<typeof fetch>().mockImplementation(
      (_url, init) =>
        new Promise((_resolve, reject) => {
          init?.signal?.addEventListener(
            'abort',
            () => reject(new Error('aborted')),
            { once: true },
          );
        }),
    );
    await expect(
      new PokeApiAdapter(5, fetcher, async () => {}).get('25'),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('catalog cache and admission control', () => {
  it('reports cache outages without requesting upstream data', async () => {
    const cache: ResourceCache = {
      get: async () => {
        throw new Error('internal database detail');
      },
      set: async () => {},
    };
    const fetcher = jest.fn<typeof fetch>();
    const service = new CatalogService(
      cache,
      new PokeApiAdapter(100, fetcher),
      config,
    );
    await expect(service.get('25')).rejects.toMatchObject({
      status: 503,
      code: 'CACHE_UNAVAILABLE',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('shares in-flight work and serves second request from cache', async () => {
    const fetcher = jest.fn<typeof fetch>().mockResolvedValue(response());
    const service = new CatalogService(
      new MemoryCache(),
      new PokeApiAdapter(100, fetcher),
      config,
    );
    const [first, duplicate] = await Promise.all([
      service.get('pikachu'),
      service.get(' PIKACHU '),
    ]);
    expect(first).toEqual(duplicate);
    expect(await service.get('pikachu')).toEqual(first);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('serves validated stale data on outage, preserving fetchedAt', async () => {
    const cache = new MemoryCache();
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response())
      .mockRejectedValue(new Error('offline'));
    const service = new CatalogService(
      cache,
      new PokeApiAdapter(100, fetcher, async () => {}),
      config,
    );
    const first = await service.get('25');
    for (const entry of cache.entries.values()) entry.expiresAt = new Date(0);
    const stale = await service.get('25');
    expect(stale.meta).toEqual({ ...first.meta, stale: true });
    expect(stale.data).toEqual(first.data);
  });
  it('never serves corrupt cached data', async () => {
    const cache = new MemoryCache();
    cache.entries.set('pokeapi-v2:normalized-v1:pokemon/25', {
      payload: {},
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 10000),
    });
    const fetcher = jest
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('offline'));
    await expect(
      new CatalogService(
        cache,
        new PokeApiAdapter(100, fetcher, async () => {}),
        config,
      ).get('25'),
    ).rejects.toMatchObject({ status: 503 });
  });
  it('bounds unique requests and releases capacity after errors', async () => {
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
      new PokeApiAdapter(1000, fetcher),
      config,
    );
    const pending = ['1', '2', '3', '4'].map((id) =>
      service.get(id).catch(() => null),
    );
    await expect(service.get('5')).rejects.toMatchObject({
      code: 'CATALOG_BUSY',
    });
    await new Promise((resolve) => setImmediate(resolve));
    releases.forEach((release) => release());
    await Promise.all(pending);
    fetcher.mockResolvedValue(response());
    expect((await service.get('25')).data.id).toBe(25);
  });
});

describe('HTTP controller with fixture adapter', () => {
  let app: INestApplication;
  const fetcher = jest.fn<typeof fetch>();
  beforeAll(async () => {
    // Replace persistence and upstream providers without opening network connections.
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
  it('returns a normalized DTO and caches repeated HTTP requests', async () => {
    fetcher.mockResolvedValue(response());
    const first = await request(app.getHttpServer())
      .get('/v1/pokemon/25')
      .expect(200);
    const second = await request(app.getHttpServer())
      .get('/v1/pokemon/25')
      .expect(200);
    expect(first.body).toEqual(second.body);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('returns sanitized error envelopes', async () => {
    fetcher.mockResolvedValue(response({}, 404));
    const missing = await request(app.getHttpServer())
      .get('/v1/pokemon/missing')
      .expect(404);
    expect(missing.body).toMatchObject({
      code: 'POKEMON_NOT_FOUND',
      requestId: expect.any(String),
    });
    const invalid = await request(app.getHttpServer())
      .get('/v1/pokemon/0')
      .expect(400);
    expect(invalid.body).not.toHaveProperty('stack');
  });
});
