import { afterEach, describe, expect, it, vi } from 'vitest';
import { pokemonSummarySchema } from '@pokelab/contracts';
import {
  parseCatalogQuery,
  catalogReturnHref,
  parseCatalogSearchParams,
} from './catalog-search';
import {
  generationHref,
  generationDetailHref,
  parseGenerationCards,
  matchGenerationReference,
} from './generation-catalog';
import {
  getGenerationCards,
  getGenerationPage,
} from './generation-catalog-server';
import { GET } from '../app/api/catalog/generation-cards/route';
import captured from '../../../api/test/fixtures/wormadam-detail.json';

const mappingMeta = {
  source: 'pokeapi-v2',
  fetchedAt: '2026-10-22T12:00:00Z',
  stale: true,
};
const summaryMeta = {
  source: 'pokeapi-v2',
  fetchedAt: '2026-10-24T12:00:00Z',
  stale: false,
};
const summary = pokemonSummarySchema.parse(captured);
const data = {
  species: { speciesId: 413, name: 'wormadam' },
  pokemon: { id: 413, name: 'wormadam-plant' },
};
const mappingItem = {
  speciesId: 413,
  status: 'ready',
  data,
  meta: mappingMeta,
};
const ready = {
  speciesId: 413,
  status: 'ready',
  mapping: { data, meta: mappingMeta },
  summary: { data: summary, meta: summaryMeta },
};
const unavailable = {
  speciesId: 1,
  status: 'unavailable',
  code: 'SPECIES_NOT_FOUND',
};
const response = (body: unknown) => new Response(JSON.stringify(body));
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});

describe('generation URL semantics', () => {
  it.each([1, 2, 3, 4, 5, 6, 7, 8, 9])(
    'round-trips generation %s and a page through detail navigation',
    (generation) => {
      const params = new URL(generationHref(2, generation), 'http://web.test')
        .searchParams;
      expect(parseCatalogSearchParams(params)).toEqual({
        kind: 'generation',
        generation,
        page: 2,
      });
      const detail = new URL(
        generationDetailHref(413, 2, generation),
        'http://web.test',
      );
      expect(catalogReturnHref(Object.fromEntries(detail.searchParams))).toBe(
        generationHref(2, generation),
      );
      expect(parseCatalogQuery({ generation: String(generation) })).toEqual({
        kind: 'generation',
        generation,
        page: 1,
      });
    },
  );
  it.each([
    { generation: '' },
    { generation: '0' },
    { generation: '10' },
    { generation: '01' },
    { generation: '1\n' },
    { generation: ['1', '2'] },
    { generation: 'generation-i' },
    { generation: '1', type: 'grass' },
    { generation: '1', search: '' },
    { generation: '1', page: '01' },
    { generation: '1', pageSize: '12' },
  ])('rejects ambiguous/unsupported input %j', (input) =>
    expect(parseCatalogQuery(input)).toEqual({ kind: 'invalid' }),
  );
  it('preserves duplicate URL values and rejects unsafe return combinations as a whole', () => {
    expect(
      parseCatalogSearchParams(new URLSearchParams('generation=1&generation=2'))
        .kind,
    ).toBe('invalid');
    for (const input of [
      { fromGeneration: 'https://evil.test', fromPage: '2' },
      { fromGeneration: ['1', '2'] },
      { fromGeneration: '1', fromType: 'grass' },
      { fromGeneration: '1', fromSearch: '25' },
      { fromGeneration: '1', fromPage: '1001' },
    ])
      expect(catalogReturnHref(input)).toBe('/pokedex?page=1');
  });
});

describe('cross-source card identity', () => {
  it('retains distinct species/variety names and independent source timestamps', () => {
    expect(parseGenerationCards({ items: [ready] }, [413])).toEqual({
      items: [ready],
    });
    const differentId = {
      ...ready,
      mapping: {
        ...ready.mapping,
        data: { ...data, pokemon: { id: 900001, name: summary.name } },
      },
      summary: { ...ready.summary, data: { ...summary, id: 900001 } },
    };
    expect(
      parseGenerationCards({ items: [differentId] }, [413])?.items[0]?.status,
    ).toBe('ready');
  });
  it.each([
    { ...summary, id: 900001 },
    { ...summary, name: 'other-name' },
    { ...summary, isDefault: false },
    { ...summary, species: { id: 1, name: 'wormadam' } },
    { ...summary, species: { id: 413, name: 'other-species' } },
  ])(
    'rejects valid-looking summaries that contradict the mapping: %#',
    (candidate) => {
      expect(
        parseGenerationCards(
          {
            items: [
              { ...ready, summary: { ...ready.summary, data: candidate } },
            ],
          },
          [413],
        ),
      ).toBeNull();
    },
  );
  it('rejects substituted/order/length/duplicate results and mismatched source species names', () => {
    for (const items of [
      [],
      [ready, ready],
      [unavailable, ready],
      [{ ...ready, speciesId: 1 }],
    ])
      expect(parseGenerationCards({ items }, [413])).toBeNull();
    const valid = parseGenerationCards({ items: [ready] }, [413])!.items[0]!;
    expect(
      matchGenerationReference(valid, {
        speciesId: 413,
        name: 'different-name',
      }),
    ).toEqual({
      speciesId: 413,
      status: 'unavailable',
      code: 'INVALID_UPSTREAM',
    });
  });
});

