// Offline browser-test server: real Nest controller, captured upstream fixture.
import 'reflect-metadata';
import { createRequire } from 'node:module';
import { URL } from 'node:url';
const require = createRequire(import.meta.url);
import { Test } from '@nestjs/testing';
import { AppModule } from '../dist/app.module.js';
import { CONFIG } from '../dist/config.js';
import { RESOURCE_CACHE } from '../dist/cache.js';
import { PokeApiAdapter } from '../dist/pokeapi-adapter.js';
import { ApiErrorFilter, CatalogError } from '../dist/errors.js';
import {
  pokemonSchema,
  pokemonPageSchema,
  pokemonTypeIndexSchema,
  generationSpeciesIndexSchema,
  GENERATION_NAMES,
} from '@pokelab/contracts';
const fixture = require('./fixtures/pikachu.json');
const electricFixture = require('./fixtures/type-electric.json');
const generationFixture = require('./fixtures/generation-i.json');
const generationFour = require('./fixtures/generation-iv-selection.json');
const wormadam = pokemonSchema.parse(
  require('./fixtures/wormadam-detail.json'),
);
// Captured normalized facts; the thirteen-entry test catalog is intentionally small.
const catalog = require('./fixtures/catalog-details.json').map((item) =>
  pokemonSchema.parse(item),
);
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
  const getDetail = adapter.get.bind(adapter);
  adapter.get = async (identifier) => {
    if (identifier === '413' || identifier === wormadam.name)
      throw new CatalogError(
        503,
        'UPSTREAM_UNAVAILABLE',
        'Fonte indisponível.',
      );
    if (identifier === 'ivysaur')
      await new Promise((resolve) => setTimeout(resolve, 1200));
    if (identifier === 'venusaur')
      throw new CatalogError(
        503,
        'UPSTREAM_UNAVAILABLE',
        'Fonte indisponível.',
      );
    const captured = catalog.find(
      (item) => String(item.id) === identifier || item.name === identifier,
    );
    if (captured) return captured;
    if (
      ['25', 'pikachu', 'slow', 'no-art', 'missing', 'unavailable'].includes(
        identifier,
      )
    )
      return getDetail(identifier);
    throw new CatalogError(404, 'POKEMON_NOT_FOUND', 'Pokémon não encontrado.');
  };
  entries.set('pokeapi-v2:normalized-v1:pokemon/venusaur', {
    payload: catalog.find((item) => item.name === 'venusaur'),
    fetchedAt: new Date('2026-10-20T12:00:00Z'),
    expiresAt: new Date(0),
  });
  const references = [
    ...catalog.map(({ id, name }) => ({ id, name })),
    { id: 25, name: 'pikachu' },
  ];
  const capturedSpecies = [...catalog, await getDetail('25'), wormadam];
  const generationIndex = (id, source) =>
    generationSpeciesIndexSchema.parse({
      generation: { id, name: GENERATION_NAMES[id - 1] },
      items: source.pokemon_species
        .map((entry) => ({
          speciesId: Number(entry.url.split('/').at(-2)),
          name: entry.name,
        }))
        .filter((entry) =>
          capturedSpecies.some((item) => item.species.id === entry.speciesId),
        )
        .sort((a, b) => a.speciesId - b.speciesId),
    });
  adapter.generationIndex = async (id) => {
    if (id === 1 || id === 3)
      throw new CatalogError(
        503,
        'UPSTREAM_UNAVAILABLE',
        'Fonte indisponível.',
      );
    if (id === 2) await new Promise((resolve) => setTimeout(resolve, 1200));
    return generationIndex(
      id,
      id === 4 ? generationFour : { pokemon_species: [] },
    );
  };
  const mappingFor = (item) => ({
    species: { speciesId: item.species.id, name: item.species.name },
    pokemon: { id: item.id, name: item.name },
  });
  adapter.defaultVariety = async (id) => {
    if (id === 413)
      throw new CatalogError(
        503,
        'UPSTREAM_UNAVAILABLE',
        'Fonte indisponível.',
      );
    const item = capturedSpecies.find(
      (value) => value.species.id === id && value.isDefault,
    );
    if (!item)
      throw new CatalogError(
        404,
        'SPECIES_NOT_FOUND',
        'Espécie não encontrada.',
      );
    return mappingFor(item);
  };
  const expired = (payload) => ({
    payload,
    fetchedAt: new Date('2026-10-22T12:00:00Z'),
    expiresAt: new Date(0),
  });
  entries.set(
    'pokeapi-v2:normalized-v1:generation-species-index/1',
    expired(generationIndex(1, generationFixture)),
  );
  entries.set(
    'pokeapi-v2:normalized-v1:species-default-variety/413',
    expired(mappingFor(wormadam)),
  );
  entries.set('pokeapi-v2:normalized-v1:pokemon/413', expired(wormadam));
  const indexFor = (type) =>
    pokemonTypeIndexSchema.parse({
      type,
      items:
        type === 'electric'
          ? electricFixture.pokemon
              .map(({ pokemon }) => ({
                id: Number(
                  new URL(pokemon.url).pathname
                    .split('/')
                    .filter(Boolean)
                    .at(-1),
                ),
                name: pokemon.name,
              }))
              .sort((a, b) => a.id - b.id)
          : catalog
              .filter((item) => item.types.includes(type))
              .map(({ id, name }) => ({ id, name })),
    });
  // Controlled outage/empty/stale scenarios in the deliberately limited offline dataset.
  adapter.typeIndex = async (type) => {
    if (type === 'ghost' || type === 'water')
      throw new CatalogError(
        503,
        'UPSTREAM_UNAVAILABLE',
        'Fonte indisponível.',
      );
    return indexFor(type);
  };
  entries.set('pokeapi-v2:normalized-v1:pokemon-type-index/water', {
    payload: indexFor('water'),
    fetchedAt: new Date('2026-10-20T12:00:00Z'),
    expiresAt: new Date(0),
  });
  adapter.list = async ({ page, pageSize }) => {
    if (page === 999 || page === 998)
      throw new CatalogError(
        503,
        'UPSTREAM_UNAVAILABLE',
        'Fonte indisponível.',
      );
    if (page === 997) await new Promise((resolve) => setTimeout(resolve, 1200));
    const offset = (page - 1) * pageSize;
    const items = references.slice(offset, offset + pageSize);
    return pokemonPageSchema.parse({
      items,
      page,
      pageSize,
      total: references.length,
      hasNext: offset + items.length < references.length,
    });
  };
  entries.set('pokeapi-v2:normalized-v1:pokemon-page/998/12', {
    payload: pokemonPageSchema.parse({
      items: references.slice(0, 12),
      page: 998,
      pageSize: 12,
      total: 11976,
      hasNext: false,
    }),
    fetchedAt: new Date('2026-10-20T12:00:00Z'),
    expiresAt: new Date(0),
  });
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
