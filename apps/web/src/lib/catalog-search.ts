import { z } from 'zod';
import { identifierSchema } from '@pokelab/contracts';
import { catalogHref, parseCatalogPage } from './catalog';

const querySchema = z.strictObject({
  page: z.string().optional(),
  search: z.string().max(64).optional(),
});
export type CatalogQuery =
  | { kind: 'browse'; page: number }
  | { kind: 'search'; term: string }
  | { kind: 'invalid' };
export function normalizeSearch(value: unknown): string | null {
  if (typeof value !== 'string' || value.length > 64) return null;
  if (!value.trim()) return '';
  const result = identifierSchema.safeParse(value);
  return result.success ? result.data : null;
}
export function parseCatalogQuery(input: unknown): CatalogQuery {
  const parsed = querySchema.safeParse(input);
  if (!parsed.success) return { kind: 'invalid' };
  const { page, search } = parsed.data;
  if (search !== undefined) {
    if (page !== undefined) return { kind: 'invalid' };
    const term = normalizeSearch(search);
    return term === null
      ? { kind: 'invalid' }
      : term
        ? { kind: 'search', term }
        : { kind: 'browse', page: 1 };
  }
  const value = parseCatalogPage(page === undefined ? {} : { page });
  return value === null ? { kind: 'invalid' } : { kind: 'browse', page: value };
}
export const searchHref = (term: string) =>
  `/pokedex?${new URLSearchParams({ search: term })}`;
export function catalogReturnHref(
  input: Record<string, string | string[] | undefined>,
): string {
  if (input.fromSearch !== undefined) {
    const term = normalizeSearch(input.fromSearch);
    return term && input.fromPage === undefined
      ? searchHref(term)
      : catalogHref(1);
  }
  return catalogHref(
    parseCatalogPage(
      input.fromPage === undefined ? {} : { page: input.fromPage },
    ) ?? 1,
  );
}
