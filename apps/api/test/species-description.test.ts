import { jest } from '@jest/globals';
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import captured from './fixtures/species-descriptions.json' with { type: 'json' };
import {
  speciesDescriptionResponseSchema,
  SPECIES_DESCRIPTION_LIMITS,
} from '@pokelab/contracts';
import { PokeApiAdapter } from '../src/pokeapi-adapter.js';
import { CatalogService } from '../src/catalog.service.js';
import { AppModule } from '../src/app.module.js';
import { ApiErrorFilter } from '../src/errors.js';
import { CONFIG } from '../src/config.js';
import type { Config } from '../src/config.js';
import { RESOURCE_CACHE } from '../src/cache.js';
import type { ResourceCache, CacheEntry } from '../src/cache.js';

const fixture = captured[0]!;
const entry = fixture.flavor_text_entries[0]!;
const config: Config = {
  DATABASE_URL: 'postgresql://unused:unused@localhost/unused',
  PORT: 3001,
  POKEAPI_TIMEOUT_MS: 1000,
  POKEAPI_CACHE_TTL_SECONDS: 86400,
};
class MemoryCache implements ResourceCache {
  entries = new Map<string, CacheEntry>();
  async get(key: string) {
    return this.entries.get(key) ?? null;
  }
  async set(key: string, entry: CacheEntry) {
    this.entries.set(key, entry);
  }
}
const response = (body: unknown = fixture, status = 200) =>
  new Response(JSON.stringify(body), { status });
const adapter = (fetcher: typeof fetch) =>
  new PokeApiAdapter(1000, fetcher, async () => {});
const service = (
  fetcher: typeof fetch,
  cache: ResourceCache = new MemoryCache(),
) => new CatalogService(cache, adapter(fetcher), config);
const key = 'pokeapi-v2:normalized-v1:species-description/25';

