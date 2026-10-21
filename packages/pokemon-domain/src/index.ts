export const POKEMON_TYPES = [
  'normal',
  'fire',
  'water',
  'electric',
  'grass',
  'ice',
  'fighting',
  'poison',
  'ground',
  'flying',
  'psychic',
  'bug',
  'rock',
  'ghost',
  'dragon',
  'dark',
  'steel',
  'fairy',
] as const;
export type PokemonType = (typeof POKEMON_TYPES)[number];
export const STAT_NAMES = [
  'hp',
  'attack',
  'defense',
  'special-attack',
  'special-defense',
  'speed',
] as const;
export type StatName = (typeof STAT_NAMES)[number];

/** Pure unit conversion; PokéAPI height/weight use decimetres/hectograms. */
export function toMetric(value: number): number {
  if (!Number.isFinite(value) || value < 0)
    throw new RangeError('Expected a nonnegative finite measurement');
  return value / 10;
}
