import {
  speciesEvolutionResponseSchema,
  speciesReferenceSchema,
} from '@pokelab/contracts';
import type { Pokemon, SpeciesEvolutionResponse } from '@pokelab/contracts';
import { z } from 'zod';

export type EvolutionResult =
  | { kind: 'ready'; value: SpeciesEvolutionResponse }
  | { kind: 'error' | 'missing' };
export async function getEvolution(
  species: Pokemon['species'],
): Promise<EvolutionResult> {
  const identity = speciesReferenceSchema.safeParse({
    speciesId: species.id,
    name: species.name,
  });
  if (!identity.success) return { kind: 'error' };
  try {
    const api = z.url().parse(process.env.API_URL ?? 'http://127.0.0.1:3001');
    const response = await fetch(
      new URL(`/v1/pokemon-species/${identity.data.speciesId}/evolution`, api),
      { cache: 'no-store', signal: AbortSignal.timeout(70000) },
    );
    if (response.status === 404) return { kind: 'missing' };
    if (!response.ok) return { kind: 'error' };
    const result = speciesEvolutionResponseSchema.safeParse(
      await response.json(),
    );
    if (
      !result.success ||
      result.data.data.species.speciesId !== species.id ||
      result.data.data.species.name !== species.name
    )
      return { kind: 'error' };
    return { kind: 'ready', value: result.data };
  } catch {
    return { kind: 'error' };
  }
}
