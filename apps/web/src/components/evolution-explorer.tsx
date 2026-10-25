'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { EvolutionChain } from '@pokelab/contracts';
import { GitBranch } from 'lucide-react';
import {
  parseGenerationCards,
  matchGenerationReference,
} from '../lib/generation-catalog';
import type { GenerationCardResult } from '../lib/generation-catalog';
import { evolutionConditionRows } from '../lib/evolution';
import { PokemonCard } from './pokemon-card';

type Node = EvolutionChain['nodes'][number];
export function EvolutionExplorer({
  chain,
  currentSpeciesId,
  returnHref,
}: {
  chain: EvolutionChain;
  currentSpeciesId: number;
  returnHref: string;
}) {
  const [selection, setSelection] = useState<{
    reference: Node['species'];
    attempt: number;
  } | null>(null);
  const [result, setResult] = useState<GenerationCardResult | null>(null);
  const [loading, setLoading] = useState(false);
  const activeSelection = useRef(0);
  const scope = useId();
  useEffect(() => {
    if (!selection) return;
    const controller = new AbortController();
    const { reference, attempt } = selection;
    async function load() {
      let resolved: GenerationCardResult;
      try {
        const response = await fetch(
          `/api/catalog/generation-cards?speciesIds=${reference.speciesId}`,
          {
            cache: 'no-store',
            signal: AbortSignal.any([
              controller.signal,
              AbortSignal.timeout(140000),
            ]),
          },
        );
        const parsed = response.ok
          ? parseGenerationCards(await response.json(), [reference.speciesId])
          : null;
        if (!parsed) throw new Error('Unavailable species mapping');
        resolved = matchGenerationReference(parsed.items[0]!, reference);
      } catch {
        if (controller.signal.aborted) return;
        resolved = {
          speciesId: reference.speciesId,
          status: 'unavailable',
          code: 'UPSTREAM_UNAVAILABLE',
        };
      }
      if (controller.signal.aborted || activeSelection.current !== attempt)
        return;
      setResult(resolved);
      setLoading(false);
    }
    void load();
    return () => controller.abort();
  }, [selection]);
  function select(node: Node) {
    setResult(null);
    setLoading(true);
    // Invalidate the prior result synchronously, before effect cleanup can run.
    const attempt = ++activeSelection.current;
    setSelection({
      reference: node.species,
      attempt,
    });
  }
  function renderNode(node: Node) {
    const children = chain.nodes.filter(
      (child) => child.parentSpeciesId === node.species.speciesId,
    );
    const parent = chain.nodes.find(
      (parent) => parent.species.speciesId === node.parentSpeciesId,
    );
    const selected = selection?.reference.speciesId === node.species.speciesId;
    const panelId = `${scope}-${node.species.speciesId}`;
    return (
      <li key={node.species.speciesId}>
        <article
          className={`evolution-node${node.species.speciesId === currentSpeciesId ? ' evolution-current' : ''}`}
          aria-label={`Espécie ${node.species.name}`}
        >
          <div className="evolution-node-heading">
            <span className="evolution-symbol" aria-hidden="true">
              <GitBranch size={22} />
            </span>
            <div>
              <span className="eyebrow">Espécie #{node.species.speciesId}</span>
              <h3
                className="pokemon-name"
                aria-label={`Espécie ${node.species.name}`}
              >
                {node.species.name}
              </h3>
            </div>
          </div>
          {node.species.speciesId === currentSpeciesId && (
            <span className="evolution-current-label">
              Espécie desta entrada
            </span>
          )}
          {node.isBaby && <p className="footnote">Espécie bebê na fonte.</p>}
          <p className="evolution-parent">
            {parent ? (
              <>
                Evolui de <strong>{parent.species.name}</strong>
              </>
            ) : (
              'Raiz da cadeia'
            )}
          </p>
          {parent &&
            (node.conditions.length ? (
              <details className="evolution-conditions">
                <summary>
                  Condições para {node.species.name} · {node.conditions.length}{' '}
                  {node.conditions.length === 1 ? 'registro' : 'registros'}
                </summary>
                <p className="footnote">
                  Cada registro é uma alternativa da fonte, com requisitos
                  próprios. Identificadores originais; não combinamos versões ou
                  formas.
                </p>
                <ol className="evolution-records">
                  {node.conditions.map((condition, index) => (
                    <li key={index}>
                      <details>
                        <summary>
                          {condition.versionGroup.name} · registro {index + 1}
                        </summary>
                        <dl className="evolution-condition-data">
                          {evolutionConditionRows(condition).map((row) => (
                            <div key={row.key}>
                              <dt>{row.label}</dt>
                              <dd>{row.value}</dd>
                            </div>
                          ))}
                        </dl>
                      </details>
                    </li>
                  ))}
                </ol>
              </details>
            ) : (
              <p className="footnote">
                Requisitos não informados pela fonte. Isso não significa
                evolução sem condições.
              </p>
            ))}
          <button
            type="button"
            className="button button-secondary evolution-resolve"
            aria-controls={panelId}
            aria-expanded={selected}
            disabled={selected && loading}
            onClick={() => select(node)}
          >
            {selected && loading
              ? 'Consultando variedade…'
              : selected && result?.status === 'unavailable'
                ? 'Tentar variedade novamente'
                : `Ver Pokémon padrão de ${node.species.name}`}
          </button>
          <div id={panelId} className="evolution-variety">
            {selected && (
              <>
                <p role="status" aria-live="polite">
                  {loading
                    ? 'Validando a variedade padrão e seus dados…'
                    : result?.status === 'ready'
                      ? 'Variedade padrão encontrada.'
                      : 'Variedade ou detalhes indisponíveis. Nenhum link foi inferido.'}
                </p>
                {result?.status === 'ready' && (
                  <>
                    <PokemonCard
                      pokemon={result.summary.data}
                      fromCatalog={returnHref}
                    />
                    <p className="footnote">
                      Variedade padrão da espécie; não representa
                      necessariamente a forma indicada em cada condição.
                    </p>
                  </>
                )}
                {result?.mapping?.meta.stale && (
                  <p className="stale-notice">
                    Mapeamento salvo em{' '}
                    {new Date(result.mapping.meta.fetchedAt).toLocaleString(
                      'pt-BR',
                      { timeZone: 'America/Sao_Paulo' },
                    )}
                    .
                  </p>
                )}
                {result?.status === 'ready' && result.summary.meta.stale && (
                  <p className="stale-notice">
                    Dados do Pokémon salvos em{' '}
                    {new Date(result.summary.meta.fetchedAt).toLocaleString(
                      'pt-BR',
                      { timeZone: 'America/Sao_Paulo' },
                    )}
                    .
                  </p>
                )}
              </>
            )}
          </div>
        </article>
        {children.length > 0 && (
          <ul
            className="evolution-children"
            aria-label={`Evoluções de ${node.species.name}`}
          >
            {children.map(renderNode)}
          </ul>
        )}
      </li>
    );
  }
  return (
    <ul className="evolution-tree" aria-label="Árvore de espécies">
      {renderNode(chain.nodes[0]!)}
    </ul>
  );
}
