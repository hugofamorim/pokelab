import { z } from 'zod';
import { POKEMON_TYPES, STAT_NAMES } from '@pokelab/pokemon-domain';

export const identifierSchema = z
  .string()
  .trim()
  .toLowerCase()
  .max(64)
  .regex(/^(?:[1-9]\d{0,5}|[a-z][a-z0-9]*(?:-[a-z0-9]+)*)$/);
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
export const pokemonResponseSchema = z.object({
  data: pokemonSchema,
  meta: z.object({
    source: z.literal('pokeapi-v2'),
    fetchedAt: z.iso.datetime(),
    stale: z.boolean(),
  }),
});
export type Pokemon = z.infer<typeof pokemonSchema>;
export type PokemonResponse = z.infer<typeof pokemonResponseSchema>;
