import type { PokemonType } from '@pokelab/pokemon-domain';
import { POKEMON_TYPE_TOKENS } from '../lib/type-tokens';
export function TypeBadge({ type }: { type: PokemonType }) {
  const token = POKEMON_TYPE_TOKENS[type];
  return (
    <span className="type-badge" style={{ background: token.soft }}>
      <span aria-hidden="true" style={{ background: token.solid }} />
      {token.label}
    </span>
  );
}
