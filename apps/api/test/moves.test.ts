import { jest } from '@jest/globals';
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import pikachu from './fixtures/pikachu-moves.json' with { type: 'json' };
import charm from './fixtures/move-charm.json' with { type: 'json' };
import {
  pokemonMovesResponseSchema,
  moveMetadataResponseSchema,
  MOVE_LIMITS,
} from '@pokelab/contracts';
import { PokeApiAdapter } from '../src/pokeapi-adapter.js';
import { CatalogService } from '../src/catalog.service.js';
import { AppModule } from '../src/app.module.js';
import { ApiErrorFilter } from '../src/errors.js';
import { CONFIG } from '../src/config.js';
import type { Config } from '../src/config.js';
import { RESOURCE_CACHE } from '../src/cache.js';
import type { ResourceCache, CacheEntry } from '../src/cache.js';

class MemoryCache implements ResourceCache {
  entries = new Map<string, CacheEntry>();
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
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });
const fixtureFetch: typeof fetch = async (url) =>
  response(String(url).includes('/move/') ? charm : pikachu);
const adapter = (fetcher: typeof fetch = fixtureFetch) =>
  new PokeApiAdapter(100, fetcher, async () => {});
const service = (
  fetcher: typeof fetch = fixtureFetch,
  cache: ResourceCache = new MemoryCache(),
) => new CatalogService(cache, adapter(fetcher), config);
const learnsetKey = 'pokeapi-v2:normalized-v1:pokemon-learnset/25';
const metadataKey = 'pokeapi-v2:normalized-v1:move-metadata/204';

