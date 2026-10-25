import Link from 'next/link';
import { ArrowLeft, ArrowRight } from 'lucide-react';
import type { PokemonType } from '@pokelab/pokemon-domain';
import { catalogHref } from '../lib/catalog';
import { generationHref } from '../lib/generation-catalog';

export function CatalogPagination({
  page,
  hasNext,
  type,
  generation,
}: {
  page: number;
  hasNext: boolean;
  type?: PokemonType;
  generation?: number;
}) {
  const href = (value: number) =>
    generation ? generationHref(value, generation) : catalogHref(value, type);
  return (
    <nav className="pagination" aria-label="Paginação do catálogo">
      {page > 1 ? (
        <Link
          className="button button-secondary"
          href={href(page - 1)}
          prefetch={false}
        >
          <ArrowLeft size={18} aria-hidden="true" />
          Anterior
        </Link>
      ) : (
        <span className="button button-secondary" aria-disabled="true">
          Anterior
        </span>
      )}
      <span aria-current="page">Página {page}</span>
      {hasNext && page < 1000 ? (
        <Link
          className="button button-primary"
          href={href(page + 1)}
          prefetch={false}
        >
          Próxima
          <ArrowRight size={18} aria-hidden="true" />
        </Link>
      ) : (
        <span className="button button-secondary" aria-disabled="true">
          Próxima
        </span>
      )}
    </nav>
  );
}