describe('species description adapter', () => {
  it('uses a constructed species URL, normalizes source line/page breaks and retains language/version', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () => response());
    const result = await adapter(fetcher).speciesDescription(25);
    expect(result).toEqual({
      species: { speciesId: 25, name: 'pikachu' },
      description: {
        text: entry.flavor_text.replace(/\s+/gu, ' '),
        language: 'en',
        version: 'red',
      },
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://pokeapi.co/api/v2/pokemon-species/25',
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ redirect: 'error' });
  });
  it('prefers pt-br over earlier English, skipping blank entries and preserving source order (synthetic localization boundary)', async () => {
    const pt = {
      ...entry,
      flavor_text: ' Texto\n em\fportuguês. ',
      language: { ...entry.language, name: 'pt-br' },
    };
    const body = {
      ...fixture,
      flavor_text_entries: [
        entry,
        { ...pt, flavor_text: ' \n\f ' },
        pt,
        { ...pt, flavor_text: 'Outro texto.' },
      ],
    };
    const result = await adapter(async () => response(body)).speciesDescription(
      25,
    );
    expect(result.description).toEqual({
      text: 'Texto em português.',
      language: 'pt-br',
      version: 'red',
    });
  });
  it('does not infer variety identity from species or translate generic Portuguese', async () => {
    const result = await adapter(async () =>
      response(captured[1]),
    ).speciesDescription(413);
    expect(result.species).toEqual({ speciesId: 413, name: 'wormadam' });
    expect(result).not.toHaveProperty('pokemon');
    expect(
      (
        await adapter(async () =>
          response({
            ...fixture,
            flavor_text_entries: [
              { ...entry, language: { ...entry.language, name: 'pt' } },
            ],
          }),
        ).speciesDescription(25)
      ).description,
    ).toBeNull();
  });
  it.each([
    { items: [] },
    { items: [{ ...entry, flavor_text: ' \n\f ' }] },
    { items: [{ ...entry, language: { ...entry.language, name: 'fr' } }] },
  ])('returns null when supported text is absent', async ({ items }) => {
    const result = await adapter(async () =>
      response({ ...fixture, flavor_text_entries: items }),
    ).speciesDescription(25);
    expect(result.description).toBeNull();
  });
  it.each([0, -1, 1.5, 1000000, NaN])(
    'rejects species ID %s before network access',
    async (id) => {
      const fetcher = jest.fn<typeof fetch>();
      await expect(
        adapter(fetcher).speciesDescription(id),
      ).rejects.toMatchObject({ status: 400 });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each([
    { ...fixture, id: 413 },
    { ...fixture, flavor_text_entries: undefined },
    {
      ...fixture,
      flavor_text_entries: Array.from({ length: 513 }, () => entry),
    },
    {
      ...fixture,
      flavor_text_entries: [{ ...entry, flavor_text: 'x'.repeat(8193) }],
    },
    {
      ...fixture,
      flavor_text_entries: [
        {
          ...entry,
          version: { name: 'red', url: 'https://evil.example/version/1/' },
        },
      ],
    },
    {
      ...fixture,
      flavor_text_entries: [
        {
          ...entry,
          language: {
            name: 'en',
            url: 'https://pokeapi.co/api/v2/language/9/?x=1',
          },
        },
      ],
    },
  ])(
    'rejects malformed or excessive upstream metadata without retry',
    async (body) => {
      const fetcher = jest
        .fn<typeof fetch>()
        .mockImplementation(async () => response(body));
      await expect(
        adapter(fetcher).speciesDescription(25),
      ).rejects.toMatchObject({ status: 502, code: 'INVALID_UPSTREAM' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('bounds streamed and declared bytes', async () => {
    for (const headers of [
      new Headers(),
      new Headers({
        'content-length': String(
          SPECIES_DESCRIPTION_LIMITS.maxResponseBytes + 1,
        ),
      }),
    ]) {
      const fetcher = jest
        .fn<typeof fetch>()
        .mockImplementation(
          async () =>
            new Response(
              ' '.repeat(SPECIES_DESCRIPTION_LIMITS.maxResponseBytes + 1),
              { headers },
            ),
        );
      await expect(
        adapter(fetcher).speciesDescription(25),
      ).rejects.toMatchObject({ status: 502 });
      expect(fetcher).toHaveBeenCalledTimes(1);
    }
  });
  it('does not retry missing species and limits transient failures to two attempts', async () => {
    const missing = jest
      .fn<typeof fetch>()
      .mockImplementation(async () => response({}, 404));
    await expect(adapter(missing).speciesDescription(25)).rejects.toMatchObject(
      { code: 'SPECIES_NOT_FOUND' },
    );
    expect(missing).toHaveBeenCalledTimes(1);
    const failing = jest
      .fn<typeof fetch>()
      .mockRejectedValue(new Error('private upstream error'));
    await expect(adapter(failing).speciesDescription(25)).rejects.toMatchObject(
      { code: 'UPSTREAM_UNAVAILABLE' },
    );
    expect(failing).toHaveBeenCalledTimes(2);
  });
  it('aborts each timed-out attempt and releases the request after one retry', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(
        async (_url, options) =>
          new Promise((_resolve, reject) =>
            options?.signal?.addEventListener(
              'abort',
              () => reject(new Error('timeout')),
              { once: true },
            ),
          ),
      );
    await expect(
      new PokeApiAdapter(5, fetcher, async () => {}).speciesDescription(25),
    ).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every((call) => call[1]?.signal?.aborted)).toBe(
      true,
    );
  });
});

describe('species description caching/admission', () => {
  it('deduplicates concurrent descriptions and persists normalized data including empty results', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        response({ ...fixture, flavor_text_entries: [] }),
      );
    const cache = new MemoryCache();
    const catalog = service(fetcher, cache);
    const [one, two] = await Promise.all([
      catalog.speciesDescription('25'),
      catalog.speciesDescription('25'),
    ]);
    expect(one).toEqual(two);
    expect(one.data.description).toBeNull();
    expect(await catalog.speciesDescription('25')).toEqual(one);
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.entries.get(key)?.payload).toEqual(one.data);
  });
  it('retains source freshness during stale rescue; 404 never rescues stale data', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () => response());
    const cache = new MemoryCache();
    const catalog = service(fetcher, cache);
    const fresh = await catalog.speciesDescription('25');
    cache.entries.get(key)!.expiresAt = new Date(0);
    fetcher.mockImplementation(async () => response({}, 503));
    const stale = await catalog.speciesDescription('25');
    expect(stale.data).toEqual(fresh.data);
    expect(stale.meta).toEqual({ ...fresh.meta, stale: true });
    fetcher.mockImplementation(async () => response({}, 404));
    await expect(catalog.speciesDescription('25')).rejects.toMatchObject({
      status: 404,
    });
  });
  it('rejects wrong-species cache entries and sanitizes cache outages', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () => response());
    const cache = new MemoryCache();
    const other = await adapter(async () =>
      response(captured[1]),
    ).speciesDescription(413);
    cache.entries.set(key, {
      payload: other,
      fetchedAt: new Date(),
      expiresAt: new Date(Date.now() + 60000),
    });
    expect(
      (await service(fetcher, cache).speciesDescription('25')).data.species
        .speciesId,
    ).toBe(25);
    const broken: ResourceCache = {
      get: async () => {
        throw new Error('private DB error');
      },
      set: async () => {},
    };
    await expect(
      service(fetcher, broken).speciesDescription('25'),
    ).rejects.toMatchObject({ code: 'CACHE_UNAVAILABLE' });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('shares the four global resource slots, joins identical work, then releases capacity', async () => {
    const releases: (() => void)[] = [];
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async (url) => {
      await new Promise<void>((resolve) => releases.push(resolve));
      if (String(url).includes('/pokemon-species/')) return response();
      return response({}, 404);
    });
    const catalog = service(fetcher);
    const operations = [
      catalog.speciesDescription('25'),
      catalog.get('1').catch(() => null),
      catalog.get('2').catch(() => null),
      catalog.get('3').catch(() => null),
    ];
    const joined = catalog.speciesDescription('25');
    await expect(catalog.speciesDescription('413')).rejects.toMatchObject({
      code: 'CATALOG_BUSY',
    });
    await new Promise((resolve) => setImmediate(resolve));
    releases.forEach((release) => release());
    await Promise.all([...operations, joined]);
    expect(fetcher).toHaveBeenCalledTimes(4);
    fetcher.mockImplementation(async () => response(captured[1]));
    expect(
      (await catalog.speciesDescription('413')).data.species.speciesId,
    ).toBe(413);
  });
});

