import { Suspense } from 'react';
import { BookOpen } from 'lucide-react';
import { getSpeciesDescription } from '../lib/species-description';
import { DescriptionRetry } from './description-retry';
import type { Pokemon } from '@pokelab/contracts';
type Props = { species: Pokemon['species'] };

async function Description({ species }: Props) {
  const result = await getSpeciesDescription(species);
  if (result.kind !== 'ready')
    return (
      <div className="description-state" role="status">
        <p>
          {result.kind === 'missing'
            ? 'A descrição desta espécie não foi encontrada na fonte.'
            : 'Não conseguimos carregar a descrição da espécie.'}
        </p>
        <DescriptionRetry />
      </div>
    );
  const { data, meta } = result.value;
  return (
    <>
      {meta.stale && (
        <p className="stale-notice" role="status">
          Descrição salva em{' '}
          {new Date(meta.fetchedAt).toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
          })}
          . A fonte está indisponível no momento.
        </p>
      )}
      {data.description ? (
        <>
          <p
            className="species-flavor"
            lang={data.description.language === 'en' ? 'en' : 'pt-BR'}
          >
            {data.description.text}
          </p>
          <p className="footnote">
            {data.description.language === 'en'
              ? 'Texto original em inglês; português brasileiro indisponível.'
              : 'Texto original em português brasileiro.'}{' '}
            Versão de origem: <strong>{data.description.version}</strong> ·
            PokéAPI v2.
          </p>
        </>
      ) : (
        <p className="description-state">
          A fonte não fornece descrição em português brasileiro ou inglês para
          esta espécie.
        </p>
      )}
    </>
  );
}

export function SpeciesDescription({ species }: Props) {
  return (
    <section
      className="panel species-description"
      id="sobre-especie"
      aria-labelledby="species-description-title"
    >
      <div className="panel-heading">
        <div>
          <span className="section-icon cream">
            <BookOpen size={20} aria-hidden="true" />
          </span>
          <h2 id="species-description-title">Sobre a espécie</h2>
        </div>
      </div>
      <p className="panel-description">
        Registro da espécie {species.name} · #{species.id}. Os atributos acima
        pertencem à entrada Pokémon selecionada.
      </p>
      <Suspense
        fallback={
          <p
            role="status"
            aria-label="Carregando descrição"
            className="description-state"
          >
            Carregando descrição da espécie…
          </p>
        }
      >
        <Description species={species} />
      </Suspense>
      <p className="footnote">
        A versão identifica a origem do registro. O texto pode variar entre
        jogos.
      </p>
    </section>
  );
}
