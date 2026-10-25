import { describe, it, expect } from 'vitest';
import {
  evolutionChainSchema,
  speciesEvolutionDataSchema,
  EVOLUTION_LIMITS,
} from './evolution.js';
import { speciesEvolutionResponseSchema } from './index.js';
const root = {
  species: { speciesId: 133, name: 'eevee' },
  parentSpeciesId: null,
  isBaby: false,
  conditions: [],
};
const child = (id: number, parent = 133) => ({
  species: { speciesId: id, name: 'species-' + id },
  parentSpeciesId: parent,
  isBaby: false,
  conditions: [],
});
const chain = {
  chainId: 67,
  babyTriggerItem: null,
  nodes: [root, child(134), child(135)],
};
describe('bounded species evolution trees', () => {
  it('preserves branching, unknown conditions and a valid single-node family', () => {
    expect(evolutionChainSchema.parse(chain)).toEqual(chain);
    expect(
      evolutionChainSchema.parse({ ...chain, nodes: [root] }).nodes,
    ).toHaveLength(1);
  });
  it.each([
    { nodes: [] },
    { nodes: [{ ...root, parentSpeciesId: 134 }, child(134)] },
    { nodes: [root, { ...child(134), parentSpeciesId: null }] },
    { nodes: [root, child(134, 999)] },
    { nodes: [root, child(134, 134)] },
    { nodes: [root, child(134), child(134)] },
    {
      nodes: [
        root,
        { ...child(134), species: { speciesId: 134, name: 'eevee' } },
      ],
    },
    { nodes: [root, child(134, 135), child(135)] },
    {
      nodes: [
        ...Array.from({ length: 65 }, (_, i) => (i === 0 ? root : child(i))),
      ],
    },
    {
      nodes: [
        root,
        ...Array.from({ length: 8 }, (_, i) =>
          child(200 + i, i === 0 ? 133 : 199 + i),
        ),
      ],
    },
    { chainId: 0 },
    { babyTriggerItem: { id: 1, name: 'item', url: 'https://example.org' } },
  ])(
    'rejects ambiguous, disconnected, cyclic, excessive or malformed normalized metadata',
    (patch) => {
      expect(
        evolutionChainSchema.safeParse({ ...chain, ...patch }).success,
      ).toBe(false);
    },
  );
  it('accepts the exact node and depth boundaries', () => {
    expect(
      evolutionChainSchema.safeParse({
        ...chain,
        nodes: [
          root,
          ...Array.from({ length: EVOLUTION_LIMITS.maxNodes - 1 }, (_, i) =>
            child(200 + i),
          ),
        ],
      }).success,
    ).toBe(true);
    expect(
      evolutionChainSchema.safeParse({
        ...chain,
        nodes: [
          root,
          ...Array.from({ length: 7 }, (_, i) =>
            child(200 + i, i === 0 ? 133 : 199 + i),
          ),
        ],
      }).success,
    ).toBe(true);
  });
  it('requires the requested species ID and name to belong to the returned chain', () => {
    expect(
      speciesEvolutionDataSchema.safeParse({ species: root.species, chain })
        .success,
    ).toBe(true);
    expect(
      speciesEvolutionDataSchema.safeParse({
        species: { speciesId: 133, name: 'wrong-name' },
        chain,
      }).success,
    ).toBe(false);
    expect(
      speciesEvolutionDataSchema.safeParse({
        species: { speciesId: 25, name: 'pikachu' },
        chain,
      }).success,
    ).toBe(false);
    expect(
      speciesEvolutionDataSchema.safeParse({
        species: root.species,
        chain: null,
      }).success,
    ).toBe(true);
  });
  it('requires matching absence and independent chain/reference source metadata', () => {
    const meta = {
      source: 'pokeapi-v2',
      fetchedAt: '2026-10-25T01:00:00.000Z',
      stale: false,
    };
    expect(
      speciesEvolutionResponseSchema.safeParse({
        data: { species: root.species, chain },
        meta: { species: meta, chain: { ...meta, stale: true } },
      }).success,
    ).toBe(true);
    expect(
      speciesEvolutionResponseSchema.safeParse({
        data: { species: root.species, chain },
        meta: { species: meta, chain: null },
      }).success,
    ).toBe(false);
    expect(
      speciesEvolutionResponseSchema.safeParse({
        data: { species: root.species, chain: null },
        meta: { species: meta, chain: meta },
      }).success,
    ).toBe(false);
  });
});
