import { jest } from '@jest/globals';
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import request from 'supertest';
import fixture from './fixtures/generation-i.json' with { type: 'json' };
import {
  generationSpeciesPageResponseSchema,
  GENERATION_LIMITS,
  GENERATION_NAMES,
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
  async set(key: string, value: CacheEntry) {
    this.entries.set(key, value);
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
const key = 'pokeapi-v2:normalized-v1:generation-species-index/1';
const first = fixture.pokemon_species[0]!;

describe('generation species adapter', () => {
  it('constructs one generation URL and keeps species identity without following resource references', async () => {
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async () =>
      response({
        ...fixture,
        pokemon_species: [...fixture.pokemon_species].reverse(),
      }),
    );
    const result = await adapter(fetcher).generationIndex(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://pokeapi.co/api/v2/generation/1',
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      redirect: 'error',
      headers: { accept: 'application/json' },
    });
    expect(result.generation).toEqual({ id: 1, name: 'generation-i' });
    expect(result.items).toHaveLength(fixture.pokemon_species.length);
    expect(result.items[0]).toEqual({ speciesId: 1, name: 'bulbasaur' });
    expect(result.items.map((item) => item.speciesId)).toEqual(
      [...result.items.map((item) => item.speciesId)].sort((a, b) => a - b),
    );
    expect(result.items[0]).not.toHaveProperty('id');
    expect(result.items[0]).not.toHaveProperty('isDefault');
    expect(result.items[0]).not.toHaveProperty('types');
  });
  it.each([0, 10, -1, 1.5, NaN, Infinity])(
    'rejects unsupported generation %s before fetching',
    async (input) => {
      const fetcher = jest.fn<typeof fetch>();
      await expect(
        adapter(fetcher).generationIndex(input),
      ).rejects.toMatchObject({ status: 400, code: 'INVALID_GENERATION' });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each([
    { ...fixture, id: 2 },
    { ...fixture, name: 'generation-ii' },
    { ...fixture, pokemon_species: [first, first] },
    {
      ...fixture,
      pokemon_species: [
        first,
        { ...first, url: 'https://pokeapi.co/api/v2/pokemon-species/999/' },
      ],
    },
    { ...fixture, pokemon_species: [{ ...first, name: 'https://evil.test' }] },
    ...[
      'https://evil.test/api/v2/pokemon-species/1/',
      'https://pokeapi.co/api/v2/pokemon/1/',
      'https://pokeapi.co/api/v2/pokemon-species/01/',
      'https://pokeapi.co/api/v2/pokemon-species/1000000/',
      'https://pokeapi.co/api/v2/pokemon-species/1/?x=1',
      'https://pokeapi.co/api/v2/pokemon-species/1/#a',
      'http://pokeapi.co/api/v2/pokemon-species/1/',
    ].map((url) => ({ ...fixture, pokemon_species: [{ ...first, url }] })),
    {
      ...fixture,
      pokemon_species: Array.from(
        { length: GENERATION_LIMITS.maxMembers + 1 },
        () => first,
      ),
    },
  ])(
    'rejects malformed identity, references, duplicates or excessive membership: %#',
    async (body) => {
      const fetcher = jest
        .fn<typeof fetch>()
        .mockImplementation(async () => response(body));
      await expect(adapter(fetcher).generationIndex(1)).rejects.toMatchObject({
        status: 502,
        code: 'INVALID_UPSTREAM',
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('allows empty membership and retries a transient source failure once', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValueOnce(response({ ...fixture, pokemon_species: [] }));
    expect(await adapter(fetcher).generationIndex(1)).toEqual({
      generation: { id: 1, name: 'generation-i' },
      items: [],
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each([404, 503])(
    'bounds retry and cancels unread HTTP %s bodies',
    async (status) => {
      const cancel = jest.fn<() => void>();
      const fetcher = jest
        .fn<typeof fetch>()
        .mockImplementation(
          async () => new Response(new ReadableStream({ cancel }), { status }),
        );
      await expect(adapter(fetcher).generationIndex(1)).rejects.toMatchObject({
        status: 503,
        code: 'UPSTREAM_UNAVAILABLE',
      });
      expect(fetcher).toHaveBeenCalledTimes(2);
      expect(cancel).toHaveBeenCalledTimes(2);
    },
  );
  it('bounds timeouts for generation requests', async () => {
    const fetcher = jest.fn<typeof fetch>().mockImplementation(
      async (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => reject(new DOMException('timeout', 'AbortError')),
            { once: true },
          );
        }),
    );
    await expect(
      new PokeApiAdapter(10, fetcher, async () => {}).generationIndex(1),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects excessive declared bytes before reading the body', async () => {
    const cancel = jest.fn<() => void>();
    const fetcher = jest.fn<typeof fetch>().mockResolvedValue(
      new Response(new ReadableStream({ cancel }), {
        headers: {
          'content-length': String(GENERATION_LIMITS.maxResponseBytes + 1),
        },
      }),
    );
    await expect(adapter(fetcher).generationIndex(1)).rejects.toMatchObject({
      status: 502,
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('caps streamed/decompressed bytes despite a false length and cancels overflow', async () => {
    let reads = 0;
    const cancel = jest.fn<() => void>();
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
    await expect(adapter(fetcher).generationIndex(1)).rejects.toMatchObject({
      status: 502,
    });
    expect(reads).toBeLessThanOrEqual(18);
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['', '{invalid', new Uint8Array([0xff, 0xfe])])(
    'rejects invalid JSON/UTF-8 without retry: %#',
    async (body) => {
      const fetcher = jest
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(body));
      await expect(adapter(fetcher).generationIndex(1)).rejects.toMatchObject({
        status: 502,
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('retries interrupted transport streams once', async () => {
    const fetcher = jest.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.error(new Error('private transport trace'));
            },
          }),
        ),
    );
    await expect(adapter(fetcher).generationIndex(1)).rejects.toMatchObject({
      status: 503,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
});

describe('generation index caching, pagination and shared admission', () => {
  it('joins different pages/sizes, persists one index and reuses it across service instances', async () => {
    const cache = new MemoryCache();
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () => response());
    const catalog = service(fetcher, cache);
    const [one, two] = await Promise.all([
      catalog.speciesByGeneration({ generation: '1', pageSize: '2' }),
      catalog.speciesByGeneration({
        generation: '1',
        page: '2',
        pageSize: '3',
      }),
    ]);
    expect(one.items).toHaveLength(2);
    expect(two.items).toHaveLength(3);
    expect(one.meta).toEqual(two.meta);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.entries.size).toBe(1);
    expect(cache.entries.has(key)).toBe(true);
    const fresh = await service(fetcher, cache).speciesByGeneration({
      generation: '1',
      page: '1000',
      pageSize: '50',
    });
    expect(fresh).toMatchObject({
      items: [],
      hasNext: false,
      total: fixture.pokemon_species.length,
      meta: one.meta,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const entry = cache.entries.get(key)!;
    expect(entry.expiresAt.getTime() - entry.fetchedAt.getTime()).toBe(
      config.POKEAPI_CACHE_TTL_SECONDS * 1000,
    );
    const page = Math.ceil(fixture.pokemon_species.length / 50);
    const last = await catalog.speciesByGeneration({
      generation: '1',
      page: String(page),
      pageSize: '50',
    });
    expect(last.hasNext).toBe(false);
    expect(last.items.length).toBe(
      fixture.pokemon_species.length - (page - 1) * 50,
    );
    expect(generationSpeciesPageResponseSchema.safeParse(last).success).toBe(
      true,
    );
  });
  it('preserves original generation freshness when expired data rescues failure', async () => {
    const cache = new MemoryCache();
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () => response());
    const catalog = service(fetcher, cache);
    const one = await catalog.speciesByGeneration({
      generation: '1',
      pageSize: '2',
    });
    cache.entries.get(key)!.expiresAt = new Date(0);
    fetcher.mockRejectedValue(new Error('offline'));
    const two = await catalog.speciesByGeneration({
      generation: '1',
      page: '2',
      pageSize: '2',
    });
    expect(two.meta).toEqual({ ...one.meta, stale: true });
    expect(two.total).toBe(one.total);
    expect(two.items).not.toEqual(one.items);
    expect(cache.entries.get(key)!.fetchedAt.toISOString()).toBe(
      one.meta.fetchedAt,
    );
  });
  it.each([
    'wrong-generation',
    'mismatched-name',
    'duplicate',
    'unsorted',
    'entry-ids',
  ])('rejects poisoned index as fresh or stale: %s', async (kind) => {
    const cache = new MemoryCache();
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () => response());
    const catalog = service(fetcher, cache);
    const one = await catalog.speciesByGeneration({ generation: '1' });
    const entry = cache.entries.get(key)!;
    const index = { generation: one.generation, items: one.items };
    entry.payload =
      kind === 'wrong-generation'
        ? { ...index, generation: { id: 2, name: 'generation-ii' } }
        : kind === 'mismatched-name'
          ? { ...index, generation: { id: 1, name: 'generation-ii' } }
          : {
              ...index,
              items:
                kind === 'duplicate'
                  ? [one.items[0], one.items[0]]
                  : kind === 'unsorted'
                    ? [...one.items].reverse()
                    : [{ id: 1, name: 'bulbasaur' }],
            };
    fetcher.mockRejectedValue(new Error('offline'));
    await expect(
      catalog.speciesByGeneration({ generation: '1' }),
    ).rejects.toMatchObject({ status: 503 });
  });
  it('isolates generation cache keys', async () => {
    const cache = new MemoryCache();
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async (url) => {
      const id = Number(String(url).split('/').at(-1));
      return response({
        id,
        name: GENERATION_NAMES[id - 1],
        pokemon_species: [],
      });
    });
    const catalog = service(fetcher, cache);
    await catalog.speciesByGeneration({ generation: '1' });
    await catalog.speciesByGeneration({ generation: '2' });
    expect(cache.entries.size).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('shares four global slots with detail/type/page work, permits joins and recovers after failure', async () => {
    const releases: (() => void)[] = [];
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async (url) => {
      if (String(url).includes('/generation/')) {
        await new Promise<void>((resolve) => releases.push(resolve));
        return response();
      }
      await new Promise<void>((resolve) => releases.push(resolve));
      if (String(url).includes('/type/'))
        return response({ name: 'electric', pokemon: [] });
      if (String(url).includes('/pokemon/?'))
        return response({ count: 0, results: [] });
      return response({}, 404);
    });
    const catalog = service(fetcher);
    const pending = [
      catalog.speciesByGeneration({ generation: '1' }),
      catalog.list({ type: 'electric' }),
      catalog.list({}),
      catalog.get('25').catch(() => null),
    ];
    const joined = catalog.speciesByGeneration({ generation: '1', page: '2' });
    await expect(
      catalog.speciesByGeneration({ generation: '2' }),
    ).rejects.toMatchObject({ code: 'CATALOG_BUSY' });
    await expect(catalog.get('26')).rejects.toMatchObject({
      code: 'CATALOG_BUSY',
    });
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetcher).toHaveBeenCalledTimes(4);
    releases.forEach((release) => release());
    await Promise.all([...pending, joined]);
    fetcher.mockRejectedValue(new Error('offline'));
    await expect(
      catalog.speciesByGeneration({ generation: '2' }),
    ).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    fetcher.mockImplementation(async () =>
      response({ id: 2, name: 'generation-ii', pokemon_species: [] }),
    );
    expect(
      (await catalog.speciesByGeneration({ generation: '2' })).items,
    ).toEqual([]);
  });
  it('does not access upstream on invalid input/database read failure and sanitizes database failures', async () => {
    const fetcher = jest.fn<typeof fetch>();
    const cache: ResourceCache = {
      get: async () => {
        throw new Error('private database trace');
      },
      set: async () => {},
    };
    const catalog = service(fetcher, cache);
    await expect(
      catalog.speciesByGeneration({ generation: '1', type: 'grass' }),
    ).rejects.toMatchObject({ status: 400 });
    await expect(
      catalog.speciesByGeneration({ generation: '1' }),
    ).rejects.toMatchObject({ code: 'CACHE_UNAVAILABLE' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('GET /v1/pokemon-species?generation=', () => {
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
  it('returns a species-specific page and shares freshness across pages', async () => {
    const one = await request(app.getHttpServer())
      .get('/v1/pokemon-species?generation=1&pageSize=2')
      .expect(200);
    expect(
      generationSpeciesPageResponseSchema.safeParse(one.body).success,
    ).toBe(true);
    expect(one.body).toMatchObject({
      generation: { id: 1, name: 'generation-i' },
      total: fixture.pokemon_species.length,
      page: 1,
      pageSize: 2,
    });
    expect(one.body.items[0]).toEqual({ speciesId: 1, name: 'bulbasaur' });
    const two = await request(app.getHttpServer())
      .get('/v1/pokemon-species?generation=1&page=2&pageSize=1')
      .expect(200);
    expect(two.body.meta).toEqual(one.body.meta);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(
      (
        await request(app.getHttpServer())
          .get('/v1/pokemon-species?generation=1&page=1000')
          .expect(200)
      ).body,
    ).toMatchObject({ items: [], hasNext: false });
  });
  it.each([
    '',
    'generation=',
    'generation=0',
    'generation=10',
    'generation=01',
    'generation=1%0A',
    'generation=1&generation=2',
    'generation=1,2',
    'generation=generation-i',
    'generation=1&type=grass',
    'generation=1&search=25',
    'generation=1&page=01',
    'generation=1&pageSize=51',
    'generation=1&page=1&page=2',
    'generation=1&pageSize=1&pageSize=2',
  ])('rejects %s without upstream access', async (query) => {
    const before = fetcher.mock.calls.length;
    const result = await request(app.getHttpServer())
      .get('/v1/pokemon-species?' + query)
      .expect(400);
    expect(result.body).toMatchObject({
      code: 'INVALID_GENERATION_QUERY',
      requestId: expect.any(String),
    });
    expect(fetcher).toHaveBeenCalledTimes(before);
  });
  it('documents species semantics and the response schema in OpenAPI', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('test').build(),
    );
    const operation = doc.paths['/v1/pokemon-species']?.get;
    expect(operation?.summary).toContain('species ID');
    expect(operation?.responses['200']).toMatchObject({
      content: {
        'application/json': {
          schema: {
            properties: {
              items: {
                items: { properties: { speciesId: { type: 'integer' } } },
              },
            },
          },
        },
      },
    });
  });
  it('keeps generation unsupported on entry endpoint and sanitizes failures on species endpoint', async () => {
    await request(app.getHttpServer())
      .get('/v1/pokemon?generation=1')
      .expect(400);
    fetcher.mockRejectedValue(new Error('private stack and credentials'));
    const unavailable = await request(app.getHttpServer())
      .get('/v1/pokemon-species?generation=2')
      .expect(503);
    expect(unavailable.body).toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(JSON.stringify(unavailable.body)).not.toMatch(
      /private|credentials|stack/,
    );
    fetcher.mockImplementation(async () => response({ secret: 'private' }));
    expect(
      (
        await request(app.getHttpServer())
          .get('/v1/pokemon-species?generation=3')
          .expect(502)
      ).body,
    ).toMatchObject({ code: 'INVALID_UPSTREAM' });
  });
});
