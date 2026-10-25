import { z } from 'zod';
import {
  defaultVarietyQuerySchema,
  defaultVarietyResponseSchema,
  defaultVarietyUnavailableCodeSchema,
  pokemonSummarySchema,
  sourceMetadataSchema,
  speciesReferenceSchema,
} from '@pokelab/contracts';
import { CATALOG_BATCH_SIZE } from './catalog';

export const generationHref = (page: number, generation: number) =>
  `/pokedex?${new URLSearchParams({ page: String(page), generation: String(generation) })}`;
export const generationDetailHref = (
  id: number,
  page: number,
  generation: number,
) =>
  `/pokemon/${id}?${new URLSearchParams({ fromPage: String(page), fromGeneration: String(generation) })}`;
export const generationCardQuerySchema = z.strictObject({
  speciesIds: defaultVarietyQuerySchema.shape.speciesIds.refine(
    (ids) => ids.length <= CATALOG_BATCH_SIZE,
  ),
});
export const generationCardResultSchema = z.discriminatedUnion('status', [
  z
    .object({
      speciesId: speciesReferenceSchema.shape.speciesId,
      status: z.literal('ready'),
      mapping: defaultVarietyResponseSchema,
      summary: z.object({
        data: pokemonSummarySchema,
        meta: sourceMetadataSchema,
      }),
    })
    .refine(
      ({ speciesId, mapping, summary }) =>
        speciesId === mapping.data.species.speciesId &&
        summary.data.id === mapping.data.pokemon.id &&
        summary.data.name === mapping.data.pokemon.name &&
        summary.data.species.id === speciesId &&
        summary.data.species.name === mapping.data.species.name &&
        summary.data.isDefault,
    ),
  z
    .object({
      speciesId: speciesReferenceSchema.shape.speciesId,
      status: z.literal('unavailable'),
      code: z.enum([
        ...defaultVarietyUnavailableCodeSchema.options,
        'POKEMON_NOT_FOUND',
      ]),
      mapping: defaultVarietyResponseSchema.optional(),
    })
    .refine(
      ({ speciesId, mapping }) =>
        !mapping || speciesId === mapping.data.species.speciesId,
    ),
]);
export type GenerationCardResult = z.infer<typeof generationCardResultSchema>;
export const generationCardsSchema = z.object({
  items: z
    .array(generationCardResultSchema)
    .min(1)
    .max(CATALOG_BATCH_SIZE)
    .refine(
      (items) =>
        new Set(items.map((item) => item.speciesId)).size === items.length,
    ),
});
export type GenerationCards = z.infer<typeof generationCardsSchema>;
export function parseGenerationCards(
  value: unknown,
  speciesIds: number[],
): GenerationCards | null {
  const result = generationCardsSchema.safeParse(value);
  return result.success &&
    result.data.items.length === speciesIds.length &&
    result.data.items.every(
      (item, index) => item.speciesId === speciesIds[index],
    )
    ? result.data
    : null;
}
export function matchGenerationReference(
  result: GenerationCardResult,
  reference: z.infer<typeof speciesReferenceSchema>,
): GenerationCardResult {
  return result.speciesId !== reference.speciesId ||
    (result.mapping && result.mapping.data.species.name !== reference.name)
    ? {
        speciesId: reference.speciesId,
        status: 'unavailable',
        code: 'INVALID_UPSTREAM',
      }
    : result;
}
