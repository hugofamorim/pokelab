import Link from 'next/link';
import type { PokemonSummary } from '@pokelab/contracts';
import { ArrowUpRight } from 'lucide-react';
import { PokemonArtwork } from './pokemon-artwork';
import { TypeBadge } from './type-badge';
import type { CSSProperties } from 'react';
import { POKEMON_TYPE_TOKENS } from '../lib/type-tokens';
import { catalogDetailHref } from '../lib/catalog';
import type { PokemonType } from '@pokelab/pokemon-domain';
import { generationDetailHref } from '../lib/generation-catalog';
export function PokemonCard({
  pokemon,
  fromPage,
  fromSearch,
  fromType,
  fromGeneration,
}: {
  pokemon: PokemonSummary;
  fromPage?: number;
  fromSearch?: string;
  fromType?: PokemonType;
  fromGeneration?: number;
}) {
  const accent = POKEMON_TYPE_TOKENS[pokemon.types[0] ?? 'normal'];
  return (
    <Link
      className="pokemon-card"
      style={{ '--type-soft': accent.soft } as CSSProperties}
      href={
        fromSearch
          ? `/pokemon/${pokemon.id}?${new URLSearchParams({ fromSearch })}`
          : fromGeneration
            ? generationDetailHref(pokemon.id, fromPage ?? 1, fromGeneration)
            : fromPage
              ? catalogDetailHref(pokemon.id, fromPage, fromType)
              : `/pokemon/${pokemon.id}`
      }
      prefetch={false}
    >
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
      <PokemonArtwork
        src={pokemon.artwork}
        name={pokemon.name}
        sizes="(max-width: 639px) 38vw, 180px"
      />
      <ArrowUpRight aria-hidden="true" />
    </Link>
  );
}
