import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';
import {
  generationSpeciesPageResponseSchema,
  GENERATION_NAMES,
  PAGINATION_LIMITS,
  defaultVarietiesResponseSchema,
} from '@pokelab/contracts';
import { CatalogService } from './catalog.service.js';

@ApiTags('pokemon-species')
@Controller('v1/pokemon-species')
export class SpeciesController {
  constructor(
    @Inject(CatalogService) private readonly catalog: CatalogService,
  ) {}

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
