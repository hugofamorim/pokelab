import { z } from 'zod';
import {
  combinedFilterQuerySchema,
  pokemonTypeSchema,
} from '@pokelab/contracts';

// Four candidates budget the composed API request; never fill a match page.
export const COMBINED_WINDOW_SIZE = 4;
export const combinedCatalogQuerySchema = z
  .strictObject({
    type: pokemonTypeSchema,
    generation: z.string(),
    after: z.string().optional(),
    typeAt: z.iso.datetime().optional(),
    generationAt: z.iso.datetime().optional(),
  })
  .superRefine((value, ctx) => {
    const query = combinedFilterQuerySchema.safeParse({
      type: value.type,
      generation: value.generation,
      after: value.after,
    });
    if (
      !query.success ||
      (value.typeAt === undefined) !== (value.generationAt === undefined) ||
      (query.success && query.data.after > 0 && value.typeAt === undefined)
    )
      ctx.addIssue({ code: 'custom', message: 'Invalid scan context' });
  });
export type CombinedCatalogInput = z.infer<typeof combinedCatalogQuerySchema>;
export function combinedHref(input: CombinedCatalogInput): string {
  const query = combinedCatalogQuerySchema.parse(input);
  return `/pokedex?${new URLSearchParams(
    Object.entries(query).filter(
      (entry): entry is [string, string] => entry[1] !== undefined,
    ),
  )}`;
}
