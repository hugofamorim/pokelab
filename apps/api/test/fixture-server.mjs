// Offline browser-test server: real Nest controller, captured upstream fixture.
import 'reflect-metadata';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
import { Test } from '@nestjs/testing';
import { AppModule } from '../dist/app.module.js';
import { CONFIG } from '../dist/config.js';
import { RESOURCE_CACHE } from '../dist/cache.js';
import { PokeApiAdapter } from '../dist/pokeapi-adapter.js';
import { ApiErrorFilter } from '../dist/errors.js';
const fixture = require('./fixtures/pikachu.json');
async function start() {
  const entries = new Map();
  const adapter = new PokeApiAdapter(
    100,
    async (url) => {
      const id = String(url).split('/').at(-1);
      if (id === 'slow')
        await new Promise((resolve) => setTimeout(resolve, 1200));
      if (id === 'missing') return new Response('{}', { status: 404 });
      if (id === 'unavailable') return new Response('{}', { status: 503 });
      const pokemon = structuredClone(fixture);
      if (id === 'no-art') {
        pokemon.sprites = {};
        pokemon.abilities = [];
      }
      return new Response(JSON.stringify(pokemon));
    },
    async () => {},
  );
  const module = await Test.createTestingModule({ imports: [AppModule] })
    .overrideProvider(CONFIG)
    .useValue({
      DATABASE_URL: 'postgresql://unused:unused@localhost/unused',
      PORT: 3101,
      POKEAPI_TIMEOUT_MS: 100,
      POKEAPI_CACHE_TTL_SECONDS: 86400,
    })
    .overrideProvider(RESOURCE_CACHE)
    .useValue({
      get: async (key) => entries.get(key) ?? null,
      set: async (key, value) => {
        entries.set(key, value);
      },
    })
    .overrideProvider(PokeApiAdapter)
    .useValue(adapter)
    .compile();
  const app = module.createNestApplication();
  app.useGlobalFilters(new ApiErrorFilter());
  await app.listen(3101, '127.0.0.1');
}
void start();
