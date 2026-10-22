# Public API — M0 and M1 increments

Development origin: `http://localhost:3001`. OpenAPI UI: `/docs`, JSON: `/docs-json`.
`GET /v1/pokemon`, `GET /v1/pokemon/summaries` and `GET /v1/pokemon/:idOrName` are public and read-only.

## Explicit default-variety resolution — PL-008

`GET /v1/pokemon-species/default-varieties?speciesIds=1,413` resolves a bounded visible
batch of species to explicit Pokémon references. `DefaultVarietiesResponse.items`
preserves input order. Each item is either:

- `{ speciesId, status: 'ready', data: { species: { speciesId, name }, pokemon: { id, name } }, meta }`
- `{ speciesId, status: 'unavailable', code }`

The outer ID must equal the mapping's species ID. Species and Pokémon names/IDs are
independent; Wormadam's species name is `wormadam`, its default variety is `wormadam-plant`.
Mapping freshness belongs to the species resource and is independent of subsequent
Pokémon summary/detail freshness. No Pokémon detail, artwork or types are fetched here.

- Required `speciesIds`: 1–12 distinct canonical integers 1–999999, comma separated,
  maximum 83 raw characters. The strict contract reuses the existing bounded ID grammar
  with explicit species semantics. Missing/empty/repeated parameters, duplicates, leading
  zeros, whitespace, names, URLs, excessive lists and extra filters return 400
  `INVALID_SPECIES_QUERY` before cache/upstream access.
- Each worker constructs `/api/v2/pokemon-species/{id}` and validates matching species
  identity, at most 128 varieties, exact canonical Pokémon reference URLs, unique variety
  IDs/names and exactly one `is_default: true`. Position, numeric equality and name
  similarity are never used to select the default. Referenced URLs are never followed.
- One normalized persistent mapping per species:
  `pokeapi-v2:normalized-v1:species-default-variety/{id}`. Same-species work deduplicates
  across overlapping batches and existing mappings are revalidated against the requested
  species. Existing configurable TTL (24h default) and stale-if-error apply; original
  source timestamps are retained. Malformed/wrong-species mappings cannot rescue failures.
- Two workers per mapping batch; at most two distinct mapping batches per instance,
  with identical ordered requests joining the same in-flight batch. This pool is separate
  from the summary batch pool, while every resource operation shares the same four-slot
  global admission budget with types/generations/pages/details. New batch admission
  beyond the cap returns 503 `CATALOG_BUSY`; resource contention is per-item unavailable.
  No unbounded queue or whole-generation enrichment is introduced.
- Response bodies are capped at 1 MiB streamed/decompressed bytes, including misleading
  Content-Length handling. Invalid identity/defaults/references/body/JSON/UTF-8 fail
  without retry. Timeout/transport/HTTP failures retain one bounded retry. A twelve-item
  transient outage permits at most 24 upstream attempts, never Pokémon-detail fan-out.
- Species HTTP 404 becomes `SPECIES_NOT_FOUND` without retry and does not use expired
  stale data. Other expected per-item codes are `INVALID_UPSTREAM`, `UPSTREAM_UNAVAILABLE`,
  `CACHE_UNAVAILABLE` and `CATALOG_BUSY`. Ready items survive other failures in the same
  HTTP 200 response. Unexpected failures use the sanitized HTTP 500 envelope; raw upstream
  data, database traces and credentials are not exposed.