describe('bounded generation server integration', () => {
  it('constructs a fixed-size species page query and validates generation/page identity', async () => {
    const body = {
      generation: { id: 4, name: 'generation-iv' },
      items: [{ speciesId: 413, name: 'wormadam' }],
      page: 1,
      pageSize: 12,
      total: 1,
      hasNext: false,
      meta: mappingMeta,
    };
    const fetcher = vi.fn().mockImplementation(async () => response(body));
    vi.stubGlobal('fetch', fetcher);
    expect(await getGenerationPage(1, 4)).toEqual(body);
    expect(String(fetcher.mock.calls[0]?.[0])).toContain(
      '/v1/pokemon-species?page=1&pageSize=12&generation=4',
    );
    expect(await getGenerationPage(2, 4)).toBeNull();
    expect(await getGenerationPage(1, 1)).toBeNull();
    expect(await getGenerationPage(0, 4)).toBeNull();
    expect(await getGenerationPage(1, 10)).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(3);
  });
  it('resolves mappings before requesting only ready Pokémon IDs and preserves per-source metadata', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ items: [unavailable, mappingItem] }))
      .mockResolvedValueOnce(
        response({
          items: [
            { id: 413, status: 'ready', data: summary, meta: summaryMeta },
          ],
        }),
      );
    vi.stubGlobal('fetch', fetcher);
    expect(await getGenerationCards({ speciesIds: '1,413' })).toEqual({
      items: [unavailable, ready],
    });
    expect(String(fetcher.mock.calls[0]?.[0])).toContain(
      '/v1/pokemon-species/default-varieties?speciesIds=1%2C413',
    );
    expect(String(fetcher.mock.calls[1]?.[0])).toContain(
      '/v1/pokemon/summaries?ids=413',
    );
    expect(fetcher).toHaveBeenCalledTimes(2);
  });
  it('does not fetch summaries when no mapping is available', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ items: [unavailable] }));
    vi.stubGlobal('fetch', fetcher);
    expect(await getGenerationCards({ speciesIds: '1' })).toEqual({
      items: [unavailable],
    });
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it('retains mapping freshness when summaries fail and downgrades incompatible summaries per item', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ items: [mappingItem] }))
      .mockResolvedValueOnce(
        response({
          items: [
            {
              id: 413,
              status: 'ready',
              data: { ...summary, isDefault: false },
              meta: summaryMeta,
            },
          ],
        }),
      )
      .mockResolvedValueOnce(response({ items: [mappingItem] }))
      .mockRejectedValueOnce(new Error('private upstream trace'));
    vi.stubGlobal('fetch', fetcher);
    expect(
      (await getGenerationCards({ speciesIds: '413' }))?.items[0],
    ).toMatchObject({
      status: 'unavailable',
      code: 'INVALID_UPSTREAM',
      mapping: ready.mapping,
    });
    expect(
      (await getGenerationCards({ speciesIds: '413' }))?.items[0],
    ).toMatchObject({
      status: 'unavailable',
      code: 'UPSTREAM_UNAVAILABLE',
      mapping: ready.mapping,
    });
  });
  it.each([
    { items: [] },
    { items: [unavailable] },
    { items: [mappingItem, mappingItem] },
  ])(
    'refuses a substituted/malformed mapping batch before summary access: %#',
    async ({ items }) => {
      const fetcher = vi.fn().mockResolvedValueOnce(response({ items }));
      vi.stubGlobal('fetch', fetcher);
      expect(await getGenerationCards({ speciesIds: '413' })).toBeNull();
      expect(fetcher).toHaveBeenCalledTimes(1);
    },
  );
  it('cancels between phases without summary access', async () => {
    const controller = new AbortController();
    const fetcher = vi.fn().mockImplementation(async () => {
      controller.abort();
      return response({ items: [mappingItem] });
    });
    vi.stubGlobal('fetch', fetcher);
    expect(
      await getGenerationCards({ speciesIds: '413' }, controller.signal),
    ).toBeNull();
    expect(fetcher).toHaveBeenCalledTimes(1);
  });
  it.each([
    '',
    'speciesIds=01',
    'speciesIds=1&speciesIds=2',
    'speciesIds=1,2,3,4,5',
    'speciesIds=1&type=grass',
    'speciesIds=1,1',
  ])('gateway rejects %s before upstream access', async (query) => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(
      (
        await GET(
          new Request('http://web.test/api/catalog/generation-cards?' + query),
        )
      ).status,
    ).toBe(400);
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('returns no-store results and sanitizes a gateway outage', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(response({ items: [unavailable] }))
      .mockRejectedValueOnce(new Error('database password trace'));
    vi.stubGlobal('fetch', fetcher);
    const one = await GET(
      new Request('http://web.test/api/catalog/generation-cards?speciesIds=1'),
    );
    expect(one.status).toBe(200);
    expect(one.headers.get('cache-control')).toBe('no-store');
    const two = await GET(
      new Request('http://web.test/api/catalog/generation-cards?speciesIds=1'),
    );
    expect(two.status).toBe(503);
    expect(await two.json()).toEqual({ code: 'GENERATION_CARDS_UNAVAILABLE' });
  });
});
