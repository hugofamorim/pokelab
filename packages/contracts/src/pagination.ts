import { z } from 'zod';
import { identifierSchema } from './identifiers.js';

export const PAGINATION_LIMITS = {
  defaultPage: 1,
  maxPage: 1000,
  defaultPageSize: 20,
  maxPageSize: 50,
} as const;

export const pokemonPaginationSchema = z.strictObject({
  page: z.number().int().min(1).max(PAGINATION_LIMITS.maxPage),
  pageSize: z.number().int().min(1).max(PAGINATION_LIMITS.maxPageSize),
});

const queryInteger = z
  .string()
  .max(6)
  .refine((value) => value === value.trim(), 'Whitespace is not allowed')
  .regex(/^[1-9]\d*$/)
  .transform(Number);
export const pokemonListQuerySchema = z
  .strictObject({
    page: queryInteger.default(PAGINATION_LIMITS.defaultPage),
    pageSize: queryInteger.default(PAGINATION_LIMITS.defaultPageSize),
  })
  .pipe(pokemonPaginationSchema);

// These are Pokémon entry IDs, not species IDs; list resources contain no species data.
export const pokemonReferenceSchema = z.object({
  id: z.number().int().min(1).max(999999),
  name: identifierSchema,
});

export const pokemonPageSchema = z
  .object({
    items: z.array(pokemonReferenceSchema).max(PAGINATION_LIMITS.maxPageSize),
    ...pokemonPaginationSchema.shape,
    total: z.number().int().min(0).max(1000000),
    hasNext: z.boolean(),
  })
  .refine((value) => {
    const offset = (value.page - 1) * value.pageSize;
    const expected = Math.min(
      value.pageSize,
      Math.max(0, value.total - offset),
    );
    return (
      value.items.length === expected &&
      value.hasNext === offset + value.items.length < value.total &&
      new Set(value.items.map((item) => item.id)).size === value.items.length &&
      new Set(value.items.map((item) => item.name)).size === value.items.length
    );
  }, 'Inconsistent or duplicate page results');

export type PokemonPagination = z.infer<typeof pokemonPaginationSchema>;
export type PokemonPage = z.infer<typeof pokemonPageSchema>;
