'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import { GENERATION_NAMES } from '@pokelab/contracts';
import { parseCatalogSearchParams } from '../lib/catalog-search';
import { generationHref } from '../lib/generation-catalog';
import { useRevealSelection } from './use-reveal-selection';

export function GenerationFilter() {
  const query = parseCatalogSearchParams(useSearchParams());
  const selected =
    query.kind === 'generation'
      ? String(query.generation)
      : query.kind === 'browse'
        ? 'all'
        : undefined;
  const optionsRef = useRef<HTMLElement>(null);
  useRevealSelection(optionsRef, selected);
  return (
    <section
      className="type-filter generation-filter"
      aria-label="Filtro por geração"
    >
      <div className="type-filter-heading">
        <h2>Geração de introdução</h2>
        <p>Escolha um tipo ou uma geração. A busca por nome/ID é separada.</p>
      </div>
      <nav
        ref={optionsRef}
        className="type-filter-options"
        aria-label="Gerações de Pokémon"
      >
        <Link
          className="type-filter-chip"
          href="/pokedex"
          prefetch={false}
          aria-current={selected === 'all' ? 'true' : undefined}
        >
          Todas
        </Link>
        {GENERATION_NAMES.map((name, index) => {
          const id = index + 1,
            label = name.replace('generation-', '').toUpperCase();
          return (
            <Link
              key={id}
              className="type-filter-chip"
              href={generationHref(1, id)}
              prefetch={false}
              aria-label={`Geração ${label}`}
              aria-current={selected === String(id) ? 'true' : undefined}
            >
              {label}
            </Link>
          );
        })}
      </nav>
    </section>
  );
}
