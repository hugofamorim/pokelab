import { describe, expect, it, vi, afterEach } from 'vitest';
import { getSpeciesDescription } from './species-description';
const species = { id: 413, name: 'wormadam' };
const body = {
  data: {
    species: { speciesId: 413, name: 'wormadam' },
    description: { text: 'Source text.', language: 'en', version: 'diamond' },
  },
  meta: {
    source: 'pokeapi-v2',
    fetchedAt: '2026-10-25T01:00:00.000Z',
    stale: false,
  },
};
afterEach(() => {
  vi.unstubAllGlobals();
  vi.unstubAllEnvs();
});
describe('species description server client', () => {
  it('requests the owning species, revalidates identity and preserves independent metadata', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValue(new Response(JSON.stringify(body)));
    vi.stubGlobal('fetch', fetcher);
    vi.stubEnv('API_URL', 'http://127.0.0.1:3001');
    expect(await getSpeciesDescription(species)).toEqual({
      kind: 'ready',
      value: body,
    });
    expect(fetcher.mock.calls[0]?.[0].href).toBe(
      'http://127.0.0.1:3001/v1/pokemon-species/413/description',
    );
    expect(fetcher.mock.calls[0]?.[1]).toMatchObject({
      cache: 'no-store',
      signal: expect.any(AbortSignal),
    });
  });
  it.each([
    {
      ...body,
      data: { ...body.data, species: { speciesId: 414, name: 'wormadam' } },
    },
    {
      ...body,
      data: {
        ...body.data,
        species: { speciesId: 413, name: 'wormadam-plant' },
      },
    },
    {
      ...body,
      data: {
        ...body.data,
        description: { ...body.data.description, language: 'fr' },
      },
    },
    {
      ...body,
      data: {
        ...body.data,
        description: { ...body.data.description, text: 'raw\ntext' },
      },
    },
    { ...body, meta: { ...body.meta, source: 'unknown' } },
  ])('rejects contradictory or malformed source data', async (value) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(value))),
    );
    expect(await getSpeciesDescription(species)).toEqual({ kind: 'error' });
  });
  it('keeps unavailable language separate from failed data', async () => {
    const value = {
      ...body,
      data: { ...body.data, description: null },
      meta: { ...body.meta, stale: true },
    };
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response(JSON.stringify(value))),
    );
    expect(await getSpeciesDescription(species)).toEqual({
      kind: 'ready',
      value,
    });
  });
  it.each([404, 502, 503])('handles HTTP %s', async (status) => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{}', { status })),
    );
    expect(await getSpeciesDescription(species)).toEqual({
      kind: status === 404 ? 'missing' : 'error',
    });
  });
  it('handles transport failure and invalid JSON without exposing errors', async () => {
    const fetcher = vi
      .fn()
      .mockRejectedValueOnce(new Error('private network data'))
      .mockResolvedValueOnce(new Response('{'));
    vi.stubGlobal('fetch', fetcher);
    expect(await getSpeciesDescription(species)).toEqual({ kind: 'error' });
    expect(await getSpeciesDescription(species)).toEqual({ kind: 'error' });
  });
  it('rejects invalid species input before network access', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(await getSpeciesDescription({ id: 0, name: 'wormadam' })).toEqual({
      kind: 'error',
    });
    expect(fetcher).not.toHaveBeenCalled();
  });
});
