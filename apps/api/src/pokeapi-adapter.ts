import { z } from 'zod';
import {
  artworkSchema,
  identifierSchema,
  pokemonSchema,
  pokemonPaginationSchema,
  pokemonPageSchema,
  pokemonTypeSchema,
  pokemonTypeIndexSchema,
  TYPE_FILTER_LIMITS,
  generationIdSchema,
  generationSchema,
  generationSpeciesIndexSchema,
  GENERATION_LIMITS,
  speciesReferenceSchema,
  defaultVarietyMappingSchema,
  DEFAULT_VARIETY_LIMITS,
  SPECIES_DESCRIPTION_LIMITS,
  EVOLUTION_LIMITS,
} from '@pokelab/contracts';
import type {
  Pokemon,
  PokemonPagination,
  PokemonPage,
  PokemonTypeIndex,
  GenerationSpeciesIndex,
  DefaultVarietyMapping,
} from '@pokelab/contracts';
import { POKEMON_TYPES, STAT_NAMES, toMetric } from '@pokelab/pokemon-domain';
import { CatalogError } from './errors.js';
import { MOVE_LIMITS } from '@pokelab/contracts';
import {
  validateMoveResourceId,
  learnsetUpstreamSchema,
  moveUpstreamSchema,
} from './moves.js';
import {
  descriptionUpstreamSchema,
  normalizeDescription,
} from './species-description.js';
import {
  evolutionUpstreamSchema,
  evolutionReferenceUpstreamSchema,
  validateEvolutionId,
} from './evolution.js';

const named = z.object({ name: identifierSchema });
const upstreamSchema = z.object({
  id: z.number().int().positive(),
  name: identifierSchema,
  is_default: z.boolean(),
  species: z.object({
    name: identifierSchema,
    url: z
      .string()
      .regex(/^https:\/\/pokeapi\.co\/api\/v2\/pokemon-species\/[1-9]\d*\/$/),
  }),
  height: z.number().int().nonnegative(),
  weight: z.number().int().nonnegative(),
  types: z
    .array(
      z.object({
        slot: z.number().int().min(1).max(2),
        type: z.object({ name: z.enum(POKEMON_TYPES) }),
      }),
    )
    .min(1)
    .max(2),
  stats: z
    .array(
      z.object({
        base_stat: z.number().int().min(1).max(255),
        stat: z.object({ name: z.enum(STAT_NAMES) }),
      }),
    )
    .length(6),
  abilities: z
    .array(z.object({ ability: named, is_hidden: z.boolean() }))
    .max(4),
  sprites: z.object({
    other: z
      .object({
        'official-artwork': z.object({ front_default: artworkSchema }),
      })
      .optional(),
  }),
});

export class PokeApiAdapter {
  constructor(
    private readonly timeoutMs: number,
    private readonly fetcher: typeof fetch = fetch,
    private readonly pause: (ms: number) => Promise<void> = (ms) =>
      new Promise((resolve) => setTimeout(resolve, ms)),
  ) {}

  async pokemonLearnset(input: number) {
    const id = validateMoveResourceId(input);
    return this.request(
      'pokemon/' + id,
      learnsetUpstreamSchema(id),
      'pokemon',
      MOVE_LIMITS.maxResponseBytes,
    );
  }

  async moveMetadata(input: number) {
    const id = validateMoveResourceId(input);
    return this.request(
      'move/' + id,
      moveUpstreamSchema(id),
      'move',
      MOVE_LIMITS.maxResponseBytes,
    );
  }

  async evolutionReference(input: number) {
    const id = validateEvolutionId(input);
    return this.request(
      'pokemon-species/' + id,
      evolutionReferenceUpstreamSchema(id),
      'species',
      EVOLUTION_LIMITS.maxResponseBytes,
    );
  }

  async evolutionChain(input: number) {
    const id = validateEvolutionId(input);
    return this.request(
      'evolution-chain/' + id,
      evolutionUpstreamSchema(id),
      'evolution-chain',
      EVOLUTION_LIMITS.maxResponseBytes,
    );
  }

