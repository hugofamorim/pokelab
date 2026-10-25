import { z } from 'zod';
import { identifierSchema } from './identifiers.js';
import {
  pokemonReferenceSchema,
  pokemonPaginationSchema,
  pokemonPaginationQuerySchema,
} from './pagination.js';
import { speciesReferenceSchema } from './generation.js';
import { speciesIdParamSchema } from './species-description.js';

export const MOVE_LIMITS = {
  maxMoves: 2000,
  maxRecordsPerMove: 512,
  maxVersionGroups: 128,
  maxHistoricalChanges: 128,
  maxResponseBytes: 1048576,
} as const;
export const moveResourceIdSchema = z.number().int().min(1).max(999999);
export const moveIdParamSchema = speciesIdParamSchema;
export const moveReferenceSchema = z.strictObject({
  id: moveResourceIdSchema,
  name: identifierSchema,
});
export const learnRecordSchema = z.strictObject({
  versionGroup: moveReferenceSchema,
  method: moveReferenceSchema,
  level: z.number().int().min(0).max(100),
  order: z.number().int().min(0).max(1000000).nullable(),
});
const distinctRecords = (records: z.infer<typeof learnRecordSchema>[]) =>
  new Set(
    records.map((r) =>
      JSON.stringify([r.versionGroup.id, r.method.id, r.level, r.order]),
    ),
  ).size === records.length;
export const learnsetMoveSchema = z.strictObject({
  move: moveReferenceSchema,
  records: z
    .array(learnRecordSchema)
    .min(1)
    .max(MOVE_LIMITS.maxRecordsPerMove)
    .refine(distinctRecords),
});
export const pokemonLearnsetSchema = z
  .strictObject({
    pokemon: pokemonReferenceSchema,
    species: speciesReferenceSchema,
    isDefault: z.boolean(),
    moves: z.array(learnsetMoveSchema).max(MOVE_LIMITS.maxMoves),
  })
  .refine((data) => {
    if (
      new Set(data.moves.map((m) => m.move.id)).size !== data.moves.length ||
      new Set(data.moves.map((m) => m.move.name)).size !== data.moves.length
    )
      return false;
    const versions = new Map<number, string>(),
      names = new Map<string, number>();
    const methods = new Map<number, string>(),
      methodNames = new Map<string, number>();
    for (const move of data.moves)
      for (const record of move.records) {
        for (const [ref, ids, labels] of [
          [record.versionGroup, versions, names],
          [record.method, methods, methodNames],
        ] as const) {
          if (
            (ids.has(ref.id) && ids.get(ref.id) !== ref.name) ||
            (labels.has(ref.name) && labels.get(ref.name) !== ref.id)
          )
            return false;
          ids.set(ref.id, ref.name);
          labels.set(ref.name, ref.id);
        }
      }
    return versions.size <= MOVE_LIMITS.maxVersionGroups;
  }, 'Duplicate or inconsistent move, version-group or method identity');
export type PokemonLearnset = z.infer<typeof pokemonLearnsetSchema>;
export const pokemonMovesQuerySchema = z
  .strictObject({
    versionGroup: moveIdParamSchema,
    ...pokemonPaginationQuerySchema.shape,
  })
  .pipe(
    z.strictObject({
      versionGroup: moveResourceIdSchema,
      ...pokemonPaginationSchema.shape,
    }),
  );
export const pokemonMovesPageSchema = z
  .strictObject({
    pokemon: pokemonReferenceSchema,
    species: speciesReferenceSchema,
    isDefault: z.boolean(),
    requestedVersionGroupId: moveResourceIdSchema,
    versionGroup: moveReferenceSchema.nullable(),
    availableVersionGroups: z
      .array(moveReferenceSchema)
      .max(MOVE_LIMITS.maxVersionGroups),
    items: z.array(learnsetMoveSchema).max(50),
    ...pokemonPaginationSchema.shape,
    total: z.number().int().min(0).max(MOVE_LIMITS.maxMoves),
    hasNext: z.boolean(),
  })
  .refine((value) => {
    const offset = (value.page - 1) * value.pageSize;
    const group =
      value.availableVersionGroups.find(
        (g) => g.id === value.requestedVersionGroupId,
      ) ?? null;
    return (
      (group === null
        ? value.versionGroup === null
        : value.versionGroup?.id === group.id &&
          value.versionGroup.name === group.name) &&
      new Set(value.availableVersionGroups.map((g) => g.id)).size ===
        value.availableVersionGroups.length &&
      new Set(value.availableVersionGroups.map((g) => g.name)).size ===
        value.availableVersionGroups.length &&
      (group !== null || value.total === 0) &&
      value.items.length ===
        Math.min(value.pageSize, Math.max(0, value.total - offset)) &&
      value.hasNext === offset + value.items.length < value.total &&
      new Set(value.items.map((m) => m.move.id)).size === value.items.length &&
      new Set(value.items.map((m) => m.move.name)).size ===
        value.items.length &&
      value.items.every((m) =>
        m.records.every(
          (r) =>
            r.versionGroup.id === group?.id &&
            r.versionGroup.name === group.name,
        ),
      )
    );
  });
export type PokemonMovesPage = z.infer<typeof pokemonMovesPageSchema>;

const accuracy = z.number().int().min(0).max(100).nullable();
const power = z.number().int().min(0).max(10000).nullable();
const pp = z.number().int().min(0).max(1000).nullable();
export const moveMetadataSchema = z
  .strictObject({
    move: moveReferenceSchema,
    snapshot: z.literal('current-source'),
    type: moveReferenceSchema,
    damageClass: moveReferenceSchema,
    power,
    pp,
    accuracy,
    priority: z.number().int().min(-10).max(10),
    historicalChanges: z
      .array(
        z.strictObject({
          versionGroup: moveReferenceSchema,
          type: moveReferenceSchema.nullable(),
          power,
          pp,
          accuracy,
        }),
      )
      .max(MOVE_LIMITS.maxHistoricalChanges),
  })
  .refine(
    (value) =>
      new Set(value.historicalChanges.map((v) => v.versionGroup.id)).size ===
        value.historicalChanges.length &&
      new Set(value.historicalChanges.map((v) => v.versionGroup.name)).size ===
        value.historicalChanges.length,
  );
export type MoveMetadata = z.infer<typeof moveMetadataSchema>;
