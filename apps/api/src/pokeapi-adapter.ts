import { z } from 'zod';
import {
  artworkSchema,
  identifierSchema,
  pokemonSchema,
} from '@pokelab/contracts';
import type { Pokemon } from '@pokelab/contracts';
import { POKEMON_TYPES, STAT_NAMES, toMetric } from '@pokelab/pokemon-domain';
import { CatalogError } from './errors.js';

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
  async get(identifier: string): Promise<Pokemon> {
    const parsed = identifierSchema.safeParse(identifier);
    if (!parsed.success)
      throw new CatalogError(
        400,
        'INVALID_IDENTIFIER',
        'Identificador de Pokémon inválido.',
      );
    for (let attempt = 0; attempt < 2; attempt++) {
      const controller = new AbortController();
      const timer = setTimeout(() => controller.abort(), this.timeoutMs);
      try {
        const response = await this.fetcher(
          `https://pokeapi.co/api/v2/pokemon/${parsed.data}`,
          {
            signal: controller.signal,
            redirect: 'error',
            headers: { accept: 'application/json' },
          },
        );
        if (response.status === 404)
          throw new CatalogError(
            404,
            'POKEMON_NOT_FOUND',
            'Pokémon não encontrado.',
          );
        if (!response.ok)
          throw new CatalogError(
            503,
            'UPSTREAM_UNAVAILABLE',
            'A PokéAPI está temporariamente indisponível.',
          );
        const raw = upstreamSchema.safeParse(await response.json());
        if (!raw.success)
          throw new CatalogError(
            502,
            'INVALID_UPSTREAM',
            'A PokéAPI retornou dados incompatíveis.',
          );
        const p = raw.data;
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
        if (!result.success)
          throw new CatalogError(
            502,
            'INVALID_UPSTREAM',
            'A PokéAPI retornou dados incompatíveis.',
          );
        return result.data;
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
