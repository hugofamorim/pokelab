import Link from 'next/link';
import { BookOpen } from 'lucide-react';
import type { PokemonType } from '@pokelab/pokemon-domain';
import { catalogHref } from '../lib/catalog';
import { generationHref } from '../lib/generation-catalog';

export function CatalogState({
  kind,
  page = 1,
  type,
  generation,
}: {
  kind: 'invalid' | 'invalidSearch' | 'error' | 'empty';
  page?: number;
  type?: PokemonType;
  generation?: number;
}) {
  const href = (value: number) =>
    generation ? generationHref(value, generation) : catalogHref(value, type);
  return (
    <section className="catalog-state" role="status">
      <BookOpen size={40} aria-hidden="true" />
      <h2>
        {kind === 'invalidSearch'
          ? 'Busca inválida'
          : kind === 'invalid'
            ? 'Página inválida'
            : kind === 'empty'
              ? generation
                ? 'Nenhuma espécie nesta página'
                : 'Nenhum Pokémon nesta página'
              : 'Não conseguimos abrir o catálogo'}
      </h2>
      <p>
        {kind === 'invalidSearch'
          ? 'Use um nome completo ou ID com até 64 caracteres, sem filtros ou paginação na mesma consulta.'
          : kind === 'invalid'
            ? 'Use uma página de 1 a 1000 com um tipo ou geração de I a IX, ou busque por nome completo/ID separadamente.'
            : kind === 'empty'
              ? 'Você chegou além das entradas disponíveis. Volte para continuar explorando.'
              : 'O serviço está indisponível no momento. Aguarde um pouco e tente novamente.'}
      </p>
      {kind === 'error' && (
        <a className="button button-primary" href={href(page)}>
          Tentar novamente
        </a>
      )}
      <Link className="button button-secondary" href={href(1)} prefetch={false}>
        Ir para a primeira página
      </Link>
    </section>
  );
}
