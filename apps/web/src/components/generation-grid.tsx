'use client';
import { useEffect, useState } from 'react';
import { RefreshCw } from 'lucide-react';
import type { GenerationSpeciesPageResponse } from '@pokelab/contracts';
import { PokemonCard } from './pokemon-card';
import { CATALOG_BATCH_SIZE } from '../lib/catalog';
import {
  matchGenerationReference,
  parseGenerationCards,
} from '../lib/generation-catalog';
import type { GenerationCardResult } from '../lib/generation-catalog';

function SavedSource({
  label,
  fetchedAt,
}: {
  label: string;
  fetchedAt: string;
}) {
  return (
    <p className="generation-freshness">
      {label}{' '}
      <time dateTime={fetchedAt}>
        {new Date(fetchedAt).toLocaleDateString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
        })}
      </time>
    </p>
  );
}
export function GenerationGrid({
  references,
  page,
  generation,
}: {
  references: GenerationSpeciesPageResponse['items'];
  page: number;
  generation: number;
}) {
  const [results, setResults] = useState<Record<number, GenerationCardResult>>(
    {},
  );
  const [retryIds, setRetryIds] = useState<number[] | null>(null);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const controller = new AbortController();
    const ids = retryIds ?? references.map((item) => item.speciesId);
    async function load() {
      for (let offset = 0; offset < ids.length; offset += CATALOG_BATCH_SIZE) {
        if (controller.signal.aborted) return;
        const batch = ids.slice(offset, offset + CATALOG_BATCH_SIZE);
        let items: GenerationCardResult[];
        try {
          const response = await fetch(
            `/api/catalog/generation-cards?speciesIds=${batch.join(',')}`,
            {
              cache: 'no-store',
              signal: AbortSignal.any([
                controller.signal,
                AbortSignal.timeout(140000),
              ]),
            },
          );
          const parsed = response.ok
            ? parseGenerationCards(await response.json(), batch)
            : null;
          if (!parsed) throw new Error('Unavailable generation batch');
          items = parsed.items.map((item) =>
            matchGenerationReference(
              item,
              references.find((ref) => ref.speciesId === item.speciesId)!,
            ),
          );
        } catch {
          if (controller.signal.aborted) return;
          items = batch.map((speciesId) => ({
            speciesId,
            status: 'unavailable',
            code: 'UPSTREAM_UNAVAILABLE',
          }));
        }
        if (controller.signal.aborted) return;
        setResults((previous) => ({
          ...previous,
          ...Object.fromEntries(items.map((item) => [item.speciesId, item])),
        }));
      }
      if (!controller.signal.aborted) setLoading(false);
    }
    void load();
    return () => controller.abort();
  }, [references, retryIds]);
  const failed = references.filter(
    (ref) => results[ref.speciesId]?.status === 'unavailable',
  );
  const ready = references.filter(
    (ref) => results[ref.speciesId]?.status === 'ready',
  ).length;
  return (
    <>
      <div className="catalog-status" role="status" aria-live="polite">
        {loading
          ? 'Resolvendo variedades e carregando detalhes…'
          : `${ready} de ${references.length} ${references.length === 1 ? 'espécie' : 'espécies'} com variedade padrão disponível.`}
      </div>
      <ul
        className="catalog-grid generation-grid"
        aria-label="Espécies desta página"
      >
        {references.map((reference) => {
          const result = results[reference.speciesId];
          return (
            <li key={reference.speciesId}>
              {result?.status === 'ready' ? (
                <PokemonCard
                  pokemon={result.summary.data}
                  fromPage={page}
                  fromGeneration={generation}
                />
              ) : (
                <div className="pokemon-card reference-card">
                  <span className="eyebrow">
                    Espécie Nº {String(reference.speciesId).padStart(4, '0')}
                  </span>
                  <h3 className="pokemon-name">{reference.name}</h3>
                  <p>
                    {result
                      ? 'Variedade ou detalhes indisponíveis. Tente novamente para abrir o Pokémon correto.'
                      : 'Consultando a variedade padrão e seus detalhes…'}
                  </p>
                  {!result && (
                    <div
                      className="reference-halo skeleton"
                      aria-hidden="true"
                    />
                  )}
                </div>
              )}
              {result?.status === 'ready' &&
                result.summary.data.name !== reference.name && (
                  <p className="generation-species-name">
                    Espécie: {reference.name}
                  </p>
                )}
              {result?.mapping?.meta.stale && (
                <SavedSource
                  label="Mapeamento salvo em"
                  fetchedAt={result.mapping.meta.fetchedAt}
                />
              )}
              {result?.status === 'ready' && result.summary.meta.stale && (
                <SavedSource
                  label="Dados do Pokémon salvos em"
                  fetchedAt={result.summary.meta.fetchedAt}
                />
              )}
            </li>
          );
        })}
      </ul>
      {!loading && failed.length > 0 && (
        <div className="catalog-retry">
          <p>Algumas variedades não chegaram. As disponíveis continuam aqui.</p>
          <button
            className="button button-secondary"
            onClick={() => {
              setLoading(true);
              setRetryIds(failed.map((ref) => ref.speciesId));
            }}
          >
            <RefreshCw size={18} aria-hidden="true" />
            Tentar variedades novamente
          </button>
        </div>
      )}
    </>
  );
}
