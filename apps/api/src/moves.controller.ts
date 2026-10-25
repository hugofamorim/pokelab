import { Controller, Get, Inject, Param, Query } from '@nestjs/common';
import {
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';
import {
  pokemonMovesResponseSchema,
  moveMetadataResponseSchema,
} from '@pokelab/contracts';
import { CatalogService } from './catalog.service.js';

@ApiTags('moves')
@Controller('v1')
export class MovesController {
  constructor(
    @Inject(CatalogService) private readonly catalog: CatalogService,
  ) {}

  @Get('pokemon/:pokemonId/moves')
  @ApiOperation({
    summary:
      'Paginated learn records for an explicit Pokémon entry and version group; no move-detail fan-out',
  })
  @ApiParam({
    name: 'pokemonId',
    schema: { type: 'integer', minimum: 1, maximum: 999999 },
  })
  @ApiQuery({
    name: 'versionGroup',
    required: true,
    schema: { type: 'integer', minimum: 1, maximum: 999999 },
    description:
      'Explicit group ID; only source learning records, not universal availability or battle legality',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 1000, default: 1 },
  })
  @ApiQuery({
    name: 'pageSize',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 50, default: 20 },
  })
  @ApiResponse({
    status: 200,
    description:
      'Source groups plus paginated records; null selected group means no records in this dataset',
    schema: z.toJSONSchema(pokemonMovesResponseSchema, {
      target: 'openapi-3.0',
    }) as SchemaObject,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid/repeated/unsupported query or noncanonical ID',
  })
  @ApiResponse({ status: 404, description: 'Pokémon entry not found' })
  @ApiResponse({ status: 502, description: 'Invalid or excessive source' })
  @ApiResponse({
    status: 503,
    description: 'Cache, upstream or shared resource admission unavailable',
  })
  pokemonMoves(@Param('pokemonId') id: string, @Query() query: unknown) {
    return this.catalog.pokemonMoves(id, query);
  }

  @Get('moves/:moveId')
  @ApiOperation({
    summary:
      'One current-source move snapshot with selected historical change fields; no historical battle calculation or learnability claim',
  })
  @ApiParam({
    name: 'moveId',
    schema: { type: 'integer', minimum: 1, maximum: 999999 },
  })
  @ApiResponse({
    status: 200,
    schema: z.toJSONSchema(moveMetadataResponseSchema, {
      target: 'openapi-3.0',
    }) as SchemaObject,
  })
  @ApiResponse({ status: 400, description: 'Invalid ID or unsupported query' })
  @ApiResponse({ status: 404, description: 'Move not found' })
  @ApiResponse({ status: 502, description: 'Invalid or excessive source' })
  @ApiResponse({
    status: 503,
    description: 'Cache, upstream or shared resource admission unavailable',
  })
  move(@Param('moveId') id: string, @Query() query: unknown) {
    return this.catalog.moveMetadata(id, query);
  }
}
