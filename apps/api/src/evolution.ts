import { z } from 'zod';
import {
  EVOLUTION_LIMITS,
  evolutionResourceIdSchema,
  evolutionChainSchema,
  evolutionConditionSchema,
  identifierSchema,
  speciesEvolutionReferenceSchema,
} from '@pokelab/contracts';
import type { EvolutionChain } from '@pokelab/contracts';
import { CatalogError } from './errors.js';

function named(kind: string) {
  return z
    .strictObject({
      name: identifierSchema,
      url: z
        .string()
        .refine((url) => url === url.trim())
        .regex(
          new RegExp(
            '^https://pokeapi\\.co/api/v2/' + kind + '/[1-9]\\d{0,5}/$',
          ),
        ),
    })
    .transform((value) => ({
      id: Number(value.url.split('/').at(-2)),
      name: value.name,
    }));
}
const optional = (kind: string) => named(kind).nullable();
const minimum = z.number().int().min(0).max(1000000000).nullable();
const condition = z
  .strictObject({
    version_group: named('version-group'),
    is_default: z.boolean(),
    trigger: named('evolution-trigger'),
    item: optional('item'),
    gender: evolutionConditionSchema.shape.gender,
    held_item: optional('item'),
    known_move: optional('move'),
    known_move_type: optional('type'),
    location: optional('location'),
    min_level: minimum,
    min_happiness: minimum,
    min_beauty: minimum,
    min_affection: minimum,
    near_special_rock: z.boolean(),
    needs_multiplayer: z.boolean(),
    needs_overworld_rain: z.boolean(),
    party_species: optional('pokemon-species'),
    party_type: optional('type'),
    relative_physical_stats:
      evolutionConditionSchema.shape.relativePhysicalStats,
    time_of_day: evolutionConditionSchema.shape.timeOfDay,
    trade_species: optional('pokemon-species'),
    turn_upside_down: z.boolean(),
    region: optional('region'),
    required_pokemon_form: optional('pokemon-form'),
    evolved_pokemon_form: optional('pokemon-form'),
    used_move: optional('move'),
    min_move_count: minimum,
    min_steps: minimum,
    min_damage_taken: minimum,
    allowed_natures: z.array(named('nature')).max(25).nullable(),
    condition_expression: z
      .strictObject({
        expression:
          evolutionConditionSchema.shape.conditionExpression.unwrap().shape
            .expression,
        percentage_chance:
          evolutionConditionSchema.shape.conditionExpression.unwrap().shape
            .percentageChance,
        variables: z
          .array(named('evolution-variable'))
          .max(EVOLUTION_LIMITS.maxVariables),
      })
      .nullable(),
  })
  .transform((value) => ({
    versionGroup: value.version_group,
    isDefault: value.is_default,
    trigger: value.trigger,
    item: value.item,
    gender: value.gender,
    heldItem: value.held_item,
    knownMove: value.known_move,
    knownMoveType: value.known_move_type,
    location: value.location,
    minLevel: value.min_level,
    minHappiness: value.min_happiness,
    minBeauty: value.min_beauty,
    minAffection: value.min_affection,
    nearSpecialRock: value.near_special_rock,
    needsMultiplayer: value.needs_multiplayer,
    needsOverworldRain: value.needs_overworld_rain,
    partySpecies: value.party_species,
    partyType: value.party_type,
    relativePhysicalStats: value.relative_physical_stats,
    timeOfDay: value.time_of_day,
    tradeSpecies: value.trade_species,
    turnUpsideDown: value.turn_upside_down,
    region: value.region,
    requiredPokemonForm: value.required_pokemon_form,
    evolvedPokemonForm: value.evolved_pokemon_form,
    usedMove: value.used_move,
    minMoveCount: value.min_move_count,
    minSteps: value.min_steps,
    minDamageTaken: value.min_damage_taken,
    allowedNatures: value.allowed_natures,
    conditionExpression:
      value.condition_expression === null
        ? null
        : {
            expression: value.condition_expression.expression,
            percentageChance: value.condition_expression.percentage_chance,
            variables: value.condition_expression.variables,
          },
  }))
  .pipe(evolutionConditionSchema);
const link = z.strictObject({
  is_baby: z.boolean(),
  species: named('pokemon-species'),
  evolution_details: z.array(condition).max(EVOLUTION_LIMITS.maxAlternatives),
  evolves_to: z.array(z.unknown()).max(EVOLUTION_LIMITS.maxNodes),
});

export function evolutionUpstreamSchema(chainId: number) {
  return z
    .strictObject({
      id: evolutionResourceIdSchema,
      baby_trigger_item: optional('item'),
      chain: z.unknown(),
    })
    .refine((body) => body.id === chainId)
    .transform((body, ctx) => {
      const nodes: EvolutionChain['nodes'] = [];
      const queue = [
        { raw: body.chain, parent: null as number | null, depth: 1 },
      ];
      for (let i = 0; i < queue.length; i++) {
        const current = queue[i]!;
        const parsed = link.safeParse(current.raw);
        if (
          !parsed.success ||
          current.depth > EVOLUTION_LIMITS.maxDepth ||
          queue.length > EVOLUTION_LIMITS.maxNodes
        ) {
          ctx.addIssue({
            code: 'custom',
            message: 'Invalid or excessive evolution tree',
          });
          return z.NEVER;
        }
        const value = parsed.data;
        nodes.push({
          species: { speciesId: value.species.id, name: value.species.name },
          parentSpeciesId: current.parent,
          isBaby: value.is_baby,
          conditions: value.evolution_details,
        });
        for (const child of value.evolves_to)
          queue.push({
            raw: child,
            parent: value.species.id,
            depth: current.depth + 1,
          });
      }
      return {
        chainId: body.id,
        babyTriggerItem: body.baby_trigger_item,
        nodes,
      };
    })
    .pipe(evolutionChainSchema);
}

export function evolutionReferenceUpstreamSchema(speciesId: number) {
  return z
    .object({
      id: evolutionResourceIdSchema,
      name: identifierSchema,
      evolution_chain: z
        .object({
          url: z
            .string()
            .refine((url) => url === url.trim())
            .regex(
              /^https:\/\/pokeapi\.co\/api\/v2\/evolution-chain\/[1-9]\d{0,5}\/$/,
            ),
        })
        .nullable(),
    })
    .refine((body) => body.id === speciesId)
    .transform((body) => ({
      species: { speciesId: body.id, name: body.name },
      chainId:
        body.evolution_chain === null
          ? null
          : Number(body.evolution_chain.url.split('/').at(-2)),
    }))
    .pipe(speciesEvolutionReferenceSchema);
}

export function validateEvolutionId(input: number) {
  const result = evolutionResourceIdSchema.safeParse(input);
  if (!result.success)
    throw new CatalogError(
      400,
      'INVALID_EVOLUTION_ID',
      'Use um ID de recurso de 1 a 999999.',
    );
  return result.data;
}
