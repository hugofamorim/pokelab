import { jest } from '@jest/globals';
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import electric from './fixtures/type-electric.json' with { type: 'json' };
import generationOne from './fixtures/generation-i.json' with { type: 'json' };
import generationThree from './fixtures/generation-iii.json' with { type: 'json' };
import pikachu from './fixtures/pikachu.json' with { type: 'json' };
import electrike from './fixtures/filter-pokemon-309.json' with { type: 'json' };
import raichu from './fixtures/filter-pokemon-10100.json' with { type: 'json' };
import { combinedFilterResponseSchema } from '@pokelab/contracts';
import { CatalogService } from '../src/catalog.service.js';
import {
  PokeApiAdapter,
  POKEMON_DETAIL_MAX_BYTES,
} from '../src/pokeapi-adapter.js';
import { AppModule } from '../src/app.module.js';
import { ApiErrorFilter } from '../src/errors.js';
import { CONFIG } from '../src/config.js';
import type { Config } from '../src/config.js';
import { RESOURCE_CACHE } from '../src/cache.js';
import type { CacheEntry, ResourceCache } from '../src/cache.js';

class MemoryCache implements ResourceCache {
  entries = new Map<string, CacheEntry>();
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
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const details = new Map<number, unknown>([
  [25, pikachu],
  [309, electrike],
  [10100, raichu],
]);
// Controlled three-candidate subset of the captured type list; source facts are unchanged.
const typeSubset = {
  ...electric,
  pokemon: electric.pokemon.filter(({ pokemon }) =>
    details.has(Number(pokemon.url.split('/').at(-2))),
  ),
};
const fixtureFetch: typeof fetch = async (url) => {
  const path = new URL(String(url)).pathname;
  if (path === '/api/v2/type/electric') return response(typeSubset);
  if (path === '/api/v2/generation/1') return response(generationOne);
  if (path === '/api/v2/generation/3') return response(generationThree);
  const id = Number(path.split('/').at(-1));
  return details.has(id)
    ? response(details.get(id))
    : response({ private: 'secret' }, 404);
};
const adapter = (fetcher: typeof fetch = fixtureFetch) =>
  new PokeApiAdapter(1000, fetcher, async () => {});
const service = (
  fetcher: typeof fetch = fixtureFetch,
  cache: ResourceCache = new MemoryCache(),
) => new CatalogService(cache, adapter(fetcher), config);
const query = { type: 'electric', generation: '1' };
const typeKey = 'pokeapi-v2:normalized-v1:pokemon-type-index/electric';
const genKey = 'pokeapi-v2:normalized-v1:generation-species-index/1';
const pikaKey = 'pokeapi-v2:normalized-v1:pokemon/25';
const turn = () => new Promise<void>((resolve) => setImmediate(resolve));

describe('combined filter composition', () => {
  it('joins real owning species, includes nondefault forms and retains independent freshness', async () => {
    const fetcher = jest.fn<typeof fetch>().mockImplementation(fixtureFetch);
    const result = await service(fetcher).filterScan(query);
    expect(combinedFilterResponseSchema.safeParse(result).success).toBe(true);
    expect(
      result.items.map((item) => [item.reference.id, item.status]),
    ).toEqual([
      [25, 'match'],
      [309, 'excluded'],
      [10100, 'match'],
    ]);
    expect(result.items[2]).toMatchObject({
      data: {
        id: 10100,
        name: 'raichu-alola',
        species: { id: 26, name: 'raichu' },
        isDefault: false,
        types: ['electric', 'psychic'],
      },
    });
    expect(result.scan).toEqual({
      afterId: 0,
      limit: 4,
      totalCandidates: 3,
      scanned: 3,
      hasMore: false,
      nextAfterId: null,
    });
    expect(fetcher).toHaveBeenCalledTimes(5);
    expect(
      fetcher.mock.calls.every(([, options]) => options?.redirect === 'error'),
    ).toBe(true);
    expect(result).not.toHaveProperty('totalMatches');
  });
  it('reuses the same type/generation/detail caches across scans, existing routes and instances', async () => {
    const fetcher = jest.fn<typeof fetch>().mockImplementation(fixtureFetch),
      cache = new MemoryCache();
    const first = service(fetcher, cache);
    await first.list({ type: 'electric', page: '1', pageSize: '1' });
    await first.speciesByGeneration({
      generation: '1',
      page: '1',
      pageSize: '1',
    });
    await first.filterScan(query);
    expect(fetcher).toHaveBeenCalledTimes(5);
    await service(fetcher, cache).filterScan({ ...query, limit: '1' });
    expect(fetcher).toHaveBeenCalledTimes(5);
    const changed = await first.filterScan({ ...query, generation: '3' });
    expect(changed.items.map((item) => item.status)).toEqual([
      'excluded',
      'match',
      'excluded',
    ]);
    expect(fetcher).toHaveBeenCalledTimes(6);
    expect(
      [...cache.entries.keys()].some((key) => key.includes('filter-scan')),
    ).toBe(false);
  });
  it('uses exclusive entry cursors and does not scan extra entries to fill a match page', async () => {
    const fetcher = jest.fn<typeof fetch>().mockImplementation(fixtureFetch);
    const source = service(fetcher);
    const first = await source.filterScan({ ...query, limit: '1' });
    expect(first.scan.nextAfterId).toBe(25);
    const next = await source.filterScan({ ...query, after: '25', limit: '1' });
    expect(next.items[0]).toMatchObject({
      reference: { id: 309 },
      status: 'excluded',
    });
    expect(next.scan).toMatchObject({
      hasMore: true,
      nextAfterId: 309,
      scanned: 1,
    });
    expect(fetcher).toHaveBeenCalledTimes(4);
    const last = await source.filterScan({
      ...query,
      after: '309',
      limit: '1',
    });
    expect(last.items[0]?.reference.id).toBe(10100);
    expect(last.scan).toMatchObject({ hasMore: false, nextAfterId: null });
  });
  it('returns a completed empty window past the cursor with no Pokémon requests', async () => {
    const fetcher = jest.fn<typeof fetch>().mockImplementation(fixtureFetch);
    const result = await service(fetcher).filterScan({
      ...query,
      after: '999999',
    });
    expect(result.items).toEqual([]);
    expect(result.scan).toMatchObject({
      totalCandidates: 3,
      scanned: 0,
      hasMore: false,
      nextAfterId: null,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('keeps an empty type resource separate from a source/index failure', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async (url, options) =>
        String(url).includes('/type/')
          ? response({ ...electric, pokemon: [] })
          : fixtureFetch(url, options),
      );
    expect((await service(fetcher).filterScan(query)).scan).toMatchObject({
      totalCandidates: 0,
      scanned: 0,
      hasMore: false,
    });
    fetcher.mockImplementation(async (url, options) =>
      String(url).includes('/type/')
        ? response({ private: 'secret' }, 503)
        : fixtureFetch(url, options),
    );
    await expect(service(fetcher).filterScan(query)).rejects.toMatchObject({
      status: 503,
      code: 'UPSTREAM_UNAVAILABLE',
    });
  });
  it.each(['entry-name', 'type', 'species-name', 'species-id'] as const)(
    'rejects cross-source %s contradictions per candidate',
    async (kind) => {
      const invalid = structuredClone(raichu);
      if (kind === 'entry-name') invalid.name = 'wrong-entry';
      if (kind === 'species-name') invalid.species.name = 'wrong-species';
      if (kind === 'species-id')
        invalid.species.url = 'https://pokeapi.co/api/v2/pokemon-species/309/';
      if (kind === 'type')
        invalid.types = [
          {
            slot: 1,
            type: { name: 'water', url: 'https://pokeapi.co/api/v2/type/11/' },
          },
        ];
      const fetcher: typeof fetch = async (url, options) =>
        String(url).endsWith('/pokemon/10100')
          ? response(invalid)
          : fixtureFetch(url, options);
      const result = await service(fetcher).filterScan({
        ...query,
        after: '309',
      });
      expect(result.items).toEqual([
        {
          reference: { id: 10100, name: 'raichu-alola' },
          status: 'unavailable',
          code: 'INVALID_UPSTREAM',
        },
      ]);
    },
  );
  it('does not treat failed lookup as exclusion and allows retrying the same window', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async (url, options) =>
        String(url).endsWith('/pokemon/25')
          ? response({}, 404)
          : fixtureFetch(url, options),
      );
    const source = service(fetcher);
    const result = await source.filterScan({ ...query, limit: '1' });
    expect(result.items[0]).toMatchObject({
      status: 'unavailable',
      code: 'POKEMON_NOT_FOUND',
    });
    expect(result.scan.nextAfterId).toBe(25);
    fetcher.mockImplementation(fixtureFetch);
    expect(
      (await source.filterScan({ ...query, limit: '1' })).items[0]?.status,
    ).toBe('match');
  });
  it('preserves independent index/detail stale flags and source timestamps', async () => {
    const cache = new MemoryCache(),
      fetcher = jest.fn<typeof fetch>().mockImplementation(fixtureFetch),
      source = service(fetcher, cache);
    const fresh = await source.filterScan(query);
    cache.entries.get(typeKey)!.expiresAt = new Date(0);
    cache.entries.get(pikaKey)!.expiresAt = new Date(0);
    fetcher.mockImplementation(async (url, options) =>
      String(url).includes('/type/') || String(url).endsWith('/pokemon/25')
        ? response({}, 503)
        : fixtureFetch(url, options),
    );
    const result = await source.filterScan(query);
    expect(result.meta.type).toEqual({ ...fresh.meta.type, stale: true });
    expect(result.meta.generation.stale).toBe(false);
    const first = fresh.items[0];
    if (!first || first.status !== 'match')
      throw new Error('Expected matched fixture');
    expect(result.items[0]).toMatchObject({
      status: 'match',
      meta: { ...first.meta, stale: true },
    });
    expect(result.items[1]).toMatchObject({
      status: 'excluded',
      meta: { stale: false },
    });
    fetcher.mockImplementation(async (url, options) =>
      String(url).endsWith('/pokemon/25')
        ? response({}, 404)
        : fixtureFetch(url, options),
    );
    expect(
      (await source.filterScan({ ...query, limit: '1' })).items[0],
    ).toMatchObject({ status: 'unavailable', code: 'POKEMON_NOT_FOUND' });
  });
  it('repairs corrupt cached indexes instead of joining unvalidated resource identities', async () => {
    const cache = new MemoryCache(),
      fetcher = jest.fn<typeof fetch>().mockImplementation(fixtureFetch),
      source = service(fetcher, cache);
    await source.filterScan(query);
    cache.entries.get(typeKey)!.payload = { type: 'water', items: [] };
    cache.entries.get(genKey)!.payload = {
      generation: { id: 2, name: 'generation-ii' },
      items: [],
    };
    const repaired = await source.filterScan(query);
    expect(repaired.items.map((item) => item.status)).toEqual([
      'match',
      'excluded',
      'match',
    ]);
    expect(fetcher).toHaveBeenCalledTimes(7);
  });
});

describe('scan scheduling and bounded work', () => {
  it('deduplicates scans, caps distinct scans at two and releases failed admission', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async (url, options) => {
        await gate;
        return fixtureFetch(url, options);
      });
    const source = service(fetcher);
    const first = source.filterScan({ ...query, limit: '1' }),
      duplicate = source.filterScan({ ...query, limit: '1' });
    const second = source.filterScan({ ...query, after: '25', limit: '1' });
    await expect(
      source.filterScan({ ...query, after: '309' }),
    ).rejects.toMatchObject({ code: 'CATALOG_BUSY' });
    release();
    const [a, b] = await Promise.all([first, duplicate, second]);
    expect(a).toEqual(b);
    expect(fetcher).toHaveBeenCalledTimes(4);
    await expect(
      source.filterScan({ ...query, after: '309' }),
    ).resolves.toMatchObject({ scan: { scanned: 1 } });
  });
  it('waits for both index operations after one fails, without leaking pending/global slots', async () => {
    const cache = new MemoryCache();
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const original = cache.get.bind(cache);
    cache.get = async (key) => {
      if (key === typeKey) throw new Error('private');
      if (key === genKey) await gate;
      return original(key);
    };
    const source = service(fixtureFetch, cache);
    let settled = false;
    const pending = source.filterScan(query);
    void pending.then(
      () => {
        settled = true;
      },
      () => {
        settled = true;
      },
    );
    await turn();
    expect(settled).toBe(false);
    release();
    await expect(pending).rejects.toMatchObject({ code: 'CACHE_UNAVAILABLE' });
    cache.get = original;
    await expect(source.filterScan(query)).resolves.toMatchObject({
      scan: { scanned: 3 },
    });
  });
  it('shares the same four resource slots with other endpoints', async () => {
    let release!: () => void;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetcher: typeof fetch = async (url, options) => {
      await gate;
      return fixtureFetch(url, options);
    };
    const source = service(fetcher);
    const scan = source.filterScan(query),
      other = source.get('600'),
      another = source.get('601');
    const settled = Promise.allSettled([scan, other, another]);
    await expect(source.get('602')).rejects.toMatchObject({
      code: 'CATALOG_BUSY',
    });
    release();
    await settled;
    await expect(source.filterScan(query)).resolves.toMatchObject({
      scan: { scanned: 3 },
    });
  });
  it('limits a cold twelve-candidate scan to two detail workers and fourteen resources', async () => {
    // Explicit synthetic scheduling dataset; no production facts are derived from it.
    const ids = Array.from({ length: 12 }, (_, i) => i + 1),
      releases: (() => void)[] = [];
    let active = 0,
      peak = 0;
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/type/'))
        return response({
          ...electric,
          pokemon: ids.map((id) => ({
            slot: 1,
            pokemon: {
              name: `entry-${id}`,
              url: `https://pokeapi.co/api/v2/pokemon/${id}/`,
            },
          })),
        });
      if (path.includes('/generation/')) return response(generationOne);
      const id = Number(path.split('/').at(-1));
      active++;
      peak = Math.max(peak, active);
      await new Promise<void>((resolve) => releases.push(resolve));
      active--;
      return response({
        ...pikachu,
        id,
        name: `entry-${id}`,
        is_default: false,
      });
    });
    const source = service(fetcher);
    const pending = source.filterScan({ ...query, limit: '12' });
    for (let i = 0; i < 6; i++) {
      await turn();
      expect(releases).toHaveLength(2);
      releases.splice(0).forEach((release) => release());
    }
    const result = await pending;
    expect(result.items).toHaveLength(12);
    expect(result.items.every((item) => item.status === 'match')).toBe(true);
    expect(peak).toBe(2);
    expect(fetcher).toHaveBeenCalledTimes(14);
  });
});