No combined generation/type query, UI generation control, migration, env or dependency
change. A future card consumer must validate summary identity, owning species and
`isDefault` against the mapping, and preserve both sources' freshness/failure states.
Source: [PokéAPI Pokémon Species / varieties](https://pokeapi.co/docs/v2#pokemon-species).

## Species introduced in a generation — PL-007

`GET /v1/pokemon-species?generation=1&page=1&pageSize=20` returns a
`GenerationSpeciesPageResponse`: `generation: { id, name }`,
`items: [{ speciesId, name }]`, `page`, `pageSize`, `total`, `hasNext` and `meta`.
The schema is shared and exposed by OpenAPI. Items are species references, with no
Pokémon entry ID, artwork, types, form metadata or implied default variety.

- Required `generation`: one canonical numeric string 1–9, pinned supported scope I–IX
  verified against the upstream generation list. Generation ID and canonical name must
  agree. This is **species introduction**, not every Pokémon obtainable in a game, a
  regional Pokédex, historical typing or a form's release generation.
- Same pagination defaults/bounds as the entry route: page 1–1000 (default 1), size
  1–50 (default 20). Missing/empty/unknown/repeated/comma-separated generation, names,
  whitespace/leading-zero variants, invalid pagination and any extra parameter
  (`type`, `search`, etc.) return 400 `INVALID_GENERATION_QUERY` before upstream access.
  `/v1/pokemon?generation=…` remains unsupported: species and entries are distinct.
- One constructed `/api/v2/generation/{id}` request per attempt. `pokemon_species`
  references must use exact canonical `https://pokeapi.co/api/v2/pokemon-species/{id}/`
  URLs, bounded IDs and valid names. URLs are parsed as identifiers and never followed.
  Unique IDs/names are required; output is sorted by numeric species ID. No species or
  Pokémon detail requests are made. Total is index length, never a production constant.
- Persistent key: `pokeapi-v2:normalized-v1:generation-species-index/{id}`. All pages/sizes
  share one index and in-flight load. Other generations/types/entry pages remain isolated.
  Cache reads and upstream work share the existing four-slot admission budget. Existing
  loads can be joined when saturated; new distinct work returns 503 `CATALOG_BUSY`.
- Maximum 10,000 species references and 1,048,576 streamed/decompressed bytes. Oversized
  declared lengths fail early; streamed bytes are counted regardless of header accuracy.
  Wrong ID/name, invalid references/duplicates, excessive bodies, bad JSON/UTF-8 return
  502 `INVALID_UPSTREAM` without retry. Transport interruption/timeouts/unavailable HTTP
  statuses (including absent supported-generation resources) use one bounded retry,
  then 503 `UPSTREAM_UNAVAILABLE`. Unread bodies are cancelled before retry.
- Existing configurable TTL (24h default) and stale-if-error apply. Cache identity,
  order and uniqueness are revalidated. Original index `fetchedAt` is retained across
  pages and stale fallback. Database read failures return 503 `CACHE_UNAVAILABLE` without
  upstream access; malformed/wrong-generation cache cannot rescue failures. Out-of-range
  pages return 200 with `items: []`, `hasNext: false` and generation/freshness metadata.

PL-008 supplies the bounded resolver described above. A card consumer must resolve
`varieties` before requesting Pokémon summaries; never reuse `speciesId` as a Pokémon ID
or assume species names identify default varieties. Combined filters and visual generation
controls remain unimplemented. No migration, env or dependency change.

Source semantics: [PokéAPI Generations](https://pokeapi.co/docs/v2#generations),
[Pokémon Species](https://pokeapi.co/docs/v2#pokemon-species).

## Single-type reference filtering — PL-005

`GET /v1/pokemon?type=electric&page=1&pageSize=20` returns the existing page envelope,
plus `type: 'electric'`. Omitting `type` preserves the original unfiltered response shape
without a `type` property. Pagination defaults/bounds stay page 1–1000 and size 1–50,
default size 20. The shared `pokemonCatalogPageResponseSchema` documents both shapes.

- One canonical lowercase name from the existing 18-type enum. Empty, whitespace/case
  variants, numeric type IDs, repeated/array values and comma-separated selections are
  rejected. `search`, `generation` and other unsupported combinations return 400
  `INVALID_PAGINATION` before upstream access. No silent AND/OR or type alias behavior.
- The adapter performs one constructed `/api/v2/type/{type}` request per attempt. Its
  `pokemon` membership is validated for requested type name, slots 1/2, exact canonical
  Pokémon URLs and unique normalized entry IDs/names. Referenced URLs are never followed.
  There is no list/detail/species fan-out. Primary and secondary type memberships count.
- Current PokéAPI entry/form membership only; neither species deduplication, generation
  introduction nor historical type changes/battle effects are inferred. Results are sorted
  by numeric entry ID. Total is the validated index length, never a hardcoded catalog count.
- One normalized persistent index per type:
  `pokeapi-v2:normalized-v1:pokemon-type-index/{type}`. Pages/sizes share in-flight work
  and cache entries; no per-page index duplication. A second API/service instance reads
  the same PostgreSQL payload. Cached identity, sortedness and uniqueness are revalidated.
- Maximum 10,000 references and 1,048,576 streamed/decompressed response bytes. An oversized
  declared Content-Length is rejected early; missing or misleading lengths cannot bypass
  streamed byte counting. Invalid JSON/UTF-8, excessive data, wrong type and malformed or
  duplicate references return 502 `INVALID_UPSTREAM`, with no retry. Interrupted streams,
  network errors, unavailable HTTP statuses (including a missing supported type resource)
  use the existing bounded retry/503 policy. Unread error bodies are cancelled before retry.
- Type-index loading uses the shared four-slot admission budget, including cache reads.
  An in-flight index can be joined by other pages even when all slots are occupied; a
  new index/page/detail beyond the limit returns 503 `CATALOG_BUSY`. No unbounded queue.
- Existing cache TTL (24h default) and stale policy apply. Page `meta` preserves the index's
  original `fetchedAt`; validated expired data may rescue upstream failure with `stale: true`.
  Invalid/wrong-type cache content cannot be used as fresh or stale data. Beyond-total
  pages return HTTP 200 with `items: []`, `hasNext: false` and the selected type.
- PL-006 consumes this API through `/pokedex?page=1&type=electric`, preserving the
  filter through pagination, retry and detail return. Web page size remains fixed at 12;
  search/type combinations remain explicitly unsupported.
  No dependency, environment or migration changes.

## Bounded card summaries — PL-002

`GET /v1/pokemon/summaries?ids=1,25,10025` returns ordered results:

```ts
{
  items: (
    | {
        id: number;
        status: 'ready';
        data: PokemonSummary;
        meta: { source: 'pokeapi-v2'; fetchedAt: string; stale: boolean };
      }
    | {
        id: number;
        status: 'unavailable';
        code: 'POKEMON_NOT_FOUND' | 'INVALID_UPSTREAM' | 'UPSTREAM_UNAVAILABLE'
          | 'CACHE_UNAVAILABLE' | 'CATALOG_BUSY';
      }
  )[];
}
```

`PokemonSummary` is a projection of the shared detail schema: `id`, `name`, `species`
(`id`, `name`), `isDefault`, nullable `artwork`, and one or two validated `types`.
Types and image URLs come from validated detail responses; no URL or type is inferred
from an ID. Entry IDs can differ from species IDs. `PokemonCard` accepts this DTO.

- Required `ids`: comma-separated canonical integers 1–999999, 1–12 distinct IDs,
  maximum 83 characters. No names, whitespace, leading zeroes, repeated parameters,
  extra query fields or duplicate IDs. Invalid queries return 400 `INVALID_SUMMARY_QUERY`
  before any upstream call. Summary routing precedes dynamic detail routing.
- HTTP 200 can contain ready and unavailable items, even when all items are unavailable.
  Missing artwork remains `null` on a ready item. An unavailable item has no data/freshness;
  clients can join its ID with the reference page for its label. Missing entries are not
  removed from the result. Unexpected internal failures return sanitized HTTP 500.
- At most two workers per batch, with no unbounded queue. They use the existing four
  admission slots shared with page/detail requests, including cache reads. Under contention,
  affected items can report `CATALOG_BUSY`; the client may retry explicitly.
- At most two distinct in-flight batches per instance. An identical ordered ID list joins
  its in-flight batch; a third distinct batch returns HTTP 503 `CATALOG_BUSY`. Reordering
  IDs changes the batch key, but overlapping detail keys still deduplicate.
- A cold batch of 12 IDs makes at most 12 detail requests plus one transient retry each
  (24 upstream attempts), never a list/species request. Each attempt retains the configured
  timeout. Six two-worker waves mean a slow cold batch can take roughly 62 seconds at the
  default timeout (roughly 182 seconds at the maximum setting). This is bounded enrichment,
  not a measured low-latency catalog guarantee; future UI should request visible groups
  and render reference placeholders without waiting for all details.
- Existing persistent normalized detail entries are reused, not copied into a second
  summary cache. Each ready item exposes its own original freshness, including stale
  fallback. Failures are never persisted as successful detail or summary data.
- Numeric detail reads and upstream responses must match the requested entry ID. An
  otherwise valid cached Pokémon under a different numeric key cannot be served or used
  as stale fallback. No new dependency, environment variable or database migration.

## Paginated entry references — PL-001

`GET /v1/pokemon?page=1&pageSize=20` returns:

```ts
{
  items: {
    id: number;
    name: string;
  }
  [];
  page: number;
  pageSize: number;
  total: number;
  hasNext: boolean;
  meta: {
    source: 'pokeapi-v2';
    fetchedAt: string;
    stale: boolean;
  }
}
```

- Defaults: page 1, page size 20. Bounds: page 1–1000, page size 1–50;
  maximum offset 49,950. Only canonical positive integer query strings are accepted.
- Unknown fields (including `search`, `generation`, `offset`, `limit`) and repeated/array
  fields return 400 `INVALID_PAGINATION`. PL-005 adds the optional single-type variant
  documented above; list search and generation filters remain unsupported. PL-004 web
  exact lookup uses the separate detail endpoint.
- One attempt calls the constructed `/api/v2/pokemon/?limit=…&offset=…` path.
  Entry reference URLs must match the exact Pokémon resource origin/path and a
  supported numeric ID. Reference, next and previous URLs are never followed.
- Entries are Pokémon/form-specific references, not species. No artwork, types,
  species or detail requests are invented or inferred for a list item. Card-summary
  enrichment is explicit through the separate PL-002 endpoint and request budget above.
- `total` comes from the validated upstream count, not a pinned Pokémon/species total.
  `hasNext` is computed from offset, returned length and total. A page beyond the
  total returns 200 with an empty `items` array and `hasNext: false`.
- Responses require the expected number of entries for their count/page, with unique
  IDs/names. A truncated, duplicate, oversized or otherwise inconsistent page yields
  502 `INVALID_UPSTREAM`. A missing upstream listing is treated as 503 availability
  failure, rather than a missing individual Pokémon.
- Pages use the same persistent TTL and stale-if-error policy as details, in a
  distinct `pokeapi-v2:normalized-v1:pokemon-page/{page}/{pageSize}` cache namespace.
  Cache payloads are revalidated and must match the requested pagination.
- Equivalent default/explicit queries share in-flight work. List and detail requests
  share the same four-slot admission limit. A cache hit makes no upstream request;
  an uncached page makes one attempt, plus at most one transient retry. No detail fan-out.

## Individual Pokémon detail — M0

The identifier is trimmed and lowercased: positive integer IDs up to six digits or
lowercase hyphen-separated names, maximum 64 characters. Invalid paths and arbitrary
URLs are rejected before network access. No caller-controlled upstream origin or redirect.

Response schema is generated from `packages/contracts` into OpenAPI. Example shape:

```ts
{
  data: {
    id: number; name: string;
    species: { id: number; name: string };
    isDefault: boolean; artwork: string | null;
    types: PokemonType[];
    heightMeters: number; weightKg: number;
    stats: { name: StatName; value: number }[];
    abilities: { name: string; hidden: boolean }[];
  };
  meta: { source: 'pokeapi-v2'; fetchedAt: string; stale: boolean };
}
```

Pokémon IDs identify entries/forms, not necessarily species. The species ID is parsed
from a validated species resource reference, which is never fetched as an arbitrary URL.
All six unique base stats and one or two unique supported types are required.
Artwork is nullable and allowlisted to PokéAPI's sprite repository. Missing optional
artwork and an empty ability list remain explicit; data is never invented.

Errors: `{ code, message, requestId }`, with sanitized Portuguese messages and no
stack trace. Statuses: 400 invalid identifier, 404 absent Pokémon, 502 incompatible
upstream payload, 503 unavailable upstream/admission limit. Unexpected internal
failures are sanitized to 500. Errors are not persisted as successful cache entries.

## Cache and request policy

- PostgreSQL stores normalized validated public DTOs with source/schema version in
  the key, `fetchedAt`, and `expiresAt`. Reads revalidate payloads.
- Default TTL 24 hours; configurable between 60 seconds and 7 days.
- Same canonical identifier shares in-flight work per API instance. Four distinct
  requests can be active; excess requests receive a bounded 503 instead of queuing.
- Each upstream attempt has a 5-second default timeout (100–15000 ms configurable).
  Transient failures retry once after a 150–249 ms jittered delay. No 404/schema retries.
- If upstream fails transiently or with a schema mismatch, validated expired public
  data can be returned with `stale: true` and its original `fetchedAt`.
- No transient failure caching, bulk scraping, startup prefetch, or Redis. Numeric
  and named aliases have separate cache keys. Cache rows currently need an operational
  retention policy before public deployment; stale responses have no age cutoff yet.
- Database connection timeout 2 seconds, pool max 4. Cache writes log only a generic
  failure and do not discard a valid upstream response. Reads depend on PostgreSQL.
- Per-instance admission limits are not distributed rate limiting. That and HTTP
  edge controls are deployment work, not evidence of load-tested production readiness.

Upstream documentation and fair-use policy: [PokéAPI v2](https://pokeapi.co/docs/v2).

## Web consumption — PL-003

`/pokedex` uses fixed 12-entry reference pages and accepts only canonical `page` query
strings (1–1000). Unknown, repeated or unsupported query fields show an explicit invalid
page state. The browser requests summaries in sequential groups of four from the
same-origin web route `GET /api/catalog/summaries?ids=…`. This is a Next.js gateway,
not a second catalog service: it validates the shared bounded query, rejects repeated
fields, forwards only the constructed NestJS summary path and validates returned IDs/order.
Success and availability-error responses use `Cache-Control: no-store`; unsafe input
returns 400 `INVALID_SUMMARY_QUERY`, upstream/validation failures return sanitized
503 `CATALOG_UNAVAILABLE`. Upstream messages/traces are not forwarded.

Reference fetch timeout is 15 seconds. The gateway retains a bounded 185-second timeout
for the full twelve-ID API contract; the four-ID browser batches have a 70-second timeout
and are cancelled on navigation. NestJS may finish admitted work after disconnect.
No background page prefetch or automatic retry loop; failed IDs can be retried explicitly.
The server API origin remains private to server modules; no new environment variable,
public upstream access, dependency or migration is introduced.

## Exact name/ID search — PL-004 web query

`/pokedex?search=pikachu` and `/pokedex?search=25` use one existing
`GET /v1/pokemon/:idOrName` call. No search parameter is sent to the NestJS listing route,
no whole-catalog index is downloaded and no summary batch is needed for the single result.
The existing detail timeout (15 seconds), cache, retry and stale policy remain unchanged.

- Complete PokéAPI entry name or numeric ID only, case-insensitive with outer whitespace
  trimmed. Up to 64 raw characters; positive IDs 1–999999 without leading zeroes;
  ASCII canonical names allow internal hyphens. No accent/localized-name aliases,
  substring/fuzzy matching or automatic suggestions are implemented.
- Search and page queries are mutually exclusive. Unknown/repeated/array parameters,
  invalid paths/URLs and oversized terms show an invalid query state before fetching.
  Empty/whitespace search returns to `/pokedex`. Valid noncanonical case/spacing redirects
  to the normalized search URL before requesting a Pokémon.
- One normalized result, explicit not-found for HTTP 404, availability/error state for
  failed or malformed data, and original stale freshness where available. A schema-valid
  response for a different requested ID or name is rejected as an availability error.
- Form submission is explicit (Enter/button); 300 ms validation debounce never fetches.
  Clear/Escape return to browsing. The HTML form can submit before client hydration.
  Async results remain streamed inside Suspense; no full JavaScript-free UI claim.
- `fromSearch` on detail links is bounded/validated, URI-encoded, and reconstructed as
  an internal catalog URL. Ambiguous or invalid return inputs fall back to page 1;
  arbitrary caller-supplied return URLs are never followed.
- No dependency, environment, database migration or production NestJS change.
