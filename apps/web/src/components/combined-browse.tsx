import Link from 'next/link';
import { getCombinedWindow } from '../lib/combined-catalog-server';
import { combinedHref } from '../lib/combined-catalog';
import type { CombinedCatalogInput } from '../lib/combined-catalog';
import { POKEMON_TYPE_TOKENS } from '../lib/type-tokens';
import { PokemonCard } from './pokemon-card';
import { RouteRetry } from './route-retry';
import type { SourceMetadata } from '@pokelab/contracts';

function Freshness({ label, meta }: { label: string; meta: SourceMetadata }) {
  return (
    <p className={meta.stale ? 'stale-notice' : 'combined-freshness'}>
      {label}:{' '}
      <time dateTime={meta.fetchedAt}>
        {new Date(meta.fetchedAt).toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
        })}
      </time>
      .{meta.stale && ' Dados salvos; a fonte está indisponível no momento.'}
    </p>
  );
}
export async function CombinedBrowse({
  input,
}: {
  input: CombinedCatalogInput;
}) {
  const restart = combinedHref({
    type: input.type,
    generation: input.generation,
  });
  const result = await getCombinedWindow(input);
  if (result.kind !== 'ready')
    return (
      <section className="catalog-state" role="status">
        <h2>
          {result.kind === 'changed'
            ? 'Os índices foram atualizados'
            : 'Não conseguimos consultar este grupo'}
        </h2>
        <p>
          {result.kind === 'changed'
            ? 'Reinicie a consulta para usar os novos índices de tipo e geração.'
            : 'Aguarde um pouco e tente novamente. O ponto da consulta foi preservado.'}
        </p>
        {result.kind === 'error' && (
          <RouteRetry
            label="Tentar este grupo novamente"
            pendingLabel="Consultando grupo…"
          />
        )}
        <Link
          className="button button-secondary"
          href={restart}
          prefetch={false}
        >
          Reiniciar consulta
        </Link>
      </section>
    );
  const { value } = result;
  const returnHref = combinedHref({
    ...input,
    typeAt: value.meta.type.fetchedAt,
    generationAt: value.meta.generation.fetchedAt,
  });
  const matches = value.items.filter((item) => item.status === 'match');
  const unknown = value.items.filter((item) => item.status === 'unavailable');
  const excluded = value.items.filter((item) => item.status === 'excluded');
  return (
    <section
      className="combined-results"
      aria-label="Consulta por tipo e geração"
    >
      <div className="catalog-toolbar">
        <h2>
          {POKEMON_TYPE_TOKENS[value.type].label} · geração{' '}
          {value.generation.name.replace('generation-', '').toUpperCase()}
        </h2>
        <span>Consulta por grupos de até 4 candidatos</span>
      </div>
      <p className="generation-description">
        Tipo atual de cada Pokémon e geração de introdução da sua espécie,
        incluindo variedades não padrão. Não representa tipos históricos, a
        estreia de cada variedade ou disponibilidade em jogos.
      </p>
      <details className="combined-sources">
        <summary>Fontes desta consulta</summary>
        <Freshness label="Índice de tipo" meta={value.meta.type} />
        <Freshness label="Índice de geração" meta={value.meta.generation} />
      </details>
      {(value.meta.type.stale || value.meta.generation.stale) && (
        <p className="stale-notice">
          Esta consulta usa pelo menos um índice salvo enquanto a fonte está
          indisponível.
        </p>
      )}
      <p role="status">
        Neste grupo: {value.scan.scanned} avaliados, {matches.length}{' '}
        encontrados, {excluded.length} fora da geração e {unknown.length} sem
        confirmação.
      </p>
      <p className="generation-description">
        O índice de tipo tem {value.scan.totalCandidates} candidatos antes do
        filtro de geração. Esse número não é o total de resultados combinados.
        Cada grupo substitui o anterior; use o histórico do navegador para
        voltar.
      </p>
      {matches.length > 0 ? (
        <ul
          className="catalog-grid generation-grid"
          aria-label="Pokémon encontrados neste grupo"
        >
          {matches.map((item) => (
            <li key={item.reference.id}>
              <PokemonCard pokemon={item.data} fromCatalog={returnHref} />
              <p className="generation-species-name">
                Espécie: {item.data.species.name} ·{' '}
                {item.data.isDefault
                  ? 'Variedade padrão'
                  : 'Variedade não padrão'}
              </p>
              <Freshness
                label={`Dados de ${item.data.name}`}
                meta={item.meta}
              />
            </li>
          ))}
        </ul>
      ) : (
        <p className="combined-empty">
          Nenhum resultado confirmado neste grupo.
          {value.scan.hasMore
            ? ' Há mais candidatos para consultar.'
            : ' Este é o fim dos candidatos.'}
          {unknown.length > 0 &&
            ' Há candidatos sem confirmação; isso não significa ausência de resultados.'}
        </p>
      )}
      {unknown.length > 0 && (
        <div className="combined-unknown">
          <h3>Candidatos sem confirmação</h3>
          <p>
            Falhas não são exclusões. Você pode repetir este grupo antes de
            continuar.
          </p>
          <ul>
            {unknown.map((item) => (
              <li key={item.reference.id}>
                #{item.reference.id} · {item.reference.name} — dados
                indisponíveis
              </li>
            ))}
          </ul>
          <RouteRetry
            label="Tentar este grupo novamente"
            pendingLabel="Consultando grupo…"
          />
        </div>
      )}
      {excluded.length > 0 && (
        <details className="combined-sources">
          <summary>Fora da geração neste grupo ({excluded.length})</summary>
          <ul>
            {excluded.map((item) => (
              <li key={item.reference.id}>
                {item.data.name} · espécie {item.data.species.name}
                <Freshness label="Dados do Pokémon" meta={item.meta} />
              </li>
            ))}
          </ul>
        </details>
      )}
      <nav className="combined-actions" aria-label="Avançar consulta combinada">
        <Link
          className="button button-secondary"
          href={restart}
          prefetch={false}
        >
          Reiniciar consulta
        </Link>
        {value.scan.hasMore && value.scan.nextAfterId !== null ? (
          <Link
            className="button button-primary"
            href={combinedHref({
              ...input,
              after: String(value.scan.nextAfterId),
              typeAt: value.meta.type.fetchedAt,
              generationAt: value.meta.generation.fetchedAt,
            })}
            prefetch={false}
          >
            Consultar próximos candidatos
          </Link>
        ) : (
          <p>
            Fim dos candidatos
            {unknown.length
              ? ' deste índice; este grupo ainda tem dados sem confirmação'
              : ' deste índice'}
            . Não há um total acumulado de resultados.
          </p>
        )}
      </nav>
    </section>
  );
}
