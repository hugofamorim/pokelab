import { Controller, Get, Inject, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';
import {
  generationSpeciesPageResponseSchema,
  GENERATION_NAMES,
  PAGINATION_LIMITS,
} from '@pokelab/contracts';
import { CatalogService } from './catalog.service.js';

@ApiTags('pokemon-species')
@Controller('v1/pokemon-species')
export class SpeciesController {
  constructor(
    @Inject(CatalogService) private readonly catalog: CatalogService,
  ) {}

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
