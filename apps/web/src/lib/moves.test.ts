import { describe, it, expect, vi, afterEach } from 'vitest';
import {
  parseMovesQuery,
  movesHref,
  parseMoveMetadata,
  moveValue,
  learnMethod,
} from './moves';
import { getMoves, getMoveMetadata } from './moves-server';
import { GET } from '../app/api/moves/[id]/route';

const pokemon = {
  id: 10080,
  name: 'pikachu-rock-star',
  species: { id: 25, name: 'pikachu' },
  isDefault: false,
};
const meta = {
  source: 'pokeapi-v2',
  fetchedAt: '2026-10-25T17:00:00.000Z',
  stale: false,
};
const group = { id: 1, name: 'red-blue' };
const body = {
  data: {
    pokemon: { id: pokemon.id, name: pokemon.name },
    species: { speciesId: 25, name: 'pikachu' },
    isDefault: false,
    requestedVersionGroupId: 1,
    versionGroup: group,
    availableVersionGroups: [group],
    items: [
      {
        move: { id: 5, name: 'mega-punch' },
        records: [
          {
            versionGroup: group,
            method: { id: 4, name: 'machine' },
            level: 0,
            order: null,
          },
        ],
      },
    ],
    page: 1,
    pageSize: 6,
    total: 1,
    hasNext: false,
  },
  meta,
};
const metadata = {
  data: {
    move: { id: 204, name: 'charm' },
    snapshot: 'current-source',
    type: { id: 18, name: 'fairy' },
    damageClass: { id: 1, name: 'status' },
    power: null,
    pp: 20,
    accuracy: 100,
    priority: 0,
    historicalChanges: [
      {
        versionGroup: { id: 15, name: 'x-y' },
        type: { id: 1, name: 'normal' },
        power: null,
        pp: null,
        accuracy: null,
      },
    ],
  },
  meta: { ...meta, stale: true },
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});
const response = (value: unknown, status = 200) =>
  new Response(JSON.stringify(value), { status });

