'use client';

import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRevealSelection } from './use-reveal-selection';
import { Check } from 'lucide-react';
import type { CSSProperties } from 'react';
import { useRef } from 'react';
import { POKEMON_TYPES } from '@pokelab/pokemon-domain';
import { parseCatalogSearchParams } from '../lib/catalog-search';
import { catalogHref } from '../lib/catalog';
import { POKEMON_TYPE_TOKENS } from '../lib/type-tokens';

export function TypeFilter() {
  const params = useSearchParams();
  const optionsRef = useRef<HTMLElement>(null);
  const query = parseCatalogSearchParams(params);
  const selected = query.kind === 'browse' ? query.type : undefined;
  useRevealSelection(optionsRef, selected);
  return (
    <section className="type-filter" aria-label="Filtro por tipo">
      <div className="type-filter-heading">
        <h2>Explore por tipo</h2>
        <p>Escolha um tipo ou busque por nome/ID acima.</p>
      </div>
      <nav
        ref={optionsRef}
        className="type-filter-options"
        aria-label="Tipos de Pokémon"
      >
        <Link
          className="type-filter-chip"
          href="/pokedex"
          prefetch={false}
          aria-current={
            query.kind === 'browse' && !selected ? 'true' : undefined
          }
        >
          Todos
        </Link>
        {POKEMON_TYPES.map((type) => {
          const token = POKEMON_TYPE_TOKENS[type];
          const active = selected === type;
          return (
            <Link
              key={type}
              className="type-filter-chip"
              href={catalogHref(1, type)}
              prefetch={false}
              aria-current={active ? 'true' : undefined}
              style={
                {
                  '--type-soft': token.soft,
                  '--type-solid': token.solid,
                } as CSSProperties
              }
            >
              <span className="type-filter-marker" aria-hidden="true">
                {active && <Check size={12} />}
              </span>
              {token.label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}

export function TypeFilterFallback() {
  return (
    <div
      className="type-filter skeleton"
      role="status"
      aria-label="Carregando filtros"
    />
  );
}
