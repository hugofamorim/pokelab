import { z } from 'zod';
import { identifierSchema } from './identifiers.js';
import {
  PAGINATION_LIMITS,
  pokemonPaginationQuerySchema,
  pokemonPaginationSchema,
} from './pagination.js';

// Explicit supported upstream scope, verified against /generation/; adding a generation is deliberate.
export const GENERATION_NAMES = [
  'generation-i',
  'generation-ii',
  'generation-iii',
  'generation-iv',
  'generation-v',
  'generation-vi',
  'generation-vii',
  'generation-viii',
  'generation-ix',
] as const;
export const GENERATION_LIMITS = {
  maxMembers: 10000,
  maxResponseBytes: 1048576,
} as const;
export const generationIdSchema = z
  .number()
  .int()
  .min(1)
  .max(GENERATION_NAMES.length);
export const generationSchema = z
  .object({
    id: generationIdSchema,
    name: z.enum(GENERATION_NAMES),
  })
  .refine(
    (value) => value.name === GENERATION_NAMES[value.id - 1],
    'Generation ID/name mismatch',
  );
export const speciesReferenceSchema = z.strictObject({
  speciesId: z.number().int().min(1).max(999999),
  name: identifierSchema,
});
export const generationSpeciesQuerySchema = pokemonPaginationQuerySchema
  .extend({
    generation: z
      .string()
      .regex(/^[1-9]$/)
      .transform(Number)
      .pipe(generationIdSchema),
  })
  .pipe(pokemonPaginationSchema.extend({ generation: generationIdSchema }));

const orderedUniqueSpecies = (items: { speciesId: number; name: string }[]) =>
  items.every(
    (item, index) =>
      index === 0 || items[index - 1]!.speciesId < item.speciesId,
  ) && new Set(items.map((item) => item.name)).size === items.length;
export const generationSpeciesIndexSchema = z
  .object({
    generation: generationSchema,
    items: z.array(speciesReferenceSchema).max(GENERATION_LIMITS.maxMembers),
  })
  .refine(
    (value) => orderedUniqueSpecies(value.items),
    'Species must have unique ascending IDs and unique names',
  );
export const generationSpeciesPageSchema = z
  .object({
    generation: generationSchema,
    items: z.array(speciesReferenceSchema).max(PAGINATION_LIMITS.maxPageSize),
    ...pokemonPaginationSchema.shape,
    total: z.number().int().min(0).max(GENERATION_LIMITS.maxMembers),
    hasNext: z.boolean(),
  })
  .refine((value) => {
    const offset = (value.page - 1) * value.pageSize;
    return (
      value.items.length ===
        Math.min(value.pageSize, Math.max(0, value.total - offset)) &&
      value.hasNext === offset + value.items.length < value.total &&
      orderedUniqueSpecies(value.items)
    );
  }, 'Inconsistent or unordered species page');
export type GenerationSpeciesIndex = z.infer<
  typeof generationSpeciesIndexSchema
>;
export type GenerationSpeciesPage = z.infer<typeof generationSpeciesPageSchema>;
