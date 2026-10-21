import Link from 'next/link';
import { pokemonSummarySchema } from '@pokelab/contracts';
import { getSearchResult } from '../lib/pokemon-search';
import { searchHref } from '../lib/catalog-search';
import { PokemonCard } from './pokemon-card';

export async function CatalogSearchResult({ term }: { term: string }) {
  const result = await getSearchResult(term);
  return (
    <section className="search-results" aria-labelledby="search-results-title">
      <div className="catalog-toolbar">
        <h2 id="search-results-title">Resultado para “{term}”</h2>
        <Link href="/pokedex" prefetch={false} className="search-browse-link">
          Ver todos os Pokémon
        </Link>
      </div>
      {result.kind === 'ready' ? (
        <>
          <p className="catalog-status" role="status">
            1 Pokémon encontrado por nome completo ou ID.
          </p>
          {result.value.meta.stale && (
            <p className="stale-notice" role="status">
              Dados salvos em{' '}
              <time dateTime={result.value.meta.fetchedAt}>
                {new Date(result.value.meta.fetchedAt).toLocaleDateString(
                  'pt-BR',
                  { timeZone: 'America/Sao_Paulo' },
                )}
              </time>
              . A fonte está indisponível no momento.
            </p>
          )}
          <ul className="catalog-grid" aria-label="Resultado da busca">
            <li>
              <PokemonCard
                pokemon={pokemonSummarySchema.parse(result.value.data)}
                fromSearch={term}
              />
            </li>
          </ul>
        </>
      ) : (
        <div className="catalog-state" role="status">
          <h3>
            {result.kind === 'missing'
              ? 'Nenhum Pokémon encontrado'
              : 'Não conseguimos realizar a busca'}
          </h3>
          <p>
            {result.kind === 'missing'
              ? 'Confira o nome completo ou o ID. A busca por partes do nome ainda não está disponível.'
              : 'O serviço está indisponível no momento. Aguarde um pouco e tente novamente.'}
          </p>
          {result.kind !== 'missing' && (
            <a className="button button-primary" href={searchHref(term)}>
              Tentar busca novamente
            </a>
          )}
          <Link
            className="button button-secondary"
            href="/pokedex"
            prefetch={false}
          >
            Voltar ao catálogo
          </Link>
        </div>
      )}
    </section>
  );
}