describe('detail source byte budget', () => {
  it('rejects oversized declared or streamed detail bytes without retry', async () => {
    const cancel = jest.fn<() => void>();
    const fetcher = jest.fn<typeof fetch>().mockImplementation(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(new Uint8Array(POKEMON_DETAIL_MAX_BYTES + 1));
            },
            cancel,
          }),
        ),
    );
    await expect(adapter(fetcher).get('25')).rejects.toMatchObject({
      code: 'INVALID_UPSTREAM',
      status: 502,
    });
    expect(cancel).toHaveBeenCalled();
    expect(fetcher).toHaveBeenCalledTimes(1);
    fetcher.mockImplementation(
      async () =>
        new Response(
          new ReadableStream({
            start(controller) {
              controller.enqueue(
                new TextEncoder().encode(JSON.stringify(pikachu)),
              );
              controller.close();
            },
            cancel,
          }),
          {
            headers: { 'content-length': String(POKEMON_DETAIL_MAX_BYTES + 1) },
          },
        ),
    );
    await expect(adapter(fetcher).get('25')).rejects.toMatchObject({
      status: 502,
    });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cancel).toHaveBeenCalledTimes(2);
  });
  it('accepts a valid detail at the exact decompressed byte boundary', async () => {
    const json = JSON.stringify(pikachu),
      bytes = new TextEncoder().encode(json).length;
    const value = json + ' '.repeat(POKEMON_DETAIL_MAX_BYTES - bytes);
    expect((await adapter(async () => new Response(value)).get('25')).id).toBe(
      25,
    );
  });
});

