import { pokemonTypeSchema } from '@pokelab/contracts';
import type { MoveMetadataResponse } from '@pokelab/contracts';
import { moveValue } from '../lib/moves';
import { TypeBadge } from './type-badge';
import { MoveFreshness } from './move-freshness';

export function MoveMetadata({
  value,
  versionGroup,
}: {
  value: MoveMetadataResponse;
  versionGroup: string;
}) {
  const { data, meta } = value;
  const type = pokemonTypeSchema.safeParse(data.type.name);
  return (
    <div className="move-metadata">
      <h4>Atributos atuais da fonte</h4>
      <p className="footnote">
        Estes valores não foram recalculados para {versionGroup}. O aprendizado
        acima pertence ao grupo escolhido; estes atributos são uma consulta
        atual.
      </p>
      <MoveFreshness label="Atributos do movimento" meta={meta} />
      <dl className="move-values">
        <div>
          <dt>Tipo atual</dt>
          <dd>
            {type.success ? <TypeBadge type={type.data} /> : data.type.name}{' '}
            <small>#{data.type.id}</small>
          </dd>
        </div>
        <div>
          <dt>Classe atual</dt>
          <dd>
            {data.damageClass.name} <small>#{data.damageClass.id}</small>
          </dd>
        </div>
        <div>
          <dt>Potência</dt>
          <dd>{moveValue(data.power)}</dd>
        </div>
        <div>
          <dt>Precisão</dt>
          <dd>
            {data.accuracy === null ? moveValue(null) : `${data.accuracy}%`}
          </dd>
        </div>
        <div>
          <dt>PP</dt>
          <dd>{moveValue(data.pp)}</dd>
        </div>
        <div>
          <dt>Prioridade</dt>
          <dd>{data.priority}</dd>
        </div>
      </dl>
      <details className="move-history">
        <summary>
          Alterações históricas publicadas · {data.historicalChanges.length}
        </summary>
        <p className="footnote">
          Campos sem alteração informada não definem o valor efetivo de uma
          versão. Mantemos o grupo de referência da fonte; não calculamos
          atributos históricos de batalha.
        </p>
        {data.historicalChanges.length ? (
          <ul>
            {data.historicalChanges.map((change) => (
              <li key={change.versionGroup.id}>
                <strong>
                  {change.versionGroup.name} (#{change.versionGroup.id})
                </strong>
                <dl className="move-values">
                  <div>
                    <dt>Tipo anterior</dt>
                    <dd>
                      {change.type
                        ? `${change.type.name} (#${change.type.id})`
                        : 'Sem alteração informada'}
                    </dd>
                  </div>
                  <div>
                    <dt>Potência anterior</dt>
                    <dd>{moveValue(change.power, true)}</dd>
                  </div>
                  <div>
                    <dt>Precisão anterior</dt>
                    <dd>{moveValue(change.accuracy, true)}</dd>
                  </div>
                  <div>
                    <dt>PP anterior</dt>
                    <dd>{moveValue(change.pp, true)}</dd>
                  </div>
                </dl>
              </li>
            ))}
          </ul>
        ) : (
          <p>Nenhuma alteração desses campos foi publicada neste registro.</p>
        )}
      </details>
    </div>
  );
}
