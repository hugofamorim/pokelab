import { z } from 'zod';
import { pokemonTypeSchema, TYPE_FILTER_LIMITS } from './type-filter.js';
import { generationQueryValueSchema } from './generation.js';

export const COMBINED_FILTER_LIMITS = {
  defaultCandidates: 4,
  maxCandidates: 12,
  maxScans: 2,
} as const;
export const combinedFilterQuerySchema = z.strictObject({
  type: pokemonTypeSchema,
  generation: generationQueryValueSchema,
  after: z
    .string()
    .max(6)
    .regex(/^(?:0|[1-9]\d{0,5})$/)
    .transform(Number)
    .default(0),
  limit: z
    .string()
    .max(2)
    .regex(/^[1-9]\d?$/)
    .transform(Number)
    .pipe(z.number().int().min(1).max(COMBINED_FILTER_LIMITS.maxCandidates))
    .default(COMBINED_FILTER_LIMITS.defaultCandidates),
});
export type CombinedFilterQuery = z.infer<typeof combinedFilterQuerySchema>;
export const combinedFilterScanSchema = z.strictObject({
  afterId: z.number().int().min(0).max(999999),
  limit: z.number().int().min(1).max(COMBINED_FILTER_LIMITS.maxCandidates),
  totalCandidates: z.number().int().min(0).max(TYPE_FILTER_LIMITS.maxMembers),
  scanned: z.number().int().min(0).max(COMBINED_FILTER_LIMITS.maxCandidates),
  hasMore: z.boolean(),
  nextAfterId: z.number().int().min(1).max(999999).nullable(),
});
