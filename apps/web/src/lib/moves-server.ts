import { z } from 'zod';
import {
  pokemonMovesResponseSchema,
  pokemonMovesQuerySchema,
  pokemonReferenceSchema,
  speciesReferenceSchema,
  moveMetadataResponseSchema,
} from '@pokelab/contracts';
import type { PokemonMovesResponse } from '@pokelab/contracts';
import { MOVES_PAGE_SIZE, validMoveId } from './moves';
import type { MovesPokemon, MoveMetadataResult } from './moves';

export type MovesResult =
  | { kind: 'ready'; value: PokemonMovesResponse }
  | { kind: 'error' | 'missing' };
const apiOrigin = () =>
  z.url().parse(process.env.API_URL ?? 'http://127.0.0.1:3001');
export async function getMoves(
  pokemon: MovesPokemon,
  versionGroup: number,
  page: number,
): Promise<MovesResult> {
  const identity = pokemonReferenceSchema.safeParse(pokemon);
  const species = speciesReferenceSchema.safeParse({
    speciesId: pokemon.species.id,
    name: pokemon.species.name,
  });
  const query = pokemonMovesQuerySchema.safeParse({
    versionGroup: String(versionGroup),
    page: String(page),
    pageSize: String(MOVES_PAGE_SIZE),
  });
  if (
    !identity.success ||
    !species.success ||
    typeof pokemon.isDefault !== 'boolean' ||
    !query.success
  )
    return { kind: 'error' };
  try {
    const params = new URLSearchParams({
      versionGroup: String(query.data.versionGroup),
      page: String(query.data.page),
      pageSize: String(MOVES_PAGE_SIZE),
    });
    const response = await fetch(
      new URL(`/v1/pokemon/${identity.data.id}/moves?${params}`, apiOrigin()),
      { cache: 'no-store', signal: AbortSignal.timeout(45000) },
    );
    if (response.status === 404) return { kind: 'missing' };
    if (!response.ok) return { kind: 'error' };
    const parsed = pokemonMovesResponseSchema.safeParse(await response.json());
    if (!parsed.success) return { kind: 'error' };
    const data = parsed.data.data;
    if (
      data.pokemon.id !== pokemon.id ||
      data.pokemon.name !== pokemon.name ||
      data.species.speciesId !== pokemon.species.id ||
      data.species.name !== pokemon.species.name ||
      data.isDefault !== pokemon.isDefault ||
      data.requestedVersionGroupId !== versionGroup ||
      data.page !== page ||
      data.pageSize !== MOVES_PAGE_SIZE
    )
      return { kind: 'error' };
    return { kind: 'ready', value: parsed.data };
  } catch {
    return { kind: 'error' };
  }
}
export async function getMoveMetadata(
  id: string,
  signal?: AbortSignal,
): Promise<MoveMetadataResult> {
  const parsed = validMoveId(id);
  if (!parsed.success) return { kind: 'error' };
  try {
    const deadline = AbortSignal.timeout(45000);
    const response = await fetch(
      new URL(`/v1/moves/${parsed.data}`, apiOrigin()),
      {
        cache: 'no-store',
        signal: signal ? AbortSignal.any([signal, deadline]) : deadline,
      },
    );
    if (response.status === 404) return { kind: 'missing' };
    if (!response.ok) return { kind: 'error' };
    const result = moveMetadataResponseSchema.safeParse(await response.json());
    return result.success && result.data.data.move.id === parsed.data
      ? { kind: 'ready', value: result.data }
      : { kind: 'error' };
  } catch {
    return { kind: 'error' };
  }
}
