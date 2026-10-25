import {
  Activity,
  ArrowDown,
  Database,
  Feather,
  Ruler,
  Scale,
  Sparkles,
} from 'lucide-react';
import type { PokemonResponse } from '@pokelab/contracts';
import type { StatName } from '@pokelab/pokemon-domain';
import type { CSSProperties } from 'react';
import { POKEMON_TYPE_TOKENS } from '../lib/type-tokens';
import { PokemonArtwork } from './pokemon-artwork';
import { TypeBadge } from './type-badge';
import { SpeciesDescription } from './species-description';
import { EvolutionPanel } from './evolution-panel';
import { MovesPanel } from './moves-panel';
import type { MovesQuery } from '../lib/moves';
import { DetailTabs } from './detail-tabs';
const statLabels: Record<StatName, string> = {
  hp: 'HP',
  attack: 'Ataque',
  defense: 'Defesa',
  'special-attack': 'Ataque especial',
  'special-defense': 'Defesa especial',
  speed: 'Velocidade',
};
const number = new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 1 });
export function PokemonDetail({
  data: p,
  meta,
  catalogReturn = '/pokedex?page=1',
  movesQuery = { kind: 'choose' },
}: PokemonResponse & { catalogReturn?: string; movesQuery?: MovesQuery }) {
  const accent = POKEMON_TYPE_TOKENS[p.types[0] ?? 'normal'];
  const total = p.stats.reduce((sum, stat) => sum + stat.value, 0);
  return (
    <div
      className="detail-page"
      style={
        {
          '--type-soft': accent.soft,
          '--type-solid': accent.solid,
        } as CSSProperties
      }
    >
      <div className="page-heading">
        <div>
          <span className="eyebrow">
            <span className="tiny-spark">✦</span> UM MUNDO PARA DESCOBRIR
          </span>
          <h1>Todo Pokémon tem uma história.</h1>
          <p>O primeiro passo é conhecer seus detalhes.</p>
        </div>
        <span className="page-chip">
          <BookIcon />
          DADOS DA POKÉAPI
        </span>
      </div>
      {meta.stale && (
        <p className="stale-notice" role="status">
          Exibindo dados salvos em{' '}
          {new Date(meta.fetchedAt).toLocaleString('pt-BR', {
            timeZone: 'America/Sao_Paulo',
          })}
          . A PokéAPI está indisponível no momento.
        </p>
      )}
      <section className="pokemon-hero" aria-labelledby="pokemon-title">
        <div className="hero-copy">
          <div className="hero-number">
            <span className="eyebrow">POKÉMON EM DESTAQUE</span>
            <span>Nº {String(p.id).padStart(4, '0')}</span>
          </div>
          <h2 id="pokemon-title" className="pokemon-name">
            {p.name}
          </h2>
          <div className="badges">
            {p.types.map((type) => (
              <TypeBadge key={type} type={type} />
            ))}
          </div>
          <p className="hero-description">
            Um olhar mais de perto nos tipos, nas habilidades e nos atributos
            que fazem cada Pokémon ser único.
          </p>
          <div className="measurements">
            <div>
              <Ruler size={19} aria-hidden="true" />
              <span>
                Altura
                <strong>
                  {number.format(p.heightMeters)} <small>m</small>
                </strong>
              </span>
            </div>
            <div>
              <Scale size={19} aria-hidden="true" />
              <span>
                Peso
                <strong>
                  {number.format(p.weightKg)} <small>kg</small>
                </strong>
              </span>
            </div>
          </div>
          <a className="button button-primary" href="#atributos">
            Explorar atributos
            <ArrowDown size={16} aria-hidden="true" />
          </a>
        </div>
        <div className="hero-visual">
          <div className="pokemon-halo" />
          <span className="decoration star-one" aria-hidden="true">
            ✦
          </span>
          <span className="decoration star-two" aria-hidden="true">
            ✦
          </span>
          <span className="orbit-dot" />
          <PokemonArtwork key={p.id} src={p.artwork} name={p.name} priority />
          <span className="art-caption">Ilustração oficial · PokéAPI</span>
        </div>
      </section>
      <DetailTabs
        panels={{
          atributos: (
            <section className="panel stats-panel" id="atributos">
              <div className="panel-heading">
                <div>
                  <span className="section-icon">
                    <Activity size={20} />
                  </span>
                  <h2>Atributos base</h2>
                </div>
                <span className="subtle-label">BASE STATS</span>
              </div>
              <p className="panel-description">
                Os números que compõem este Pokémon.
              </p>
              <div className="stat-list">
                {p.stats.map((stat) => (
                  <div className="stat-row" key={stat.name}>
                    <span>{statLabels[stat.name]}</span>
                    <strong>{stat.value}</strong>
                    <meter
                      min={0}
                      max={255}
                      value={stat.value}
                      aria-label={`${statLabels[stat.name]}: ${stat.value} de 255`}
                    />
                  </div>
                ))}
              </div>
              <div className="stat-total">
                <span>Total dos atributos</span>
                <strong>{total}</strong>
              </div>
              <p className="footnote">
                Barras na escala de 0 a 255 por atributo. Não representam dano
                ou probabilidade de vitória.
              </p>
            </section>
          ),
          habilidades: (
            <section className="panel" id="habilidades">
              <div className="panel-heading">
                <div>
                  <span className="section-icon lavender">
                    <Sparkles size={20} />
                  </span>
                  <h2>Habilidades</h2>
                </div>
              </div>
              <p className="panel-description">
                Habilidades listadas para este Pokémon.
              </p>
              <div className="ability-list">
                {p.abilities.length ? (
                  p.abilities.map((ability) => (
                    <div className="ability" key={ability.name}>
                      <span className="ability-symbol">
                        <Feather size={18} />
                      </span>
                      <strong>{ability.name.replaceAll('-', ' ')}</strong>
                      {ability.hidden && (
                        <span className="hidden-label">Oculta</span>
                      )}
                    </div>
                  ))
                ) : (
                  <p>Nenhuma habilidade disponível na fonte.</p>
                )}
              </div>
              <p className="footnote">
                Nomes originais da fonte, em inglês. Efeitos em batalha não são
                calculados.
              </p>
            </section>
          ),
          dados: (
            <section className="panel data-panel" id="dados">
              <div className="panel-heading">
                <div>
                  <span className="section-icon cream">
                    <Database size={20} />
                  </span>
                  <h2>Identidade & origem</h2>
                </div>
              </div>
              <dl>
                <div>
                  <dt>Espécie</dt>
                  <dd>
                    {p.species.name} <span>#{p.species.id}</span>
                  </dd>
                </div>
                <div>
                  <dt>Entrada Pokémon</dt>
                  <dd>#{p.id}</dd>
                </div>
                <div>
                  <dt>Forma padrão</dt>
                  <dd>{p.isDefault ? 'Sim' : 'Não · variante'}</dd>
                </div>
                <div>
                  <dt>Fonte</dt>
                  <dd>PokéAPI v2</dd>
                </div>
              </dl>
              <p className="footnote">
                Espécie e forma são conceitos distintos. Os atributos base
                pertencem a esta entrada Pokémon.
              </p>
            </section>
          ),
          'sobre-especie': <SpeciesDescription species={p.species} />,
          evolucoes: (
            <EvolutionPanel species={p.species} returnHref={catalogReturn} />
          ),
          movimentos: (
            <MovesPanel
              pokemon={p}
              query={movesQuery}
              returnHref={catalogReturn}
            />
          ),
        }}
      />
      <div className="explore-note">
        <span className="note-icon">
          <FlaskIcon />
        </span>
        <div>
          <strong>Curiosidade é o começo de toda estratégia.</strong>
          <p>
            Continue explorando espécies e suas ramificações na Pokédex.
            Consulte movimentos por versão para continuar suas descobertas.
          </p>
        </div>
        <span className="outline-chip">EM CONSTRUÇÃO</span>
      </div>
    </div>
  );
}
function BookIcon() {
  return <Database size={14} aria-hidden="true" />;
}
function FlaskIcon() {
  return <Sparkles size={24} aria-hidden="true" />;
}
