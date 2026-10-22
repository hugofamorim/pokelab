import { z } from 'zod';
import {
  pokemonCatalogPageResponseSchema,
  pokemonTypeSchema,
  pokemonSummaryQuerySchema,
} from '@pokelab/contracts';
import type {
  PokemonCatalogPageResponse,
  PokemonSummariesResponse,
} from '@pokelab/contracts';
import type { PokemonType } from '@pokelab/pokemon-domain';
import {
  CATALOG_PAGE_SIZE,
  parseCatalogPage,
  parseSummaryBatch,
} from './catalog';

export async function getCatalogPage(
  page: number,
  type?: PokemonType,
): Promise<PokemonCatalogPageResponse | null> {
  if (parseCatalogPage({ page: String(page) }) === null) return null;
  if (type !== undefined && !pokemonTypeSchema.safeParse(type).success)
    return null;
  try {
    const api = z.url().parse(process.env.API_URL ?? 'http://127.0.0.1:3001');
    const url = new URL('/v1/pokemon', api);
    url.search = new URLSearchParams({
      page: String(page),
      pageSize: String(CATALOG_PAGE_SIZE),
      ...(type ? { type } : {}),
    }).toString();
    const response = await fetch(url, {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) return null;
    const parsed = pokemonCatalogPageResponseSchema.safeParse(
      await response.json(),
    );
    return parsed.success &&
      parsed.data.page === page &&
      parsed.data.type === type &&
      parsed.data.pageSize === CATALOG_PAGE_SIZE
      ? parsed.data
      : null;
  } catch {
    return null;
  }
}

export async function getSummaryBatch(
  input: unknown,
  signal?: AbortSignal,
): Promise<PokemonSummariesResponse | null> {
  const query = pokemonSummaryQuerySchema.safeParse(input);
  if (!query.success) return null;
  try {
    const api = z.url().parse(process.env.API_URL ?? 'http://127.0.0.1:3001');
    const url = new URL('/v1/pokemon/summaries', api);
    url.search = new URLSearchParams({
      ids: query.data.ids.join(','),
    }).toString();
    const timeout = AbortSignal.timeout(185000);
    const response = await fetch(url, {
      cache: 'no-store',
      signal: signal ? AbortSignal.any([signal, timeout]) : timeout,
    });
    return response.ok
      ? parseSummaryBatch(await response.json(), query.data.ids)
      : null;
  } catch {
    return null;
  }
}