describe('GET /v1/pokemon-species/:speciesId/description', () => {
  let app: INestApplication;
  const fetcher = jest
    .fn<typeof fetch>()
    .mockImplementation(async () => response());
  beforeAll(async () => {
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
  it('returns the shared contract, metadata and reusable cache response', async () => {
    const one = await request(app.getHttpServer())
      .get('/v1/pokemon-species/25/description')
      .expect(200);
    expect(speciesDescriptionResponseSchema.safeParse(one.body).success).toBe(
      true,
    );
    const two = await request(app.getHttpServer())
      .get('/v1/pokemon-species/25/description')
      .expect(200);
    expect(two.body).toEqual(one.body);
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each(['0', '01', '1000000', '25%0A', '25?language=en', '25?x=1&x=2'])(
    'rejects path/query %s without network requests',
    async (path) => {
      const [id, query] = path.split('?');
      const count = fetcher.mock.calls.length;
      await request(app.getHttpServer())
        .get(`/v1/pokemon-species/${id}/description${query ? '?' + query : ''}`)
        .expect(400);
      expect(fetcher).toHaveBeenCalledTimes(count);
    },
  );
  it('sanitizes unexpected resource failures', async () => {
    fetcher.mockRejectedValue(new Error('private upstream secret'));
    const result = await request(app.getHttpServer())
      .get('/v1/pokemon-species/26/description')
      .expect(503);
    expect(result.body.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(JSON.stringify(result.body)).not.toMatch(/private|secret|stack/);
  });
  it('documents species identity and independent optional description', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('test').build(),
    );
    expect(
      doc.paths['/v1/pokemon-species/{speciesId}/description']?.get?.responses[
        '200'
      ],
    ).toBeDefined();
  });
});
