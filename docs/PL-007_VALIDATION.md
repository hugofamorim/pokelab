# PL-007 — Species-introduction generation API

Date: 2026-10-22. Branch: `feat/pl-007-generation-reference-api`.
M1 increment, based on PL-006 at `a46d207`. PRs #8 and #9 were open at audit time;
this PR targets `main` and includes their dependency commits until they merge.
No automatic merge or history rewriting.

## Decisions and implementation

PokéAPI generation resources list species, not form-specific Pokémon entries.
The separate `GET /v1/pokemon-species?generation=1&page=1&pageSize=20` route makes
that distinction explicit: `{ speciesId, name }` items, `{ id, name }` generation,
pagination and index freshness. Generation means species introduction, not historical
typing, game availability, regional Pokédex or form release generation. Default-variety
resolution is intentionally required before rendering generation Pokémon cards.

The official generation listing returned I–IX, now pinned supported scope. Shared
runtime contracts reject missing/repeated/unknown/noncanonical inputs and unsupported
type/search combinations. The adapter constructs one `/generation/{id}` request, validates
generation identity and canonical species references, requires unique IDs/names, sorts by
species ID and follows no supplied URLs. Source data is capped at 10,000 references and
1 MiB of streamed/decompressed bytes. Invalid schema/body/JSON/UTF-8 fails without retry;
transport/HTTP failures retain one bounded retry and timeout. Unread bodies are cancelled.

One normalized persistent index per generation under
`pokeapi-v2:normalized-v1:generation-species-index/{id}` serves every page/size.
Cross-query in-flight deduplication, four shared admission slots, existing configurable
24-hour default TTL and stale-if-error are reused. Cache identity/order/uniqueness are
revalidated. No new dependency, env, migration, database model or visual UI change.

Source: [PokéAPI Generations](https://pokeapi.co/docs/v2#generations),
[Pokémon Species](https://pokeapi.co/docs/v2#pokemon-species).

## Local validation

| Command                           | Result                                                      |
| --------------------------------- | ----------------------------------------------------------- |
| `pnpm install --frozen-lockfile`  | Passed; versions and lockfile unchanged                     |
| `docker compose ps`               | Existing PostgreSQL healthy                                 |
| `pnpm db:migrate`                 | Passed; no pending migrations                               |
| `pnpm format:check` / `pnpm lint` | Passed                                                      |
| `pnpm typecheck`                  | Passed across all four packages; Prisma generation included |
| `pnpm test`                       | 359 passed: domain 5, contracts 103, API 177, web 74        |
| `pnpm build`                      | Passed, Cache Components retained                           |
| `pnpm test:e2e`                   | All 28 existing browser scenarios passed                    |

There are 83 new automated cases (25 contracts, 58 API): query defaults/bounds/conflicts,
distinct species identities, ID/name mismatch, malformed/duplicate/unsafe references,
membership and byte caps, JSON/UTF-8/transport/HTTP/timeout handling, cache reuse across
instances, shared source timestamps, stale fallback and corrupt cache rejection,
cross-generation isolation, mixed generation/type/page/detail admission/join/recovery,
database outages, HTTP sanitization and OpenAPI response semantics.

The 28 offline browser scenarios regress catalog, type filter, exact search and detail at
375/768/1280/1600px, with keyboard, 200% zoom, loading/empty/error/stale/partial states,
missing images, URL pagination, history and detail return. No live PokéAPI calls occur
in CI. Existing UI/assets remain reused; no new visual screen is introduced.

## Real integration evidence

One `/api/v2/generation/1` resource was captured; only original `id`, `name` and
`pokemon_species` are retained in `apps/api/test/fixtures/generation-i.json`.
The production NestJS/PostgreSQL smoke returned 151 species at verification time,
with Bulbasaur/Ivysaur first and Charmander/Charmeleon/Charizard on page 2 of size 3.
These are observed source facts, never inferred Pokémon/form IDs or fixed totals.

Different pages/sizes preserved `fetchedAt: 2026-10-22T03:01:40.868Z`, `stale: false`.
Beyond-total page was empty; unsupported/repeated/combined generation queries returned
400, existing detail returned 200 and OpenAPI exposed explicit species semantics.
A separate Prisma process re-read and validated the same persistent 151-species index,
with expiry `2026-10-23T03:01:40.868Z`. A temporary smoke-script import needed the
workspace package's explicit built path; correcting that script completed verification.

Review: [PR #10](https://github.com/hugofamorim/pokelab/pull/10) targets `main` and
depends on #8/#9. Implementation/documentation head `764e215` was submitted to
[Linux CI #41](https://github.com/hugofamorim/pokelab/actions/runs/39714965984).
The [branch workflow history](https://github.com/hugofamorim/pokelab/actions/workflows/ci.yml?query=branch%3Afeat%2Fpl-007-generation-reference-api)
tracks subsequent heads; PR checks provide the final Linux result. No automatic merge.

## Remaining work

M1 is incomplete. PL-008 should resolve a bounded visible batch of species to their
explicit default Pokémon varieties with caching, concurrency and per-item failure states;
never assume matching species/entry IDs or names. Visual generation controls, combined
filters, evolution/moves/localization enrichment remain future work. Existing cache
retention/stale-age, alias duplication and production rate-limit limitations remain.
