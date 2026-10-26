# PL-015 — Bounded combined-filter API

Date: 2026-10-25 (America/Sao_Paulo).
Branch: `feat/pl-015-combined-filter-api`, based on integrated main `815069d` after PR #17.
All mandatory product/architecture/domain/roadmap guidance was reviewed; existing design/assets
are preserved and no UI is modified. No required documentation was missing. The original
generated `next-env.d.ts` difference is backed up under ignored `.cache/pl-015-next-env.original`
and excluded from commits. No merge is performed by this task.

## Decisions and acceptance

- Explicit semantics: current Pokémon entry type AND introduction generation of its owning
  species. Type/generation indexes reference different resource kinds; join through normalized
  Pokémon data, never equal IDs/name-prefix guesses. Nondefault variants are included as
  separate entries, without inferring their introduction date or game availability.
- Separate `filter-scan` endpoint: defaults four/max twelve candidate references, exclusive
  entry-ID cursor, ordered match/excluded/unavailable results. No automatic match-page fill,
  global match total, all-index drain or new indexing infrastructure. Candidate total is the
  entire selected type index. Empty match windows are not global empty results; failures
  remain unknown and consume progress. This bounded REST v2 join prepares progressive UI.
- Reuse type/generation/detail caches and in-flight work, TTL/stale metadata and four resource
  slots. At most two distinct scan operations, existing two summary workers/two batches, and
  two index reads plus at most twelve details per cold request. Both indexes settle before
  scan admission releases, including one-sided failure/admission rejection. No nested slots.
- Validate entry ID/name/type and species ID/name in both directions across source indexes.
  Index failures remain top-level errors; detail failures remain partial items. No false
  exclusions for identity contradictions, unsupported payloads or unavailable sources.
- Detail adapter now uses the existing bounded reader, capped at 2 MiB streamed/decompressed
  per resource (including standalone details and summaries). Source DTO/cache formats remain
  compatible. Existing indexes keep 1 MiB/10,000-member caps. No retry on schema/404 detail
  failure; expired validated public resources retain original per-source freshness on rescue.
- No frontend, pure-domain code, dependency, migration, environment variable or asset change.
  Existing single-filter endpoints and web modes are preserved. Source snapshots may change
  between calls; future UI must reset progress when index timestamps change and retain unknowns.

## Source and fixtures

Primary reference: [PokéAPI v2](https://pokeapi.co/docs/v2), especially Type, Generation and
Pokémon resources. Existing electric/generation-I/Pikachu captures are reused. On this date,
explicit resources `/pokemon/309`, `/pokemon/10100` and `/generation/3` were captured as
`filter-pokemon-309.json`, `filter-pokemon-10100.json`, `generation-iii.json`. Unrelated detail
fields are projected out; source facts remain unchanged. A standalone `/pokemon/151` body
measurement was 675,204 UTF-8 bytes, below the conservative 2 MiB cap. Tests do not call live
PokéAPI: a controlled three-entry type subset uses captured facts; scheduling/boundary fixtures
are explicitly synthetic and never production application data.

## Validation checkpoint

- Frozen installation passed with unchanged lockfile/runtime; PostgreSQL Compose healthy,
  migrate deploy found no pending migrations. No schema added.
- ESLint and strict monorepo typecheck passed. Full unit/integration suite: 797 tests passed
  (domain 5, contracts 219, API 383, web 190); 64 new tests cover combined query/response bounds,
  identity/cursor/progress, real variant ownership, cross-source contradictions, cache reuse/
  corruption/stale rescue, retryable unknowns, scan/summary/global admission, two-worker bounds,
  one-sided index failure cleanup, exact/declared/streamed detail byte caps, HTTP and OpenAPI.
- Production monorepo build passed with Cache Components/partial prerendering retained.
- All 64 existing offline browser cases passed in one run (2.0 minutes), including the
  functional tabs, zoom, history/return context, evolution/moves and failure recovery.
  No browser assertion, timeout, retry policy or UI implementation was changed.
- Real production API smoke passed. Electric/generation-I windows returned Pikachu 25 and
  Raichu 26, followed exclusively by Magnemite 81 and Magneton 82. The type index contained
  114 current entries at capture time (candidate count, not combined matches). Alolan
  Raichu entry 10100 matched through species 26 with default false. Electrike 309 matched
  generation III and was excluded from I. Type/detail timestamps were reused across scans;
  exhausted cursor and duplicate-query rejection were verified. No bulk scan was performed.
- Local production API/web run from F: at ports 3001/3000. The source-measurement/test fixtures
  and smoke code remain independent from application data. Original generated difference
  is preserved. Published in [PR #18](https://github.com/hugofamorim/pokelab/pull/18),
  targeting integrated `main` without pending dependencies. Linux CI is pending at publication;
  the PR checks/description record the final head's result. M1 is not marked complete.

## Next work and limits

PL-016 adds combined controls and progressive consumption, safe URL/detail return context,
source-change reset, explicit zero-match-but-more/partial-failure/completed-unknown states,
keyboard/mobile/history and preserved functional detail tabs. Only then run integrated M1
acceptance. No historical form typing/game availability, multiple-type query, fuzzy search,
Team Builder, Analyzer or private persistence is introduced. Cache retention, unlimited stale
age and deployment-level rate limiting remain existing operational follow-ups.
