import {
  speciesDescriptionResponseSchema,
  speciesReferenceSchema,
} from '@pokelab/contracts';
import type { Pokemon, SpeciesDescriptionResponse } from '@pokelab/contracts';
import { z } from 'zod';

export type DescriptionResult =
  | { kind: 'ready'; value: SpeciesDescriptionResponse }
  | { kind: 'error' | 'missing' };

export async function getSpeciesDescription(
  species: Pokemon['species'],
): Promise<DescriptionResult> {
  const identity = speciesReferenceSchema.safeParse({
    speciesId: species.id,
    name: species.name,
  });
  if (!identity.success) return { kind: 'error' };
  try {
    const api = z.url().parse(process.env.API_URL ?? 'http://127.0.0.1:3001');
    const response = await fetch(
      new URL(
        `/v1/pokemon-species/${identity.data.speciesId}/description`,
        api,
      ),
      {
        cache: 'no-store',
        signal: AbortSignal.timeout(15000),
      },
    );
    if (response.status === 404) return { kind: 'missing' };
    if (!response.ok) return { kind: 'error' };
    const result = speciesDescriptionResponseSchema.safeParse(
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
