import type { EvolutionChain } from '@pokelab/contracts';

export type EvolutionCondition =
  EvolutionChain['nodes'][number]['conditions'][number];
export const evolutionConditionLabels = {
  versionGroup: 'Grupo de versões',
  isDefault: 'Padrão no registro da fonte',
  trigger: 'Gatilho',
  item: 'Item de evolução',
  gender: 'Código de gênero',
  heldItem: 'Item segurado',
  knownMove: 'Movimento conhecido',
  knownMoveType: 'Tipo de movimento conhecido',
  location: 'Local',
  minLevel: 'Nível mínimo',
  minHappiness: 'Felicidade mínima',
  minBeauty: 'Beleza mínima',
  minAffection: 'Afeição mínima',
  nearSpecialRock: 'Exige rocha especial',
  needsMultiplayer: 'Exige multijogador',
  needsOverworldRain: 'Exige chuva no mundo',
  partySpecies: 'Espécie na equipe',
  partyType: 'Tipo na equipe',
  relativePhysicalStats: 'Relação entre atributos',
  timeOfDay: 'Período',
  tradeSpecies: 'Espécie recebida na troca',
  turnUpsideDown: 'Exige virar o dispositivo',
  region: 'Região',
  requiredPokemonForm: 'Forma exigida (Pokémon Form)',
  evolvedPokemonForm: 'Forma resultante (Pokémon Form)',
  usedMove: 'Movimento usado',
  minMoveCount: 'Número mínimo de usos',
  minSteps: 'Passos mínimos',
  minDamageTaken: 'Dano recebido mínimo',
  allowedNatures: 'Naturezas permitidas',
  conditionExpression: 'Expressão do registro (sem avaliação)',
} satisfies Record<keyof EvolutionCondition, string>;

function formatValue(
  value: EvolutionCondition[keyof EvolutionCondition],
): string {
  if (value === null || value === '') return 'Não indicado no registro';
  if (typeof value === 'boolean') return value ? 'Sim' : 'Não';
  if (typeof value === 'number' || typeof value === 'string')
    return String(value);
  if (Array.isArray(value))
    return value.length
      ? value.map((item) => `${item.name} (#${item.id})`).join(', ')
      : 'Nenhuma informada';
  if ('id' in value) return `${value.name} (#${value.id})`;
  return `${value.expression} · Percentual informado pela fonte: ${value.percentageChance === null ? 'não indicado' : value.percentageChance + '%'} · Variáveis: ${value.variables.map((item) => `${item.name} (#${item.id})`).join(', ') || 'nenhuma informada'}`;
}
export function evolutionConditionRows(condition: EvolutionCondition) {
  return (
    Object.entries(evolutionConditionLabels) as [
      keyof EvolutionCondition,
      string,
    ][]
  ).map(([key, label]) => ({
    key,
    label,
    value:
      key === 'relativePhysicalStats' &&
      condition.relativePhysicalStats !== null
        ? {
            '-1': 'Ataque < Defesa',
            '0': 'Ataque = Defesa',
            '1': 'Ataque > Defesa',
          }[condition.relativePhysicalStats]
        : key === 'timeOfDay' && condition.timeOfDay !== ''
          ? {
              day: 'Dia',
              night: 'Noite',
              dusk: 'Entardecer',
              'full-moon': 'Lua cheia',
            }[condition.timeOfDay]
          : formatValue(condition[key]),
  }));
}
