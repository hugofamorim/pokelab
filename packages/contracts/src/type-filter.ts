import { z } from 'zod';
import { POKEMON_TYPES } from '@pokelab/pokemon-domain';
import {
  pokemonPaginationQuerySchema,
  pokemonPaginationSchema,
  pokemonReferenceSchema,
} from './pagination.js';

export const TYPE_FILTER_LIMITS = {
  maxMembers: 10000,
  maxResponseBytes: 1048576,
} as const;
export const pokemonTypeSchema = z.enum(POKEMON_TYPES);
export const pokemonCatalogQuerySchema = pokemonPaginationQuerySchema
  .extend({ type: pokemonTypeSchema.optional() })
  .pipe(pokemonPaginationSchema.extend({ type: pokemonTypeSchema.optional() }));
export const pokemonTypeIndexSchema = z
  .object({
    type: pokemonTypeSchema,
    items: z.array(pokemonReferenceSchema).max(TYPE_FILTER_LIMITS.maxMembers),
  })
  .refine(
    (value) =>
      value.items.every(
        (item, index) => index === 0 || value.items[index - 1]!.id < item.id,
      ) &&
      new Set(value.items.map((item) => item.name)).size === value.items.length,
    'Type members must have unique IDs/names in ascending entry-ID order',
  );
export type PokemonTypeIndex = z.infer<typeof pokemonTypeIndexSchema>;
