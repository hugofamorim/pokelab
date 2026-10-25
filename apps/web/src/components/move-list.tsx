'use client';
import { useEffect, useId, useRef, useState } from 'react';
import type { PokemonMovesPage } from '@pokelab/contracts';
import { learnMethod, moveValue, parseMoveMetadata } from '../lib/moves';
import type { MoveMetadataResult } from '../lib/moves';
import { MoveMetadata } from './move-metadata';

export function MoveList({
  items,
  versionGroup,
}: {
  items: PokemonMovesPage['items'];
  versionGroup: string;
}) {
  const scope = useId();
  const attemptRef = useRef(0);
  const [selection, setSelection] = useState<{
    id: number;
    name: string;
    attempt: number;
  } | null>(null);
  const [result, setResult] = useState<MoveMetadataResult | null>(null);
  useEffect(() => {
    if (!selection) return;
    const { id, name, attempt } = selection;
    const controller = new AbortController();
    async function load() {
      let value: MoveMetadataResult;
      try {
        const response = await fetch(`/api/moves/${id}`, {
          cache: 'no-store',
          signal: AbortSignal.any([
            controller.signal,
            AbortSignal.timeout(50000),
          ]),
        });
        value =
          response.status === 404
            ? { kind: 'missing' }
            : response.ok
              ? parseMoveMetadata(await response.json(), { id, name })
              : { kind: 'error' };
      } catch {
        value = { kind: 'error' };
      }
      if (!controller.signal.aborted && attemptRef.current === attempt)
        setResult(value);
    }
    void load();
    return () => controller.abort();
  }, [selection]);
  function select(move: { id: number; name: string }) {
    const attempt = ++attemptRef.current;
    setResult(null);
    setSelection({ ...move, attempt });
  }
  return (
    <ul className="move-grid" aria-label={`Movimentos em ${versionGroup}`}>
      {items.map(({ move, records }) => {
        const selected = selection?.id === move.id;
        return (
          <li key={move.id} data-selected={selected}>
            <article
              className="move-card"
              aria-label={`Movimento ${move.name}`}
            >
              <div className="move-card-heading">
                <h3>{move.name}</h3>
                <span>#{move.id}</span>
              </div>
              <details className="move-records">
                <summary>Registros de aprendizado · {records.length}</summary>
                <ol>
                  {records.map((record, index) => (
                    <li key={index}>
                      <dl className="move-values">
                        <div>
                          <dt>Método</dt>
                          <dd>
                            {learnMethod(record.method.name)} (#
                            {record.method.id})
                          </dd>
                        </div>
                        <div>
                          <dt>Nível informado</dt>
                          <dd>{record.level}</dd>
                        </div>
                        <div>
                          <dt>Ordem informada</dt>
                          <dd>{moveValue(record.order)}</dd>
                        </div>
                      </dl>
                    </li>
                  ))}
                </ol>
              </details>
              <button
                type="button"
                className="button button-secondary"
                onClick={() => select(move)}
                aria-controls={`move-preview-${scope}-${move.id}`}
                aria-expanded={selected}
              >
                {selected && result && result.kind !== 'ready'
                  ? `Tentar atributos de ${move.name} novamente`
                  : `Consultar atributos atuais de ${move.name}`}
              </button>
              <div
                id={`move-preview-${scope}-${move.id}`}
                aria-live="polite"
                aria-atomic="false"
              >
                {selected &&
                  (result === null ? (
                    <p role="status">Carregando atributos de {move.name}…</p>
                  ) : result.kind === 'ready' ? (
                    <MoveMetadata
                      value={result.value}
                      versionGroup={versionGroup}
                    />
                  ) : (
                    <p role="status">
                      {result.kind === 'missing'
                        ? 'A fonte não encontrou os atributos deste movimento.'
                        : 'Não conseguimos carregar os atributos deste movimento.'}
                    </p>
                  ))}
              </div>
            </article>
          </li>
        );
      })}
    </ul>
  );
}
