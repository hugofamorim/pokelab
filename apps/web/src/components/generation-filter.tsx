'use client';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { useRef } from 'react';
import { GENERATION_NAMES } from '@pokelab/contracts';
import { parseCatalogSearchParams } from '../lib/catalog-search';
import { combinedHref } from '../lib/combined-catalog';
import { catalogHref } from '../lib/catalog';
import { generationHref } from '../lib/generation-catalog';
import { useRevealSelection } from './use-reveal-selection';

export function GenerationFilter() {
  const query = parseCatalogSearchParams(useSearchParams());
  const selected =
    query.kind === 'combined'
      ? query.input.generation
      : query.kind === 'generation'
        ? String(query.generation)
        : query.kind === 'browse'
          ? 'all'
          : undefined;
  const type =
    query.kind === 'combined'
      ? query.input.type
      : query.kind === 'browse'
        ? query.type
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
        <p>Combine com um tipo. A busca por nome/ID é separada.</p>
      </div>
      <nav
        ref={optionsRef}
        className="type-filter-options"
        aria-label="Gerações de Pokémon"
      >
        <Link
          className="type-filter-chip"
          href={type ? catalogHref(1, type) : '/pokedex'}
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
              href={
                type
                  ? combinedHref({ type, generation: String(id) })
                  : generationHref(1, id)
              }
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