  async speciesDescription(input: number) {
    const speciesId = speciesReferenceSchema.shape.speciesId.safeParse(input);
    if (!speciesId.success)
      throw new CatalogError(
        400,
        'INVALID_SPECIES_ID',
        'Use um ID de espécie de 1 a 999999.',
      );
    const body = await this.request(
      'pokemon-species/' + speciesId.data,
      descriptionUpstreamSchema(speciesId.data),
      'species',
      SPECIES_DESCRIPTION_LIMITS.maxResponseBytes,
    );
    return normalizeDescription(body);
  }

  async get(identifier: string): Promise<Pokemon> {
    const parsed = identifierSchema.safeParse(identifier);
    if (!parsed.success)
      throw new CatalogError(
        400,
        'INVALID_IDENTIFIER',
        'Identificador de Pokémon inválido.',
      );
    const p = await this.request(
      'pokemon/' + parsed.data,
      upstreamSchema,
      'pokemon',
    );
    const result = pokemonSchema.safeParse({
      id: p.id,
      name: p.name,
      isDefault: p.is_default,
      species: {
        id: Number(p.species.url.split('/').at(-2)),
        name: p.species.name,
      },
      artwork: p.sprites.other?.['official-artwork'].front_default ?? null,
      types: [...p.types]
        .sort((a, b) => a.slot - b.slot)
        .map((entry) => entry.type.name),
      heightMeters: toMetric(p.height),
      weightKg: toMetric(p.weight),
      stats: p.stats.map((entry) => ({
        name: entry.stat.name,
        value: entry.base_stat,
      })),
      abilities: p.abilities.map((entry) => ({
        name: entry.ability.name,
        hidden: entry.is_hidden,
      })),
    });
    if (
      !result.success ||
      (/^\d+$/.test(parsed.data) && result.data.id !== Number(parsed.data))
    )
      throw new CatalogError(
        502,
        'INVALID_UPSTREAM',
        'A PokéAPI retornou dados incompatíveis.',
      );
    return result.data;
  }

  async list(input: PokemonPagination): Promise<PokemonPage> {
    const query = pokemonPaginationSchema.safeParse(input);
    if (!query.success)
      throw new CatalogError(400, 'INVALID_PAGINATION', 'Paginação inválida.');
    const { page, pageSize } = query.data;
    const offset = (page - 1) * pageSize;
    // Resource references are validated and normalized, never followed as URLs.
    const body = await this.request(
      'pokemon/?limit=' + pageSize + '&offset=' + offset,
      z.object({
        count: z.number().int().min(0).max(1000000),
        results: z
          .array(
            z.object({
              name: identifierSchema,
              url: z
                .string()
                .regex(
                  /^https:\/\/pokeapi\.co\/api\/v2\/pokemon\/[1-9]\d{0,5}\/$/,
                ),
            }),
          )
          .max(pageSize),
      }),
    );
    const normalized = pokemonPageSchema.safeParse({
      items: body.results.map((entry) => ({
        id: Number(entry.url.split('/').at(-2)),
        name: entry.name,
      })),
      page,
      pageSize,
      total: body.count,
      hasNext: offset + body.results.length < body.count,
    });
    if (!normalized.success)
      throw new CatalogError(
        502,
        'INVALID_UPSTREAM',
        'A PokéAPI retornou uma página incompatível.',
      );
    return normalized.data;
  }

