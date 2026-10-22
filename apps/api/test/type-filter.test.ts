import { jest } from '@jest/globals';
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import request from 'supertest';
import fixture from './fixtures/type-electric.json' with { type: 'json' };
import {
  pokemonCatalogPageResponseSchema,
  TYPE_FILTER_LIMITS,
} from '@pokelab/contracts';
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
const adapter = (fetcher: typeof fetch) =>
  new PokeApiAdapter(1000, fetcher, async () => {});
const service = (
  fetcher: typeof fetch,
  cache: ResourceCache = new MemoryCache(),
) => new CatalogService(cache, adapter(fetcher), config);
const first = fixture.pokemon[0]!;
const key = 'pokeapi-v2:normalized-v1:pokemon-type-index/electric';

describe('type-membership adapter', () => {
  it('makes one canonical type request, retains forms/secondary types and sorts references without following URLs', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        response({ ...fixture, pokemon: [...fixture.pokemon].reverse() }),
      );
    const result = await adapter(fetcher).typeIndex('electric');
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://pokeapi.co/api/v2/type/electric',
    );
    expect(result.items).toHaveLength(fixture.pokemon.length);
    expect(result.items.map((item) => item.id)).toEqual(
      [...result.items.map((item) => item.id)].sort((a, b) => a - b),
    );
    expect(result.items).toContainEqual({ id: 25, name: 'pikachu' });
    expect(result.items.some((item) => item.id > 10000)).toBe(true);
    const secondary = fixture.pokemon.find((item) => item.slot === 2)!;
    expect(
      result.items.some((item) => item.name === secondary.pokemon.name),
    ).toBe(true);
    expect(result.items[0]).not.toHaveProperty('artwork');
    expect(result.items[0]).not.toHaveProperty('species');
  });
  it.each([
    'Electric',
    'electric\n',
    'stellar',
    '13',
    'https://evil.test',
    'electric/../water',
  ])('rejects unsafe or noncanonical type %s before fetch', async (type) => {
    const fetcher = jest.fn<typeof fetch>();
    await expect(adapter(fetcher).typeIndex(type)).rejects.toMatchObject({
      status: 400,
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([
    { name: 'water', pokemon: [] },
    { name: 'electric', pokemon: [first, first] },
    {
      name: 'electric',
      pokemon: [
        first,
        {
          ...first,
          pokemon: {
            ...first.pokemon,
            url: 'https://pokeapi.co/api/v2/pokemon/999/',
          },
        },
      ],
    },
    { name: 'electric', pokemon: [{ ...first, slot: 0 }] },
    { name: 'electric', pokemon: [{ ...first, slot: 3 }] },
    {
      name: 'electric',
      pokemon: [
        {
          ...first,
          pokemon: { ...first.pokemon, url: 'https://evil.test/25/' },
        },
      ],
    },
    {
      name: 'electric',
      pokemon: [
        {
          ...first,
          pokemon: {
            ...first.pokemon,
            url: 'https://pokeapi.co/api/v2/pokemon-species/25/',
          },
        },
      ],
    },
    {
      name: 'electric',
      pokemon: [
        {
          ...first,
          pokemon: {
            ...first.pokemon,
            url: 'https://pokeapi.co/api/v2/pokemon/25/?x=1',
          },
        },
      ],
    },
    {
      name: 'electric',
      pokemon: [
        {
          ...first,
          pokemon: {
            ...first.pokemon,
            url: 'https://pokeapi.co/api/v2/pokemon/1000000/',
          },
        },
      ],
    },
    {
      name: 'electric',
      pokemon: Array.from(
        { length: TYPE_FILTER_LIMITS.maxMembers + 1 },
        () => first,
      ),
    },
  ])(
    'rejects inconsistent/excessive membership without retry, case %#',
    async (body) => {
      const fetcher = jest
        .fn<typeof fetch>()
        .mockImplementation(async () => response(body));
      await expect(
        adapter(fetcher).typeIndex('electric'),
      ).rejects.toMatchObject({ status: 502, code: 'INVALID_UPSTREAM' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('allows an empty membership and retries transient failures only once', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValueOnce(response({ ...fixture, pokemon: [] }));
    expect(await adapter(fetcher).typeIndex('electric')).toEqual({
      type: 'electric',
      items: [],
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    fetcher.mockReset().mockImplementation(async () => response({}, 404));
    await expect(adapter(fetcher).typeIndex('electric')).rejects.toMatchObject({
      status: 503,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('retries aborted requests once', async () => {
    const fetcher = jest.fn<typeof fetch>().mockImplementation(
      async (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('Timeout', 'AbortError')),
            { once: true },
          );
        }),
    );
    await expect(
      new PokeApiAdapter(10, fetcher, async () => {}).typeIndex('electric'),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('cancels unread HTTP error bodies before retrying', async () => {
    const cancel = jest.fn<() => void>();
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(
        async () =>
          new Response(new ReadableStream({ cancel }), { status: 503 }),
      );
    await expect(adapter(fetcher).typeIndex('electric')).rejects.toMatchObject({
      status: 503,
    });
    expect(cancel).toHaveBeenCalledTimes(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects a declared oversized body before reading it', async () => {
    const fetcher = jest.fn<typeof fetch>().mockResolvedValue(
      new Response('{}', {
        headers: {
          'content-length': String(TYPE_FILTER_LIMITS.maxResponseBytes + 1),
        },
      }),
    );
    await expect(adapter(fetcher).typeIndex('electric')).rejects.toMatchObject({
      status: 502,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('bounds streamed/decompressed bytes even with an absent or false content-length', async () => {
    const cancel = jest.fn<() => void>();
    let reads = 0;
    const stream = new ReadableStream<Uint8Array>({
      pull(controller) {
        reads++;
        controller.enqueue(new Uint8Array(65536));
      },
      cancel,
    });
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(stream, { headers: { 'content-length': '1' } }),
      );
    await expect(adapter(fetcher).typeIndex('electric')).rejects.toMatchObject({
      status: 502,
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(reads).toBeLessThanOrEqual(18);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['{bad json', '', new Uint8Array([0xff, 0xfe])])(
    'rejects malformed JSON/UTF-8 without retry',
    async (body) => {
      const fetcher = jest
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(body));
      await expect(
        adapter(fetcher).typeIndex('electric'),
      ).rejects.toMatchObject({ status: 502 });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('retries a truncated stream as a transport failure', async () => {
    const fetcher = jest.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error('private transport detail'));
            },
          }),
        ),
    );
    await expect(adapter(fetcher).typeIndex('electric')).rejects.toMatchObject({
      status: 503,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('filtered catalog caching and admission', () => {
  it('deduplicates different page/size queries into one index load and reuses persisted data across instances', async () => {
    const cache = new MemoryCache(),
      fetcher = jest
        .fn<typeof fetch>()
        .mockImplementation(async () => response());
    const catalog = service(fetcher, cache);
    const [one, two] = await Promise.all([
      catalog.list({ type: 'electric', pageSize: '2' }),
      catalog.list({ type: 'electric', page: '2', pageSize: '3' }),
    ]);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(one.items).toHaveLength(2);
    expect(two.items).toHaveLength(3);
    expect(one.meta).toEqual(two.meta);
    expect(cache.entries.size).toBe(1);
    expect(cache.entries.has(key)).toBe(true);
    expect(
      await service(fetcher, cache).list({
        type: 'electric',
        page: '1000',
        pageSize: '50',
      }),
    ).toMatchObject({
      items: [],
      total: fixture.pokemon.length,
      hasNext: false,
      type: 'electric',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const finalPage = Math.ceil(fixture.pokemon.length / 50);
    const last = await catalog.list({
      type: 'electric',
      page: String(finalPage),
      pageSize: '50',
    });
    expect(last.hasNext).toBe(false);
    expect(last.items.length).toBe(
      fixture.pokemon.length - (finalPage - 1) * 50,
    );
    expect(pokemonCatalogPageResponseSchema.safeParse(last).success).toBe(true);
  });
  it('preserves index freshness on stale fallback for different pages', async () => {
    const cache = new MemoryCache(),
      fetcher = jest
        .fn<typeof fetch>()
        .mockImplementation(async () => response());
    const catalog = service(fetcher, cache),
      one = await catalog.list({ type: 'electric', pageSize: '2' });
    cache.entries.get(key)!.expiresAt = new Date(0);
    fetcher.mockImplementation(async () => response({}, 503));
    const two = await catalog.list({
      type: 'electric',
      page: '2',
      pageSize: '2',
    });
    expect(two.meta).toEqual({ ...one.meta, stale: true });
    expect(two.total).toBe(one.total);
    expect(two.items).not.toEqual(one.items);
  });
  it.each(['wrong-type', 'duplicate', 'unsorted'])(
    'does not use poisoned index as fresh or stale: %s',
    async (corruption) => {
      const cache = new MemoryCache(),
        fetcher = jest
          .fn<typeof fetch>()
          .mockImplementation(async () => response());
      const catalog = service(fetcher, cache);
      await catalog.list({ type: 'electric' });
      const entry = cache.entries.get(key)!;
      const payload = entry.payload as {
        type: string;
        items: { id: number; name: string }[];
      };
      entry.payload =
        corruption === 'wrong-type'
          ? { ...payload, type: 'water' }
          : {
              ...payload,
              items:
                corruption === 'duplicate'
                  ? [payload.items[0], payload.items[0]]
                  : [...payload.items].reverse(),
            };
      fetcher.mockRejectedValue(new Error('offline'));
      await expect(catalog.list({ type: 'electric' })).rejects.toMatchObject({
        status: 503,
      });
    },
  );
  it('separates canonical type caches', async () => {
    const cache = new MemoryCache(),
      fetcher = jest.fn<typeof fetch>().mockImplementation(async (url) =>
        response({
          ...fixture,
          name: String(url).split('/').at(-1),
          pokemon: [],
        }),
      );
    const catalog = service(fetcher, cache);
    await catalog.list({ type: 'electric' });
    await catalog.list({ type: 'water' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cache.entries.size).toBe(2);
  });
  it('shares four global slots with detail/page work and joins an existing type under saturation', async () => {
    const releases: (() => void)[] = [];
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async (url) => {
      await new Promise<void>((resolve) => releases.push(resolve));
      return String(url).includes('/type/') ? response() : response({}, 404);
    });
    const catalog = service(fetcher);
    const type = catalog.list({ type: 'electric' });
    const details = ['1', '2', '3'].map((id) =>
      catalog.get(id).catch(() => null),
    );
    const joined = catalog.list({ type: 'electric', page: '2' });
    await expect(catalog.list({})).rejects.toMatchObject({
      code: 'CATALOG_BUSY',
    });
    await expect(catalog.list({ type: 'water' })).rejects.toMatchObject({
      code: 'CATALOG_BUSY',
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetcher).toHaveBeenCalledTimes(4);
    releases.forEach((release) => release());
    await Promise.all([type, joined, ...details]);
    fetcher.mockImplementation(async () =>
      response({ ...fixture, name: 'water', pokemon: [] }),
    );
    expect((await catalog.list({ type: 'water' })).items).toEqual([]);
  });
  it('does not fetch during invalid queries or database outages', async () => {
    const fetcher = jest.fn<typeof fetch>(),
      cache: ResourceCache = {
        get: async () => {
          throw new Error('private database trace');
        },
        set: async () => {},
      };
    const catalog = service(fetcher, cache);
    await expect(
      catalog.list({ type: 'electric', search: 'pika' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(catalog.list({ type: 'electric' })).rejects.toMatchObject({
      code: 'CACHE_UNAVAILABLE',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('GET /v1/pokemon?type=', () => {
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
      .useValue(adapter(fetcher))
      .compile();
    app = module.createNestApplication();
    app.useGlobalFilters(new ApiErrorFilter());
    await app.init();
  });
  afterAll(async () => {
    await app.close();
  });
  it('returns a bounded typed reference page and preserves cached timestamps', async () => {
    const first = await request(app.getHttpServer())
      .get('/v1/pokemon?type=electric&pageSize=2')
      .expect(200);
    expect(pokemonCatalogPageResponseSchema.safeParse(first.body).success).toBe(
      true,
    );
    expect(first.body).toMatchObject({
      type: 'electric',
      page: 1,
      pageSize: 2,
      total: fixture.pokemon.length,
      hasNext: true,
    });
    expect(first.body.items).toHaveLength(2);
    const second = await request(app.getHttpServer())
      .get('/v1/pokemon?page=2&type=electric&pageSize=1')
      .expect(200);
    expect(second.body.meta).toEqual(first.body.meta);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    'type=',
    'type=Electric',
    'type=electric%0A',
    'type=electric&type=water',
    'type=electric,water',
    'type=stellar',
    'type=electric&search=pika',
    'type=electric&generation=1',
    'type=electric&pageSize=51',
  ])('rejects %s before upstream access', async (query) => {
    const before = fetcher.mock.calls.length;
    const result = await request(app.getHttpServer())
      .get('/v1/pokemon?' + query)
      .expect(400);
    expect(result.body).toMatchObject({
      code: 'INVALID_PAGINATION',
      requestId: expect.any(String),
    });
    expect(fetcher).toHaveBeenCalledTimes(before);
  });
  it('returns an empty page and sanitized unavailable/malformed indexes', async () => {
    expect(
      (
        await request(app.getHttpServer())
          .get('/v1/pokemon?type=electric&page=1000')
          .expect(200)
      ).body,
    ).toMatchObject({ items: [], hasNext: false });
    fetcher.mockImplementation(async () => response({}, 503));
    const unavailable = await request(app.getHttpServer())
      .get('/v1/pokemon?type=water')
      .expect(503);
    expect(unavailable.body).toMatchObject({
      code: 'UPSTREAM_UNAVAILABLE',
      requestId: expect.any(String),
    });
    expect(unavailable.body).not.toHaveProperty('stack');
    fetcher.mockImplementation(async () =>
      response({ secret: 'private trace' }),
    );
    expect(
      (
        await request(app.getHttpServer())
          .get('/v1/pokemon?type=fire')
          .expect(502)
      ).body,
    ).toMatchObject({ code: 'INVALID_UPSTREAM' });
  });
});
