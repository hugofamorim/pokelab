import { z } from 'zod';
import { identifierSchema } from './identifiers.js';
import { speciesReferenceSchema } from './generation.js';

export const SPECIES_DESCRIPTION_LIMITS = {
  maxEntries: 512,
  maxTextLength: 8192,
  maxResponseBytes: 1048576,
} as const;
export const speciesIdParamSchema = z
  .string()
  .max(6)
  .refine((value) => value === value.trim())
  .regex(/^[1-9]\d{0,5}$/)
  .transform(Number);
export const speciesDescriptionSchema = z.strictObject({
  species: speciesReferenceSchema,
  description: z
    .strictObject({
      text: z
        .string()
        .min(1)
        .max(SPECIES_DESCRIPTION_LIMITS.maxTextLength)
        .refine(
          (text) => text === text.trim() && !/ {2}|[^\S ]|\p{Cc}/u.test(text),
        ),
      language: z.enum(['pt-br', 'en']),
      version: identifierSchema,
    })
    .nullable(),
});
export type SpeciesDescription = z.infer<typeof speciesDescriptionSchema>;
export const speciesDescriptionQuerySchema = z.strictObject({});
