import { Inject, Injectable } from '@nestjs/common';
import type { z } from 'zod';
import {
  identifierSchema,
  pokemonSchema,
  pokemonCatalogQuerySchema,
  pokemonTypeIndexSchema,
  pokemonPageSchema,
  pokemonSummaryQuerySchema,
  pokemonSummarySchema,
  summaryUnavailableCodeSchema,
  SUMMARY_LIMITS,
  generationSpeciesQuerySchema,
  generationSpeciesIndexSchema,
  speciesReferenceSchema,
  defaultVarietyMappingSchema,
  defaultVarietyQuerySchema,
  defaultVarietyUnavailableCodeSchema,
  DEFAULT_VARIETY_LIMITS,
  speciesDescriptionSchema,
  speciesIdParamSchema,
  speciesDescriptionQuerySchema,
  speciesEvolutionReferenceSchema,
  evolutionChainSchema,
  speciesEvolutionResponseSchema,
} from '@pokelab/contracts';
import type {
  PokemonResponse,
  PokemonPageResponse,
  PokemonCatalogPageResponse,
  PokemonTypeIndex,
  SourceMetadata,
  PokemonSummariesResponse,
  PokemonSummaryResult,
  GenerationSpeciesIndex,
  GenerationSpeciesPageResponse,
  DefaultVarietyResponse,
  DefaultVarietiesResponse,
  DefaultVarietyResult,
  SpeciesDescriptionResponse,
  SpeciesEvolutionReference,
  SpeciesEvolutionResponse,
  EvolutionChain,
} from '@pokelab/contracts';
import { CONFIG } from './config.js';
import type { Config } from './config.js';
import { RESOURCE_CACHE } from './cache.js';
import type { ResourceCache } from './cache.js';
import { PokeApiAdapter } from './pokeapi-adapter.js';
import { CatalogError } from './errors.js';
import {
  moveIdParamSchema,
  pokemonMovesQuerySchema,
  pokemonLearnsetSchema,
  pokemonMovesResponseSchema,
  moveMetadataSchema,
  speciesDescriptionQuerySchema as emptyQuerySchema,
} from '@pokelab/contracts';
import type {
  PokemonLearnset,
  MoveMetadataResponse,
  PokemonMovesResponse,
} from '@pokelab/contracts';

@Injectable()
export class CatalogService {
  private readonly pendingLearnsets = new Map<
    string,
    Promise<{ data: PokemonLearnset; meta: SourceMetadata }>
  >();
  private readonly pendingMoves = new Map<
    string,
    Promise<MoveMetadataResponse>
  >();
  private readonly pendingEvolutionReferences = new Map<
    string,
    Promise<{ data: SpeciesEvolutionReference; meta: SourceMetadata }>
  >();
  private readonly pendingEvolutionChains = new Map<
    string,
    Promise<{ data: EvolutionChain; meta: SourceMetadata }>
  >();
  private readonly pendingDescriptions = new Map<
    string,
    Promise<SpeciesDescriptionResponse>
  >();
  private readonly pendingDetails = new Map<string, Promise<PokemonResponse>>();
  private readonly pendingPages = new Map<
    string,
    Promise<PokemonPageResponse>
  >();
  private active = 0;
  private readonly pendingDefaultVarieties = new Map<
    string,
    Promise<DefaultVarietyResponse>
  >();
  private readonly pendingDefaultBatches = new Map<
    string,
    Promise<DefaultVarietiesResponse>
  >();
  private readonly pendingGenerationIndexes = new Map<
    string,
    Promise<{ data: GenerationSpeciesIndex; meta: SourceMetadata }>
  >();
  private readonly pendingTypeIndexes = new Map<
    string,
    Promise<{ data: PokemonTypeIndex; meta: SourceMetadata }>
  >();
  private readonly pendingSummaries = new Map<
    string,
    Promise<PokemonSummariesResponse>
  >();
  constructor(
    @Inject(RESOURCE_CACHE) private readonly cache: ResourceCache,
    @Inject(PokeApiAdapter) private readonly adapter: PokeApiAdapter,
    @Inject(CONFIG) private readonly config: Config,
  ) {}

