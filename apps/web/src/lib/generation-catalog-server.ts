import { z } from 'zod';
import {
  defaultVarietyQuerySchema,
  defaultVarietiesResponseSchema,
  generationSpeciesQuerySchema,
  generationSpeciesPageResponseSchema,
} from '@pokelab/contracts';
import type { GenerationSpeciesPageResponse } from '@pokelab/contracts';
import { CATALOG_PAGE_SIZE } from './catalog';
import { getSummaryBatch } from './catalog-server';
import {
  generationCardQuerySchema,
  generationCardResultSchema,
} from './generation-catalog';
import type {
  GenerationCards,
  GenerationCardResult,
} from './generation-catalog';

export async function getGenerationPage(
  page: number,
  generation: number,
): Promise<GenerationSpeciesPageResponse | null> {
  const query = generationSpeciesQuerySchema.safeParse({
    page: String(page),
    pageSize: String(CATALOG_PAGE_SIZE),
    generation: String(generation),
  });
  if (!query.success) return null;
  try {
    const api = z.url().parse(process.env.API_URL ?? 'http://127.0.0.1:3001');
    const url = new URL('/v1/pokemon-species', api);
    url.search = new URLSearchParams({
      page: String(page),
      pageSize: String(CATALOG_PAGE_SIZE),
      generation: String(generation),
    }).toString();
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const result = generationSpeciesPageResponseSchema.safeParse(
      await response.json(),
    );
    return result.success &&
      result.data.page === page &&
      result.data.pageSize === CATALOG_PAGE_SIZE &&
      result.data.generation.id === generation
      ? result.data
      : null;
  } catch {
    return null;
  }
}

export async function getGenerationCards(
  input: unknown,
  requestSignal?: AbortSignal,
): Promise<GenerationCards | null> {
  const query = generationCardQuerySchema.safeParse(input);
  if (!query.success || requestSignal?.aborted) return null;
  const { speciesIds } = query.data;
  const timeout = AbortSignal.timeout(135000);
  const signal = requestSignal
    ? AbortSignal.any([requestSignal, timeout])
    : timeout;
  try {
    const api = z.url().parse(process.env.API_URL ?? 'http://127.0.0.1:3001');
    const url = new URL('/v1/pokemon-species/default-varieties', api);
    const rawQuery = { speciesIds: speciesIds.join(',') };
    if (!defaultVarietyQuerySchema.safeParse(rawQuery).success) return null;
    url.search = new URLSearchParams(rawQuery).toString();
    const response = await fetch(url, { cache: 'no-store', signal });
    if (!response.ok) return null;
    const mappings = defaultVarietiesResponseSchema.safeParse(
      await response.json(),
    );
    if (
      !mappings.success ||
      mappings.data.items.length !== speciesIds.length ||
      !mappings.data.items.every(
        (item, index) => item.speciesId === speciesIds[index],
      )
    )
      return null;
    if (signal.aborted) return null;
    const ids = [
      ...new Set(
        mappings.data.items.flatMap((item) =>
          item.status === 'ready' ? [item.data.pokemon.id] : [],
        ),
      ),
    ];
    const summaries = ids.length
      ? await getSummaryBatch({ ids: ids.join(',') }, signal)
      : null;
    if (signal.aborted) return null;
    const items: GenerationCardResult[] = mappings.data.items.map((item) => {
      if (item.status === 'unavailable') return item;
      const mapping = { data: item.data, meta: item.meta };
      const summary = summaries?.items.find(
        (value) => value.id === item.data.pokemon.id,
      );
      if (!summary || summary.status === 'unavailable')
        return {
          speciesId: item.speciesId,
          status: 'unavailable',
          code: summary?.code ?? 'UPSTREAM_UNAVAILABLE',
          mapping,
        };
      const candidate = generationCardResultSchema.safeParse({
        speciesId: item.speciesId,
        status: 'ready',
        mapping,
        summary: { data: summary.data, meta: summary.meta },
      });
      return candidate.success
        ? candidate.data
        : {
            speciesId: item.speciesId,
            status: 'unavailable',
            code: 'INVALID_UPSTREAM',
            mapping,
          };
    });
    return { items };
  } catch {
    return null;
  }
}
