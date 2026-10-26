import { afterEach, describe, expect, it, vi } from 'vitest';
import { pokemonSummarySchema } from '@pokelab/contracts';
import { combinedHref } from './combined-catalog';
import { getCombinedWindow } from './combined-catalog-server';
import {
  catalogEntryHref,
  catalogReturnHref,
  parseCatalogQuery,
  parseCatalogSearchParams,
} from './catalog-search';
import captured from '../../../api/test/fixtures/catalog-details.json';
import variant from '../../../api/test/fixtures/filter-pokemon-10100.json';
const meta = {
  source: 'pokeapi-v2',
  fetchedAt: '2026-10-22T12:00:00Z',
  stale: false,
};
const data = pokemonSummarySchema.parse(captured[0]);
const base = { type: 'grass' as const, generation: '1' };
const context = {
  ...base,
  after: '0',
  typeAt: meta.fetchedAt,
  generationAt: meta.fetchedAt,
};
const payload = {
  semantics: 'current-entry-type-and-species-introduction',
  type: 'grass',
  generation: { id: 1, name: 'generation-i' },
  scan: {
    afterId: 0,
    limit: 4,
    totalCandidates: 1,
    scanned: 1,
    hasMore: false,
    nextAfterId: null,
  },
  items: [
    {
      reference: { id: data.id, name: data.name },
      status: 'match',
      data,
      meta,
    },
  ],
  meta: { type: meta, generation: meta },
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
const mock = (value: unknown = payload) => {
  const fn = vi
    .fn()
    .mockImplementation(async () => new Response(JSON.stringify(value)));
  vi.stubGlobal('fetch', fn);
  return fn;
};
describe('combined query and detail context', () => {
  it.each(['1', '2', '3', '4', '5', '6', '7', '8', '9'])(
    'supports generation %s with current-type semantics',
    (generation) => {
      expect(parseCatalogQuery({ ...base, generation })).toEqual({
        kind: 'combined',
        input: { ...base, generation },
      });
    },
  );
  it('round-trips cursor and independent source versions through detail, ignoring movement state', () => {
    const input = { ...context, after: '25' };
    const href = combinedHref(input);
    const detail = new URL(catalogEntryHref(10100, href), 'http://web.test');
    expect(detail.searchParams.get('fromAfter')).toBe('25');
    expect(detail.searchParams.has('fromPage')).toBe(false);
    expect(
      catalogReturnHref({
        ...Object.fromEntries(detail.searchParams),
        moveVersion: '1',
      }),
    ).toBe(href);
    expect(
      parseCatalogSearchParams(new URL(href, detail).searchParams),
    ).toEqual({ kind: 'combined', input });
  });
  it.each([
    { ...base, page: '1' },
    { ...base, search: '25' },
    { ...base, limit: '12' },
    { ...base, after: '01' },
    { ...base, after: '1000000' },
    { ...base, after: '25' },
    { ...base, typeAt: meta.fetchedAt },
    { ...context, generationAt: 'bad' },
    { ...base, generation: ['1', '2'] },
    { ...context, after: ['1', '2'] },
    { type: 'grass', after: '0' },
    { generation: '1', typeAt: meta.fetchedAt },
    { ...context, typeAt: 'https://evil.test' },
  ])('rejects invalid contexts %j before fetching', async (input) => {
    const fetcher = mock();
    expect(parseCatalogQuery(input).kind).toBe('invalid');
    expect(await getCombinedWindow(input)).toEqual({ kind: 'error' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('rejects repeated values and conflicting return combinations', () => {
    expect(
      parseCatalogSearchParams(
        new URLSearchParams('type=grass&type=water&generation=1'),
      ).kind,
    ).toBe('invalid');
    expect(
      catalogReturnHref({
        fromType: 'grass',
        fromGeneration: '1',
        fromAfter: '25',
      }),
    ).toBe('/pokedex?page=1');
    expect(catalogReturnHref({ fromSearch: '25', fromAfter: '0' })).toBe(
      '/pokedex?page=1',
    );
  });
});
describe('bounded combined server consumer', () => {
  it('makes exactly one uncached four-candidate request without forwarding source versions', async () => {
    const fetcher = mock();
    expect(await getCombinedWindow(context)).toEqual({
      kind: 'ready',
      value: payload,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain(
      '/v1/pokemon/filter-scan?type=grass&generation=1&after=0&limit=4',
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({ cache: 'no-store' });
  });
  it.each(['type', 'generation'] as const)(
    'invalidates progress when the %s index changes',
    async (source) => {
      mock({
        ...payload,
        meta: {
          ...payload.meta,
          [source]: { ...meta, fetchedAt: '2026-10-23T00:00:00Z' },
        },
      });
      expect(await getCombinedWindow(context)).toEqual({ kind: 'changed' });
    },
  );
  it.each([
    { ...payload, type: 'water' },
    { ...payload, generation: { id: 2, name: 'generation-ii' } },
    { ...payload, scan: { ...payload.scan, afterId: 1 } },
    { ...payload, scan: { ...payload.scan, limit: 12 } },
    { ...payload, totalMatches: 1 },
    {
      ...payload,
      items: [
        {
          ...payload.items[0],
          data: { ...data, species: { id: 26, name: 'raichu' }, id: 10100 },
        },
      ],
    },
  ])(
    'refuses substituted identity, cursor, limits or malformed responses',
    async (body) => {
      mock(body);
      expect(await getCombinedWindow(base)).toEqual({ kind: 'error' });
    },
  );
  it('retains unknown, excluded, stale and empty windows without filling matches', async () => {
    const items = [1, 2, 3, 4].map((id) => ({
      reference: { id, name: `fixture-${id}` },
      status: 'unavailable',
      code: 'UPSTREAM_UNAVAILABLE',
    }));
    const body = {
      ...payload,
      scan: {
        ...payload.scan,
        totalCandidates: 10,
        scanned: 4,
        hasMore: true,
        nextAfterId: 4,
      },
      items,
      meta: { type: { ...meta, stale: true }, generation: meta },
    };
    const fetcher = mock(body);
    expect(await getCombinedWindow(base)).toEqual({
      kind: 'ready',
      value: body,
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
    const excluded = {
      ...payload,
      items: [
        {
          ...payload.items[0],
          status: 'excluded',
          reason: 'species-not-in-generation',
        },
      ],
    };
    mock(excluded);
    expect(await getCombinedWindow(base)).toEqual({
      kind: 'ready',
      value: excluded,
    });
    const empty = {
      ...payload,
      scan: { ...payload.scan, totalCandidates: 0, scanned: 0 },
      items: [],
    };
    mock(empty);
    expect(await getCombinedWindow(base)).toEqual({
      kind: 'ready',
      value: empty,
    });
  });
  it('keeps a captured nondefault entry linked to its distinct owning species', async () => {
    const data = pokemonSummarySchema.parse({
      id: variant.id,
      name: variant.name,
      isDefault: variant.is_default,
      species: {
        id: Number(variant.species.url.split('/').at(-2)),
        name: variant.species.name,
      },
      types: variant.types.map((item) => item.type.name),
      artwork: variant.sprites.other['official-artwork'].front_default,
    });
    const body = {
      ...payload,
      type: 'electric',
      scan: { ...payload.scan, afterId: 10099 },
      items: [
        {
          reference: { id: data.id, name: data.name },
          status: 'match',
          data,
          meta,
        },
      ],
    };
    mock(body);
    const result = await getCombinedWindow({
      ...context,
      type: 'electric',
      after: '10099',
    });
    expect(result).toEqual({ kind: 'ready', value: body });
    expect(data).toMatchObject({
      id: 10100,
      species: { id: 26, name: 'raichu' },
      isDefault: false,
    });
  });
  it('handles HTTP, JSON and timeout errors without exposing internals', async () => {
    for (const response of [
      new Response('{}', { status: 503 }),
      new Response('bad-json'),
    ]) {
      vi.stubGlobal('fetch', vi.fn().mockResolvedValue(response));
      expect(await getCombinedWindow(base)).toEqual({ kind: 'error' });
    }
    vi.stubGlobal(
      'fetch',
      vi
        .fn()
        .mockRejectedValue(new DOMException('private trace', 'TimeoutError')),
    );
    expect(await getCombinedWindow(base)).toEqual({ kind: 'error' });
  });
});