describe('move adapter', () => {
  it('normalizes real learning records without following references or fetching move details', async () => {
    const fetcher = jest.fn<typeof fetch>().mockImplementation(fixtureFetch);
    const result = await adapter(fetcher).pokemonLearnset(25);
    expect(result.pokemon).toEqual({ id: 25, name: 'pikachu' });
    expect(result.species).toEqual({ speciesId: 25, name: 'pikachu' });
    expect(result.moves).toHaveLength(pikachu.moves.length);
    const source = pikachu.moves[0]!;
    const move = result.moves.find(
      (entry) => entry.move.name === source.move.name,
    )!;
    expect(move.records).toHaveLength(source.version_group_details.length);
    expect(move.records[0]).toEqual({
      versionGroup: { id: 1, name: 'red-blue' },
      method: { id: 4, name: 'machine' },
      level: 0,
      order: null,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(fetcher.mock.calls[0]?.[0]).toBe(
      'https://pokeapi.co/api/v2/pokemon/25',
    );
    expect(fetcher.mock.calls[0]?.[1]?.redirect).toBe('error');
  });
  it('keeps distinct entry and species IDs (synthetic form boundary)', async () => {
    const result = await adapter(async () =>
      response({
        ...pikachu,
        id: 10080,
        name: 'pikachu-rock-star',
        is_default: false,
      }),
    ).pokemonLearnset(10080);
    expect(result).toMatchObject({
      pokemon: { id: 10080 },
      species: { speciesId: 25 },
      isDefault: false,
    });
  });
  it('preserves Charm’s current Fairy type and separate pre-X/Y Normal change record', async () => {
    const result = await adapter().moveMetadata(204);
    expect(result).toMatchObject({
      move: { id: 204, name: 'charm' },
      snapshot: 'current-source',
      type: { id: 18, name: 'fairy' },
      power: null,
      historicalChanges: [
        {
          versionGroup: { id: 15, name: 'x-y' },
          type: { id: 1, name: 'normal' },
          power: null,
          pp: null,
          accuracy: null,
        },
      ],
    });
    expect(result).not.toHaveProperty('effect_entries');
  });
  it.each([0, -1, 1.5, 1000000, NaN])(
    'rejects invalid resource ID %s without fetch',
    async (id) => {
      const fetcher = jest.fn<typeof fetch>();
      await expect(adapter(fetcher).pokemonLearnset(id)).rejects.toMatchObject({
        status: 400,
      });
      await expect(adapter(fetcher).moveMetadata(id)).rejects.toMatchObject({
        status: 400,
      });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  const mutated = (change: (body: typeof pikachu) => void) => {
    const body = structuredClone(pikachu);
    change(body);
    return body;
  };
  it.each([
    mutated((p) => {
      p.id = 26;
    }),
    mutated((p) => {
      p.moves[0]!.move.url = 'https://evil.test/85/';
    }),
    mutated((p) => {
      p.moves[0]!.version_group_details[0]!.version_group.url =
        'https://pokeapi.co/api/v2/pokemon/1/';
    }),
    mutated((p) => {
      p.moves.push(p.moves[0]!);
    }),
    mutated((p) => {
      p.moves[0]!.version_group_details.push(
        p.moves[0]!.version_group_details[0]!,
      );
    }),
    mutated((p) => {
      p.moves[0]!.version_group_details[0]!.level_learned_at = 101;
    }),
    mutated((p) => {
      p.moves[0]!.version_group_details[0]!.version_group.name =
        'contradiction';
    }),
    mutated((p) => {
      p.moves[0]!.version_group_details = Array(
        MOVE_LIMITS.maxRecordsPerMove + 1,
      ).fill(p.moves[0]!.version_group_details[0]);
    }),
  ])(
    'rejects invalid identity, paths, duplicate or excessive learning data without retry',
    async (body) => {
      const fetcher = jest
        .fn<typeof fetch>()
        .mockImplementation(async () => response(body));
      await expect(adapter(fetcher).pokemonLearnset(25)).rejects.toMatchObject({
        status: 502,
        code: 'INVALID_UPSTREAM',
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    { ...charm, id: 203 },
    { ...charm, accuracy: 101 },
    { ...charm, past_values: [...charm.past_values, ...charm.past_values] },
    {
      ...charm,
      type: { ...charm.type, url: 'https://pokeapi.co/api/v2/move/18/' },
    },
  ])('rejects contradictory metadata', async (body) => {
    await expect(
      adapter(async () => response(body)).moveMetadata(204),
    ).rejects.toMatchObject({ status: 502 });
  });
  it.each(['pokemonLearnset', 'moveMetadata'] as const)(
    'bounds streamed/decompressed bytes for %s',
    async (method) => {
      const cancelled = jest.fn<() => void>();
      const fetcher = jest.fn<typeof fetch>().mockImplementation(
        async () =>
          new Response(
            new ReadableStream({
              start(controller) {
                controller.enqueue(
                  new Uint8Array(MOVE_LIMITS.maxResponseBytes + 1),
                );
              },
              cancel: cancelled,
            }),
          ),
      );
      await expect(
        adapter(fetcher)[method](method === 'pokemonLearnset' ? 25 : 204),
      ).rejects.toMatchObject({ status: 502 });
      expect(fetcher).toHaveBeenCalledTimes(1);
      expect(cancelled).toHaveBeenCalled();
    },
  );
  it.each(['pokemonLearnset', 'moveMetadata'] as const)(
    'does not retry 404 for %s',
    async (method) => {
      const fetcher = jest
        .fn<typeof fetch>()
        .mockImplementation(async () => response({}, 404));
      await expect(adapter(fetcher)[method](25)).rejects.toMatchObject({
        status: 404,
        code:
          method === 'pokemonLearnset' ? 'POKEMON_NOT_FOUND' : 'MOVE_NOT_FOUND',
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('retries transient failures once and aborts stalled calls', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementationOnce(async () => response({}, 503))
      .mockImplementation(fixtureFetch);
    expect((await adapter(fetcher).pokemonLearnset(25)).pokemon.id).toBe(25);
    expect(fetcher).toHaveBeenCalledTimes(2);
    const stalled = jest.fn<typeof fetch>().mockImplementation(
      (_url, options) =>
        new Promise((_resolve, reject) => {
          options?.signal?.addEventListener(
            'abort',
            () => reject(new Error('abort')),
            { once: true },
          );
        }),
    );
    await expect(
      new PokeApiAdapter(5, stalled, async () => {}).moveMetadata(204),
    ).rejects.toMatchObject({ status: 503 });
    expect(stalled).toHaveBeenCalledTimes(2);
  });
});

describe('move service cache and composition', () => {
  it('shares one cached learnset across page sizes and version groups, without metadata fan-out', async () => {
    const fetcher = jest.fn<typeof fetch>().mockImplementation(fixtureFetch);
    const cache = new MemoryCache();
    const source = service(fetcher, cache);
    const [first, second] = await Promise.all([
      source.pokemonMoves('25', { versionGroup: '1', pageSize: '2' }),
      source.pokemonMoves('25', { versionGroup: '2', pageSize: '1' }),
    ]);
    expect(pokemonMovesResponseSchema.safeParse(first).success).toBe(true);
    expect(first.data.items).toHaveLength(2);
    expect(first.data.hasNext).toBe(true);
    expect(second.data.items).toHaveLength(1);
    expect(
      first.data.items.every((move) =>
        move.records.every((r) => r.versionGroup.id === 1),
      ),
    ).toBe(true);
    expect(
      second.data.items.every((move) =>
        move.records.every((r) => r.versionGroup.id === 2),
      ),
    ).toBe(true);
    const next = await source.pokemonMoves('25', {
      versionGroup: '1',
      pageSize: '2',
      page: '2',
    });
    expect(next.data.items.map((m) => m.move.id)).not.toEqual(
      first.data.items.map((m) => m.move.id),
    );
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(cache.entries.size).toBe(1);
  });
  it('returns source groups even when the requested group/page has no records', async () => {
    const source = service();
    const absent = await source.pokemonMoves('25', { versionGroup: '999999' });
    expect(absent.data).toMatchObject({
      versionGroup: null,
      requestedVersionGroupId: 999999,
      items: [],
      total: 0,
      hasNext: false,
    });
    expect(absent.data.availableVersionGroups.length).toBeGreaterThan(0);
    const beyond = await source.pokemonMoves('25', {
      versionGroup: '1',
      page: '1000',
    });
    expect(beyond.data.items).toEqual([]);
    expect(beyond.data.versionGroup).toEqual({ id: 1, name: 'red-blue' });
  });
  it.each(['learnset', 'metadata'] as const)(
    'uses stale-if-error and refuses stale rescue for 404: %s',
    async (kind) => {
      const fetcher = jest.fn<typeof fetch>().mockImplementation(fixtureFetch);
      const cache = new MemoryCache();
      const source = service(fetcher, cache);
      const get = () =>
        kind === 'learnset'
          ? source.pokemonMoves('25', { versionGroup: '1' })
          : source.moveMetadata('204');
      const key = kind === 'learnset' ? learnsetKey : metadataKey;
      const fresh = await get();
      const entry = cache.entries.get(key)!;
      entry.expiresAt = new Date(0);
      fetcher.mockImplementation(async () => response({}, 503));
      const stale = await get();
      expect(stale.meta).toEqual({ ...fresh.meta, stale: true });
      fetcher.mockImplementation(async () => response({}, 404));
      await expect(get()).rejects.toMatchObject({ status: 404 });
    },
  );
  it('revalidates cached identity and repairs corrupt projections', async () => {
    const cache = new MemoryCache();
    const fetcher = jest.fn<typeof fetch>().mockImplementation(fixtureFetch);
    const source = service(fetcher, cache);
    await source.pokemonMoves('25', { versionGroup: '1' });
    cache.entries.get(learnsetKey)!.payload = {
      ...(await adapter().pokemonLearnset(25)),
      pokemon: { id: 26, name: 'raichu' },
    };
    expect(
      (await source.pokemonMoves('25', { versionGroup: '1' })).data.pokemon.id,
    ).toBe(25);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('deduplicates metadata and keeps resource freshness independent', async () => {
    const cache = new MemoryCache();
    const fetcher = jest.fn<typeof fetch>().mockImplementation(fixtureFetch);
    const source = service(fetcher, cache);
    const [first, second] = await Promise.all([
      source.moveMetadata('204'),
      source.moveMetadata('204'),
    ]);
    expect(first).toEqual(second);
    expect(moveMetadataResponseSchema.safeParse(first).success).toBe(true);
    await source.pokemonMoves('25', { versionGroup: '1' });
    cache.entries.get(learnsetKey)!.expiresAt = new Date(0);
    fetcher.mockImplementation(async () => response({}, 503));
    expect(
      (await source.pokemonMoves('25', { versionGroup: '1' })).meta.stale,
    ).toBe(true);
    expect((await source.moveMetadata('204')).meta.stale).toBe(false);
  });
  it('shares the four resource slots with existing catalog operations and releases failures', async () => {
    let release!: () => void;
    const hold = new Promise<void>((resolve) => {
      release = resolve;
    });
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async () => {
      await hold;
      return response({}, 404);
    });
    const source = service(fetcher);
    const pending = [
      source.pokemonMoves('25', { versionGroup: '1' }),
      source.moveMetadata('204'),
      source.get('1'),
      source.speciesDescription('2'),
    ];
    const settled = Promise.allSettled(pending);
    await expect(source.moveMetadata('205')).rejects.toMatchObject({
      code: 'CATALOG_BUSY',
    });
    release();
    expect((await settled).every((r) => r.status === 'rejected')).toBe(true);
    fetcher.mockImplementation(fixtureFetch);
    expect((await source.moveMetadata('204')).data.move.id).toBe(204);
  });
  it('fails safely on database outage and unexpected cache failure', async () => {
    const fetcher = jest.fn<typeof fetch>();
    const cache: ResourceCache = {
      get: async () => {
        throw new Error('private DB details');
      },
      set: async () => {},
    };
    await expect(
      service(fetcher, cache).pokemonMoves('25', { versionGroup: '1' }),
    ).rejects.toMatchObject({ code: 'CACHE_UNAVAILABLE' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('moves HTTP and OpenAPI', () => {
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
  it('serves real fixture learning records and current metadata under explicit paths', async () => {
    const result = await request(app.getHttpServer())
      .get('/v1/pokemon/25/moves?versionGroup=1&pageSize=2')
      .expect(200);
    expect(pokemonMovesResponseSchema.safeParse(result.body).success).toBe(
      true,
    );
    const move = await request(app.getHttpServer())
      .get('/v1/moves/204')
      .expect(200);
    expect(moveMetadataResponseSchema.safeParse(move.body).success).toBe(true);
  });
  it.each([
    '/v1/pokemon/25/moves',
    '/v1/pokemon/pikachu/moves?versionGroup=1',
    '/v1/pokemon/025/moves?versionGroup=1',
    '/v1/pokemon/25/moves?versionGroup=1&versionGroup=2',
    '/v1/pokemon/25/moves?versionGroup=1&generation=1',
    '/v1/pokemon/25/moves?versionGroup=1&pageSize=51',
    '/v1/moves/204?versionGroup=1',
    '/v1/moves/0',
  ])('rejects invalid HTTP input without upstream work: %s', async (url) => {
    const before = fetcher.mock.calls.length;
    await request(app.getHttpServer()).get(url).expect(400);
    expect(fetcher.mock.calls.length).toBe(before);
  });
  it('exposes sanitized resource errors and no source body', async () => {
    fetcher.mockImplementation(async () =>
      response({ private: 'secret' }, 404),
    );
    const result = await request(app.getHttpServer())
      .get('/v1/moves/205')
      .expect(404);
    expect(result.body.code).toBe('MOVE_NOT_FOUND');
    expect(JSON.stringify(result.body)).not.toContain('secret');
    fetcher.mockImplementation(fixtureFetch);
  });
  it('documents both schemas and the required explicit version-group query', () => {
    const document = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('test').setVersion('1').build(),
    );
    const operation = document.paths['/v1/pokemon/{pokemonId}/moves']!.get!;
    expect(operation.parameters).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ name: 'versionGroup', required: true }),
      ]),
    );
    expect(operation.responses['200']).toBeDefined();
    expect(
      document.paths['/v1/moves/{moveId}']!.get!.responses['200'],
    ).toBeDefined();
  });
});
