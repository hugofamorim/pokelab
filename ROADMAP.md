# PokéLab — Incremental Delivery Roadmap

Never claim a milestone done until acceptance tests pass, reviewable changes are committed, docs updated and the PR checks are green.

## Current execution

M0 / PL-000 passed local and Linux CI acceptance and was merged in [PR #1](https://github.com/hugofamorim/pokelab/pull/1).
See [`docs/M0_VALIDATION.md`](docs/M0_VALIDATION.md) for the recorded acceptance evidence.

M1 is in progress. PL-001 (`feat/pl-001-paginated-catalog`) implements the bounded
reference-list API, shared contracts, persistent page cache, and offline tests.
See [`docs/PL-001_VALIDATION.md`](docs/PL-001_VALIDATION.md) for checks and review status.
PL-001 was merged into `main` in [PR #2](https://github.com/hugofamorim/pokelab/pull/2).
PL-002 (`feat/pl-002-card-summaries`) adds bounded summary batches with real types/artwork,
per-item availability/freshness and shared detail caching. [PR #3](https://github.com/hugofamorim/pokelab/pull/3)
was merged into the PL-001 branch afterward; [PR #4](https://github.com/hugofamorim/pokelab/pull/4)
subsequently merged the same validated PL-002 commits into `main`. See
[`docs/PL-002_VALIDATION.md`](docs/PL-002_VALIDATION.md) for checks and review status.
PL-003 (`feat/pl-003-catalog-ui`) adds the responsive `/pokedex` UI with URL pagination,
progressive summary batches, failure/retry/empty/stale states and page-preserving detail
navigation. PR #5 was merged into the old PL-002 branch after #4 reached `main`;
[integration PR #6](https://github.com/hugofamorim/pokelab/pull/6) subsequently merged PL-003 into `main`. See
[`docs/PL-003_VALIDATION.md`](docs/PL-003_VALIDATION.md).
PL-004 (`feat/pl-004-name-id-search`) adds exact name/ID lookup with URL state, explicit
submission, debounced validation, clear/Escape, failure/empty/stale states and search-aware
detail return/history restoration. [PR #7](https://github.com/hugofamorim/pokelab/pull/7)
was merged into `main` after #6. See
[`docs/PL-004_VALIDATION.md`](docs/PL-004_VALIDATION.md).
PL-005 (`feat/pl-005-type-filter-api`) starts from integrated `main` at `66ba715` and adds
the single-type reference-list API, normalized persistent membership index, bounded source
responses, shared admission/deduplication and offline tests. See
[`docs/PL-005_VALIDATION.md`](docs/PL-005_VALIDATION.md).
PL-006 (`feat/pl-006-type-filter-ui`) builds on PL-005 with responsive single-type controls,
URL pagination/reset, filter-aware detail return and offline browser coverage. See
[`docs/PL-006_VALIDATION.md`](docs/PL-006_VALIDATION.md) for actual validation status.
PL-007 (`feat/pl-007-generation-reference-api`) adds the bounded species-introduction
generation API, with explicit species IDs, one shared persistent index per generation,
strict identity/body validation, offline HTTP/cache/admission tests and OpenAPI.
See [`docs/PL-007_VALIDATION.md`](docs/PL-007_VALIDATION.md).
PL-005/006/007 were integrated into `main` through PRs #8, #9 and #10.
PL-008 (`feat/pl-008-default-variety-resolution`) starts from integrated `main` at
`3c714c3`, adding bounded explicit default-variety mappings, per-item failures/freshness,
shared cache/admission and offline tests. See [`docs/PL-008_VALIDATION.md`](docs/PL-008_VALIDATION.md).
PL-009 (`feat/pl-009-generation-controls`) builds on PL-008 with responsive native
generation links, URL pagination/reset, validated mapped cards in bounded same-origin
batches, independent source freshness, partial failures/retry and generation-aware detail
return. PL-008 and PL-009 were integrated into `main` through
[PR #11](https://github.com/hugofamorim/pokelab/pull/11) and
[PR #12](https://github.com/hugofamorim/pokelab/pull/12). See [`docs/PL-009_VALIDATION.md`](docs/PL-009_VALIDATION.md).
PL-010 (`feat/pl-010-species-descriptions`) starts from integrated `main` at `c54f47d`,
adding a bounded cached species-description endpoint and an independently streamed
detail panel, explicit source language/version, fallback, empty/error/retry/stale states.
Integrated into `main` in [PR #13](https://github.com/hugofamorim/pokelab/pull/13).
See [`docs/PL-010_VALIDATION.md`](docs/PL-010_VALIDATION.md) for actual checks and review status.
M1 as a whole is not complete: combined filter controls and final acceptance remain.
PL-011 (`feat/pl-011-evolution-chain-api`) builds on PL-010 head `e133952`,
resolving species to bounded cached evolution trees with independent resource freshness,
explicit parent relationships and complete source version/form conditions. PL-011 was
integrated into `main` through PR #14 after PL-010 PR #13.
Published in [PR #14](https://github.com/hugofamorim/pokelab/pull/14).
See [`docs/PL-011_VALIDATION.md`](docs/PL-011_VALIDATION.md) for actual checks and review status.
PL-012 (`feat/pl-012-evolution-panel`) builds on PL-011 head `36bbdda`, adding the
independent evolution panel, real species nesting, native scoped-condition disclosures
and validated on-demand default-variety navigation. Main was `01c8d0f` at audit;
PR #14 was open at audit and merged before publication. PL-012 is published in
[PR #15](https://github.com/hugofamorim/pokelab/pull/15), with no unmerged dependency. See
[`docs/PL-012_VALIDATION.md`](docs/PL-012_VALIDATION.md) for actual checks/review status.
PL-012 was integrated into `main` through PR #15 at `3633611`.
PL-013 (`feat/pl-013-versioned-moves`) starts from that integrated main and adds
bounded version-scoped Pokémon learning records and individual current-source move
metadata, preserving method/level/order and selected historical change fields.
See [`docs/PL-013_VALIDATION.md`](docs/PL-013_VALIDATION.md) for actual acceptance status.
Published for review in [PR #16](https://github.com/hugofamorim/pokelab/pull/16).
PL-013 was integrated into `main` through PR #16 at `bdb395a`.
PL-014 (`feat/pl-014-moves-panel`) builds on PL-013 head `131722f`. PR #16 was open
at audit and was merged before publication, verified against `main` at `bdb395a`.
No unmerged dependency remains; no merge is performed by this task.
The moves panel adds explicit version-group selection, URL pagination/return context,
native learning disclosures and single-selection current metadata/history with independent
failure/freshness. See [`docs/PL-014_VALIDATION.md`](docs/PL-014_VALIDATION.md).
Published for review in [PR #17](https://github.com/hugofamorim/pokelab/pull/17),
targeting integrated `main` without pending dependencies.
PL-014 visual follow-up, requested before continuing M1: section navigation now shows
only the selected tab's content, retaining hash/history, keyboard operation and movement
query state. See [`docs/PL-014_TABS_VALIDATION.md`](docs/PL-014_TABS_VALIDATION.md).
PL-014, including its requested tabs revision, was integrated into `main` through
[PR #17](https://github.com/hugofamorim/pokelab/pull/17) at `815069d`.
PL-015 (`feat/pl-015-combined-filter-api`) starts from that integrated main, adding
bounded candidate scans combining current entry type and species-introduction generation.
It preserves explicit form/species identity, partial outcomes, keyset progress and independent
source freshness while reusing the existing resource caches/admission. See
[`docs/PL-015_VALIDATION.md`](docs/PL-015_VALIDATION.md) for actual validation/review status.
Published for review in [PR #18](https://github.com/hugofamorim/pokelab/pull/18),
targeting integrated `main` without pending dependencies.
Next issue: PL-016, combined filter controls and progressive candidate consumption,
with explicit labels, query/return state, partial failures, source-change resets and native
accessible navigation. Candidate scans are not conventional pages of all filtered matches.
Combined filter UI and final integrated acceptance remain before completing M1.
M2–M5 have not started.

## M0 — Foundation and external API (priority P0)

- Initialize pnpm/Turbo monorepo: web, api, pokemon-domain, contracts, optional ui.
- Configure strict TypeScript, formatting/lint, unit test runners, runtime schema validation, Docker/Postgres, example env, CI.
- Define normalized Pokemon DTO and PokéAPI adapter, local cache and deterministic mocked tests.
- Implement GET `/v1/pokemon/:idOrName`, homepage shell, error/loading handling.
- Acceptance: one Pokémon renders from normalized API DTO; second request hits cache in integration test; no secret committed; lint/typecheck/test/build pass.

## M1 — Pokédex experience (P0)

- Search by name/ID; pagination; type/generation filters and URL state.
- Detail screen with stats, types, evolutions, abilities, curated moves; localization fallback; accessibility.
- Acceptance: test search/filter/query URL, missing-art and missing-data cases, error retries, responsive/mobile, build with Cache Components.

## M2 — Team Builder (P0)

- Six-slot editor with add/remove/reorder, team name, local versioned persistence, share-by-URL import/export.
- Validate imported payload, maximum size, unsupported IDs/forms, duplicates according to explicitly selected rule.
- Acceptance: draft survives refresh; malformed links fail safely; keyboard reorder possible; no login required.

## M3 — Type Analyzer (P0)

- Commit canonical 18-type chart and ruleset fixture, implement pure deterministic domain algorithms.
- Defensive heatmap, team aggregation, weakness overlap, explicit type-only offensive approximation with disclaimers.
- Acceptance: full 18 x 18 test matrix, dual typing 4x/0.25x/immunity tests, team-level snapshot test, results explained to user.
- At end of M3, a guest can fully experience core portfolio demo.

## M4 — Accounts and cloud teams (P1)

- User auth, sessions, email verification, password reset, private teams CRUD, favorites, share snapshots, ownership checks.
- Guest import after login, migration-safe schema, rate limiting and authorization tests.
- Acceptance: teams sync across devices; other users cannot read/update private teams; revocation works; auth/session edge-case tests pass.

## M5 — Showcase and polish (P1)

- E2E across guest and logged-in flows, performance/accessibility audits, responsive visuals, SEO, Open Graph, architecture screenshots, README walkthrough, demo seed, deploy.
- Acceptance: documented deploy from clean checkout, smoke tests, no failing CI jobs, demo links valid and branding disclaimer shown.

## Future / post-MVP (separate proposal)

- Side-by-side matchups using defined move rules; learnset game-version validation, alternate rulesets; sophisticated moveset recommendations; export team image; optional localized descriptions. Not a full battle simulator without a separate rules engine spec.

## Pull-request checklist

- Issue and goal documented; baseline reproduced.
- Small scoped changes; tests written or explicit reason not applicable.
- `pnpm lint`, `pnpm typecheck`, `pnpm test`, `pnpm build` run as appropriate, results reported faithfully.
- No credentials; migrations reviewed; API contract and docs updated; images/license compliance checked.
- Branch pushed only with authorized access; PR created; Actions checked; no bypassing failing checks.
