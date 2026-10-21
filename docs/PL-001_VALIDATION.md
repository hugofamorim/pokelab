# PL-001 — bounded paginated catalog API

Scope: the first M1 increment, based on merged M0 commit `8ee5172`.
Branch: `feat/pl-001-paginated-catalog`. This does not complete M1.

## Behavior and decisions

- `GET /v1/pokemon?page=1&pageSize=20`, default 20/max 50 entries, max page 1000.
- Validated entry ID/name references, upstream total and computed `hasNext`.
  One upstream list request per attempt; no detail fan-out, species assumptions,
  fabricated type/artwork, caller-selected URLs, or full-catalog prefetch.
- Strict shared query/response schemas, including duplicate result and metadata checks.
- Reuses PostgreSQL JSON cache, freshness, retry/timeout and stale fallback. List and
  detail queries share four admission slots, with typed independent in-flight maps.
- No dependencies, environment variables, schema migrations, UI changes or new
  domain algorithms. Search and filters explicitly return 400 until implemented.
- Source: [PokéAPI resource lists/pagination and fair use](https://pokeapi.co/docs/v2/).
  A two-entry fixture was captured on 2026-10-21; synthetic variations are test-only.

## Local checks

- `pnpm install --frozen-lockfile`: passed, no lockfile changes.
- `pnpm db:migrate`: passed, no pending migrations.
- `pnpm lint`, `pnpm typecheck`, `pnpm build`: passed.
- `pnpm test`: 105 passed (domain 5, contracts 41, API 55, web client 4).
- `pnpm test:e2e`: 6 passed, preserving the existing detail experience at
  375/768/1280/1600px, missing/error/loading states, keyboard navigation and zoom.
- Real API smoke: page 1/size 2 returned Bulbasaur #1 and Ivysaur #2, upstream total
  1351 at observation time, `hasNext: true`; the repeat preserved `fetchedAt` and was
  not stale. Max-page request returned an empty page. Oversized page size returned 400. Pokémon #25 and both OpenAPI paths remained functional.
- `pnpm format:check`, `git diff --check`: passed after final formatting review.
- Remote acceptance: the feature branch's PR must pass the existing Linux CI
  workflow before PL-001 is accepted. [Current branch runs](https://github.com/hugofamorim/pokelab/actions/workflows/ci.yml?query=branch%3Afeat%2Fpl-001-paginated-catalog).

## Limits and next issue

M1 remains incomplete. PL-002 should provide bounded, cached summaries for real
type/artwork cards before the catalog UI. Lists contain entry references only.
There are no substring searches or type/generation filters yet. Totals may change
between separately cached pages as the upstream dataset changes. Existing M0 cache
limits (per-instance admission, unbounded stale age and operational retention) remain.