  async pokemonMoves(
    input: string,
    query: unknown,
  ): Promise<PokemonMovesResponse> {
    const id = moveIdParamSchema.safeParse(input);
    const parsed = pokemonMovesQuerySchema.safeParse(query);
    if (!id.success || !parsed.success)
      throw new CatalogError(
        400,
        'INVALID_MOVE_QUERY',
        'Use um ID de Pokémon, versionGroup obrigatório e paginação válida.',
      );
    const pokemonId = id.data;
    const { versionGroup, page, pageSize } = parsed.data;
    const key = `pokeapi-v2:normalized-v1:pokemon-learnset/${pokemonId}`;
    const result = await this.admit(this.pendingLearnsets, key, () =>
      this.load(
        key,
        pokemonLearnsetSchema.refine((value) => value.pokemon.id === pokemonId),
        () => this.adapter.pokemonLearnset(pokemonId),
      ),
    );
    const groups = new Map<
      number,
      PokemonLearnset['moves'][number]['records'][number]['versionGroup']
    >();
    for (const move of result.data.moves)
      for (const record of move.records)
        groups.set(record.versionGroup.id, record.versionGroup);
    const availableVersionGroups = [...groups.values()].sort(
      (a, b) => a.id - b.id,
    );
    const matching = result.data.moves
      .map((move) => ({
        move: move.move,
        records: move.records.filter(
          (record) => record.versionGroup.id === versionGroup,
        ),
      }))
      .filter((move) => move.records.length > 0)
      .sort((a, b) => a.move.id - b.move.id);
    const offset = (page - 1) * pageSize;
    const items = matching.slice(offset, offset + pageSize);
    // Projection occurs after admission: all pages/groups share one bounded resource load.
    return pokemonMovesResponseSchema.parse({
      data: {
        pokemon: result.data.pokemon,
        species: result.data.species,
        isDefault: result.data.isDefault,
        requestedVersionGroupId: versionGroup,
        versionGroup: groups.get(versionGroup) ?? null,
        availableVersionGroups,
        items,
        page,
        pageSize,
        total: matching.length,
        hasNext: offset + items.length < matching.length,
      },
      meta: result.meta,
    });
  }

  async moveMetadata(
    input: string,
    query: unknown = {},
  ): Promise<MoveMetadataResponse> {
    const parsed = moveIdParamSchema.safeParse(input);
    if (!parsed.success || !emptyQuerySchema.safeParse(query).success)
      throw new CatalogError(
        400,
        'INVALID_MOVE_QUERY',
        'Use um ID de movimento, sem parâmetros de consulta.',
      );
    const id = parsed.data;
    const key = `pokeapi-v2:normalized-v1:move-metadata/${id}`;
    return this.admit(this.pendingMoves, key, () =>
      this.load(
        key,
        moveMetadataSchema.refine((value) => value.move.id === id),
        () => this.adapter.moveMetadata(id),
      ),
    );
  }

  async speciesEvolution(
    input: string,
    query: unknown = {},
  ): Promise<SpeciesEvolutionResponse> {
    const parsed = speciesIdParamSchema.safeParse(input);
    if (
      !parsed.success ||
      !speciesDescriptionQuerySchema.safeParse(query).success
    )
      throw new CatalogError(
        400,
        'INVALID_SPECIES_QUERY',
        'Use um ID de espécie de 1 a 999999, sem parâmetros de consulta.',
      );
    const speciesId = parsed.data;
    const refKey = `pokeapi-v2:normalized-v1:species-evolution-reference/${speciesId}`;
    const reference = await this.admit(
      this.pendingEvolutionReferences,
      refKey,
      () =>
        this.load(
          refKey,
          speciesEvolutionReferenceSchema.refine(
            (value) => value.species.speciesId === speciesId,
          ),
          () => this.adapter.evolutionReference(speciesId),
        ),
    );
    let chain: null | { data: EvolutionChain; meta: SourceMetadata } = null;
    if (reference.data.chainId !== null) {
      const chainId = reference.data.chainId;
      const key = `pokeapi-v2:normalized-v1:evolution-chain/${chainId}`;
      // The reference slot is released before chain admission; shared chains join by ID.
      chain = await this.admit(this.pendingEvolutionChains, key, () =>
        this.load(
          key,
          evolutionChainSchema.refine((value) => value.chainId === chainId),
          () => this.adapter.evolutionChain(chainId),
        ),
      );
    }
    const result = speciesEvolutionResponseSchema.safeParse({
      data: { species: reference.data.species, chain: chain?.data ?? null },
      meta: { species: reference.meta, chain: chain?.meta ?? null },
    });
    if (!result.success)
      throw new CatalogError(
        502,
        'INVALID_UPSTREAM',
        'A cadeia de evolução não corresponde à espécie solicitada.',
      );
    return result.data;
  }

