import { afterEach, describe, expect, it, vi } from 'vitest';
import { getPokemon } from './pokemon';
afterEach(() => vi.unstubAllGlobals());
describe('server-side API client', () => {
  it('rejects identifiers before making requests', async () => {
    const fetcher = vi.fn();
    vi.stubGlobal('fetch', fetcher);
    expect(await getPokemon('../25')).toEqual({ kind: 'invalid' });
    expect(fetcher).not.toHaveBeenCalled();
  });
  it('distinguishes unavailable Pokémon from outages', async () => {
    const fetcher = vi
      .fn()
      .mockResolvedValueOnce(new Response('{}', { status: 404 }))
      .mockResolvedValueOnce(new Response('{}', { status: 503 }));
    vi.stubGlobal('fetch', fetcher);
    expect(await getPokemon('25')).toEqual({ kind: 'missing' });
    expect(await getPokemon('25')).toEqual({ kind: 'error' });
  });
  it('rejects malformed successful responses', async () => {
    vi.stubGlobal(
      'fetch',
      vi.fn().mockResolvedValue(new Response('{"data":{}}')),
    );
    expect(await getPokemon('25')).toEqual({ kind: 'error' });
  });
  it('handles connection failure', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new Error('offline')));
    expect(await getPokemon('25')).toEqual({ kind: 'error' });
  });
});
