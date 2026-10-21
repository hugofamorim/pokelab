# PokéLab — Incremental Delivery Roadmap

Never claim a milestone done until acceptance tests pass, reviewable changes are committed, docs updated and the PR checks are green.

## Current execution

M0 / PL-000 passed local and Linux CI acceptance and was merged in [PR #1](https://github.com/hugofamorim/pokelab/pull/1).
See [`docs/M0_VALIDATION.md`](docs/M0_VALIDATION.md) for the recorded acceptance evidence.

M1 is in progress. PL-001 (`feat/pl-001-paginated-catalog`) implements the bounded
reference-list API, shared contracts, persistent page cache, and offline tests.
See [`docs/PL-001_VALIDATION.md`](docs/PL-001_VALIDATION.md) for checks and review status.
PL-002 (`feat/pl-002-card-summaries`) adds bounded summary batches with real types/artwork,
per-item availability/freshness and shared detail caching. It is stacked on the still-open
PL-001 branch; no merge is performed automatically. See
[`docs/PL-002_VALIDATION.md`](docs/PL-002_VALIDATION.md) for checks and review status.
M1 as a whole is not complete: browsing UI, search, filters and detail enrichment remain.
Next issue: PL-003, paginated browsing UI using references and summary batches.
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
