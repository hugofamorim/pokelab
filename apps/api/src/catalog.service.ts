import { Inject, Injectable } from '@nestjs/common';
import { identifierSchema, pokemonSchema } from '@pokelab/contracts';
import type { PokemonResponse } from '@pokelab/contracts';
import { CONFIG } from './config.js';
import type { Config } from './config.js';
import { RESOURCE_CACHE } from './cache.js';
import type { ResourceCache } from './cache.js';
import { PokeApiAdapter } from './pokeapi-adapter.js';
import { CatalogError } from './errors.js';

@Injectable()
export class CatalogService {
  private readonly pending = new Map<string, Promise<PokemonResponse>>();
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
    const existing = this.pending.get(identifier);
    if (existing) return existing;
    // Bound the entire request, including DB lookups; duplicate requests share work.
    if (this.active >= 4)
      throw new CatalogError(
        503,
        'CATALOG_BUSY',
        'Muitas consultas em andamento. Tente novamente em instantes.',
      );
    this.active++;
    const task = this.load(identifier).finally(() => {
      this.active--;
      this.pending.delete(identifier);
    });
    this.pending.set(identifier, task);
    return task;
  }
  private async load(identifier: string): Promise<PokemonResponse> {
    const key = `pokeapi-v2:normalized-v1:pokemon/${identifier}`;
    const cached = await this.cache.get(key).catch(() => {
      throw new CatalogError(
        503,
        'CACHE_UNAVAILABLE',
        'O serviço de dados está temporariamente indisponível.',
      );
    });
    const payload = pokemonSchema.safeParse(cached?.payload);
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
      const data = await this.adapter.get(identifier);
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
