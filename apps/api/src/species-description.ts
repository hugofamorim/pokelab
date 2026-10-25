import { z } from 'zod';
import {
  identifierSchema,
  speciesReferenceSchema,
  speciesDescriptionSchema,
  SPECIES_DESCRIPTION_LIMITS,
} from '@pokelab/contracts';

const upstreamSpeciesDescriptionSchema = z.object({
  id: speciesReferenceSchema.shape.speciesId,
  name: identifierSchema,
  flavor_text_entries: z
    .array(
      z.object({
        flavor_text: z.string().max(SPECIES_DESCRIPTION_LIMITS.maxTextLength),
        language: z.object({
          name: identifierSchema,
          url: z
            .string()
            .regex(
              /^https:\/\/pokeapi\.co\/api\/v2\/language\/[1-9]\d{0,5}\/$/,
            ),
        }),
        version: z.object({
          name: identifierSchema,
          url: z
            .string()
            .regex(/^https:\/\/pokeapi\.co\/api\/v2\/version\/[1-9]\d{0,5}\/$/),
        }),
      }),
    )
    .max(SPECIES_DESCRIPTION_LIMITS.maxEntries),
});

export function descriptionUpstreamSchema(speciesId: number) {
  return upstreamSpeciesDescriptionSchema.refine(
    (body) => body.id === speciesId,
  );
}

export function normalizeDescription(
  body: z.infer<typeof upstreamSpeciesDescriptionSchema>,
) {
  // Preserve source order within a language; this is not a latest-game ranking.
  for (const language of ['pt-br', 'en'] as const) {
    for (const entry of body.flavor_text_entries) {
      if (entry.language.name !== language) continue;
      const text = entry.flavor_text.replace(/[\s\p{Cc}]+/gu, ' ').trim();
      if (!text) continue;
      return speciesDescriptionSchema.parse({
        species: { speciesId: body.id, name: body.name },
        description: { text, language, version: entry.version.name },
      });
    }
  }
  return speciesDescriptionSchema.parse({
    species: { speciesId: body.id, name: body.name },
    description: null,
  });
}