  async typeIndex(input: string): Promise<PokemonTypeIndex> {
    const type = pokemonTypeSchema.safeParse(input);
    if (!type.success)
      throw new CatalogError(
        400,
        'INVALID_TYPE',
        'Use um dos 18 tipos suportados.',
      );
    const body = await this.request(
      'type/' + type.data,
      z
        .object({
          name: pokemonTypeSchema,
          pokemon: z
            .array(
              z.object({
                slot: z.number().int().min(1).max(2),
                pokemon: z.object({
                  name: identifierSchema,
                  url: z
                    .string()
                    .regex(
                      /^https:\/\/pokeapi\.co\/api\/v2\/pokemon\/[1-9]\d{0,5}\/$/,
                    ),
                }),
              }),
            )
            .max(TYPE_FILTER_LIMITS.maxMembers),
        })
        .refine((value) => value.name === type.data),
      false,
      TYPE_FILTER_LIMITS.maxResponseBytes,
    );
    const result = pokemonTypeIndexSchema.safeParse({
      type: type.data,
      items: body.pokemon
        .map((entry) => ({
          id: Number(entry.pokemon.url.split('/').at(-2)),
          name: entry.pokemon.name,
        }))
        .sort((left, right) => left.id - right.id),
    });
    if (!result.success)
      throw new CatalogError(
        502,
        'INVALID_UPSTREAM',
        'A PokéAPI retornou associações de tipo incompatíveis.',
      );
    return result.data;
  }

  async generationIndex(input: number): Promise<GenerationSpeciesIndex> {
    const generation = generationIdSchema.safeParse(input);
    if (!generation.success)
      throw new CatalogError(
        400,
        'INVALID_GENERATION',
        'Use uma geração suportada de 1 a 9.',
      );
    const body = await this.request(
      'generation/' + generation.data,
      z
        .object({
          id: generationIdSchema,
          name: generationSchema.shape.name,
          pokemon_species: z
            .array(
              z.object({
                name: identifierSchema,
                url: z
                  .string()
                  .regex(
                    /^https:\/\/pokeapi\.co\/api\/v2\/pokemon-species\/[1-9]\d{0,5}\/$/,
                  ),
              }),
            )
            .max(GENERATION_LIMITS.maxMembers),
        })
        .refine(
          (value) =>
            value.id === generation.data &&
            generationSchema.safeParse(value).success,
        ),
      false,
      GENERATION_LIMITS.maxResponseBytes,
    );
    const normalized = generationSpeciesIndexSchema.safeParse({
      generation: { id: body.id, name: body.name },
      items: body.pokemon_species
        .map((species) => ({
          speciesId: Number(species.url.split('/').at(-2)),
          name: species.name,
        }))
        .sort((a, b) => a.speciesId - b.speciesId),
    });
    if (!normalized.success)
      throw new CatalogError(
        502,
        'INVALID_UPSTREAM',
        'A PokéAPI retornou espécies incompatíveis.',
      );
    return normalized.data;
  }

  async defaultVariety(input: number): Promise<DefaultVarietyMapping> {
    const speciesId = speciesReferenceSchema.shape.speciesId.safeParse(input);
    if (!speciesId.success)
      throw new CatalogError(
        400,
        'INVALID_SPECIES_ID',
        'Use um ID de espécie de 1 a 999999.',
      );
    const body = await this.request(
      'pokemon-species/' + speciesId.data,
      z
        .object({
          id: speciesReferenceSchema.shape.speciesId,
          name: identifierSchema,
          varieties: z
            .array(
              z.object({
                is_default: z.boolean(),
                pokemon: z.object({
                  name: identifierSchema,
                  url: z
                    .string()
                    .regex(
                      /^https:\/\/pokeapi\.co\/api\/v2\/pokemon\/[1-9]\d{0,5}\/$/,
                    ),
                }),
              }),
            )
            .min(1)
            .max(DEFAULT_VARIETY_LIMITS.maxVarieties),
        })
        .refine(
          (value) =>
            value.id === speciesId.data &&
            value.varieties.filter((variety) => variety.is_default).length ===
              1 &&
            new Set(value.varieties.map((variety) => variety.pokemon.url))
              .size === value.varieties.length &&
            new Set(value.varieties.map((variety) => variety.pokemon.name))
              .size === value.varieties.length,
        ),
      'species',
      DEFAULT_VARIETY_LIMITS.maxResponseBytes,
    );
    // The upstream flag, never position or matching IDs/names, selects the mapping.
    const selected = body.varieties.find((variety) => variety.is_default)!;
    return defaultVarietyMappingSchema.parse({
      species: { speciesId: body.id, name: body.name },
      pokemon: {
        id: Number(selected.pokemon.url.split('/').at(-2)),
        name: selected.pokemon.name,
      },
    });
  }

