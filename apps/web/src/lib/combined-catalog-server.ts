import { z } from 'zod';
import { combinedFilterResponseSchema } from '@pokelab/contracts';
import type { CombinedFilterResponse } from '@pokelab/contracts';
import {
  combinedCatalogQuerySchema,
  COMBINED_WINDOW_SIZE,
} from './combined-catalog';

export type CombinedResult =
  | { kind: 'ready'; value: CombinedFilterResponse }
  | { kind: 'error' | 'changed' };
export async function getCombinedWindow(
  input: unknown,
): Promise<CombinedResult> {
  const parsed = combinedCatalogQuerySchema.safeParse(input);
  if (!parsed.success) return { kind: 'error' };
  const query = parsed.data;
  try {
    const api = z.url().parse(process.env.API_URL ?? 'http://127.0.0.1:3001');
    const url = new URL('/v1/pokemon/filter-scan', api);
    url.search = new URLSearchParams({
      type: query.type,
      generation: query.generation,
      after: query.after ?? '0',
      limit: String(COMBINED_WINDOW_SIZE),
    }).toString();
    // Parallel indexes then two detail waves, including bounded cache operations/retries.
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(125000),
    });
    if (!response.ok) return { kind: 'error' };
    const result = combinedFilterResponseSchema.safeParse(
      await response.json(),
    );
    if (
      !result.success ||
      result.data.type !== query.type ||
      result.data.generation.id !== Number(query.generation) ||
      result.data.scan.afterId !== Number(query.after ?? 0) ||
      result.data.scan.limit !== COMBINED_WINDOW_SIZE
    )
      return { kind: 'error' };
    if (
      query.typeAt !== undefined &&
      (query.typeAt !== result.data.meta.type.fetchedAt ||
        query.generationAt !== result.data.meta.generation.fetchedAt)
    )
      return { kind: 'changed' };
    return { kind: 'ready', value: result.data };
  } catch {
    return { kind: 'error' };
  }
}
