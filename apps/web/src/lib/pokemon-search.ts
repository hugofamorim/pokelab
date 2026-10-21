import { getPokemon } from './pokemon';
import type { PokemonResult } from './pokemon';
import { normalizeSearch } from './catalog-search';

export async function getSearchResult(term: string): Promise<PokemonResult> {
  const normalized = normalizeSearch(term);
  if (!normalized) return { kind: 'invalid' };
  const result = await getPokemon(normalized);
  if (result.kind !== 'ready') return result;
  const data = result.value.data;
  const matches = /^\d+$/.test(normalized)
    ? data.id === Number(normalized)
    : data.name === normalized;
  return matches ? result : { kind: 'error' };
}