  private async boundedJson(
    response: Response,
    maxBytes: number,
  ): Promise<unknown> {
    const invalid = () =>
      new CatalogError(
        502,
        'INVALID_UPSTREAM',
        'A PokéAPI retornou um recurso incompatível ou excessivo.',
      );
    const length = response.headers.get('content-length');
    if (length && /^\d+$/.test(length) && Number(length) > maxBytes) {
      void response.body?.cancel().catch(() => {});
      throw invalid();
    }
    const reader = response.body?.getReader();
    if (!reader) throw invalid();
    const chunks: Uint8Array[] = [];
    let size = 0,
      complete = false;
    try {
      for (;;) {
        const result = await reader.read();
        if (result.done) {
          complete = true;
          break;
        }
        size += result.value.byteLength;
        if (size > maxBytes) throw invalid();
        chunks.push(result.value);
      }
    } finally {
      if (!complete) void reader.cancel().catch(() => {});
      reader.releaseLock();
    }
    const bytes = new Uint8Array(size);
    let offset = 0;
    for (const chunk of chunks) {
      bytes.set(chunk, offset);
      offset += chunk.byteLength;
    }
    try {
      return JSON.parse(
        new TextDecoder('utf-8', { fatal: true }).decode(bytes),
      );
    } catch {
      throw invalid();
    }
  }

  private async request<T>(
    path: string,
    schema: z.ZodType<T>,
    missingResource:
      'pokemon' | 'species' | 'evolution-chain' | 'move' | false = false,
    maxBytes?: number,
  ): Promise<T> {
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetcher(
          'https://pokeapi.co/api/v2/' + path,
          {
            signal: controller.signal,
            redirect: 'error',
            headers: { accept: 'application/json' },
          },
        );
        // Release unread error bodies before retry/admission cleanup.
        if (!response.ok) void response.body?.cancel().catch(() => {});
        if (response.status === 404 && missingResource) {
          const missing = {
            move: {
              code: 'MOVE_NOT_FOUND',
              message: 'Movimento não encontrado.',
            },
            pokemon: {
              code: 'POKEMON_NOT_FOUND',
              message: 'Pokémon não encontrado.',
            },
            species: {
              code: 'SPECIES_NOT_FOUND',
              message: 'Espécie não encontrada.',
            },
            'evolution-chain': {
              code: 'EVOLUTION_CHAIN_NOT_FOUND',
              message: 'Cadeia de evolução não encontrada.',
            },
          }[missingResource];
          throw new CatalogError(404, missing.code, missing.message);
        }
        if (!response.ok)
          throw new CatalogError(
            503,
            'UPSTREAM_UNAVAILABLE',
            'A PokéAPI está temporariamente indisponível.',
          );
        const raw = schema.safeParse(
          maxBytes
            ? await this.boundedJson(response, maxBytes)
            : await response.json(),
        );
        if (!raw.success)
          throw new CatalogError(
            502,
            'INVALID_UPSTREAM',
            'A PokéAPI retornou dados incompatíveis.',
          );
        return raw.data;
      } catch (error) {
        if (error instanceof CatalogError && error.status !== 503) throw error;
        if (attempt === 1)
          throw new CatalogError(
            503,
            'UPSTREAM_UNAVAILABLE',
            'Não foi possível consultar a PokéAPI. Tente novamente.',
          );
      } finally {
        clearTimeout(timer);
      }
      await this.pause(150 * 2 ** attempt + Math.floor(Math.random() * 100));
    }
    throw new CatalogError(
      503,
      'UPSTREAM_UNAVAILABLE',
      'PokéAPI indisponível.',
    );
  }
}
