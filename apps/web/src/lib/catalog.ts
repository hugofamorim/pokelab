import {
  pokemonListQuerySchema,
  pokemonSummariesResponseSchema,
} from '@pokelab/contracts';
import type { PokemonSummariesResponse } from '@pokelab/contracts';
import type { PokemonType } from '@pokelab/pokemon-domain';

export const CATALOG_PAGE_SIZE = 12;
export const CATALOG_BATCH_SIZE = 4;
export function parseCatalogPage(input: unknown): number | null {
  const parsed = pokemonListQuerySchema.safeParse(input);
  if (!parsed.success) return null;
  // The UI owns its page size; unsupported fields must not be silently ignored.
  if (input && typeof input === 'object' && 'pageSize' in input) return null;
  return parsed.data.page;
}
export const catalogHref = (page: number, type?: PokemonType) =>
  `/pokedex?${new URLSearchParams({ page: String(page), ...(type ? { type } : {}) })}`;

export function catalogDetailHref(
  id: number,
  page: number,
  type?: PokemonType,
) {
  return `/pokemon/${id}?${new URLSearchParams({ fromPage: String(page), ...(type ? { fromType: type } : {}) })}`;
}

// Used on both sides of the same-origin boundary: reject reordered, omitted or substituted results.
export function parseSummaryBatch(
  value: unknown,
  ids: number[],
): PokemonSummariesResponse | null {
  const parsed = pokemonSummariesResponseSchema.safeParse(value);
  return parsed.success &&
    parsed.data.items.length === ids.length &&
    parsed.data.items.every((item, index) => item.id === ids[index])
    ? parsed.data
    : null;
}
