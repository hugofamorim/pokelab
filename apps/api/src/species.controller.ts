import { Controller, Get, Inject, Query, Param } from '@nestjs/common';
import {
  ApiOperation,
  ApiQuery,
  ApiResponse,
  ApiTags,
  ApiParam,
} from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';
import {
  generationSpeciesPageResponseSchema,
  GENERATION_NAMES,
  PAGINATION_LIMITS,
  defaultVarietiesResponseSchema,
  speciesDescriptionResponseSchema,
  speciesEvolutionResponseSchema,
} from '@pokelab/contracts';
import { CatalogService } from './catalog.service.js';

@ApiTags('pokemon-species')
@Controller('v1/pokemon-species')
export class SpeciesController {
  constructor(
    @Inject(CatalogService) private readonly catalog: CatalogService,
  ) {}

  @Get(':speciesId/evolution')
  @ApiOperation({
    summary:
      'Resolve an explicit owning species to its bounded evolution tree; species references and version/form conditions, without Pokémon detail fan-out',
  })
  @ApiParam({
    name: 'speciesId',
    schema: { type: 'string', pattern: '^[1-9]\\d{0,5}$' },
    description: 'Owning species ID, not a Pokémon entry or evolution-chain ID',
  })
  @ApiResponse({
    status: 200,
    description:
      'Parent-before-child species nodes and alternative condition records; independent reference/chain freshness; null chain only when source reference is null',
    schema: z.toJSONSchema(speciesEvolutionResponseSchema, {
      target: 'openapi-3.0',
    }) as SchemaObject,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid species ID or unsupported query',
  })
  @ApiResponse({
    status: 404,
    description: 'Species or referenced evolution chain not found',
  })
  @ApiResponse({
    status: 502,
    description:
      'Invalid, unsupported, excessive or inconsistent upstream metadata',
  })
  @ApiResponse({
    status: 503,
    description: 'Upstream, cache or admission unavailable',
  })
  evolution(@Param('speciesId') speciesId: string, @Query() query: unknown) {
    return this.catalog.speciesEvolution(speciesId, query);
  }

  @Get(':speciesId/description')
  @ApiOperation({
    summary:
      'One species description: first nonblank pt-br, otherwise en, in upstream order; no game recency claim',
  })
  @ApiParam({
    name: 'speciesId',
    schema: { type: 'string', pattern: '^[1-9]\\d{0,5}$' },
    description: 'Explicit owning species ID, not a Pokémon entry ID',
  })
  @ApiResponse({
    status: 200,
    description:
      'Source language/version and independent freshness; null description when supported languages are absent',
    schema: z.toJSONSchema(speciesDescriptionResponseSchema, {
      target: 'openapi-3.0',
    }) as SchemaObject,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid species ID or unsupported query',
  })
  @ApiResponse({ status: 404, description: 'Species not found' })
  @ApiResponse({ status: 502, description: 'Invalid upstream metadata' })
  @ApiResponse({
    status: 503,
    description: 'Upstream, cache or admission unavailable',
  })
  description(@Param('speciesId') speciesId: string, @Query() query: unknown) {
    return this.catalog.speciesDescription(speciesId, query);
  }

  @Get('default-varieties')
  @ApiOperation({
    summary:
      'Resolve up to 12 explicit species IDs to their upstream default Pokémon variety; no Pokémon detail fan-out',
  })
  @ApiQuery({
    name: 'speciesIds',
    required: true,
    schema: { type: 'string', maxLength: 83, example: '1,413' },
    description:
      'Distinct canonical species IDs 1–999999, comma separated; input order is preserved',
  })
  @ApiResponse({
    status: 200,
    description:
      'Ordered mappings with independent per-species availability and freshness',
    schema: z.toJSONSchema(defaultVarietiesResponseSchema, {
      target: 'openapi-3.0',
    }) as SchemaObject,
  })
  @ApiResponse({
    status: 400,
    description:
      'Missing, repeated, excessive, invalid or unsupported query parameters',
  })
  @ApiResponse({
    status: 503,
    description: 'Distinct species batch admission limit reached',
  })
  defaultVarieties(@Query() query: unknown) {
    return this.catalog.defaultVarieties(query);
  }

  @Get()
  @ApiOperation({
    summary:
      'Species introduced in one generation, ordered by species ID; no Pokémon/form resolution or detail fan-out',
  })
  @ApiQuery({
    name: 'generation',
    required: true,
    schema: { type: 'integer', minimum: 1, maximum: GENERATION_NAMES.length },
    description:
      'Introduction generation I–IX. Species IDs are not Pokémon/form IDs; this is not a game availability or historical typing filter.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: PAGINATION_LIMITS.maxPage,
      default: PAGINATION_LIMITS.defaultPage,
    },
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    schema: {
      type: 'integer',
      minimum: 1,
      maximum: PAGINATION_LIMITS.maxPageSize,
      default: PAGINATION_LIMITS.defaultPageSize,
    },
  })
  @ApiResponse({
    status: 200,
    description:
      'Species reference page or empty page with generation identity and index freshness',
    schema: z.toJSONSchema(generationSpeciesPageResponseSchema, {
      target: 'openapi-3.0',
    }) as SchemaObject,
  })
  @ApiResponse({
    status: 400,
    description:
      'Invalid/missing/repeated generation, invalid pagination or unsupported query combination',
  })
  @ApiResponse({
    status: 502,
    description:
      'Malformed, inconsistent or excessive upstream generation resource',
  })
  @ApiResponse({
    status: 503,
    description: 'Upstream, database or shared admission limit unavailable',
  })
  list(@Query() query: unknown) {
    return this.catalog.speciesByGeneration(query);
  }
}
