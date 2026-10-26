import { describe, it, expect } from 'vitest';
import {
  combinedFilterQuerySchema,
  combinedFilterResponseSchema,
} from './index.js';

const meta = {
  source: 'pokeapi-v2',
  fetchedAt: '2026-10-25T20:00:00.000Z',
  stale: false,
};
// Synthetic shape boundary; production data comes from validated source resources.
const item = {
  reference: { id: 10100, name: 'raichu-alola' },
  status: 'match',
  data: {
    id: 10100,
    name: 'raichu-alola',
    species: { id: 26, name: 'raichu' },
    isDefault: false,
    artwork: null,
    types: ['electric', 'psychic'],
  },
  meta,
};
const body = {
  semantics: 'current-entry-type-and-species-introduction',
  type: 'electric',
  generation: { id: 1, name: 'generation-i' },
  scan: {
    afterId: 10099,
    limit: 4,
    totalCandidates: 99,
    scanned: 1,
    hasMore: false,
    nextAfterId: null,
  },
  items: [item],
  meta: { type: meta, generation: meta },
};
describe('combined filter query', () => {
  it('requires both filters and defaults to four candidates after entry zero', () => {
    expect(
      combinedFilterQuerySchema.parse({ type: 'electric', generation: '1' }),
    ).toEqual({ type: 'electric', generation: 1, after: 0, limit: 4 });
    expect(
      combinedFilterQuerySchema.parse({
        type: 'fairy',
        generation: '9',
        after: '999999',
        limit: '12',
      }),
    ).toEqual({ type: 'fairy', generation: 9, after: 999999, limit: 12 });
  });
  it.each([
    {},
    { type: 'electric' },
    { generation: '1' },
    { type: ['electric', 'water'], generation: '1' },
    { type: 'ELECTRIC', generation: '1' },
    { type: 'unknown', generation: '1' },
    { type: 'electric', generation: '10' },
    { type: 'electric', generation: ['1', '2'] },
    { type: 'electric', generation: '01' },
    { type: 'electric', generation: '1', limit: '13' },
    { type: 'electric', generation: '1', limit: '0' },
    { type: 'electric', generation: '1', after: '-1' },
    { type: 'electric', generation: '1', after: '01' },
    { type: 'electric', generation: '1', after: ' 0' },
    { type: 'electric', generation: '1', after: '1000000' },
    { type: 'electric', generation: '1', page: '2' },
    { type: 'electric', generation: '1', search: 'pikachu' },
    { type: 'electric', generation: '1', after: 0 },
  ])('rejects ambiguous or unsupported raw query %j', (value) => {
    expect(combinedFilterQuerySchema.safeParse(value).success).toBe(false);
  });
});
describe('combined filter response', () => {
  it('keeps variant entry/species separate and never invents a global match total', () => {
    expect(combinedFilterResponseSchema.safeParse(body).success).toBe(true);
    expect(
      combinedFilterResponseSchema.safeParse({ ...body, totalMatches: 1 })
        .success,
    ).toBe(false);
  });
  it.each([
    { ...body, generation: { id: 1, name: 'generation-ii' } },
    { ...body, semantics: 'game-availability' },
    { ...body, type: 'water' },
    {
      ...body,
      items: [{ ...item, reference: { ...item.reference, name: 'raichu' } }],
    },
    { ...body, items: [item, item], scan: { ...body.scan, scanned: 2 } },
    { ...body, scan: { ...body.scan, afterId: 10100 } },
    { ...body, scan: { ...body.scan, scanned: 2 } },
    { ...body, scan: { ...body.scan, hasMore: true, nextAfterId: 10100 } },
    { ...body, scan: { ...body.scan, nextAfterId: 10100 } },
    { ...body, scan: { ...body.scan, totalCandidates: 0 } },
    { ...body, scan: { ...body.scan, afterId: 0 } },
  ])('rejects contradictory identity scope ordering and progress', (value) => {
    expect(combinedFilterResponseSchema.safeParse(value).success).toBe(false);
  });
  it('requires a full window and exact exclusive cursor when candidates remain', () => {
    expect(
      combinedFilterResponseSchema.safeParse({
        ...body,
        scan: { ...body.scan, limit: 1, hasMore: true, nextAfterId: 10100 },
      }).success,
    ).toBe(true);
    expect(
      combinedFilterResponseSchema.safeParse({
        ...body,
        scan: { ...body.scan, limit: 1, hasMore: true, nextAfterId: 10101 },
      }).success,
    ).toBe(false);
  });
  it('retains failed candidates as unknown rather than an exclusion', () => {
    const input = {
      ...body,
      items: [
        {
          reference: item.reference,
          status: 'unavailable',
          code: 'POKEMON_NOT_FOUND',
        },
      ],
    };
    expect(combinedFilterResponseSchema.safeParse(input).success).toBe(true);
    expect(
      combinedFilterResponseSchema.safeParse({
        ...input,
        items: [{ ...input.items[0], code: 'private-details' }],
      }).success,
    ).toBe(false);
  });
  it('supports exclusions and completed empty scans without claiming no global matches', () => {
    expect(
      combinedFilterResponseSchema.safeParse({
        ...body,
        items: [
          { ...item, status: 'excluded', reason: 'species-not-in-generation' },
        ],
      }).success,
    ).toBe(true);
    expect(
      combinedFilterResponseSchema.safeParse({
        ...body,
        items: [],
        scan: { ...body.scan, afterId: 999999, scanned: 0 },
      }).success,
    ).toBe(true);
    expect(
      combinedFilterResponseSchema.safeParse({
        ...body,
        items: [],
        scan: { ...body.scan, afterId: 0, totalCandidates: 0, scanned: 0 },
      }).success,
    ).toBe(true);
  });
});
