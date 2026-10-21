import { Suspense } from 'react';
import Link from 'next/link';
import { ArrowLeft, ArrowRight, BookOpen, Sparkles } from 'lucide-react';
import { CatalogGrid } from '../../components/catalog-grid';
import { catalogHref, parseCatalogPage } from '../../lib/catalog';
import { getCatalogPage } from '../../lib/catalog-server';

type Query = Promise<Record<string, string | string[] | undefined>>;
function CatalogState({
  kind,
  page = 1,
}: {
  kind: 'invalid' | 'error' | 'empty';
  page?: number;
}) {
  return (
    <section className="catalog-state" role="status">
      <BookOpen size={40} aria-hidden="true" />
      <h2>
        {kind === 'invalid'
          ? 'Página inválida'
          : kind === 'empty'
            ? 'Nenhum Pokémon nesta página'
            : 'Não conseguimos abrir o catálogo'}
      </h2>
      <p>
        {kind === 'invalid'
          ? 'Escolha uma página de 1 a 1000.'
          : kind === 'empty'
            ? 'Você chegou além das entradas disponíveis. Volte para continuar explorando.'
            : 'O serviço está indisponível no momento. Aguarde um pouco e tente novamente.'}
      </p>
      {kind === 'error' && (
        <a className="button button-primary" href={catalogHref(page)}>
          Tentar novamente
        </a>
      )}
      <Link
        className="button button-secondary"
        href="/pokedex"
        prefetch={false}
      >
        Ir para a primeira página
      </Link>
    </section>
  );
}
async function Catalog({ searchParams }: { searchParams: Query }) {
  const page = parseCatalogPage(await searchParams);
  if (page === null) return <CatalogState kind="invalid" />;
  const result = await getCatalogPage(page);
  if (!result) return <CatalogState kind="error" page={page} />;
  if (!result.items.length) return <CatalogState kind="empty" page={page} />;
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
        <h2>Encontre sua próxima descoberta</h2>
        <span>
          {start}–{start + result.items.length - 1} de{' '}
          {result.total.toLocaleString('pt-BR')} entradas
        </span>
      </div>
      <CatalogGrid key={page} references={result.items} page={page} />
      <nav className="pagination" aria-label="Paginação do catálogo">
        {page > 1 ? (
          <Link
            className="button button-secondary"
            href={catalogHref(page - 1)}
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
        {result.hasNext && page < 1000 ? (
          <Link
            className="button button-primary"
            href={catalogHref(page + 1)}
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
    </>
  );
}
function CatalogSkeleton() {
  return (
    <div role="status" aria-label="Carregando catálogo">
      <p>Consultando o catálogo…</p>
      <div className="catalog-grid" aria-hidden="true">
        {Array.from({ length: 12 }, (_, i) => (
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
      <Suspense fallback={<CatalogSkeleton />}>
        <Catalog searchParams={searchParams} />
      </Suspense>
    </div>
  );
}
