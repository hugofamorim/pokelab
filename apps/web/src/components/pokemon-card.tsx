import Link from 'next/link';
import type { PokemonSummary } from '@pokelab/contracts';
import { ArrowUpRight } from 'lucide-react';
import { PokemonArtwork } from './pokemon-artwork';
import { TypeBadge } from './type-badge';
export function PokemonCard({ pokemon }: { pokemon: PokemonSummary }) {
  return (
    <Link className="pokemon-card" href={`/pokemon/${pokemon.id}`}>
      <div>
        <span className="eyebrow">
          Nº {String(pokemon.id).padStart(4, '0')}
        </span>
        <h3 className="pokemon-name">{pokemon.name}</h3>
        <div className="badges">
          {pokemon.types.map((type) => (
            <TypeBadge type={type} key={type} />
          ))}
        </div>
      </div>
      <PokemonArtwork src={pokemon.artwork} name={pokemon.name} />
      <ArrowUpRight aria-hidden="true" />
    </Link>
  );
}
