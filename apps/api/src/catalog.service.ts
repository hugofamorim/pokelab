import { Inject, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import {
  identifierSchema,
  pokemonSchema,
  pokemonListQuerySchema,
  pokemonPageSchema,
} from '@pokelab/contracts';
import type {
  PokemonResponse,
  PokemonPageResponse,
  SourceMetadata,
} from '@pokelab/contracts';
import { CONFIG } from './config.js';
import type { Config } from './config.js';
import { RESOURCE_CACHE } from './cache.js';
import type { ResourceCache } from './cache.js';
import { PokeApiAdapter } from './pokeapi-adapter.js';
import { CatalogError } from './errors.js';

@Injectable()
export class CatalogService {
  private readonly pendingDetails = new Map<string, Promise<PokemonResponse>>();
  private readonly pendingPages = new Map<
    string,
    Promise<PokemonPageResponse>
  >();
  private active = 0;
  constructor(
    @Inject(RESOURCE_CACHE) private readonly cache: ResourceCache,
    @Inject(PokeApiAdapter) private readonly adapter: PokeApiAdapter,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  async get(input: string): Promise<PokemonResponse> {
    const parsed = identifierSchema.safeParse(input);
    if (!parsed.success)
      throw new CatalogError(
        400,
        'INVALID_IDENTIFIER',
        'Use um nome ou ID de Pokémon válido.',
      );
    const identifier = parsed.data;
    const key = `pokeapi-v2:normalized-v1:pokemon/${identifier}`;
    return this.admit(this.pendingDetails, key, () =>
      this.load(key, pokemonSchema, () => this.adapter.get(identifier)),
    );
  }

  async list(input: unknown): Promise<PokemonPageResponse> {
    const parsed = pokemonListQuerySchema.safeParse(input);
    if (!parsed.success)
      throw new CatalogError(
        400,
        'INVALID_PAGINATION',
        'Use page de 1 a 1000 e pageSize de 1 a 50. Outros filtros ainda não são suportados.',
      );
    const query = parsed.data;
    const key = `pokeapi-v2:normalized-v1:pokemon-page/${query.page}/${query.pageSize}`;
    return this.admit(this.pendingPages, key, async () => {
      const schema = pokemonPageSchema.refine(
        (value) =>
          value.page === query.page && value.pageSize === query.pageSize,
      );
      const result = await this.load(key, schema, () =>
        this.adapter.list(query),
      );
      return { ...result.data, meta: result.meta };
    });
  }

  private admit<T>(
    pending: Map<string, Promise<T>>,
    key: string,
    operation: () => Promise<T>,
  ): Promise<T> {
    const existing = pending.get(key);
    if (existing) return existing;
    // One admission limit covers both list and detail requests, including cache reads.
    if (this.active >= 4)
      throw new CatalogError(
        503,
        'CATALOG_BUSY',
        'Muitas consultas em andamento. Tente novamente em instantes.',
      );
    this.active++;
    const task = operation().finally(() => {
      this.active--;
      pending.delete(key);
    });
    pending.set(key, task);
    return task;
  }

  private async load<T>(
    key: string,
    schema: z.ZodType<T>,
    fetchResource: () => Promise<T>,
  ): Promise<{ data: T; meta: SourceMetadata }> {
    const cached = await this.cache.get(key).catch(() => {
      throw new CatalogError(
        503,
        'CACHE_UNAVAILABLE',
        'O serviço de dados está temporariamente indisponível.',
      );
    });
    const payload = schema.safeParse(cached?.payload);
    if (cached && payload.success && cached.expiresAt.getTime() > Date.now())
      return {
        data: payload.data,
        meta: {
          source: 'pokeapi-v2',
          fetchedAt: cached.fetchedAt.toISOString(),
          stale: false,
        },
      };
    try {
      const data = await fetchResource();
      const fetchedAt = new Date();
      await this.cache.set(key, {
        payload: data,
        fetchedAt,
        expiresAt: new Date(
          fetchedAt.getTime() + this.config.POKEAPI_CACHE_TTL_SECONDS * 1000,
        ),
      });
      return {
        data,
        meta: {
          source: 'pokeapi-v2',
          fetchedAt: fetchedAt.toISOString(),
          stale: false,
        },
      };
    } catch (error) {
      if (
        cached &&
        payload.success &&
        error instanceof CatalogError &&
        error.status >= 500
      )
        return {
          data: payload.data,
          meta: {
            source: 'pokeapi-v2',
            fetchedAt: cached.fetchedAt.toISOString(),
            stale: true,
          },
        };
      throw error;
    }
  }
}
