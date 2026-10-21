'use client';
import { useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowUpRight, RefreshCw } from 'lucide-react';
import type {
  PokemonPageResponse,
  PokemonSummaryResult,
} from '@pokelab/contracts';
import { PokemonCard } from './pokemon-card';
import { CATALOG_BATCH_SIZE, parseSummaryBatch } from '../lib/catalog';

export function CatalogGrid({
  references,
  page,
}: {
  references: PokemonPageResponse['items'];
  page: number;
}) {
  const [results, setResults] = useState<Record<number, PokemonSummaryResult>>(
    {},
  );
  const [retryIds, setRetryIds] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const ids = retryIds ?? references.map((item) => item.id);
    async function load() {
      for (let offset = 0; offset < ids.length; offset += CATALOG_BATCH_SIZE) {
        if (controller.signal.aborted) return;
        const batch = ids.slice(offset, offset + CATALOG_BATCH_SIZE);
        let items: PokemonSummaryResult[];
        try {
          const response = await fetch(
            `/api/catalog/summaries?ids=${batch.join(',')}`,
            {
              cache: 'no-store',
              signal: AbortSignal.any([
                controller.signal,
                AbortSignal.timeout(70000),
              ]),
            },
          );
          const result = response.ok
            ? parseSummaryBatch(await response.json(), batch)
            : null;
          if (!result) throw new Error('Unavailable summary batch');
          items = result.items;
        } catch {
          if (controller.signal.aborted) return;
          items = batch.map((id) => ({
            id,
            status: 'unavailable',
            code: 'UPSTREAM_UNAVAILABLE',
          }));
        }
        if (controller.signal.aborted) return;
        setResults((previous) => ({
          ...previous,
          ...Object.fromEntries(items.map((item) => [item.id, item])),
        }));
      }
      if (!controller.signal.aborted) setLoading(false);
    }
    void load();
    return () => controller.abort();
  }, [references, retryIds]);
  const failed = references.filter(
    (item) => results[item.id]?.status === 'unavailable',
  );
  const ready = references.filter(
    (item) => results[item.id]?.status === 'ready',
  ).length;
  return (
    <>
      <div className="catalog-status" role="status" aria-live="polite">
        {loading
          ? 'Carregando tipos e imagens…'
          : `${ready} de ${references.length} Pokémon com detalhes disponíveis.`}
      </div>
      <ul className="catalog-grid" aria-label="Pokémon desta página">
        {references.map((reference) => {
          const result = results[reference.id];
          return (
            <li key={reference.id}>
              {result?.status === 'ready' ? (
                <>
                  <PokemonCard pokemon={result.data} fromPage={page} />
                  {result.meta.stale && (
                    <p className="card-freshness">
                      Dados salvos em{' '}
                      <time dateTime={result.meta.fetchedAt}>
                        {new Date(result.meta.fetchedAt).toLocaleDateString(
                          'pt-BR',
                          { timeZone: 'America/Sao_Paulo' },
                        )}
                      </time>
                    </p>
                  )}
                </>
              ) : (
                <div className="pokemon-card reference-card">
                  <Link
                    className="reference-link"
                    href={`/pokemon/${reference.id}?fromPage=${page}`}
                    prefetch={false}
                  >
                    <span className="eyebrow">
                      Nº {String(reference.id).padStart(4, '0')}
                    </span>
                    <h3 className="pokemon-name">{reference.name}</h3>
                    <ArrowUpRight size={20} aria-hidden="true" />
                  </Link>
                  <p>
                    {result?.status === 'unavailable'
                      ? 'Tipos e imagem indisponíveis. Você ainda pode abrir o detalhe.'
                      : 'Carregando tipos e imagem…'}
                  </p>
                  {!result && (
                    <div
                      className="reference-halo skeleton"
                      aria-hidden="true"
                    />
                  )}
                </div>
              )}
            </li>
          );
        })}
      </ul>
      {!loading && failed.length > 0 && (
        <div className="catalog-retry">
          <p>
            Alguns detalhes não chegaram. Os Pokémon disponíveis continuam aqui.
          </p>
          <button
            className="button button-secondary"
            onClick={() => {
              setLoading(true);
              setRetryIds(failed.map((item) => item.id));
            }}
          >
            <RefreshCw size={18} aria-hidden="true" />
            Tentar detalhes novamente
          </button>
        </div>
      )}
    </>
  );
}
