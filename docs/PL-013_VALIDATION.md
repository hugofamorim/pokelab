# PL-013 — Version-scoped move APIs

Date: 2026-10-25 (America/Sao_Paulo).
Branch: `feat/pl-013-versioned-moves`, based on integrated `main` at `3633611`.
PR #15 was verified merged before work. The repository moved from G: to F: at the
user's request; no source was reinitialized. All mandatory documents were present and
reviewed, alongside the existing logo/assets. The pre-existing generated `next-env.d.ts`
change is preserved under ignored `.cache/pl-013-next-env.original` and excluded from commits.

## Scope and decisions

- Add an explicit-entry/explicit-version-group paginated learn-record endpoint. Retain
  move identity, method, level, nullable order, owning species/default identity, groups
  found in the source and source freshness. No assumed latest game, species/entry equality,
  automatic move enrichment, competitive legality or absence-as-impossibility claim.
- Add independent individual move metadata, explicitly marked current-source, with
  nullable power/PP/accuracy, priority, type/class and selected historical change fields.
  Original version boundaries are preserved; historical battle stats/effects are not
  derived. Current attributes cannot silently stand for a selected game's attributes.
- Reuse the adapter/service/cache separation, shared contracts and four resource slots;
  per-resource deduplication/cache with group/page projection afterward; bounded source
  bytes/collections, one retry, timeouts, error sanitization and stale-if-error.
- No frontend/domain-framework change, dependency, environment or database migration.
  Moves UI and combined type/generation filtering remain later M1 tasks.

## Source evidence

Source: [PokéAPI v2 Pokémon](https://pokeapi.co/docs/v2#pokemon) and
[Moves](https://pokeapi.co/docs/v2#moves). On 2026-10-25, two explicit GETs captured
projections of `/pokemon/25` and `/move/204`, stored in `pikachu-moves.json` and
`move-charm.json`. Learning arrays are complete; unrelated Pokémon fields and move
effects/localized text are intentionally outside this projection. Charm demonstrates
current Fairy type with a separate Normal type historical boundary at `x-y`.
All CI tests use these fixtures or explicitly labeled synthetic boundary mutations.

## Verification status

- Frozen dependency installation passed after moving the checkout; Node 24.20.0,
  pnpm 12.6.0 and the existing lockfile remain unchanged.
- PostgreSQL Compose service is healthy. No migration added.
- Targeted contracts/API checks passed: 185 contract tests and 353 API tests.
- Formatting, ESLint, strict monorepo typecheck and production build passed. A test mock's
  cancellation callback required an explicit void return type; corrected without disabling
  any check. The web build retains Cache Components and partial prerendering.
- Full suite: 698 tests passed (domain 5, contracts 185, API 353, web 155). The 66 new
  tests cover version isolation, repeated learning methods, zero/null preservation,
  identity contradictions, canonical paths, duplicate/oversized records, streamed byte caps,
  404/retry/timeout, cross-group/page deduplication/cache, stale rescue, cache corruption,
  shared admission/release, database outage, HTTP validation/sanitization and OpenAPI.
  The domain suite was also run directly in F: to confirm the moved checkout independently
  from Turbo's previous G: cache log. PostgreSQL persistence integration passed.
- All 50 existing offline Playwright scenarios passed in one run (1.7 minutes), with
  retries still zero and global timeout unchanged. They cover 375/768/1280/1600px,
  keyboard/200% zoom, progressive loading, missing artwork/source data, errors/retries,
  history/return URLs and evolution condition/mapping/cancellation behavior. No UI changed.
  Existing screenshots remain under ignored `artifacts/` and CI artifact capture is retained.
- Production API real-source smoke passed: Pikachu had 27 moves in `red-blue`, 30 in
  `yellow` and 26 groups with source records. Repeated requests and different groups reused
  the same fetched timestamp. Charm retained Fairy current type and separate Normal
  historical type. Real `pikachu-rock-star` kept entry 10080 versus species 25, default false,
  with no records in requested group 1; no game-availability inference was made.
- Local API/web production servers were restarted from F: on ports 3001/3000. No secrets,
  dependency updates, migrations or user-generated files were added to commits.
- Published in [PR #16](https://github.com/hugofamorim/pokelab/pull/16), targeting
  integrated `main` with no unmerged dependency. Linux CI is pending at publication;
  the PR checks record the final revision's result. No merge is performed by this task.

## Remaining work and limitations

- PL-014: curated detail UI, explicit group control, version-labeled metadata,
  independent loading/error/empty/stale states, bounded enrichment, identity cross-checks,
  keyboard/responsive acceptance. Fully disabled-JS detail remains unsupported.
- Combined type/generation filtering and final integrated M1 acceptance remain.
- No batch metadata endpoint or historical battle-value resolver. No effects/text
  localization, machine IDs or regional/game availability inference in this increment.
- Distinct Pokémon projections can fetch the same upstream resource separately per TTL.
  Existing cache-retention, unlimited stale age and deployment rate-limit work remains.
