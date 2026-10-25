import { describe, it, expect, vi, afterEach } from 'vitest';
import { evolutionConditionSchema } from '@pokelab/contracts';
import { evolutionConditionLabels, evolutionConditionRows } from './evolution';
import { catalogEntryHref } from './catalog-search';
import { getEvolution } from './evolution-server';
const meta = {
  source: 'pokeapi-v2',
  fetchedAt: '2026-10-25T01:00:00.000Z',
  stale: false,
};
const species = { id: 133, name: 'eevee' };
const node = {
  species: { speciesId: 133, name: 'eevee' },
  parentSpeciesId: null,
  isBaby: false,
  conditions: [],
};
const chain = { chainId: 67, babyTriggerItem: null, nodes: [node] };
const body = {
  data: { species: node.species, chain },
  meta: { species: meta, chain: { ...meta, stale: true } },
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('evolution server boundary', () => {
  it('uses owning species, a composed-resource deadline and independent metadata', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(body)));
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('API_URL', 'http://127.0.0.1:3001');
    expect(await getEvolution(species)).toEqual({ kind: 'ready', value: body });
    expect(fetcher.mock.calls[0]?.[0].href).toBe(
      'http://127.0.0.1:3001/v1/pokemon-species/133/evolution',
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    });
    expect(timeout).toHaveBeenCalledWith(70000);
    timeout.mockRestore();
  });
  it.each([
    {
      ...body,
      data: { ...body.data, species: { speciesId: 134, name: 'vaporeon' } },
    },
    {
      ...body,
      data: { ...body.data, species: { speciesId: 133, name: 'wrong-name' } },
    },
    {
      ...body,
      data: { ...body.data, chain: { ...chain, nodes: [node, node] } },
    },
    { ...body, meta: { ...body.meta, chain: null } },
    {
      ...body,
      meta: { ...body.meta, species: { ...meta, source: 'unknown' } },
    },
  ])(
    'rejects malformed topology, identity and source metadata',
    async (value) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response(JSON.stringify(value))),
      );
      expect(await getEvolution(species)).toEqual({ kind: 'error' });
    },
  );
  it('distinguishes explicit null reference from a one-node family', async () => {
    const value = {
      data: { species: node.species, chain: null },
      meta: { species: meta, chain: null },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(value))),
    );
    expect(await getEvolution(species)).toEqual({ kind: 'ready', value });
  });
  it.each([404, 502, 503])(
    'handles HTTP %s without inventing absence',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(new Response('{}', { status })),
      );
      expect(await getEvolution(species)).toEqual({
        kind: status === 404 ? 'missing' : 'error',
      });
    },
  );
  it('handles invalid identity, JSON and network errors safely', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('private error'))
      .mockResolvedValueOnce(new Response('{'));
    vi.stubGlobal('fetch', fetcher);
    expect(await getEvolution({ id: 0, name: 'eevee' })).toEqual({
      kind: 'error',
    });
    expect(fetcher).not.toHaveBeenCalled();
    expect(await getEvolution(species)).toEqual({ kind: 'error' });
    expect(await getEvolution(species)).toEqual({ kind: 'error' });
  });
});
describe('catalog origin for evolution navigation', () => {
  it.each([
    [
      '/pokedex?page=3&generation=4',
      '/pokemon/134?fromPage=3&fromGeneration=4',
    ],
    ['/pokedex?page=2&type=water', '/pokemon/134?fromPage=2&fromType=water'],
    ['/pokedex?search=eevee', '/pokemon/134?fromSearch=eevee'],
    ['/pokedex?page=2', '/pokemon/134?fromPage=2'],
    ['https://evil.example/pokedex?page=3', '/pokemon/134?fromPage=1'],
    ['/pokedex?page=1&page=2', '/pokemon/134?fromPage=1'],
    ['/pokedex?page=1&type=water&generation=4', '/pokemon/134?fromPage=1'],
  ])('constructs internal link from %s', (origin, href) =>
    expect(catalogEntryHref(134, origin)).toBe(href),
  );
});
describe('complete condition display', () => {
  // Synthetic condition exercises null/false/zero and opaque expressions, never live data.
  const condition = {
    versionGroup: { id: 1, name: 'red-blue' },
    isDefault: false,
    trigger: { id: 1, name: 'level-up' },
    item: null,
    gender: null,
    heldItem: null,
    knownMove: null,
    knownMoveType: null,
    location: null,
    minLevel: 0,
    minHappiness: null,
    minBeauty: null,
    minAffection: null,
    nearSpecialRock: false,
    needsMultiplayer: false,
    needsOverworldRain: false,
    partySpecies: null,
    partyType: null,
    relativePhysicalStats: 0,
    timeOfDay: '',
    tradeSpecies: null,
    turnUpsideDown: false,
    region: null,
    requiredPokemonForm: { id: 10424, name: 'fixture-form' },
    evolvedPokemonForm: null,
    usedMove: null,
    minMoveCount: null,
    minSteps: null,
    minDamageTaken: null,
    allowedNatures: [],
    conditionExpression: {
      expression: 'EC 100 % 0 ==',
      percentageChance: 1,
      variables: [{ id: 1, name: 'encryption-constant' }],
    },
  };
  it('covers every field while preserving null, zero, false and source expression values', () => {
    const value = evolutionConditionSchema.parse(condition);
    const rows = evolutionConditionRows(value);
    expect(Object.keys(evolutionConditionLabels).sort()).toEqual(
      Object.keys(evolutionConditionSchema.shape).sort(),
    );
    expect(rows.find((row) => row.key === 'minLevel')?.value).toBe('0');
    expect(rows.find((row) => row.key === 'isDefault')?.value).toBe('Não');
    expect(rows.find((row) => row.key === 'item')?.value).toBe(
      'Não indicado no registro',
    );
    expect(rows.find((row) => row.key === 'relativePhysicalStats')?.value).toBe(
      'Ataque = Defesa',
    );
    expect(rows.find((row) => row.key === 'requiredPokemonForm')?.value).toBe(
      'fixture-form (#10424)',
    );
    expect(
      rows.find((row) => row.key === 'conditionExpression')?.value,
    ).toContain('EC 100 % 0 ==');
    expect(
      rows.find((row) => row.key === 'conditionExpression')?.value,
    ).toContain('1%');
  });
  it.each([
    [-1, 'Ataque < Defesa'],
    [0, 'Ataque = Defesa'],
    [1, 'Ataque > Defesa'],
  ])('describes relation %s', (relative, label) => {
    const value = evolutionConditionSchema.parse({
      ...condition,
      relativePhysicalStats: relative,
    });
    expect(
      evolutionConditionRows(value).find(
        (row) => row.key === 'relativePhysicalStats',
      )?.value,
    ).toBe(label);
  });
  it.each([
    ['day', 'Dia'],
    ['night', 'Noite'],
    ['dusk', 'Entardecer'],
    ['full-moon', 'Lua cheia'],
  ])('describes source time %s', (time, label) => {
    const value = evolutionConditionSchema.parse({
      ...condition,
      timeOfDay: time,
    });
    expect(
      evolutionConditionRows(value).find((row) => row.key === 'timeOfDay')
        ?.value,
    ).toBe(label);
  });
});
