import { z } from 'zod';
import {
  identifierSchema,
  moveResourceIdSchema,
  pokemonLearnsetSchema,
  moveMetadataSchema,
  MOVE_LIMITS,
} from '@pokelab/contracts';
import { CatalogError } from './errors.js';

export function validateMoveResourceId(input: number) {
  const parsed = moveResourceIdSchema.safeParse(input);
  if (!parsed.success)
    throw new CatalogError(
      400,
      'INVALID_MOVE_QUERY',
      'Use um ID de 1 a 999999.',
    );
  return parsed.data;
}
const named = (kind: string) =>
  z
    .strictObject({
      name: identifierSchema,
      url: z
        .string()
        .max(160)
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
export const learnsetUpstreamSchema = (id: number) =>
  z
    .object({
      id: moveResourceIdSchema,
      name: identifierSchema,
      species: named('pokemon-species'),
      is_default: z.boolean(),
      moves: z
        .array(
          z.strictObject({
            move: named('move'),
            version_group_details: z
              .array(
                z.strictObject({
                  version_group: named('version-group'),
                  move_learn_method: named('move-learn-method'),
                  level_learned_at: z.number().int().min(0).max(100),
                  order: z.number().int().min(0).max(1000000).nullable(),
                }),
              )
              .min(1)
              .max(MOVE_LIMITS.maxRecordsPerMove),
          }),
        )
        .max(MOVE_LIMITS.maxMoves),
    })
    .refine((value) => value.id === id)
    .transform((value) => ({
      pokemon: { id: value.id, name: value.name },
      species: { speciesId: value.species.id, name: value.species.name },
      isDefault: value.is_default,
      moves: value.moves
        .map((move) => ({
          move: move.move,
          records: move.version_group_details.map((record) => ({
            versionGroup: record.version_group,
            method: record.move_learn_method,
            level: record.level_learned_at,
            order: record.order,
          })),
        }))
        .sort((a, b) => a.move.id - b.move.id),
    }))
    .pipe(pokemonLearnsetSchema);

export const moveUpstreamSchema = (id: number) =>
  z
    .object({
      id: moveResourceIdSchema,
      name: identifierSchema,
      type: named('type'),
      damage_class: named('move-damage-class'),
      power: moveMetadataSchema.shape.power,
      pp: moveMetadataSchema.shape.pp,
      accuracy: moveMetadataSchema.shape.accuracy,
      priority: moveMetadataSchema.shape.priority,
      past_values: z
        .array(
          z.object({
            version_group: named('version-group'),
            type: named('type').nullable(),
            power: moveMetadataSchema.shape.power,
            pp: moveMetadataSchema.shape.pp,
            accuracy: moveMetadataSchema.shape.accuracy,
          }),
        )
        .max(MOVE_LIMITS.maxHistoricalChanges),
    })
    .refine((value) => value.id === id)
    .transform((value) => ({
      move: { id: value.id, name: value.name },
      snapshot: 'current-source' as const,
      type: value.type,
      damageClass: value.damage_class,
      power: value.power,
      pp: value.pp,
      accuracy: value.accuracy,
      priority: value.priority,
      historicalChanges: value.past_values.map((entry) => ({
        versionGroup: entry.version_group,
        type: entry.type,
        power: entry.power,
        pp: entry.pp,
        accuracy: entry.accuracy,
      })),
    }))
    .pipe(moveMetadataSchema);
