import { Suspense } from 'react';
import Link from 'next/link';
import { Zap } from 'lucide-react';
import { movesHref } from '../lib/moves';
import type { MovesPokemon, MovesQuery } from '../lib/moves';
import { getMoves } from '../lib/moves-server';
import { MoveList } from './move-list';
import { MoveFreshness } from './move-freshness';
import { RouteRetry } from './route-retry';

type Props = { pokemon: MovesPokemon; query: MovesQuery; returnHref: string };
async function MovesData({ pokemon, query, returnHref }: Props) {
  const base = movesHref(pokemon.id, returnHref);
  if (query.kind === 'invalid')
    return (
      <div className="description-state">
        <p role="status">
          A seleção de movimentos é inválida. Use um grupo de versões e uma
          página válidos.
        </p>
        <Link className="button button-secondary" href={base} prefetch={false}>
          Escolher versões novamente
        </Link>
      </div>
    );
  // The API requires an explicit group even for discovery. Group 1 is only a bounded
  // probe to obtain source choices: its move records are never shown without selection.
  const version = query.kind === 'selected' ? query.versionGroup : 1;
  const page = query.kind === 'selected' ? query.page : 1;
  const result = await getMoves(pokemon, version, page);
  if (result.kind !== 'ready')
    return (
      <div className="description-state">
        <p role="status">
          {result.kind === 'missing'
            ? 'Os registros de movimentos desta entrada não foram encontrados na fonte.'
            : 'Não conseguimos carregar os movimentos deste Pokémon.'}
        </p>
        <RouteRetry
          label="Tentar movimentos novamente"
          pendingLabel="Atualizando movimentos…"
        />
      </div>
    );
  const { data, meta } = result.value;
  const hidden = new URLSearchParams(base.split('?')[1]?.split('#')[0]);
  const selected = query.kind === 'selected';
  return (
    <>
      <MoveFreshness label="Registros de aprendizado" meta={meta} />
      <form
        className="moves-form"
        method="get"
        action={`/pokemon/${pokemon.id}#movimentos`}
      >
        {[...hidden].map(([name, value]) => (
          <input key={name} type="hidden" name={name} value={value} />
        ))}
        <div>
          <label>
            Grupo de versões
            <select
              name="moveVersion"
              required
              defaultValue={selected ? String(version) : ''}
            >
              <option value="" disabled>
                Escolha um grupo de versões
              </option>
              {selected && data.versionGroup === null && (
                <option value={version}>
                  Grupo #{version} · sem registros na fonte
                </option>
              )}
              {data.availableVersionGroups.map((group) => (
                <option key={group.id} value={group.id}>
                  {group.name} (#{group.id})
                </option>
              ))}
            </select>
          </label>
        </div>
        <button
          className="button button-primary"
          type="submit"
          disabled={!data.availableVersionGroups.length}
        >
          Consultar movimentos
        </button>
      </form>
      {!data.availableVersionGroups.length ? (
        <p role="status">
          A fonte não informou registros de aprendizado para esta entrada
          Pokémon.
        </p>
      ) : !selected ? (
        <p>
          Escolha um grupo para consultar os registros de aprendizado. Nenhum
          jogo foi selecionado automaticamente.
        </p>
      ) : (
        <>
          <div className="moves-results-heading">
            <h3>
              Aprendizado em {data.versionGroup?.name ?? `grupo #${version}`}
            </h3>
            <span>{data.total} movimentos registrados</span>
          </div>
          {data.items.length ? (
            <MoveList
              key={`${pokemon.id}-${version}-${page}-${meta.fetchedAt}`}
              items={data.items}
              versionGroup={data.versionGroup!.name}
            />
          ) : (
            <div className="description-state">
              <p role="status">
                {data.versionGroup === null
                  ? 'Não há registros de aprendizado para este grupo no conjunto de dados consultado.'
                  : 'Esta página não contém movimentos.'}
              </p>
              {data.versionGroup && (
                <Link
                  className="button button-secondary"
                  href={movesHref(pokemon.id, returnHref, version)}
                  prefetch={false}
                >
                  Voltar à primeira página de movimentos
                </Link>
              )}
            </div>
          )}
          <nav className="moves-pagination" aria-label="Páginas de movimentos">
            {page > 1 && (
              <Link
                className="button button-secondary"
                href={movesHref(pokemon.id, returnHref, version, page - 1)}
                prefetch={false}
              >
                Movimentos anteriores
              </Link>
            )}
            <span>Página {page}</span>
            {data.hasNext && (
              <Link
                className="button button-secondary"
                href={movesHref(pokemon.id, returnHref, version, page + 1)}
                prefetch={false}
              >
                Próximos movimentos
              </Link>
            )}
          </nav>
        </>
      )}
    </>
  );
}
export function MovesPanel(props: Props) {
  return (
    <section
      className="panel moves-panel"
      id="movimentos"
      aria-labelledby="moves-title"
    >
      <div className="panel-heading">
        <div>
          <span className="section-icon cream">
            <Zap size={20} aria-hidden="true" />
          </span>
          <h2 id="moves-title">Movimentos</h2>
        </div>
        <span className="subtle-label">POR VERSÃO</span>
      </div>
      <p className="panel-description">
        Explore os registros de aprendizado desta entrada Pokémon. Escolha as
        versões e consulte os atributos de cada movimento quando quiser.
      </p>
      <Suspense
        key={`${props.pokemon.id}-${
          props.query.kind === 'selected'
            ? `${props.query.versionGroup}-${props.query.page}`
            : props.query.kind
        }`}
        fallback={
          <p
            className="description-state"
            role="status"
            aria-label="Carregando movimentos"
          >
            Carregando registros de movimentos…
          </p>
        }
      >
        <MovesData {...props} />
      </Suspense>
      <p className="footnote moves-disclaimer">
        Nomes originais da PokéAPI. Nível zero e ordem ausente são preservados
        como informados. Ausência de registros não comprova impossibilidade no
        jogo; não avaliamos transferências, legalidade competitiva ou dano em
        batalha.
      </p>
    </section>
  );
}
