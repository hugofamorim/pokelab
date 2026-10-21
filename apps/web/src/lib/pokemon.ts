import { pokemonResponseSchema, identifierSchema } from '@pokelab/contracts';
import { z } from 'zod';
export type PokemonResult =
  | { kind: 'ready'; value: z.infer<typeof pokemonResponseSchema> }
  | { kind: 'missing' | 'error' | 'invalid' };
export async function getPokemon(identifier: string): Promise<PokemonResult> {
  const id = identifierSchema.safeParse(identifier);
  if (!id.success) return { kind: 'invalid' };
  try {
    const api = z.url().parse(process.env.API_URL ?? 'http://localhost:3001');
    const response = await fetch(new URL(`/v1/pokemon/${id.data}`, api), {
      cache: 'no-store',
      signal: AbortSignal.timeout(15000),
    });
    if (response.status === 404) return { kind: 'missing' };
    if (!response.ok) return { kind: 'error' };
    const value = pokemonResponseSchema.safeParse(await response.json());
    return value.success
      ? { kind: 'ready', value: value.data }
      : { kind: 'error' };
  } catch {
    return { kind: 'error' };
  }
}