  async speciesDescription(
    input: string,
    query: unknown = {},
  ): Promise<SpeciesDescriptionResponse> {
    const parsed = speciesIdParamSchema.safeParse(input);
    if (
      !parsed.success ||
      !speciesDescriptionQuerySchema.safeParse(query).success
    )
      throw new CatalogError(
        400,
        'INVALID_SPECIES_QUERY',
        'Use um ID de espécie de 1 a 999999, sem parâmetros de consulta.',
      );
    const speciesId = parsed.data;
    const key = `pokeapi-v2:normalized-v1:species-description/${speciesId}`;
    return this.admit(this.pendingDescriptions, key, () =>
      this.load(
        key,
        speciesDescriptionSchema.refine(
          (value) => value.species.speciesId === speciesId,
        ),
        () => this.adapter.speciesDescription(speciesId),
      ),
    );
  }

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
      this.load(
        key,
        pokemonSchema.refine(
          (value) =>
            !/^\d+$/.test(identifier) || value.id === Number(identifier),
        ),
        () => this.adapter.get(identifier),
      ),
    );
  }

  async list(input: unknown): Promise<PokemonCatalogPageResponse> {
    const parsed = pokemonCatalogQuerySchema.safeParse(input);
    if (!parsed.success)
      throw new CatalogError(
        400,
        'INVALID_PAGINATION',
        'Use page de 1 a 1000, pageSize de 1 a 50 e, opcionalmente, um dos 18 tipos. Outros filtros ainda não são suportados.',
      );
    const query = parsed.data;
    if (query.type) {
      const type = query.type;
      const key = `pokeapi-v2:normalized-v1:pokemon-type-index/${type}`;
      // All pages/sizes for a type join one admitted index load; no nested admission.
      const result = await this.admit(this.pendingTypeIndexes, key, () =>
        this.load(
          key,
          pokemonTypeIndexSchema.refine((value) => value.type === type),
          () => this.adapter.typeIndex(type),
        ),
      );
      const offset = (query.page - 1) * query.pageSize;
      const items = result.data.items.slice(offset, offset + query.pageSize);
      const total = result.data.items.length;
      return {
        type,
        items,
        page: query.page,
        pageSize: query.pageSize,
        total,
        hasNext: offset + items.length < total,
        meta: result.meta,
      };
    }
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

  async speciesByGeneration(
    input: unknown,
  ): Promise<GenerationSpeciesPageResponse> {
    const parsed = generationSpeciesQuerySchema.safeParse(input);
    if (!parsed.success)
      throw new CatalogError(
        400,
        'INVALID_GENERATION_QUERY',
        'Use generation de 1 a 9, page de 1 a 1000 e pageSize de 1 a 50, sem outros filtros.',
      );
    const { generation, page, pageSize } = parsed.data;
    const key = `pokeapi-v2:normalized-v1:generation-species-index/${generation}`;
    const result = await this.admit(this.pendingGenerationIndexes, key, () =>
      this.load(
        key,
        generationSpeciesIndexSchema.refine(
          (value) => value.generation.id === generation,
        ),
        () => this.adapter.generationIndex(generation),
      ),
    );
    const offset = (page - 1) * pageSize;
    const items = result.data.items.slice(offset, offset + pageSize);
    return {
      generation: result.data.generation,
      items,
      page,
      pageSize,
      total: result.data.items.length,
      hasNext: offset + items.length < result.data.items.length,
      meta: result.meta,
    };
  }

  async resolveDefaultVariety(input: number): Promise<DefaultVarietyResponse> {
    const parsed = speciesReferenceSchema.shape.speciesId.safeParse(input);
    if (!parsed.success)
      throw new CatalogError(
        400,
        'INVALID_SPECIES_ID',
        'Use um ID de espécie de 1 a 999999.',
      );
    const speciesId = parsed.data;
    const key = `pokeapi-v2:normalized-v1:species-default-variety/${speciesId}`;
    return this.admit(this.pendingDefaultVarieties, key, () =>
      this.load(
        key,
        defaultVarietyMappingSchema.refine(
          (value) => value.species.speciesId === speciesId,
        ),
        () => this.adapter.defaultVariety(speciesId),
      ),
    );
  }

  async defaultVarieties(input: unknown): Promise<DefaultVarietiesResponse> {
    const parsed = defaultVarietyQuerySchema.safeParse(input);
    if (!parsed.success)
      throw new CatalogError(
        400,
        'INVALID_SPECIES_QUERY',
        'Use speciesIds com 1 a 12 IDs distintos, separados por vírgula, sem outros filtros.',
      );
    const { speciesIds } = parsed.data;
    const key = speciesIds.join(',');
    const existing = this.pendingDefaultBatches.get(key);
    if (existing) return existing;
    if (this.pendingDefaultBatches.size >= DEFAULT_VARIETY_LIMITS.maxBatches)
      throw new CatalogError(
        503,
        'CATALOG_BUSY',
        'Muitos lotes de espécies em andamento. Tente novamente em instantes.',
      );
    // Separate batch admission; each worker uses the same global four resource slots.
    const task = this.resolveDefaultBatch(speciesIds).finally(() =>
      this.pendingDefaultBatches.delete(key),
    );
    this.pendingDefaultBatches.set(key, task);
    return task;
  }

  private async resolveDefaultBatch(
    speciesIds: number[],
  ): Promise<DefaultVarietiesResponse> {
    const items: DefaultVarietyResult[] = [];
    let next = 0;
    const worker = async () => {
      while (next < speciesIds.length) {
        const index = next++;
        const speciesId = speciesIds[index]!;
        try {
          const result = await this.resolveDefaultVariety(speciesId);
          items[index] = { speciesId, status: 'ready', ...result };
        } catch (error) {
          const code = defaultVarietyUnavailableCodeSchema.safeParse(
            error instanceof CatalogError ? error.code : undefined,
          );
          if (!code.success) throw error;
          items[index] = { speciesId, status: 'unavailable', code: code.data };
        }
      }
    };
    const workers = await Promise.allSettled(
      Array.from(
        { length: Math.min(speciesIds.length, DEFAULT_VARIETY_LIMITS.workers) },
        worker,
      ),
    );
    for (const result of workers)
      if (result.status === 'rejected') throw result.reason;
    return { items };
  }

  async summaries(input: unknown): Promise<PokemonSummariesResponse> {
    const parsed = pokemonSummaryQuerySchema.safeParse(input);
    if (!parsed.success)
      throw new CatalogError(
        400,
        'INVALID_SUMMARY_QUERY',
        'Use ids com 1 a 12 IDs distintos, separados por vírgula.',
      );
    const { ids } = parsed.data;
    const key = ids.join(',');
    const existing = this.pendingSummaries.get(key);
    if (existing) return existing;
    if (this.pendingSummaries.size >= SUMMARY_LIMITS.maxBatches)
      throw new CatalogError(
        503,
        'CATALOG_BUSY',
        'Muitos lotes em andamento. Tente novamente em instantes.',
      );
    // Batch admission is separate: workers use the existing global four detail/list slots.
    const task = this.enrichSummaries(ids).finally(() =>
      this.pendingSummaries.delete(key),
    );
    this.pendingSummaries.set(key, task);
    return task;
  }

  private async enrichSummaries(
    ids: number[],
  ): Promise<PokemonSummariesResponse> {
    const items: PokemonSummaryResult[] = [];
    let next = 0;
    const worker = async () => {
      while (next < ids.length) {
        const index = next++;
        const id = ids[index]!;
        try {
          const result = await this.get(String(id));
          items[index] = {
            id,
            status: 'ready',
            data: pokemonSummarySchema.parse(result.data),
            meta: result.meta,
          };
        } catch (error) {
          const code = summaryUnavailableCodeSchema.safeParse(
            error instanceof CatalogError ? error.code : undefined,
          );
          if (!code.success) throw error;
          items[index] = { id, status: 'unavailable', code: code.data };
        }
      }
    };
    // allSettled keeps the batch admitted until all workers have released their slots.
    const workers = await Promise.allSettled(
      Array.from(
        { length: Math.min(ids.length, SUMMARY_LIMITS.workers) },
        worker,
      ),
    );
    for (const result of workers)
      if (result.status === 'rejected') throw result.reason;
    return { items };
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
