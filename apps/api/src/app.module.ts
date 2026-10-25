import { Controller, Get, Inject, Module, Param, Query } from '@nestjs/common';
import { ApiOperation, ApiQuery, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';
import {
  pokemonResponseSchema,
  pokemonCatalogPageResponseSchema,
  pokemonTypeSchema,
  PAGINATION_LIMITS,
  pokemonSummariesResponseSchema,
  combinedFilterResponseSchema,
} from '@pokelab/contracts';
import { CatalogService } from './catalog.service.js';
import { CONFIG, configSchema } from './config.js';
import type { Config } from './config.js';
import { PrismaCache, RESOURCE_CACHE } from './cache.js';
import { PokeApiAdapter } from './pokeapi-adapter.js';
import { SpeciesController } from './species.controller.js';
import { MovesController } from './moves.controller.js';

@ApiTags('pokemon')
@Controller('v1/pokemon')
export class PokemonController {
  constructor(
    @Inject(CatalogService) private readonly catalog: CatalogService,
  ) {}
  @Get()
  @ApiOperation({
    summary:
      'Bounded entry references, optionally filtered by one current Pokémon type; no detail fan-out',
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
  @ApiQuery({
    name: 'type',
    required: false,
    schema: z.toJSONSchema(pokemonTypeSchema, {
      target: 'openapi-3.0',
    }) as SchemaObject,
    description:
      'One canonical lowercase type; search/generation/multiple-type combinations are unsupported',
  })
  @ApiResponse({
    status: 200,
    description: 'Page or empty page with source freshness',
    schema: z.toJSONSchema(pokemonCatalogPageResponseSchema, {
      target: 'openapi-3.0',
    }) as SchemaObject,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid pagination or unsupported query parameter',
  })
  @ApiResponse({ status: 502, description: 'Invalid upstream resource page' })
  @ApiResponse({
    status: 503,
    description: 'Upstream, database or admission limit unavailable',
  })
  list(@Query() query: unknown) {
    return this.catalog.list(query);
  }

  @Get('summaries')
  @ApiOperation({
    summary:
      'Up to 12 cached card summaries, ordered with per-item availability',
  })
  @ApiQuery({
    name: 'ids',
    required: true,
    schema: { type: 'string', maxLength: 83, example: '1,25,10025' },
  })
  @ApiResponse({
    status: 200,
    description: 'Ordered results; unavailable items have no fabricated data',
    schema: z.toJSONSchema(pokemonSummariesResponseSchema, {
      target: 'openapi-3.0',
    }) as SchemaObject,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid, repeated, excessive or unsupported query',
  })
  @ApiResponse({ status: 503, description: 'Batch admission limit reached' })
  summaries(@Query() query: unknown) {
    return this.catalog.summaries(query);
  }

  @Get('filter-scan')
  @ApiOperation({
    summary:
      'Bounded current-type entry scan intersected with species-introduction generation; not a page of all matches',
  })
  @ApiQuery({
    name: 'type',
    required: true,
    schema: z.toJSONSchema(pokemonTypeSchema, {
      target: 'openapi-3.0',
    }) as SchemaObject,
  })
  @ApiQuery({
    name: 'generation',
    required: true,
    schema: { type: 'integer', minimum: 1, maximum: 9 },
  })
  @ApiQuery({
    name: 'after',
    required: false,
    schema: { type: 'integer', minimum: 0, maximum: 999999, default: 0 },
    description:
      'Exclusive Pokémon entry ID cursor in the current type index; not a species ID or match offset',
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    schema: { type: 'integer', minimum: 1, maximum: 12, default: 4 },
    description: 'Maximum candidates examined, not minimum matches returned',
  })
  @ApiResponse({
    status: 200,
    description:
      'Ordered match/excluded/unavailable outcomes and cursor; totalCandidates counts type entries, not combined matches',
    schema: z.toJSONSchema(combinedFilterResponseSchema, {
      target: 'openapi-3.0',
    }) as SchemaObject,
  })
  @ApiResponse({
    status: 400,
    description: 'Invalid, repeated or unsupported query',
  })
  @ApiResponse({
    status: 502,
    description: 'Invalid index or composed resource',
  })
  @ApiResponse({
    status: 503,
    description:
      'Index/cache/admission unavailable; individual detail failures remain per item',
  })
  filterScan(@Query() query: unknown) {
    return this.catalog.filterScan(query);
  }

  @Get(':idOrName')
  @ApiOperation({
    summary: 'Normalized form-specific Pokémon detail from PokéAPI v2',
  })
  // Zod's OpenAPI target emits the correct dialect; its generic JSON Schema type is broader.
  @ApiResponse({
    status: 200,
    description: 'Normalized detail with source freshness',
    schema: z.toJSONSchema(pokemonResponseSchema, {
      target: 'openapi-3.0',
    }) as SchemaObject,
  })
  @ApiResponse({ status: 400, description: 'Invalid identifier' })
  @ApiResponse({ status: 404, description: 'Pokémon not found' })
  @ApiResponse({ status: 502, description: 'Upstream schema mismatch' })
  @ApiResponse({
    status: 503,
    description: 'Upstream, database or concurrency limit unavailable',
  })
  get(@Param('idOrName') idOrName: string) {
    return this.catalog.get(idOrName);
  }
}
@Module({
  controllers: [PokemonController, SpeciesController, MovesController],
  providers: [
    {
      provide: CONFIG,
      useFactory: () => {
        const result = configSchema.safeParse(process.env);
        if (!result.success)
          throw new Error(
            `Invalid API environment: ${result.error.issues.map((issue) => issue.path.join('.')).join(', ')}`,
          );
        return result.data;
      },
    },
    { provide: RESOURCE_CACHE, useClass: PrismaCache },
    {
      provide: PokeApiAdapter,
      useFactory: (config: Config) =>
        new PokeApiAdapter(config.POKEAPI_TIMEOUT_MS),
      inject: [CONFIG],
    },
    CatalogService,
  ],
})
export class AppModule {}
