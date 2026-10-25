import { jest } from '@jest/globals';
import 'reflect-metadata';
import type { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import { DocumentBuilder, SwaggerModule } from '@nestjs/swagger';
import request from 'supertest';
import eevee from './fixtures/evolution-chain-eevee.json' with { type: 'json' };
import dunsparce from './fixtures/evolution-chain-dunsparce.json' with { type: 'json' };
import species from './fixtures/species-eevee-evolution.json' with { type: 'json' };
import {
  evolutionChainSchema,
  speciesEvolutionResponseSchema,
  EVOLUTION_LIMITS,
} from '@pokelab/contracts';
import { PokeApiAdapter } from '../src/pokeapi-adapter.js';
import { CatalogService } from '../src/catalog.service.js';
import { AppModule } from '../src/app.module.js';
import { ApiErrorFilter } from '../src/errors.js';
import { CONFIG } from '../src/config.js';
import type { Config } from '../src/config.js';
import { RESOURCE_CACHE } from '../src/cache.js';
import type { ResourceCache, CacheEntry } from '../src/cache.js';
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
const response = (body: unknown, status = 200) =>
  new Response(JSON.stringify(body), { status });
const fixtureFetch: typeof fetch = async (url) =>
  response(String(url).includes('/pokemon-species/') ? species : eevee);
const adapter = (fetcher: typeof fetch = fixtureFetch) =>
  new PokeApiAdapter(1000, fetcher, async () => {});
const service = (
  fetcher: typeof fetch = fixtureFetch,
  cache: ResourceCache = new MemoryCache(),
) => new CatalogService(cache, adapter(fetcher), config);
const refKey = 'pokeapi-v2:normalized-v1:species-evolution-reference/133';
const chainKey = 'pokeapi-v2:normalized-v1:evolution-chain/67';
const alternative = eevee.chain.evolves_to[0]!.evolution_details[0]!;

describe('evolution adapter', () => {
  it('constructs species and chain paths without assuming ID equality or following URLs', async () => {
    const fetcher = jest.fn<typeof fetch>().mockImplementation(fixtureFetch);
    const source = adapter(fetcher);
    expect(await source.evolutionReference(133)).toEqual({
      species: { speciesId: 133, name: 'eevee' },
      chainId: 67,
    });
    const result = await source.evolutionChain(67);
    expect(result.nodes.map((node) => node.species.speciesId)).toEqual([
      133,
      ...eevee.chain.evolves_to.map((node) =>
        Number(node.species.url.split('/').at(-2)),
      ),
    ]);
    expect(
      result.nodes.slice(1).every((node) => node.parentSpeciesId === 133),
    ).toBe(true);
    expect(result.nodes[1]?.conditions).toHaveLength(
      eevee.chain.evolves_to[0]!.evolution_details.length,
    );
    expect(result.nodes[1]?.conditions[0]).toMatchObject({
      versionGroup: { id: 1, name: 'red-blue' },
      item: { id: 84, name: 'water-stone' },
      requiredPokemonForm: { id: 133, name: 'eevee' },
    });
    expect(fetcher.mock.calls.map((call) => call[0])).toEqual([
      'https://pokeapi.co/api/v2/pokemon-species/133',
      'https://pokeapi.co/api/v2/evolution-chain/67',
    ]);
    expect(
      fetcher.mock.calls.every((call) => call[1]?.redirect === 'error'),
    ).toBe(true);
  });
  it('preserves modern version/form branches and unevaluated source expressions', async () => {
    const result = await adapter(async () =>
      response(dunsparce),
    ).evolutionChain(dunsparce.id);
    const conditions = result.nodes[1]!.conditions;
    expect(conditions.map((detail) => detail.evolvedPokemonForm?.name)).toEqual(
      ['dudunsparce-two-segment', 'dudunsparce-three-segment'],
    );
    expect(
      conditions.map((detail) => detail.conditionExpression?.expression),
    ).toEqual(['EC 100 % 0 !=', 'EC 100 % 0 ==']);
    expect(
      conditions.map((detail) => detail.conditionExpression?.percentageChance),
    ).toEqual([99, 1]);
    expect(conditions[0]?.conditionExpression?.variables).toEqual([
      { id: 1, name: 'encryption-constant' },
    ]);
    expect(conditions[0]?.knownMove).toEqual({ id: 887, name: 'hyper-drill' });
  });
  it('preserves zero/false requirements, breeding metadata and multiple AND fields per alternative (synthetic boundary)', async () => {
    const body = structuredClone(eevee);
    const detail = body.chain.evolves_to[0]!.evolution_details[0]!;
    Object.assign(detail, {
      min_level: 0,
      min_steps: 1000,
      min_damage_taken: 294,
      min_move_count: 20,
      relative_physical_stats: 0,
      gender: 1,
      needs_multiplayer: true,
      needs_overworld_rain: true,
      near_special_rock: true,
      turn_upside_down: true,
      time_of_day: 'dusk',
      region: { name: 'alola', url: 'https://pokeapi.co/api/v2/region/7/' },
      used_move: {
        name: 'hyper-drill',
        url: 'https://pokeapi.co/api/v2/move/887/',
      },
      allowed_natures: [
        { name: 'hardy', url: 'https://pokeapi.co/api/v2/nature/1/' },
      ],
    });
    Object.assign(body, {
      baby_trigger_item: {
        name: 'sea-incense',
        url: 'https://pokeapi.co/api/v2/item/232/',
      },
    });
    const result = await adapter(async () => response(body)).evolutionChain(67);
    expect(result.babyTriggerItem).toEqual({ id: 232, name: 'sea-incense' });
    expect(result.nodes[1]?.conditions[0]).toMatchObject({
      minLevel: 0,
      minSteps: 1000,
      minDamageTaken: 294,
      minMoveCount: 20,
      relativePhysicalStats: 0,
      gender: 1,
      needsMultiplayer: true,
      needsOverworldRain: true,
      nearSpecialRock: true,
      turnUpsideDown: true,
      timeOfDay: 'dusk',
      allowedNatures: [{ id: 1, name: 'hardy' }],
    });
  });
  it('distinguishes null species reference, one-node family and unknown non-root requirements', async () => {
    expect(
      (
        await adapter(async () =>
          response({ ...species, evolution_chain: null }),
        ).evolutionReference(133)
      ).chainId,
    ).toBeNull();
    const body = structuredClone(eevee);
    body.chain.evolves_to = [];
    expect(
      (await adapter(async () => response(body)).evolutionChain(67)).nodes,
    ).toHaveLength(1);
    const unknown = structuredClone(eevee);
    unknown.chain.evolves_to[0]!.evolution_details = [];
    expect(
      (await adapter(async () => response(unknown)).evolutionChain(67)).nodes[1]
        ?.conditions,
    ).toEqual([]);
  });
  it.each([0, -1, 1000000, 1.5, NaN])(
    'rejects ID %s before fetch',
    async (id) => {
      const fetcher = jest.fn<typeof fetch>();
      await expect(adapter(fetcher).evolutionChain(id)).rejects.toMatchObject({
        status: 400,
      });
      await expect(
        adapter(fetcher).evolutionReference(id),
      ).rejects.toMatchObject({ status: 400 });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it.each([
    { ...species, id: 25 },
    { ...species, evolution_chain: undefined },
    {
      ...species,
      evolution_chain: { url: 'https://evil.example/evolution-chain/67/' },
    },
    {
      ...species,
      evolution_chain: {
        url: 'https://pokeapi.co/api/v2/evolution-chain/067/',
      },
    },
    {
      ...species,
      evolution_chain: {
        url: 'https://pokeapi.co/api/v2/evolution-chain/67/?x=1',
      },
    },
    {
      ...species,
      evolution_chain: {
        url: 'https://pokeapi.co/api/v2/evolution-chain/67/\n',
      },
    },
  ])(
    'rejects malformed species references without following links',
    async (body) => {
      const fetcher = jest
        .fn<typeof fetch>()
        .mockImplementation(async () => response(body));
      await expect(
        adapter(fetcher).evolutionReference(133),
      ).rejects.toMatchObject({ code: 'INVALID_UPSTREAM' });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it.each([
    ['id', null],
    ['trigger', null],
    ['unknown_requirement', true],
    ['min_level', -1],
    ['gender', 0],
    ['time_of_day', 'midnight'],
    ['near_special_rock', undefined],
    ['is_default', undefined],
    ['min_steps', 1e10],
    ['item', { name: 'stone', url: 'https://pokeapi.co/api/v2/move/84/' }],
    [
      'condition_expression',
      { expression: 'x'.repeat(513), percentage_chance: 50, variables: [] },
    ],
  ])(
    'rejects unsupported/incomplete condition %s instead of silently dropping it',
    async (field, value) => {
      const body = structuredClone(eevee);
      Object.assign(body.chain.evolves_to[0]!.evolution_details[0]!, {
        [field as string]: value,
      });
      const fetcher = jest
        .fn<typeof fetch>()
        .mockImplementation(async () => response(body));
      await expect(adapter(fetcher).evolutionChain(67)).rejects.toMatchObject({
        code: 'INVALID_UPSTREAM',
      });
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('rejects duplicate species, excessive alternatives/nodes/depth and malformed root conditions', async () => {
    const duplicate = structuredClone(eevee);
    duplicate.chain.evolves_to.push(duplicate.chain.evolves_to[0]!);
    const excessive = {
      ...eevee,
      chain: {
        ...eevee.chain,
        evolves_to: [
          {
            ...eevee.chain.evolves_to[0]!,
            evolution_details: Array.from({ length: 65 }, () => alternative),
          },
        ],
      },
    };
    const rootDetails = {
      ...eevee,
      chain: { ...eevee.chain, evolution_details: [alternative] },
    };
    const makeNode = (id: number) => ({
      is_baby: false,
      species: {
        name: 'species-' + id,
        url: `https://pokeapi.co/api/v2/pokemon-species/${id}/`,
      },
      evolution_details: [],
      evolves_to: [] as unknown[],
    });
    const deep = makeNode(1);
    let current = deep;
    for (let id = 2; id <= 9; id++) {
      const next = makeNode(id);
      current.evolves_to.push(next);
      current = next;
    }
    const wide = makeNode(1);
    wide.evolves_to = Array.from({ length: 64 }, (_, i) => makeNode(i + 2));
    for (const body of [
      duplicate,
      excessive,
      rootDetails,
      { ...eevee, chain: deep },
      { ...eevee, chain: wide },
      { ...eevee, id: 1 },
    ]) {
      await expect(
        adapter(async () => response(body)).evolutionChain(67),
      ).rejects.toMatchObject({ code: 'INVALID_UPSTREAM' });
    }
  });
  it('bounds both resource bodies, rejects malformed JSON and limits transient retries', async () => {
    for (const method of ['evolutionReference', 'evolutionChain'] as const) {
      const oversized = jest
        .fn<typeof fetch>()
        .mockImplementation(
          async () =>
            new Response(' '.repeat(EVOLUTION_LIMITS.maxResponseBytes + 1)),
        );
      await expect(adapter(oversized)[method](67)).rejects.toMatchObject({
        status: 502,
      });
      expect(oversized).toHaveBeenCalledTimes(1);
      await expect(
        adapter(async () => new Response('{'))[method](67),
      ).rejects.toMatchObject({ status: 502 });
      const outage = jest
        .fn<typeof fetch>()
        .mockRejectedValue(new Error('private upstream secret'));
      await expect(adapter(outage)[method](67)).rejects.toMatchObject({
        code: 'UPSTREAM_UNAVAILABLE',
      });
      expect(outage).toHaveBeenCalledTimes(2);
    }
  });
  it('aborts both timed-out attempts', async () => {
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
      new PokeApiAdapter(5, fetcher, async () => {}).evolutionChain(67),
    ).rejects.toMatchObject({ code: 'UPSTREAM_UNAVAILABLE' });
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(fetcher.mock.calls.every((call) => call[1]?.signal?.aborted)).toBe(
      true,
    );
  });
});

describe('species evolution composition/cache/admission', () => {
  it('fetches only reference then chain, persists both and preserves independent freshness', async () => {
    const fetcher = jest.fn<typeof fetch>().mockImplementation(fixtureFetch);
    const cache = new MemoryCache();
    const catalog = service(fetcher, cache);
    const [one, two] = await Promise.all([
      catalog.speciesEvolution('133'),
      catalog.speciesEvolution('133'),
    ]);
    expect(one).toEqual(two);
    expect(speciesEvolutionResponseSchema.safeParse(one).success).toBe(true);
    expect(await catalog.speciesEvolution('133')).toEqual(one);
    expect(fetcher).toHaveBeenCalledTimes(2);
    expect(cache.entries.has(refKey)).toBe(true);
    expect(cache.entries.has(chainKey)).toBe(true);
    cache.entries.get(chainKey)!.expiresAt = new Date(0);
    fetcher.mockImplementation(async () => response({}, 503));
    const stale = await catalog.speciesEvolution('133');
    expect(stale.meta.species.stale).toBe(false);
    expect(stale.meta.chain).toEqual({ ...one.meta.chain, stale: true });
    cache.entries.get(chainKey)!.expiresAt = new Date(Date.now() + 60000);
    cache.entries.get(refKey)!.expiresAt = new Date(0);
    const staleReference = await catalog.speciesEvolution('133');
    expect(staleReference.meta.species).toEqual({
      ...one.meta.species,
      stale: true,
    });
    expect(staleReference.meta.chain?.stale).toBe(false);
  });
  it('shares a chain load across distinct species and releases reference admission first', async () => {
    let chainReads = 0;
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async (url) => {
      const path = String(url);
      if (path.includes('/pokemon-species/')) {
        const id = Number(path.split('/').at(-1));
        return response({
          ...species,
          id,
          name: id === 133 ? 'eevee' : 'vaporeon',
        });
      }
      chainReads++;
      await new Promise((resolve) => setImmediate(resolve));
      return response(eevee);
    });
    const catalog = service(fetcher);
    const results = await Promise.all([
      catalog.speciesEvolution('133'),
      catalog.speciesEvolution('134'),
    ]);
    expect(chainReads).toBe(1);
    expect(results.map((value) => value.data.species.speciesId)).toEqual([
      133, 134,
    ]);
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('returns cached null only for an explicitly null source reference', async () => {
    const fetcher = jest
      .fn<typeof fetch>()
      .mockImplementation(async () =>
        response({ ...species, evolution_chain: null }),
      );
    const catalog = service(fetcher);
    const one = await catalog.speciesEvolution('133');
    expect(one.data.chain).toBeNull();
    expect(one.meta.chain).toBeNull();
    await catalog.speciesEvolution('133');
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('rejects cross-resource ID/name mismatches and wrong-chain cache data', async () => {
    const cache = new MemoryCache();
    const fetcher = jest.fn<typeof fetch>().mockImplementation(fixtureFetch);
    const catalog = service(fetcher, cache);
    await catalog.speciesEvolution('133');
    const saved = cache.entries.get(chainKey)!;
    cache.entries.set(chainKey, {
      ...saved,
      payload: { ...evolutionChainSchema.parse(saved.payload), chainId: 1 },
    });
    await catalog.speciesEvolution('133');
    expect(fetcher).toHaveBeenCalledTimes(3);
    const reference = cache.entries.get(refKey)!;
    cache.entries.set(refKey, {
      ...reference,
      payload: { species: { speciesId: 133, name: 'wrong-name' }, chainId: 67 },
    });
    await expect(catalog.speciesEvolution('133')).rejects.toMatchObject({
      code: 'INVALID_UPSTREAM',
    });
  });
  it('does not serve stale on species or chain 404 and never disguises outage as no evolution', async () => {
    for (const stage of ['species', 'chain']) {
      const cache = new MemoryCache();
      const fetcher = jest.fn<typeof fetch>().mockImplementation(fixtureFetch);
      const catalog = service(fetcher, cache);
      await catalog.speciesEvolution('133');
      cache.entries.get(stage === 'species' ? refKey : chainKey)!.expiresAt =
        new Date(0);
      fetcher.mockImplementation(async () => response({}, 404));
      await expect(catalog.speciesEvolution('133')).rejects.toMatchObject({
        status: 404,
        code:
          stage === 'species'
            ? 'SPECIES_NOT_FOUND'
            : 'EVOLUTION_CHAIN_NOT_FOUND',
      });
    }
    await expect(
      service(async () => response({}, 503)).speciesEvolution('133'),
    ).rejects.toMatchObject({ status: 503 });
  });
  it('shares four resource slots with details and releases them on failure', async () => {
    const releases: (() => void)[] = [];
    const fetcher = jest.fn<typeof fetch>().mockImplementation(async (url) => {
      await new Promise<void>((resolve) => releases.push(resolve));
      return String(url).includes('/pokemon-species/')
        ? response({ ...species, evolution_chain: null })
        : response({}, 404);
    });
    const catalog = service(fetcher);
    const pending = [
      catalog.speciesEvolution('133'),
      ...['1', '2', '3'].map((id) => catalog.get(id).catch(() => null)),
    ];
    const joined = catalog.speciesEvolution('133');
    await expect(catalog.speciesEvolution('134')).rejects.toMatchObject({
      code: 'CATALOG_BUSY',
    });
    await new Promise((resolve) => setImmediate(resolve));
    releases.forEach((release) => release());
    await Promise.all([...pending, joined]);
    fetcher.mockImplementation(fixtureFetch);
    expect((await catalog.speciesEvolution('133')).data.chain).toBeNull();
  });
  it('sanitizes cache read failures before upstream access', async () => {
    const fetcher = jest.fn<typeof fetch>();
    const cache: ResourceCache = {
      get: async () => {
        throw new Error('private DB trace');
      },
      set: async () => {},
    };
    await expect(
      service(fetcher, cache).speciesEvolution('133'),
    ).rejects.toMatchObject({ code: 'CACHE_UNAVAILABLE' });
    expect(fetcher).not.toHaveBeenCalled();
  });
});

describe('GET /v1/pokemon-species/:speciesId/evolution', () => {
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
  it('returns an eight-branch species tree with source conditions and cache reuse', async () => {
    const one = await request(app.getHttpServer())
      .get('/v1/pokemon-species/133/evolution')
      .expect(200);
    expect(speciesEvolutionResponseSchema.safeParse(one.body).success).toBe(
      true,
    );
    expect(one.body.data.chain.nodes).toHaveLength(9);
    expect(
      (
        await request(app.getHttpServer())
          .get('/v1/pokemon-species/133/evolution')
          .expect(200)
      ).body,
    ).toEqual(one.body);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it.each(['0', '01', '1000000', '133%0A', '133?generation=1', '133?x=1&x=2'])(
    'rejects %s before upstream access',
    async (path) => {
      const [id, query] = path.split('?');
      const count = fetcher.mock.calls.length;
      await request(app.getHttpServer())
        .get(`/v1/pokemon-species/${id}/evolution${query ? '?' + query : ''}`)
        .expect(400);
      expect(fetcher).toHaveBeenCalledTimes(count);
    },
  );
  it('returns sanitized failures without raw upstream metadata', async () => {
    fetcher.mockRejectedValue(new Error('private upstream secret'));
    const result = await request(app.getHttpServer())
      .get('/v1/pokemon-species/25/evolution')
      .expect(503);
    expect(result.body.code).toBe('UPSTREAM_UNAVAILABLE');
    expect(JSON.stringify(result.body)).not.toMatch(/private|secret|stack/);
  });
  it('documents the species-based route with both source metadata records', () => {
    const doc = SwaggerModule.createDocument(
      app,
      new DocumentBuilder().setTitle('test').build(),
    );
    expect(
      doc.paths['/v1/pokemon-species/{speciesId}/evolution']?.get?.responses[
        '200'
      ],
    ).toBeDefined();
  });
});
