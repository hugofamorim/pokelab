# PL-011 — Bounded species evolution API

Date: 2026-10-24 (America/Sao_Paulo); source timestamps are UTC.
Branch: `feat/pl-011-evolution-chain-api`, based on PL-010 head `e133952`.
Main was `c54f47d`; PR #13 was open/unmerged and green at audit. The new PR targets
`main`, retaining that dependency until the user merges it. No merge is performed here.
All mandatory documents were present; no source work or assets were overwritten.

## Implemented acceptance

- Shared strict Zod contract plus species-based endpoint
  `GET /v1/pokemon-species/:speciesId/evolution`. IDs 1–999999, canonical numeric path,
  no query parameters. Species IDs are not assumed Pokémon/form/chain IDs.
- Species-to-chain reference and actual chain are separately validated, normalized,
  cached and deduplicated. The first resource slot is released before the second is
  admitted; different species sharing one chain join its load. All operations share
  existing four resource slots. No extra queue, infrastructure, dependency, migration
  or environment variable. Existing TTL, timeout and one retry per resource apply.
- Iterative source traversal produces a connected parent-before-child breadth-first
  species list, retaining branches/sibling order, unique species identity, baby flags
  and breeding trigger item. Limits: 1 MiB per source body, 64 nodes, depth 8, 64
  alternatives per edge, 25 allowed natures, 32 expression variables, 512 expression
  characters. No untrusted recursive schema expansion or silent branch truncation.
- Retains all current source condition fields, including version group/default status,
  region, required/result Pokémon-form references, nature/move/steps/damage requirements
  and condition expressions. Records remain scoped source alternatives; requirements
  inside one record stay together. Expressions are never executed. Source percentages
  are opaque evolution metadata, never simulated battle odds. Unsupported/missing
  condition fields fail refresh validation rather than silently losing requirements.
- Requested owning species ID **and name** must occur in the returned chain. An explicit
  null reference, a one-node family and unknown child requirements remain distinct.
  Source failure is not converted to absence; species/chain 404 has no retry/stale rescue.
  Each successfully rescued resource retains its own stale flag and original timestamp.
- OpenAPI and API/architecture/domain docs describe contracts, conditions, bounds,
  error codes and source semantics. Evolution UI is intentionally the next issue.

## Validation results

- `pnpm install --frozen-lockfile`: passed, lockfile unchanged.
- PostgreSQL healthy; `pnpm db:migrate`: no pending migrations.
- Formatting/lint passed, including the final documentation formatting check.
- `pnpm typecheck`: passed across all four packages.
- `pnpm test`: **606 passed** — domain 5, contracts 163, API 309, web 129.
  Adds 16 contract cases and 45 adapter/cache/HTTP/OpenAPI cases, all offline.
- `pnpm build`: passed; existing Cache Components configuration retained.
- `pnpm test:e2e`: **41 passed in one invocation**, 1.2 minutes, unchanged 180s
  global timeout and no retries. Existing desktop/mobile/search/generation/detail,
  keyboard/zoom and failure coverage remains enabled. No UI was changed in PL-011;
  existing captures are regression evidence, not an evolution interface demo.

Tests cover real branches and modern forms/expressions, null/single-node/unspecified
states, zero/false preservation, reference allowlists, malformed/unknown condition
fields, duplicate/disconnected/cyclic/excessive trees, body limits, timeout/retry,
global admission/release, same-family joins, cache corruption/outages, independent
stale metadata and no stale rescue on 404. No CI request calls live PokéAPI.

The initial local typecheck encountered the known simultaneous dev/prod generated
`LayoutProps` collision. Only the verified Next dev process and ignored `.next/dev`
output were stopped/cleared, preserving a copy of the pre-existing generated file.
Two negative fixtures were reconstructed with object spreads to respect JSON-inferred
array types; no checks, errors or TypeScript diagnostics were suppressed.

## Real source verification

Fixtures capture projected species references for 133/206 and full chains 67/103.
Their current upstream fields were checked against the official PokéAPI v2 docs;
older tutorial schemas omit modern version/form/condition fields and were not used.
Only these explicit resources were captured; no catalog scrape or detail fan-out.

Live Nest request for species 133 returned chain 67 with 9 species nodes and 8 root
children. Species reference timestamp: `2026-10-25T01:21:59.356Z`; chain timestamp:
`2026-10-25T01:21:59.463Z`, both fresh. A subsequent species 134 request returned
Vaporeon and reused the exact chain timestamp, confirming resource-level cache reuse.

Live species 206 returned chain 103 with 2 species nodes and both Dudunsparce form
conditions (`dudunsparce-two-segment`, `dudunsparce-three-segment`). Expressions
`EC 100 % 0 !=` and `EC 100 % 0 ==` remained source text; the chain was fresh at
`2026-10-25T01:22:59.601Z`. No expression evaluator or eligibility claim exists.

Published for review in [PR #14](https://github.com/hugofamorim/pokelab/pull/14),
targeting `main` with explicit dependency on still-open PL-010 PR #13.
Initial Linux validation is tracked in [CI run 62](https://github.com/hugofamorim/pokelab/actions/runs/40150628837).
Final publication-head verification is recorded in the PR checks. No PR was merged by this task.

## Remaining work

PL-012: accessible evolution panel with honest source condition display and explicit
species/default-variety navigation. A composed cold endpoint can make two sequential
resource requests (up to four bounded attempts), so its future web caller needs a
deadline sized for composition. Combined filters and version-aware curated moves
remain M1 work. M2–M5 have not started.

Existing stale-age/retention/deployment-rate-limit limits remain. Species metadata
uses separate normalized projections, so each projection may fetch once per TTL.
Future unsupported condition fields intentionally cause refresh validation failure;
a previously valid cache can still be served with explicit stale metadata.
