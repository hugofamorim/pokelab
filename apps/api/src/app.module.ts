import { Controller, Get, Inject, Module, Param } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';
import type { SchemaObject } from '@nestjs/swagger';
import { z } from 'zod';
import { pokemonResponseSchema } from '@pokelab/contracts';
import { CatalogService } from './catalog.service.js';
import { CONFIG, configSchema } from './config.js';
import type { Config } from './config.js';
import { PrismaCache, RESOURCE_CACHE } from './cache.js';
import { PokeApiAdapter } from './pokeapi-adapter.js';

@ApiTags('pokemon')
@Controller('v1/pokemon')
export class PokemonController {
  constructor(
    @Inject(CatalogService) private readonly catalog: CatalogService,
  ) {}
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
  controllers: [PokemonController],
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
