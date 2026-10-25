import { describe, it, expect } from 'vitest';
import {
  pokemonMovesQuerySchema,
  pokemonLearnsetSchema,
  pokemonMovesResponseSchema,
  moveMetadataSchema,
} from './index.js';

const ref = (id: number, name: string) => ({ id, name });
const record = {
  versionGroup: ref(1, 'red-blue'),
  method: ref(1, 'level-up'),
  level: 0,
  order: null,
};
const move = { move: ref(85, 'thunderbolt'), records: [record] };
const learnset = {
  pokemon: ref(10080, 'pikachu-rock-star'),
  species: { speciesId: 25, name: 'pikachu' },
  isDefault: false,
  moves: [move],
};
const page = {
  pokemon: learnset.pokemon,
  species: learnset.species,
  isDefault: false,
  requestedVersionGroupId: 1,
  versionGroup: record.versionGroup,
  availableVersionGroups: [record.versionGroup],
  items: [move],
  page: 1,
  pageSize: 20,
  total: 1,
  hasNext: false,
};
const meta = {
  source: 'pokeapi-v2',
  fetchedAt: '2026-10-25T12:00:00.000Z',
  stale: false,
};

describe('move contracts', () => {
  it('requires a canonical explicit version group and supplies bounded page defaults', () => {
    expect(pokemonMovesQuerySchema.parse({ versionGroup: '1' })).toEqual({
      versionGroup: 1,
      page: 1,
      pageSize: 20,
    });
  });
  it.each([
    {},
    { versionGroup: '0' },
    { versionGroup: '01' },
    { versionGroup: ' 1' },
    { versionGroup: ['1', '2'] },
    { versionGroup: '1', type: 'electric' },
    { versionGroup: '1', pageSize: '51' },
    { versionGroup: '1', page: '1001' },
    { versionGroup: '1e1' },
    { versionGroup: '9999999' },
    { versionGroup: 1 },
  ])('rejects unsupported query %j', (value) => {
    expect(pokemonMovesQuerySchema.safeParse(value).success).toBe(false);
  });
  it('preserves form/species identity, zero levels, null order and multiple source records', () => {
    const input = {
      ...learnset,
      moves: [
        {
          ...move,
          records: [record, { ...record, method: ref(4, 'machine'), order: 0 }],
        },
      ],
    };
    expect(pokemonLearnsetSchema.parse(input)).toEqual(input);
  });
  it.each([
    { ...learnset, moves: [move, move] },
    { ...learnset, moves: [{ ...move, records: [record, record] }] },
    { ...learnset, moves: [{ ...move, records: [{ ...record, level: 101 }] }] },
    { ...learnset, moves: [{ ...move, records: [{ ...record, order: -1 }] }] },
    {
      ...learnset,
      moves: [
        {
          ...move,
          records: [
            record,
            { ...record, level: 5, versionGroup: ref(1, 'wrong') },
          ],
        },
      ],
    },
    {
      ...learnset,
      moves: [
        {
          ...move,
          records: [
            record,
            { ...record, level: 5, method: ref(2, 'level-up') },
          ],
        },
      ],
    },
  ])('rejects duplicate or contradictory learning records', (value) => {
    expect(pokemonLearnsetSchema.safeParse(value).success).toBe(false);
  });
  it('validates page count, version identity, uniqueness and independent source metadata', () => {
    expect(
      pokemonMovesResponseSchema.safeParse({ data: page, meta }).success,
    ).toBe(true);
    for (const data of [
      { ...page, total: 2 },
      { ...page, hasNext: true },
      { ...page, versionGroup: ref(2, 'yellow') },
      { ...page, requestedVersionGroupId: 2 },
      { ...page, availableVersionGroups: [] },
      { ...page, items: [move, move], total: 2 },
    ]) {
      expect(pokemonMovesResponseSchema.safeParse({ data, meta }).success).toBe(
        false,
      );
    }
  });
  it('allows an absent group as absence of source records, and an out-of-range empty page', () => {
    expect(
      pokemonMovesResponseSchema.safeParse({
        data: {
          ...page,
          requestedVersionGroupId: 99,
          versionGroup: null,
          items: [],
          total: 0,
        },
        meta,
      }).success,
    ).toBe(true);
    expect(
      pokemonMovesResponseSchema.safeParse({
        data: { ...page, page: 2, items: [] },
        meta,
      }).success,
    ).toBe(true);
  });
  it('requires an explicit current snapshot, preserving nullable values and historical boundaries', () => {
    const value = {
      move: ref(204, 'charm'),
      snapshot: 'current-source',
      type: ref(18, 'fairy'),
      damageClass: ref(1, 'status'),
      power: null,
      pp: 20,
      accuracy: 100,
      priority: 0,
      historicalChanges: [
        {
          versionGroup: ref(15, 'x-y'),
          type: ref(1, 'normal'),
          power: null,
          pp: null,
          accuracy: null,
        },
      ],
    };
    expect(moveMetadataSchema.parse(value)).toEqual(value);
    expect(
      moveMetadataSchema.safeParse({ ...value, snapshot: 'red-blue' }).success,
    ).toBe(false);
    expect(
      moveMetadataSchema.safeParse({
        ...value,
        historicalChanges: [
          ...value.historicalChanges,
          ...value.historicalChanges,
        ],
      }).success,
    ).toBe(false);
  });
});
