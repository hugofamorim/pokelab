import { z } from 'zod';
import {
  identifierSchema,
  pokemonTypeSchema,
  generationSpeciesQuerySchema,
} from '@pokelab/contracts';
import type { PokemonType } from '@pokelab/pokemon-domain';
import { catalogHref, parseCatalogPage } from './catalog';
import { generationHref } from './generation-catalog';

const querySchema = z.strictObject({
  page: z.string().optional(),
  search: z.string().max(64).optional(),
  type: pokemonTypeSchema.optional(),
  generation: z.string().optional(),
});
export type CatalogQuery =
  | { kind: 'browse'; page: number; type?: PokemonType }
  | { kind: 'search'; term: string }
  | { kind: 'generation'; page: number; generation: number }
  | { kind: 'invalid' };
export function parseCatalogSearchParams(
  params: Pick<URLSearchParams, 'keys' | 'getAll'>,
): CatalogQuery {
  return parseCatalogQuery(
    Object.fromEntries(
      [...new Set(params.keys())].map((key) => {
        const values = params.getAll(key);
        return [key, values.length === 1 ? values[0] : values];
      }),
    ),
  );
}
export function normalizeSearch(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 64) return null;
  if (!value.trim()) return '';
  const result = identifierSchema.safeParse(value);
  return result.success ? result.data : null;
}
export function parseCatalogQuery(input: unknown): CatalogQuery {
  const parsed = querySchema.safeParse(input);
  if (!parsed.success) return { kind: 'invalid' };
  const { page, search, type, generation } = parsed.data;
  if (search !== undefined) {
    if (page !== undefined || type !== undefined || generation !== undefined)
      return { kind: 'invalid' };
    const term = normalizeSearch(search);
    return term === null
      ? { kind: 'invalid' }
      : term
        ? { kind: 'search', term }
        : { kind: 'browse', page: 1 };
  }
  if (generation !== undefined) {
    if (type !== undefined) return { kind: 'invalid' };
    const result = generationSpeciesQuerySchema.safeParse({
      generation,
      ...(page === undefined ? {} : { page }),
    });
    return result.success
      ? {
          kind: 'generation',
          generation: result.data.generation,
          page: result.data.page,
        }
      : { kind: 'invalid' };
  }
  const value = parseCatalogPage(page === undefined ? {} : { page });
  return value === null
    ? { kind: 'invalid' }
    : { kind: 'browse', page: value, ...(type ? { type } : {}) };
}
export const searchHref = (term: string) =>
  `/pokedex?${new URLSearchParams({ search: term })}`;
export function catalogReturnHref(
  input: Record<string, string | string[] | undefined>,
): string {
  if (input.fromSearch !== undefined) {
    const term = normalizeSearch(input.fromSearch);
    return term &&
      input.fromPage === undefined &&
      input.fromType === undefined &&
      input.fromGeneration === undefined
      ? searchHref(term)
      : catalogHref(1);
  }
  const query = parseCatalogQuery({
    ...(input.fromPage === undefined ? {} : { page: input.fromPage }),
    ...(input.fromType === undefined ? {} : { type: input.fromType }),
    ...(input.fromGeneration === undefined
      ? {}
      : { generation: input.fromGeneration }),
  });
  return query.kind === 'generation'
    ? generationHref(query.page, query.generation)
    : query.kind === 'browse'
      ? catalogHref(query.page, query.type)
      : catalogHref(1);
}

export function catalogEntryHref(id: number, returnHref: string): string {
  const params = returnHref.startsWith('/pokedex?')
    ? new URLSearchParams(returnHref.slice('/pokedex?'.length))
    : new URLSearchParams();
  const query = parseCatalogSearchParams(params);
  const origin = new URLSearchParams();
  if (query.kind === 'search') origin.set('fromSearch', query.term);
  else {
    origin.set(
      'fromPage',
      query.kind === 'browse' || query.kind === 'generation'
        ? String(query.page)
        : '1',
    );
    if (query.kind === 'generation')
      origin.set('fromGeneration', String(query.generation));
    if (query.kind === 'browse' && query.type)
      origin.set('fromType', query.type);
  }
  return `/pokemon/${id}?${origin}`;
}