describe('combined filter HTTP and OpenAPI', () => {
  let app: INestApplication;
  const fetcher = jest.fn<typeof fetch>().mockImplementation(fixtureFetch);
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
  it('serves a real joined window on the static route, keeping existing list routes separate', async () => {
    const result = await request(app.getHttpServer())
      .get('/v1/pokemon/filter-scan?type=electric&generation=1&limit=1')
      .expect(200);
    expect(combinedFilterResponseSchema.safeParse(result.body).success).toBe(
      true,
    );
    expect(result.body.scan.nextAfterId).toBe(25);
    await request(app.getHttpServer())
      .get('/v1/pokemon?type=electric&generation=1')
      .expect(400);
  });
  it.each([
    '',
    '?type=electric',
    '?generation=1',
    '?type=electric&generation=1&generation=2',
    '?type=electric&type=water&generation=1',
    '?type=electric&generation=1&limit=13',
    '?type=electric&generation=1&after=01',
    '?type=electric&generation=1&after[]=1',
    '?type=electric&generation=1&page=1',
    '?type=electric&generation=1&search=pikachu',
  ])(
    'rejects unsafe or unsupported HTTP query before source work: %s',
    async (suffix) => {
      const before = fetcher.mock.calls.length;
      const result = await request(app.getHttpServer())
        .get('/v1/pokemon/filter-scan' + suffix)
        .expect(400);
      expect(result.body.code).toBe('INVALID_FILTER_QUERY');
      expect(fetcher.mock.calls.length).toBe(before);
    },
  );
  it('documents both required filters, candidate cursor semantics and the shared response', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('test').setVersion('1').build(),
    );
    const op = document.paths['/v1/pokemon/filter-scan']!.get!;
    expect(op.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'type', required: true }),
        expect.objectContaining({ name: 'generation', required: true }),
        expect.objectContaining({ name: 'after', required: false }),
      ]),
    );
    expect(op.responses['200']).toBeDefined();
  });
});
