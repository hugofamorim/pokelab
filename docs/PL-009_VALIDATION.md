# PL-009 — Generation controls and validated mapped cards

Date: 2026-10-24 (America/Sao_Paulo); source timestamps below are UTC.
Branch: `feat/pl-009-generation-controls`, based on PL-008 head `1a9701d`.
[PR #11](https://github.com/hugofamorim/pokelab/pull/11) was open at audit time; this
PR targets `main`, retaining that dependency until it merges. No automatic merge.
M1 as a whole remains incomplete.

## Implementation and acceptance

- Native I–IX generation links with URL state, page reset and mode replacement. Type,
  generation and exact name/ID lookup remain separate modes; combined/noncanonical,
  duplicate and unsupported queries fail explicitly. Desktop wraps controls; mobile
  scrolls rows horizontally, revealing the selected chip without scrolling the document.
- SSR species references appear before enrichment. Only the visible twelve species are
  hydrated, through sequential four-species same-origin requests. Unresolved species
  never infer a Pokémon URL from species ID/name. Existing cards, type badges, artwork,
  assets, states and pagination are reused; no redesign or new dependency.
- The web gateway validates default mappings, then fetches only resolved distinct Pokémon
  summaries. Ready cards require mapped ID/name, owning species ID/name and default status
  to agree. Order/count/identity is checked on server and browser; the browser also verifies
  source species names against the SSR index. Partial failures preserve available cards.
- Mapping and summary metadata remain independent. Stale sources have distinct notices;
  a missing summary may retain mapping metadata without enabling an unverified detail link.
- Pagination, reload/history, retry/first-page recovery and validated internal detail return
  retain generation/page. Keys include both; navigation aborts obsolete web work, and retry
  targets failed species only. Prefetch is disabled. Backend caching/admission is unchanged.
- Gateway has a combined 135s deadline; browser requests have a 140s deadline. Cancellation
  propagates to outgoing web fetches; already-admitted Nest work may finish under its bounds.
  No backend endpoint, migration, environment or infrastructure change is introduced.

## Local checks

| Command                                           | Result                                                             |
| ------------------------------------------------- | ------------------------------------------------------------------ |
| `pnpm install --frozen-lockfile`                  | Passed; versions/lockfile unchanged                                |
| `docker compose up -d --wait` / `pnpm db:migrate` | PostgreSQL healthy; no pending migrations                          |
| `pnpm format:check` / `pnpm lint`                 | Passed                                                             |
| `pnpm typecheck`                                  | Passed across all four packages                                    |
| `pnpm test`                                       | 479 passed: domain 5, contracts 126, API 231, web 117              |
| `pnpm build`                                      | Passed; Cache Components retained                                  |
| `pnpm test:e2e`                                   | All 38 passed in one invocation, within unchanged 180s suite limit |

43 new web unit cases cover all supported generation URLs/return links, ambiguous
queries, unsafe returns, mismatched mapping/summary/species identity/default status,
ordered batches, phase selection, partial failures, independent freshness, malformed
gateway replies, cancellation, no-store and sanitized failures. Nine new browser scenarios
cover four widths (375/768/1280/1600px), keyboard/200% zoom, mapped detail return, page reset,
search/type/history behavior, reference-first rendering, bounded batches/failed-only retry,
loading/error/empty/stale states, conflicting species names, delayed-load cancellation and
native generation navigation before hydration. Existing 29 scenarios remain enabled.
CI never calls live PokéAPI; browser artwork requests are intentionally blocked there.

The local workspace initially contained a generated `next-env.d.ts` change referring to
dev output. A copy was preserved under ignored `.cache/`. Simultaneous dev/prod generated
types caused duplicate `LayoutProps`; only this project's Next dev process and ignored
dev cache were stopped/cleared for production validation. Generated declarations are not
committed. No quality rule or timeout is disabled. An early test parameterization failed
strict TypeScript and was corrected to supply named cases rather than spread empty arrays.

## Fixtures and real integration

Offline generation I uses a deliberately restricted subset of the captured real index,
matching the existing captured twelve-entry catalog plus Pikachu. Generation IV uses
one projected real Wormadam membership and its normalized detail, captured through NestJS.
Its species `wormadam` and default variety `wormadam-plant` remain distinct. Controlled
expired-cache/outage/empty scenarios provide stale index and independent mapping/summary
notices; their totals/timestamps are test scenarios, never production constants.

Production browsing of `/pokedex?page=3&generation=4` returned 107 species at verification,
with twelve visible references 411–422 and index
`fetchedAt: 2026-10-25T00:11:31.059Z`, `stale: false`. All twelve default varieties and
official artwork loaded at every required width, without horizontal overflow or browser
runtime errors. Batches were `411,412,413,414`, `415,416,417,418`, `419,420,421,422`.
Wormadam linked to `/pokemon/413?fromPage=3&fromGeneration=4`; return preserved page/generation.
All resolution used only that visible page and existing backend caching/bounds.

Ignored real captures: `artifacts/generation-live-{375,768,1280,1600}.png`.
Offline captures: `artifacts/generation-{width}.png` and `generation-variety-{width}.png`.
Desktop/mobile captures were visually inspected for hierarchy, spacing, wrapped names,
badges, artwork, source notices and responsive filter rows. Existing assets are reused.

Published for review in [PR #12](https://github.com/hugofamorim/pokelab/pull/12),
targeting `main` and depending on the still-open PL-008 PR #11.
Linux validation is tracked in [CI run 52](https://github.com/hugofamorim/pokelab/actions/runs/40146149295).
Final publication-head verification is recorded in the PR checks; no PR was merged.

## Remaining work

M1 is incomplete. PL-010 should add species descriptions to detail with explicit language
fallback and bounded cached metadata. Combined filters, evolution chains and validated
move enrichment remain separate M1 work. No team/account/analyzer feature is introduced.
Existing backend stale-age/retention, alias duplication and deployment rate-limit limits remain.
