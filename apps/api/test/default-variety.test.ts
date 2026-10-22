import { jest } from '@jest/globals';
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import fixture from './fixtures/species-wormadam.json' with { type: 'json' };
import {
  defaultVarietiesResponseSchema,
  DEFAULT_VARIETY_LIMITS,
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
const key = 'pokeapi-v2:normalized-v1:species-default-variety/413';
const first = fixture.varieties[0]!;

describe('explicit default-variety adapter', () => {
  it('selects the flag regardless of position, retaining different species/entry names without detail requests', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        response({ ...fixture, varieties: [...fixture.varieties].reverse() }),
      );
    expect(await adapter(fetcher).defaultVariety(413)).toEqual({
      species: { speciesId: 413, name: 'wormadam' },
      pokemon: { id: 413, name: 'wormadam-plant' },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://pokeapi.co/api/v2/pokemon-species/413',
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error' });
  });
  it('does not infer an entry ID from the species ID (synthetic differing-ID boundary)', async () => {
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async () =>
      response({
        ...fixture,
        varieties: [
          {
            ...first,
            pokemon: {
              name: 'fixture-default',
              url: 'https://pokeapi.co/api/v2/pokemon/900001/',
            },
          },
        ],
      }),
    );
    expect((await adapter(fetcher).defaultVariety(413)).pokemon.id).toBe(
      900001,
    );
  });
  it.each([0, -1, 1000000, 1.5, NaN, Infinity])(
    'rejects species ID %s before fetch',
    async (id) => {
      const fetcher = jest.fn<typeof fetch>();
      await expect(adapter(fetcher).defaultVariety(id)).rejects.toMatchObject({
        status: 400,
      });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each([
    { ...fixture, id: 1 },
    { ...fixture, varieties: [] },
    {
      ...fixture,
      varieties: fixture.varieties.map((entry) => ({
        ...entry,
        is_default: false,
      })),
    },
    {
      ...fixture,
      varieties: fixture.varieties.map((entry) => ({
        ...entry,
        is_default: true,
      })),
    },
    { ...fixture, varieties: [first, first] },
    {
      ...fixture,
      varieties: [
        first,
        {
          ...first,
          is_default: false,
          pokemon: {
            ...first.pokemon,
            url: 'https://pokeapi.co/api/v2/pokemon/999/',
          },
        },
      ],
    },
    ...[
      'https://evil.test/413/',
      'https://pokeapi.co/api/v2/pokemon-species/413/',
      'https://pokeapi.co/api/v2/pokemon/0413/',
      'https://pokeapi.co/api/v2/pokemon/1000000/',
      'https://pokeapi.co/api/v2/pokemon/413/?x=1',
      'https://pokeapi.co/api/v2/pokemon/413/#x',
    ].map((url) => ({
      ...fixture,
      varieties: [{ ...first, pokemon: { ...first.pokemon, url } }],
    })),
    { ...fixture, varieties: [{ ...first, is_default: 'true' }] },
    {
      ...fixture,
      varieties: Array.from(
        { length: DEFAULT_VARIETY_LIMITS.maxVarieties + 1 },
        () => first,
      ),
    },
  ])(
    'rejects ambiguous defaults, wrong identity, duplicates and unsafe/excessive varieties: %#',
    async (body) => {
      const fetcher = jest
        .fn<typeof fetch>()
        .mockImplementation(async () => response(body));
      await expect(adapter(fetcher).defaultVariety(413)).rejects.toMatchObject({
        status: 502,
        code: 'INVALID_UPSTREAM',
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('returns species-specific absence without retry and cancels the body', async () => {
    const cancel = jest.fn<() => void>();
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValue(
        new Response(new ReadableStream({ cancel }), { status: 404 }),
      );
    await expect(adapter(fetcher).defaultVariety(413)).rejects.toMatchObject({
      status: 404,
      code: 'SPECIES_NOT_FOUND',
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cancel).toHaveBeenCalledTimes(1);
  });
  it('retries transient failures once and recovers', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({}, 503))
      .mockResolvedValueOnce(response());
    expect((await adapter(fetcher).defaultVariety(413)).pokemon.name).toBe(
      'wormadam-plant',
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('bounds timeouts to two attempts', async () => {
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
      new PokeApiAdapter(10, fetcher, async () => {}).defaultVariety(413),
    ).rejects.toMatchObject({ status: 503 });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('rejects excessive declared response bytes before reading', async () => {
    const cancel = jest.fn<() => void>();
    const fetcher = jest.fn<typeof fetch>().mockResolvedValue(
      new Response(new ReadableStream({ cancel }), {
        headers: {
          'content-length': String(DEFAULT_VARIETY_LIMITS.maxResponseBytes + 1),
        },
      }),
    );
    await expect(adapter(fetcher).defaultVariety(413)).rejects.toMatchObject({
      status: 502,
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('counts streamed/decompressed bytes despite a misleading header', async () => {
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
    await expect(adapter(fetcher).defaultVariety(413)).rejects.toMatchObject({
      status: 502,
    });
    expect(cancel).toHaveBeenCalledTimes(1);
    expect(reads).toBeLessThanOrEqual(18);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['', '{broken', new Uint8Array([0xff, 0xfe])])(
    'rejects malformed JSON/UTF-8 without retry: %#',
    async (body) => {
      const fetcher = jest
        .fn<typeof fetch>()
        .mockResolvedValue(new Response(body));
      await expect(adapter(fetcher).defaultVariety(413)).rejects.toMatchObject({
        status: 502,
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
});

describe('mapping cache and bounded resolver batches', () => {
  it('reuses a validated mapping across instances without fetching Pokémon details', async () => {
    const cache = new MemoryCache();
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () => response());
    const one = await service(fetcher, cache).resolveDefaultVariety(413);
    expect(await service(fetcher, cache).resolveDefaultVariety(413)).toEqual(
      one,
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.entries.size).toBe(1);
    const entry = cache.entries.get(key)!;
    expect(entry.expiresAt.getTime() - entry.fetchedAt.getTime()).toBe(
      86400000,
    );
    entry.expiresAt = new Date(0);
    fetcher.mockRejectedValue(new Error('offline'));
    expect(
      (await service(fetcher, cache).resolveDefaultVariety(413)).meta,
    ).toEqual({ ...one.meta, stale: true });
    // 404 represents actual absence, not a transient outage: expired mapping cannot rescue it.
    fetcher.mockImplementation(async () => response({}, 404));
    await expect(
      service(fetcher, cache).resolveDefaultVariety(413),
    ).rejects.toMatchObject({ code: 'SPECIES_NOT_FOUND' });
  });
  it.each(['wrong-species', 'entry-id-instead-of-species', 'invalid-entry'])(
    'rejects corrupt cached mapping as fresh or stale: %s',
    async (kind) => {
      const cache = new MemoryCache();
      const fetcher = jest
        .fn<typeof fetch>()
        .mockImplementation(async () => response());
      const catalog = service(fetcher, cache);
      const result = await catalog.resolveDefaultVariety(413);
      cache.entries.get(key)!.payload =
        kind === 'wrong-species'
          ? { ...result.data, species: { speciesId: 1, name: 'bulbasaur' } }
          : kind === 'entry-id-instead-of-species'
            ? { ...result.data, species: { id: 413, name: 'wormadam' } }
            : { ...result.data, pokemon: { id: 0, name: 'wormadam-plant' } };
      fetcher.mockRejectedValue(new Error('offline'));
      await expect(catalog.resolveDefaultVariety(413)).rejects.toMatchObject({
        status: 503,
      });
    },
  );
  it('preserves input order with partial absence/malformed responses and at most two active workers', async () => {
    let active = 0,
      peak = 0;
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async (url) => {
      const id = Number(String(url).split('/').at(-1));
      active++;
      peak = Math.max(peak, active);
      await new Promise((resolve) => setImmediate(resolve));
      active--;
      return id === 413
        ? response()
        : id === 1
          ? response({}, 404)
          : response({ invalid: true });
    });
    const result = await service(fetcher).defaultVarieties({
      speciesIds: '1,413,2',
    });
    expect(result.items.map((item) => item.speciesId)).toEqual([1, 413, 2]);
    expect(result.items.map((item) => item.status)).toEqual([
      'unavailable',
      'ready',
      'unavailable',
    ]);
    expect(result.items[0]).toEqual({
      speciesId: 1,
      status: 'unavailable',
      code: 'SPECIES_NOT_FOUND',
    });
    expect(result.items[2]).toEqual({
      speciesId: 2,
      status: 'unavailable',
      code: 'INVALID_UPSTREAM',
    });
    expect(peak).toBeLessThanOrEqual(2);
    expect(defaultVarietiesResponseSchema.safeParse(result).success).toBe(true);
  });
  it('bounds a complete 12-item outage to 24 upstream attempts and returns each failure explicitly', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () => response({}, 503));
    const result = await service(fetcher).defaultVarieties({
      speciesIds: Array.from({ length: 12 }, (_, i) => i + 1).join(','),
    });
    expect(result.items).toHaveLength(12);
    expect(
      result.items.every(
        (item) =>
          item.status === 'unavailable' && item.code === 'UPSTREAM_UNAVAILABLE',
      ),
    ).toBe(true);
    expect(fetcher).toHaveBeenCalledTimes(24);
  });
  it('deduplicates identical batches and overlapping species, caps distinct batches and releases admission', async () => {
    const releases: (() => void)[] = [];
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async (url) => {
      await new Promise<void>((resolve) => releases.push(resolve));
      const id = Number(String(url).split('/').at(-1));
      return response({ ...fixture, id });
    });
    const catalog = service(fetcher);
    const a = catalog.defaultVarieties({ speciesIds: '413,1' });
    const identical = catalog.defaultVarieties({ speciesIds: '413,1' });
    const b = catalog.defaultVarieties({ speciesIds: '2,413' });
    await expect(
      catalog.defaultVarieties({ speciesIds: '3' }),
    ).rejects.toMatchObject({ code: 'CATALOG_BUSY' });
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetcher).toHaveBeenCalledTimes(3);
    releases.forEach((release) => release());
    const [one, same, two] = await Promise.all([a, identical, b]);
    expect(one).toEqual(same);
    expect(two.items.map((item) => item.speciesId)).toEqual([2, 413]);
    expect(fetcher).toHaveBeenCalledTimes(3);
    fetcher.mockImplementation(async (url) =>
      response({ ...fixture, id: Number(String(url).split('/').at(-1)) }),
    );
    expect(
      (await catalog.defaultVarieties({ speciesIds: '3' })).items[0]?.status,
    ).toBe('ready');
  });
  it('shares four global slots with detail, type and generation work, allowing existing species joins', async () => {
    const releases: (() => void)[] = [];
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async (url) => {
      await new Promise<void>((resolve) => releases.push(resolve));
      const path = String(url);
      if (path.includes('/pokemon-species/')) return response();
      if (path.includes('/generation/'))
        return response({ id: 1, name: 'generation-i', pokemon_species: [] });
      if (path.includes('/type/'))
        return response({ name: 'electric', pokemon: [] });
      return response({}, 404);
    });
    const catalog = service(fetcher);
    const pending = [
      catalog.resolveDefaultVariety(413),
      catalog.list({ type: 'electric' }),
      catalog.speciesByGeneration({ generation: '1' }),
      catalog.get('25').catch(() => null),
    ];
    const joined = catalog.resolveDefaultVariety(413);
    const partial = await catalog.defaultVarieties({ speciesIds: '1' });
    expect(partial.items).toEqual([
      { speciesId: 1, status: 'unavailable', code: 'CATALOG_BUSY' },
    ]);
    await new Promise((resolve) => setImmediate(resolve));
    expect(fetcher).toHaveBeenCalledTimes(4);
    releases.forEach((release) => release());
    await Promise.all([...pending, joined]);
  });
  it('reports cache outages per item without upstream calls and rejects unexpected errors safely', async () => {
    const fetcher = jest.fn<typeof fetch>();
    const cache: ResourceCache = {
      get: async () => {
        throw new Error('private database trace');
      },
      set: async () => {},
    };
    expect(
      (
        await service(fetcher, cache).defaultVarieties({ speciesIds: '1,413' })
      ).items.map((item) => (item.status === 'unavailable' ? item.code : null)),
    ).toEqual(['CACHE_UNAVAILABLE', 'CACHE_UNAVAILABLE']);
    expect(fetcher).not.toHaveBeenCalled();
    const catalog = service(fetcher);
    jest
      .spyOn(catalog, 'resolveDefaultVariety')
      .mockRejectedValue(new Error('private unexpected error'));
    await expect(catalog.defaultVarieties({ speciesIds: '1' })).rejects.toThrow(
      'private unexpected error',
    );
  });
});

describe('GET /v1/pokemon-species/default-varieties', () => {
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
  it('returns a mapping with original species identity and per-item freshness', async () => {
    const one = await request(app.getHttpServer())
      .get('/v1/pokemon-species/default-varieties?speciesIds=413')
      .expect(200);
    expect(defaultVarietiesResponseSchema.safeParse(one.body).success).toBe(
      true,
    );
    expect(one.body.items[0]).toMatchObject({
      speciesId: 413,
      status: 'ready',
      data: {
        species: { speciesId: 413, name: 'wormadam' },
        pokemon: { id: 413, name: 'wormadam-plant' },
      },
    });
    const two = await request(app.getHttpServer())
      .get('/v1/pokemon-species/default-varieties?speciesIds=413')
      .expect(200);
    expect(two.body).toEqual(one.body);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    '',
    'speciesIds=',
    'speciesIds=0',
    'speciesIds=01',
    'speciesIds=1%0A',
    'speciesIds=1,1',
    'speciesIds=1&speciesIds=2',
    'speciesIds=1&generation=1',
    'speciesIds=1&type=grass',
    'ids=1',
    'speciesIds=' + Array.from({ length: 13 }, (_, i) => i + 1).join(','),
  ])('rejects query %s before upstream access', async (query) => {
    const before = fetcher.mock.calls.length;
    const result = await request(app.getHttpServer())
      .get('/v1/pokemon-species/default-varieties?' + query)
      .expect(400);
    expect(result.body.code).toBe('INVALID_SPECIES_QUERY');
    expect(fetcher).toHaveBeenCalledTimes(before);
  });
  it('isolates per-item errors and does not expose raw failures', async () => {
    fetcher.mockImplementation(async () => response({}, 404));
    expect(
      (
        await request(app.getHttpServer())
          .get('/v1/pokemon-species/default-varieties?speciesIds=1,413')
          .expect(200)
      ).body.items,
    ).toMatchObject([
      { speciesId: 1, status: 'unavailable', code: 'SPECIES_NOT_FOUND' },
      { speciesId: 413, status: 'ready' },
    ]);
    fetcher.mockRejectedValue(new Error('private upstream credentials'));
    const failure = await request(app.getHttpServer())
      .get('/v1/pokemon-species/default-varieties?speciesIds=2')
      .expect(200);
    expect(failure.body.items[0]).toEqual({
      speciesId: 2,
      status: 'unavailable',
      code: 'UPSTREAM_UNAVAILABLE',
    });
    expect(JSON.stringify(failure.body)).not.toMatch(
      /private|credentials|stack/,
    );
  });
  it('documents the bounded route and mapping schema', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('test').build(),
    );
    const operation = doc.paths['/v1/pokemon-species/default-varieties']?.get;
    expect(operation?.summary).toContain('12 explicit species IDs');
    expect(operation?.responses['200']).toBeDefined();
  });
  it('sanitizes unexpected resolver failures at the HTTP boundary', async () => {
    const resolver = jest
      .spyOn(app.get(CatalogService), 'resolveDefaultVariety')
      .mockRejectedValue(new Error('private database credentials and stack'));
    try {
      const failure = await request(app.getHttpServer())
        .get('/v1/pokemon-species/default-varieties?speciesIds=3')
        .expect(500);
      expect(failure.body).toMatchObject({
        code: 'SERVICE_UNAVAILABLE',
        requestId: expect.any(String),
      });
      expect(JSON.stringify(failure.body)).not.toMatch(
        /private|credentials|stack/,
      );
    } finally {
      resolver.mockRestore();
    }
  });
});
