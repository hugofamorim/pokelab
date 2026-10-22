import { z } from 'zod';
import { POKEMON_TYPES, STAT_NAMES } from '@pokelab/pokemon-domain';
import { identifierSchema } from './identifiers.js';
import { pokemonPageSchema } from './pagination.js';
import { pokemonTypeSchema } from './type-filter.js';
import { generationSpeciesPageSchema } from './generation.js';
export { identifierSchema } from './identifiers.js';

export const artworkSchema = z
  .url()
  .refine((value) => {
    const url = new URL(value);
    return (
      url.origin === 'https://raw.githubusercontent.com' &&
      /^\/PokeAPI\/sprites\/master\/sprites\/pokemon\/(?:other\/official-artwork\/)?[1-9]\d*\.png$/.test(
        url.pathname,
      ) &&
      !url.search &&
      !url.hash
    );
  }, 'Unsupported artwork source')
  .nullable();
export const pokemonSchema = z.object({
  id: z.number().int().positive(),
  name: identifierSchema,
  species: z.object({
    id: z.number().int().positive(),
    name: identifierSchema,
  }),
  isDefault: z.boolean(),
  artwork: artworkSchema,
  types: z
    .array(z.enum(POKEMON_TYPES))
    .min(1)
    .max(2)
    .refine((types) => new Set(types).size === types.length),
  heightMeters: z.number().nonnegative(),
  weightKg: z.number().nonnegative(),
  stats: z
    .array(
      z.object({
        name: z.enum(STAT_NAMES),
        value: z.number().int().min(1).max(255),
      }),
    )
    .length(6)
    .refine((stats) => new Set(stats.map((stat) => stat.name)).size === 6),
  abilities: z
    .array(z.object({ name: identifierSchema, hidden: z.boolean() }))
    .max(4),
});
export const sourceMetadataSchema = z.object({
  source: z.literal('pokeapi-v2'),
  fetchedAt: z.iso.datetime(),
  stale: z.boolean(),
});
export type SourceMetadata = z.infer<typeof sourceMetadataSchema>;
export const pokemonResponseSchema = z.object({
  data: pokemonSchema,
  meta: sourceMetadataSchema,
});
export type Pokemon = z.infer<typeof pokemonSchema>;
export type PokemonResponse = z.infer<typeof pokemonResponseSchema>;
export const pokemonSummarySchema = pokemonSchema.pick({
  id: true,
  name: true,
  species: true,
  isDefault: true,
  artwork: true,
  types: true,
});
export type PokemonSummary = z.infer<typeof pokemonSummarySchema>;
export const SUMMARY_LIMITS = {
  maxIds: 12,
  workers: 2,
  maxBatches: 2,
} as const;
export const pokemonSummaryQuerySchema = z.strictObject({
  ids: z
    .string()
    .max(83)
    .refine((value) => value === value.trim())
    .regex(/^[1-9]\d{0,5}(?:,[1-9]\d{0,5})*$/)
    .transform((value) => value.split(',').map(Number))
    .pipe(
      z
        .array(z.number().int().min(1).max(999999))
        .min(1)
        .max(SUMMARY_LIMITS.maxIds)
        .refine((ids) => new Set(ids).size === ids.length),
    ),
});
export const summaryUnavailableCodeSchema = z.enum([
  'POKEMON_NOT_FOUND',
  'INVALID_UPSTREAM',
  'UPSTREAM_UNAVAILABLE',
  'CACHE_UNAVAILABLE',
  'CATALOG_BUSY',
]);
export const pokemonSummaryResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      id: z.number().int().min(1).max(999999),
      status: z.literal('ready'),
      data: pokemonSummarySchema,
      meta: sourceMetadataSchema,
    })
    .refine((item) => item.id === item.data.id),
  z.object({
    id: z.number().int().min(1).max(999999),
    status: z.literal('unavailable'),
    code: summaryUnavailableCodeSchema,
  }),
]);
export type PokemonSummaryResult = z.infer<typeof pokemonSummaryResultSchema>;
export const pokemonSummariesResponseSchema = z.object({
  items: z
    .array(pokemonSummaryResultSchema)
    .min(1)
    .max(SUMMARY_LIMITS.maxIds)
    .refine(
      (items) => new Set(items.map((item) => item.id)).size === items.length,
    ),
});
export type PokemonSummariesResponse = z.infer<
  typeof pokemonSummariesResponseSchema
>;
export const pokemonPageResponseSchema = pokemonPageSchema.safeExtend({
  meta: sourceMetadataSchema,
});
export type PokemonPageResponse = z.infer<typeof pokemonPageResponseSchema>;
export const pokemonCatalogPageResponseSchema =
  pokemonPageResponseSchema.safeExtend({ type: pokemonTypeSchema.optional() });
export type PokemonCatalogPageResponse = z.infer<
  typeof pokemonCatalogPageResponseSchema
>;

export * from './pagination.js';
export * from './type-filter.js';
export * from './generation.js';
export const generationSpeciesPageResponseSchema =
  generationSpeciesPageSchema.safeExtend({
    meta: sourceMetadataSchema,
  });
export type GenerationSpeciesPageResponse = z.infer<
  typeof generationSpeciesPageResponseSchema
>;
