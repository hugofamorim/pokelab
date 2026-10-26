import { Suspense } from 'react';
import { BookOpen, Sparkles } from 'lucide-react';
import { CombinedBrowse } from '../../components/combined-browse';
import { CatalogGrid } from '../../components/catalog-grid';
import { CatalogState } from '../../components/catalog-state';
import { CatalogPagination } from '../../components/catalog-pagination';
import { GenerationBrowse } from '../../components/generation-browse';
import { GenerationFilter } from '../../components/generation-filter';
import { getCatalogPage } from '../../lib/catalog-server';
import { parseCatalogQuery } from '../../lib/catalog-search';
import {
  CatalogSearchField,
  SearchFieldFallback,
} from '../../components/search-field';
import { CatalogSearchResult } from '../../components/catalog-search-result';
import { redirect } from 'next/navigation';
import { searchHref } from '../../lib/catalog-search';
import type { PokemonType } from '@pokelab/pokemon-domain';
import { POKEMON_TYPE_TOKENS } from '../../lib/type-tokens';
import { TypeFilter, TypeFilterFallback } from '../../components/type-filter';

type Query = Promise<Record<string, string | string[] | undefined>>;
async function Catalog({ searchParams }: { searchParams: Query }) {
  const raw = await searchParams;
  const query = parseCatalogQuery(raw);
  if (query.kind === 'search' && raw.search !== query.term)
    redirect(searchHref(query.term));
  if (query.kind === 'browse' && raw.search !== undefined) redirect('/pokedex');
  return (
    <>
      {query.kind === 'invalid' ? (
        <CatalogState
          kind={raw.search === undefined ? 'invalid' : 'invalidSearch'}
        />
      ) : query.kind === 'search' ? (
        <Suspense key={query.term} fallback={<SearchSkeleton />}>
          <CatalogSearchResult term={query.term} />
        </Suspense>
      ) : query.kind === 'combined' ? (
        <Suspense
          key={JSON.stringify(query.input)}
          fallback={<CatalogSkeleton count={4} />}
        >
          <CombinedBrowse input={query.input} />
        </Suspense>
      ) : query.kind === 'generation' ? (
        <Suspense
          key={`generation:${query.generation}:${query.page}`}
          fallback={<CatalogSkeleton />}
        >
          <GenerationBrowse page={query.page} generation={query.generation} />
        </Suspense>
      ) : (
        <Suspense
          key={`${query.type ?? 'all'}:${query.page}`}
          fallback={<CatalogSkeleton />}
        >
          <Browse page={query.page} type={query.type} />
        </Suspense>
      )}
    </>
  );
}
async function Browse({ page, type }: { page: number; type?: PokemonType }) {
  const result = await getCatalogPage(page, type);
  if (!result) return <CatalogState kind="error" page={page} type={type} />;
  if (!result.items.length)
    return <CatalogState kind="empty" page={page} type={type} />;
  const start = (page - 1) * result.pageSize + 1;
  return (
    <>
      {result.meta.stale && (
        <p className="stale-notice" role="status">
          Lista salva em{' '}
          <time dateTime={result.meta.fetchedAt}>
            {new Date(result.meta.fetchedAt).toLocaleDateString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
            })}
          </time>
          . A fonte está indisponível no momento.
        </p>
      )}
      <div className="catalog-toolbar">
        <h2>
          {type
            ? `Pokémon do tipo ${POKEMON_TYPE_TOKENS[type].label}`
            : 'Encontre sua próxima descoberta'}
        </h2>
        <span>
          {start}–{start + result.items.length - 1} de{' '}
          {result.total.toLocaleString('pt-BR')} entradas
        </span>
      </div>
      <CatalogGrid
        key={`${type ?? 'all'}:${page}`}
        references={result.items}
        page={page}
        type={type}
      />
      <CatalogPagination page={page} hasNext={result.hasNext} type={type} />
    </>
  );
}
function SearchSkeleton() {
  return (
    <div role="status" aria-label="Buscando Pokémon">
      <p>Consultando o Pokémon…</p>
      <div className="catalog-grid" aria-hidden="true">
        <div className="skeleton catalog-card-skeleton" />
      </div>
    </div>
  );
}
function CatalogSkeleton({ count = 12 }: { count?: number }) {
  return (
    <div role="status" aria-label="Carregando catálogo">
      <p>Consultando o catálogo…</p>
      <div className="catalog-grid" aria-hidden="true">
        {Array.from({ length: count }, (_, i) => (
          <div key={i} className="skeleton catalog-card-skeleton" />
        ))}
      </div>
    </div>
  );
}
export default function Page({ searchParams }: { searchParams: Query }) {
  return (
    <div className="catalog-page">
      <section className="catalog-intro">
        <div>
          <span className="eyebrow">
            <Sparkles size={16} aria-hidden="true" /> SEU LABORATÓRIO DE
            DESCOBERTAS
          </span>
          <h1>
            Um mundo de Pokémon.
            <br />
            <span>Uma descoberta por vez.</span>
          </h1>
          <p>
            Conheça os tipos, encontre seus favoritos e explore o que torna cada
            Pokémon único.
          </p>
        </div>
        <div className="catalog-emblem" aria-hidden="true">
          <BookOpen size={64} strokeWidth={1.3} />
          <span>✦</span>
        </div>
      </section>
      <Suspense fallback={<SearchFieldFallback />}>
        <CatalogSearchField />
      </Suspense>
      <Suspense fallback={<TypeFilterFallback />}>
        <TypeFilter />
        <GenerationFilter />
      </Suspense>
      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
