import { Suspense } from 'react';
import { GitBranch } from 'lucide-react';
import type { Pokemon, SourceMetadata } from '@pokelab/contracts';
import { getEvolution } from '../lib/evolution-server';
import { EvolutionExplorer } from './evolution-explorer';
import { RouteRetry } from './route-retry';
type Props = { species: Pokemon['species']; returnHref: string };
function Freshness({ label, meta }: { label: string; meta: SourceMetadata }) {
  return (
    <p className={meta.stale ? 'stale-notice' : 'footnote'}>
      {label} {meta.stale ? 'salva' : 'consultada'} em{' '}
      <time dateTime={meta.fetchedAt}>
        {new Date(meta.fetchedAt).toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
        })}
      </time>
      {meta.stale ? '. A fonte está indisponível no momento.' : '.'}
    </p>
  );
}
async function EvolutionData({ species, returnHref }: Props) {
  const result = await getEvolution(species);
  if (result.kind !== 'ready')
    return (
      <div className="description-state">
        <p role="status">
          {result.kind === 'missing'
            ? 'Os dados de evolução desta espécie não foram encontrados na fonte.'
            : 'Não conseguimos carregar as evoluções desta espécie.'}
        </p>
        <RouteRetry
          label="Tentar evoluções novamente"
          pendingLabel="Atualizando evoluções…"
        />
      </div>
    );
  const { data, meta } = result.value;
  return (
    <>
      <Freshness label="Referência da espécie" meta={meta.species} />
      {meta.chain && (
        <Freshness label="Cadeia de evoluções" meta={meta.chain} />
      )}
      {data.chain === null ? (
        <p>A fonte não informou uma cadeia de evolução para esta espécie.</p>
      ) : (
        <>
          {data.chain.nodes.length === 1 && (
            <p>
              Esta cadeia contém apenas uma espécie, sem evoluções listadas.
            </p>
          )}
          {data.chain.babyTriggerItem && (
            <p className="footnote">
              Item relacionado ao nascimento da espécie bebê:{' '}
              {data.chain.babyTriggerItem.name} (#
              {data.chain.babyTriggerItem.id}). Este registro trata de
              reprodução, não de um item de evolução.
            </p>
          )}
          <EvolutionExplorer
            key={`${species.id}-${data.chain.chainId}-${meta.chain?.fetchedAt}`}
            chain={data.chain}
            currentSpeciesId={species.id}
            returnHref={returnHref}
          />
        </>
      )}
    </>
  );
}
export function EvolutionPanel(props: Props) {
  return (
    <section
      className="panel evolution-panel"
      id="evolucoes"
      aria-labelledby="evolution-title"
    >
      <div className="panel-heading">
        <div>
          <span className="section-icon cream">
            <GitBranch size={20} aria-hidden="true" />
          </span>
          <h2 id="evolution-title">Evoluções</h2>
        </div>
      </div>
      <p className="panel-description">
        Uma árvore de espécies, com as ramificações e os registros da PokéAPI.
        Abra as condições para consultar versões e formas.
      </p>
      <Suspense
        fallback={
          <p
            className="description-state"
            role="status"
            aria-label="Carregando evoluções"
          >
            Carregando a cadeia de evoluções…
          </p>
        }
      >
        <EvolutionData {...props} />
      </Suspense>
      <p className="footnote evolution-disclaimer">
        Condições variam por versão, região e forma. Não avaliamos elegibilidade
        nem executamos expressões; percentuais são metadados da fonte. Consultar
        uma variedade padrão não confirma disponibilidade em um jogo.
      </p>
    </section>
  );
}
