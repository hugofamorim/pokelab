import {
  moveIdParamSchema,
  pokemonMovesQuerySchema,
  moveMetadataResponseSchema,
} from '@pokelab/contracts';
import type { Pokemon, MoveMetadataResponse } from '@pokelab/contracts';
import { catalogEntryHref } from './catalog-search';

export const MOVES_PAGE_SIZE = 6;
export type MovesPokemon = Pick<
  Pokemon,
  'id' | 'name' | 'species' | 'isDefault'
>;
export type MovesQuery =
  | { kind: 'choose' }
  | { kind: 'invalid' }
  | { kind: 'selected'; versionGroup: number; page: number };
export type MoveMetadataResult =
  | { kind: 'ready'; value: MoveMetadataResponse }
  | { kind: 'error' | 'missing' };
export function parseMovesQuery(
  input: Record<string, string | string[] | undefined>,
): MovesQuery {
  if (input.moveVersion === undefined)
    return input.movePage === undefined
      ? { kind: 'choose' }
      : { kind: 'invalid' };
  const parsed = pokemonMovesQuerySchema.safeParse({
    versionGroup: input.moveVersion,
    page: input.movePage,
    pageSize: String(MOVES_PAGE_SIZE),
  });
  return parsed.success
    ? {
        kind: 'selected',
        versionGroup: parsed.data.versionGroup,
        page: parsed.data.page,
      }
    : { kind: 'invalid' };
}
export function movesHref(
  id: number,
  returnHref: string,
  versionGroup?: number,
  page = 1,
) {
  const base = catalogEntryHref(id, returnHref);
  const query = new URLSearchParams(base.split('?')[1]);
  if (versionGroup !== undefined) {
    query.set('moveVersion', String(versionGroup));
    query.set('movePage', String(page));
  }
  return `/pokemon/${id}?${query}#movimentos`;
}
export function parseMoveMetadata(
  input: unknown,
  move: { id: number; name: string },
): MoveMetadataResult {
  const parsed = moveMetadataResponseSchema.safeParse(input);
  return parsed.success &&
    parsed.data.data.move.id === move.id &&
    parsed.data.data.move.name === move.name
    ? { kind: 'ready', value: parsed.data }
    : { kind: 'error' };
}
export const validMoveId = (id: string) => moveIdParamSchema.safeParse(id);
export function moveValue(value: number | null, historical = false) {
  return value === null
    ? historical
      ? 'Sem alteração informada'
      : 'Não informado'
    : String(value);
}
export function learnMethod(name: string) {
  const labels: Record<string, string> = {
    'level-up': 'Por nível',
    machine: 'Máquina',
    tutor: 'Tutor',
    egg: 'Ovo',
    'light-ball-egg': 'Ovo com Light Ball',
    'form-change': 'Mudança de forma',
  };
  return labels[name] ? `${labels[name]} · ${name}` : name;
}
