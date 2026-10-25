# PL-010 — Species descriptions in detail

Date: 2026-10-24 (America/Sao_Paulo); source timestamps are UTC.
Branch: `feat/pl-010-species-descriptions`, based on integrated `main` at `c54f47d`.
The user merged PL-008/009 in PRs #11/#12; both merges were verified before branching.
M1 remains incomplete. No merge is performed by this task.

## Scope and decisions

- Shared Zod contract and `GET /v1/pokemon-species/:speciesId/description`, with explicit
  species identity, optional description and independent source metadata. Input is one
  canonical numeric species ID without query parameters.
- Constructed allowlisted upstream paths, matching species ID, canonical language/version
  references, 512-entry/8192-character/1 MiB bounds, bounded timeout/retry and no arbitrary
  URL fetching. Deterministically prefer the first nonblank `pt-br` entry, then first `en`
  in source order. Normalize whitespace/control characters; preserve original text language
  and source game version. No automatic translation or newest-version claim.
- Existing PostgreSQL cache, TTL/stale handling, in-flight deduplication and four global
  resource slots are reused. Empty supported-language data is cached as `description: null`;
  species 404 has no retry or stale rescue. No migration/dependency/environment changes.
  Description and default-variety projections have separate cache keys, so one species
  may be fetched once per projection per TTL; consolidation remains a future optimization.
- An independent Suspense panel reuses existing design tokens and panels. Loading,
  missing species, no supported description, failure/retry and stale text are distinct.
  Retry refreshes the route while retaining query/hash. Attributes remain visible when
  descriptions fail. Server client cross-checks owning species ID **and name**.
- `#sobre-especie` is distinct from the pre-existing footer's `#sobre`; both anchors remain
  unique. English has a `lang="en"` attribute and an explicit fallback label, with game
  provenance. Existing logo/artwork/components are reused; no fake game data or artwork.
- Domain documentation's former “en-US” wording was made precise: PokéAPI provides `en`;
  the app labels English without inventing a regional locale.

## Validation

- Frozen dependency installation passed; lockfile unchanged.
- PostgreSQL healthy; `pnpm db:migrate` reports no pending migrations.
- Formatting, lint, strict typecheck and production build passed on the final source,
  including the unique-anchor correction and reuse of shared Pokémon species types.
- `pnpm test`: **545 passed** (domain 5, contracts 147, API 264, web 129).
  This adds 21 contract, 33 API and 12 web tests for normalized text/language bounds,
  malformed identity/provenance, body limits, timeout/retry, stale/no-404 rescue, cache
  persistence/corruption/outage, global admission/deduplication, HTTP/OpenAPI and server
  response validation. No live PokéAPI is used by tests or CI.
- Browser suite: **41 passed** in one invocation on the final build (1.3 minutes).
  The unchanged 180s global timeout and
  zero-retry policy remain enabled.
- The initial isolated test invocation hit the Windows sandbox temporary-file rename
  restriction; rerunning with the normal local runtime succeeded. A test HeadersInit
  union typing issue was fixed before full checks; no check was suppressed.
- A fully JavaScript-disabled browser showed the existing React-streaming limitation:
  server boundaries remain at their loading fallback without inline scripts. The new
  acceptance test explicitly verifies source text/language **before client hydration**
  by blocking application bundles while allowing React's inline HTML insertion. Full
  JavaScript-disabled support is not claimed for streamed details.

## Real data and visual evidence

Projected fixtures retain actual species IDs/names and first English flavor entries,
including original language/version references, from species 25 and 413. Both sources
had no `pt-br` at capture. Portuguese preference/control/empty cases are explicitly
synthetic test boundaries, never production fixture data.

The live Nest endpoint returned Pikachu, language `en`, version `red`, 95 normalized
characters, `stale: false`, fetched at `2026-10-25T00:55:34.05Z`. A second request reused
that timestamp. Production UI smoke verified this source and actual artwork at
375/768/1280/1600px with no horizontal overflow or browser errors. Wormadam's Pokémon
entry `wormadam-plant` displayed its owning species `wormadam` and `diamond` description,
with generation/page return intact. Final captures after the anchor correction were
regenerated and visually inspected, with no overflow or runtime errors at all four widths.

Ignored screenshots: `artifacts/description-live-{width}.png`,
`artifacts/description-live-variety.png`, offline `artifacts/detail-{width}.png` and
`artifacts/description-stale.png`. Desktop/mobile hierarchy, wrapped source text, source
labels and independent states are inspected visually; keyboard and 200% zoom are tested.

Publication and final Linux CI verification are pending.

## Remaining work

PL-011: bounded evolution-chain contract/adapter preserving branches and conditions.
Evolution UI, combined filters and curated version-aware move metadata remain M1 work.
M2–M5 have not started. Existing backend stale-age/cache-retention and deployment
rate-limit limitations remain; this increment does not change them.