describe('moves URL state and presentation', () => {
  it('requires an explicit selection without assuming the latest or initial game', () => {
    expect(parseMovesQuery({ fromPage: '2' })).toEqual({ kind: 'choose' });
    expect(parseMovesQuery({ moveVersion: '20' })).toEqual({
      kind: 'selected',
      versionGroup: 20,
      page: 1,
    });
    expect(parseMovesQuery({ moveVersion: '1', movePage: '2' })).toEqual({
      kind: 'selected',
      versionGroup: 1,
      page: 2,
    });
  });
  it.each([
    { movePage: '1' },
    { moveVersion: '01' },
    { moveVersion: '' },
    { moveVersion: ['1', '2'] },
    { moveVersion: ' 1' },
    { moveVersion: '1', movePage: ['1', '2'] },
    { moveVersion: '1', movePage: '1001' },
    { moveVersion: '9999999' },
  ])('rejects ambiguous or excessive movement state %j', (query) => {
    expect(parseMovesQuery(query)).toEqual({ kind: 'invalid' });
  });
  it.each([
    '/pokedex?page=2&type=electric',
    '/pokedex?page=2&generation=4',
    '/pokedex?search=pikachu',
  ])(
    'retains validated catalog origin and resets selection independently: %s',
    (origin) => {
      const url = new URL(movesHref(25, origin, 20, 2), 'http://localhost');
      expect(url.pathname).toBe('/pokemon/25');
      expect(url.hash).toBe('#movimentos');
      expect(url.searchParams.get('moveVersion')).toBe('20');
      expect(url.searchParams.get('movePage')).toBe('2');
      expect(movesHref(25, origin)).not.toContain('moveVersion');
      expect(
        url.searchParams.has('fromPage') || url.searchParams.has('fromSearch'),
      ).toBe(true);
    },
  );
  it('rejects arbitrary return URLs and preserves null/zero and source method identifiers', () => {
    expect(movesHref(25, 'https://evil.test')).toBe(
      '/pokemon/25?fromPage=1#movimentos',
    );
    expect(moveValue(0)).toBe('0');
    expect(moveValue(null)).toBe('Não informado');
    expect(moveValue(null, true)).toBe('Sem alteração informada');
    expect(learnMethod('machine')).toBe('Máquina · machine');
    expect(learnMethod('unknown-method')).toBe('unknown-method');
  });
});
describe('moves server identity and response boundary', () => {
  it('uses entry identity instead of species ID, bounded page size and a retry-aware deadline', async () => {
    const fetcher = vi.fn().mockResolvedValue(response(body));
    vi.stubGlobal('fetch', fetcher);
    const timeout = vi.spyOn(AbortSignal, 'timeout');
    expect(await getMoves(pokemon, 1, 1)).toEqual({
      kind: 'ready',
      value: body,
    });
    expect(fetcher.mock.calls[0]?.[0].pathname).toBe('/v1/pokemon/10080/moves');
    expect(fetcher.mock.calls[0]?.[0].searchParams.get('pageSize')).toBe('6');
    expect(fetcher.mock.calls[0]?.[1].cache).toBe('no-store');
    expect(timeout).toHaveBeenCalledWith(45000);
  });
  it.each([
    { ...body, data: { ...body.data, pokemon: { id: 25, name: 'pikachu' } } },
    {
      ...body,
      data: { ...body.data, species: { speciesId: 25, name: 'wrong' } },
    },
    {
      ...body,
      data: { ...body.data, species: { speciesId: 26, name: 'pikachu' } },
    },
    { ...body, data: { ...body.data, isDefault: true } },
    { ...body, data: { ...body.data, pageSize: 20 } },
    { ...body, data: { ...body.data, page: 2, items: [] } },
    { ...body, data: { ...body.data, requestedVersionGroupId: 2 } },
  ])('rejects internally valid but wrongly scoped data', async (value) => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response(value)));
    expect(await getMoves(pokemon, 1, 1)).toEqual({ kind: 'error' });
  });
  it('validates scope before any request', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(await getMoves({ ...pokemon, id: 0 }, 1, 1)).toEqual({
      kind: 'error',
    });
    expect(await getMoves(pokemon, 0, 1)).toEqual({ kind: 'error' });
    expect(await getMoves(pokemon, 1, 1001)).toEqual({ kind: 'error' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([404, 503])(
    'keeps source missing/error distinct for HTTP %i',
    async (status) => {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response({}, status)));
      expect(await getMoves(pokemon, 1, 1)).toEqual({
        kind: status === 404 ? 'missing' : 'error',
      });
    },
  );
  it('sanitizes malformed JSON, transport and origin failures', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response('{')));
    expect(await getMoves(pokemon, 1, 1)).toEqual({ kind: 'error' });
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('private')));
    expect(await getMoves(pokemon, 1, 1)).toEqual({ kind: 'error' });
    vi.stubEnv('API_URL', 'not-a-url');
    expect(await getMoves(pokemon, 1, 1)).toEqual({ kind: 'error' });
  });
});
describe('move metadata gateway and cross-source identity', () => {
  it('preserves source history, nulls and independent freshness after ID/name matching', () => {
    expect(parseMoveMetadata(metadata, { id: 204, name: 'charm' })).toEqual({
      kind: 'ready',
      value: metadata,
    });
    expect(parseMoveMetadata(metadata, { id: 204, name: 'wrong' })).toEqual({
      kind: 'error',
    });
    expect(parseMoveMetadata(metadata, { id: 205, name: 'charm' })).toEqual({
      kind: 'error',
    });
    expect(
      parseMoveMetadata(
        { ...metadata, data: { ...metadata.data, snapshot: 'historical' } },
        { id: 204, name: 'charm' },
      ),
    ).toEqual({ kind: 'error' });
  });
  it('validates metadata identity, propagates cancellation and keeps the API origin server-side', async () => {
    const fetcher = vi.fn().mockImplementation(async () => response(metadata));
    vi.stubGlobal('fetch', fetcher);
    const controller = new AbortController();
    expect(await getMoveMetadata('204', controller.signal)).toEqual({
      kind: 'ready',
      value: metadata,
    });
    expect(fetcher.mock.calls[0]?.[0].pathname).toBe('/v1/moves/204');
    controller.abort();
    expect(fetcher.mock.calls[0]?.[1].signal.aborted).toBe(true);
    expect(await getMoveMetadata('205')).toEqual({ kind: 'error' });
  });
  it.each(['0', '0204', '../204', '9999999'])(
    'rejects unsafe metadata ID %s before fetch',
    async (id) => {
      const fetcher = vi.fn();
      vi.stubGlobal('fetch', fetcher);
      expect(await getMoveMetadata(id)).toEqual({ kind: 'error' });
      expect(fetcher).not.toHaveBeenCalled();
    },
  );
  it('serves no-store validated metadata and rejects unknown/repeated parameters before fetch', async () => {
    const fetcher = vi.fn().mockImplementation(async () => response(metadata));
    vi.stubGlobal('fetch', fetcher);
    const context = { params: Promise.resolve({ id: '204' }) };
    const result = await GET(
      new Request('http://localhost/api/moves/204'),
      context,
    );
    expect(result.status).toBe(200);
    expect(result.headers.get('Cache-Control')).toBe('no-store');
    expect(await result.json()).toEqual(metadata);
    fetcher.mockClear();
    expect(
      (
        await GET(
          new Request('http://localhost/api/moves/204?x=1&x=2'),
          context,
        )
      ).status,
    ).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it.each([404, 502, 503])(
    'sanitizes metadata HTTP %i and emits no-store errors',
    async (status) => {
      vi.stubGlobal(
        'fetch',
        vi.fn().mockResolvedValue(response({ private: 'secret' }, status)),
      );
      const result = await GET(new Request('http://localhost/api/moves/204'), {
        params: Promise.resolve({ id: '204' }),
      });
      expect(result.status).toBe(status === 404 ? 404 : 503);
      expect(result.headers.get('Cache-Control')).toBe('no-store');
      expect(JSON.stringify(await result.json())).not.toContain('secret');
    },
  );
});
