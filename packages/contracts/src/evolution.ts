import { z } from 'zod';
import { identifierSchema } from './identifiers.js';
import { speciesReferenceSchema } from './generation.js';

export const EVOLUTION_LIMITS = {
  maxResponseBytes: 1048576,
  maxNodes: 64,
  maxDepth: 8,
  maxAlternatives: 64,
  maxExpressionLength: 512,
  maxVariables: 32,
} as const;
export const evolutionResourceIdSchema = z.number().int().min(1).max(999999);
export const evolutionNamedResourceSchema = z.strictObject({
  id: evolutionResourceIdSchema,
  name: identifierSchema,
});
const resource = evolutionNamedResourceSchema.nullable();
const minimum = z.number().int().min(0).max(1000000000).nullable();
export const evolutionConditionSchema = z.strictObject({
  versionGroup: evolutionNamedResourceSchema,
  isDefault: z.boolean(),
  trigger: evolutionNamedResourceSchema,
  item: resource,
  gender: z.number().int().min(1).max(3).nullable(),
  heldItem: resource,
  knownMove: resource,
  knownMoveType: resource,
  location: resource,
  minLevel: minimum,
  minHappiness: minimum,
  minBeauty: minimum,
  minAffection: minimum,
  nearSpecialRock: z.boolean(),
  needsMultiplayer: z.boolean(),
  needsOverworldRain: z.boolean(),
  partySpecies: resource,
  partyType: resource,
  relativePhysicalStats: z
    .union([z.literal(-1), z.literal(0), z.literal(1)])
    .nullable(),
  timeOfDay: z.enum(['', 'day', 'night', 'dusk', 'full-moon']),
  tradeSpecies: resource,
  turnUpsideDown: z.boolean(),
  region: resource,
  requiredPokemonForm: resource,
  evolvedPokemonForm: resource,
  usedMove: resource,
  minMoveCount: minimum,
  minSteps: minimum,
  minDamageTaken: minimum,
  allowedNatures: z
    .array(evolutionNamedResourceSchema)
    .max(25)
    .refine(
      (items) =>
        new Set(items.map((item) => item.id)).size === items.length &&
        new Set(items.map((item) => item.name)).size === items.length,
    )
    .nullable(),
  conditionExpression: z
    .strictObject({
      expression: z
        .string()
        .trim()
        .min(1)
        .max(EVOLUTION_LIMITS.maxExpressionLength),
      percentageChance: z.number().min(0).max(100).nullable(),
      variables: z
        .array(evolutionNamedResourceSchema)
        .max(EVOLUTION_LIMITS.maxVariables),
    })
    .nullable(),
});
export const evolutionNodeSchema = z.strictObject({
  species: speciesReferenceSchema,
  parentSpeciesId: evolutionResourceIdSchema.nullable(),
  isBaby: z.boolean(),
  conditions: z
    .array(evolutionConditionSchema)
    .max(EVOLUTION_LIMITS.maxAlternatives),
});
export const evolutionChainSchema = z
  .strictObject({
    chainId: evolutionResourceIdSchema,
    babyTriggerItem: resource,
    nodes: z.array(evolutionNodeSchema).min(1).max(EVOLUTION_LIMITS.maxNodes),
  })
  .refine((chain) => {
    const depths = new Map<number, number>();
    const names = new Set<string>();
    for (const [index, node] of chain.nodes.entries()) {
      const id = node.species.speciesId;
      if (depths.has(id) || names.has(node.species.name)) return false;
      if (index === 0) {
        if (node.parentSpeciesId !== null || node.conditions.length !== 0)
          return false;
        depths.set(id, 1);
      } else {
        const parentDepth =
          node.parentSpeciesId === null
            ? undefined
            : depths.get(node.parentSpeciesId);
        if (
          parentDepth === undefined ||
          parentDepth >= EVOLUTION_LIMITS.maxDepth
        )
          return false;
        depths.set(id, parentDepth + 1);
      }
      names.add(node.species.name);
    }
    return true;
  }, 'Expected a bounded connected species tree in parent-before-child order');
export type EvolutionChain = z.infer<typeof evolutionChainSchema>;
export const speciesEvolutionReferenceSchema = z.strictObject({
  species: speciesReferenceSchema,
  chainId: evolutionResourceIdSchema.nullable(),
});
export type SpeciesEvolutionReference = z.infer<
  typeof speciesEvolutionReferenceSchema
>;
export const speciesEvolutionDataSchema = z
  .strictObject({
    species: speciesReferenceSchema,
    chain: evolutionChainSchema.nullable(),
  })
  .refine(
    (value) =>
      value.chain === null ||
      value.chain.nodes.some(
        (node) =>
          node.species.speciesId === value.species.speciesId &&
          node.species.name === value.species.name,
      ),
    'Requested species must belong to the chain',
  );
