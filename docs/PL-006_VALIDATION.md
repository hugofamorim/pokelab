# PL-006 — Responsive single-type controls

Date: 2026-10-21. Branch: `feat/pl-006-type-filter-ui`.
Scope: M1 increment; M1 as a whole remains incomplete.
Dependency: PL-005 / [PR #8](https://github.com/hugofamorim/pokelab/pull/8).
The new PR targets `main`; no merge is performed automatically.

## Implementation and acceptance

- Shared canonical 18-type validation; one optional type plus pagination. Search is a
  separate mode. Repeated, unknown, comma-separated, noncanonical and conflicting query
  values fail explicitly before upstream access.
- Existing palette, typography, focus styles and 44px targets; text/outline/check mark
  communicate selection. Desktop wraps; mobile scrolls the chip row without page overflow.
  All filter links disable speculative prefetch and selecting one resets page/search.
- Server verifies returned type/page/page size. URL state drives the stable filter
  boundary. Grid keys contain page and type; navigation aborts obsolete browser loads.
- Pagination, ready/unavailable detail links, validated internal return URLs, retry and
  first-page recovery preserve type. Search submission replaces the filter; “Todos” clears it.
- Existing bounded four-ID summary batches, freshness, partial failures and artwork
  fallbacks are reused. No dependencies, migrations, infrastructure or env changes.

## Validation status

Local checks passed:

| Command                                | Result                                              |
| -------------------------------------- | --------------------------------------------------- |
| `pnpm install --frozen-lockfile`       | Passed; existing versions/lockfile unchanged        |
| `docker compose up -d --wait`          | Existing PostgreSQL healthy                         |
| `pnpm db:generate` / `pnpm db:migrate` | Passed; no pending migrations                       |
| `pnpm format:check` / `pnpm lint`      | Passed                                              |
| `pnpm typecheck`                       | Passed across all four packages                     |
| `pnpm test`                            | 276 passed: domain 5, contracts 78, API 119, web 74 |
| `pnpm build`                           | Passed; Cache Components retained                   |
| `pnpm test:e2e`                        | 28 passed, including 7 new type-filter scenarios    |

The 31 new web unit cases cover all 18 canonical types, conflicting/malformed queries,
safe return URLs and cross-type response identity/freshness. Browser checks cover
375/768/1280/1600px, keyboard selection, 200% zoom, reload, pagination, ready/unavailable
detail return, search replacement/history, stale/error/empty responses and delayed-load
cancellation. A visual follow-up ensures the selected mobile chip is revealed after
reload/resize by scrolling only its row, without moving the page.

The first sandboxed test attempt failed on local socket/temp-file restrictions; the
authorized run passed. The initial build's worker failure persisted until the ignored
`.next` output was recreated, then the standard build passed without changing checks.
A temporary automatic-review usage failure prevented one Docker invocation; the later
authorized invocation confirmed the existing container was healthy.

## Real integration and visual evidence

Production NestJS + PostgreSQL returned 114 electric references at verification time,
with source timestamp `2026-10-21T21:46:39.473Z`, `stale: false`. This is observed source
data, not a hardcoded total. The production browser rendered the visible twelve entries
with all twelve electric badges and official artwork loaded at each of the four widths.
No horizontal overflow or browser runtime errors occurred. Pikachu detail and the
filter-preserving return were verified against real data. Existing bounded summary
requests hydrate only the visible page and reuse the backend cache.

Ignored captures: `artifacts/type-filter-live-{375,768,1280,1600}.png`; offline layout
captures: `artifacts/type-filter-{375,768,1280,1600}.png`. Desktop and mobile captures
were visually inspected for typography, palette, hierarchy, artwork and filter placement.
The smoke script's first immediate URL assertion ran before navigation committed; adding
an explicit route wait completed the smoke successfully. Application code did not require
a navigation correction.

Review: [PR #9](https://github.com/hugofamorim/pokelab/pull/9) targets `main` and
depends on #8. Implementation/documentation head `a2c2b01` was submitted to
[Linux CI #37](https://github.com/hugofamorim/pokelab/actions/runs/39712614590).
The [branch workflow history](https://github.com/hugofamorim/pokelab/actions/workflows/ci.yml?query=branch%3Afeat%2Fpl-006-type-filter-ui)
tracks subsequent heads; PR checks provide the final Linux result. No automatic merge.

Offline browser fixtures reuse captured electric membership. Only Pikachu has an electric
detail fixture; other electric cards deliberately exercise reference-only unavailable
states. Other type subsets derive from the existing captured twelve-entry catalog.
Water has an explicitly expired fixture cache plus source outage, ghost has no cache
and an outage. These are test scenarios, never production catalog counts or invented facts.

## Remaining work

Generation filters, multiple-type intersection/union, combined name/type queries and
detail enrichment are not implemented. PL-007 should define a bounded generation index
with explicit species/form semantics. Existing backend cache/operational limitations remain.
