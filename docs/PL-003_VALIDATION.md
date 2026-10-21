# PL-003 — Responsive paginated catalog

Branch: `feat/pl-003-catalog-ui`, based on validated PL-002 head `487820d`.
Date: 2026-10-21. M1 remains in progress; no Team Builder, Analyzer or accounts added.

## Acceptance delivered

- `/` opens `/pokedex`. Twelve references per page; validated canonical `page` query,
  API-derived total/range and previous/next links. Invalid, empty and upstream-error
  pages have explicit states and recovery links. Search/filter controls remain pending.
- Reference names and detail links render before enrichment. Three sequential groups
  of four summaries fill types and artwork progressively; unavailable items retain their
  real reference identity. Explicit retry only requests failed IDs; ready cards remain.
- Per-item and reference-list stale notices show the original source date. Nullable or
  failed images use the existing accessible fallback. Summary results are checked for
  requested ID/order, omission and duplication on both sides of the web gateway.
- Existing design tokens, shell, original logo, `PokemonCard`, type badges and artwork
  reused. Wide desktop three columns, tablet two, mobile full-width cards. Cards grow
  for long names. Decorative type halos use CSS, with reduced-motion support inherited.
- Same-origin Next.js gateway keeps `API_URL` server-side and uses the existing NestJS
  adapter/cache. No browser calls to PokéAPI or database. Browser batches cancel on
  navigation, time out and never retry automatically. NestJS work remains bounded.
- Detail links carry validated `fromPage`; return links preserve the catalog page.
  URL reload/back navigation work. Speculative card/pagination prefetch is disabled.

## Exact local checks

| Check                            | Result                                                      |
| -------------------------------- | ----------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Passed, no dependency/lockfile changes                      |
| `pnpm db:migrate`                | Passed, no pending migration                                |
| `pnpm format:check`              | Passed                                                      |
| `pnpm lint`                      | Passed                                                      |
| `pnpm typecheck`                 | Passed                                                      |
| `pnpm test`                      | Passed: 163 tests (5 domain, 61 contracts, 74 API, 23 web)  |
| `pnpm build`                     | Passed; catalog/detail under Suspense with Cache Components |
| `pnpm test:e2e`                  | Passed: 13 offline browser scenarios                        |

Nineteen new web tests cover query bounds, fixed paths/page identity, malformed/failing
responses, batch ID/order integrity, gateway input validation, no-store and safe errors.
Seven new browser scenarios exercise four widths (375/768/1280/1600), pagination,
last-page controls, refresh, detail/return navigation, reference-before-summary loading,
four-ID request budgets, partial failure/retry, missing artwork, stale dates, empty/error/
invalid pages, loading, keyboard skip navigation and 200% zoom. A synthetic long name
is injected only in a test to verify actual heading bounds at all four widths; clipped
decorative halos are intentionally excluded from content measurements.
Six existing detail regressions also run. No live PokéAPI calls occur in CI.

## Visual and real-data smoke

The production web app, NestJS and PostgreSQL returned the first twelve real Pokémon
with validated types. All twelve remote artwork images loaded successfully (180px
optimized resources), with no JavaScript page errors. Desktop 1600px and mobile 375px
had no horizontal overflow. Screenshots were inspected; ignored local artifacts:
`artifacts/catalog-real-1600.png`, `artifacts/catalog-real-375.png`, and offline
`artifacts/catalog-{375,768,1280,1600}.png`.

Real facts for the visible twelve-entry page were captured once through NestJS into
`apps/api/test/fixtures/catalog-details.json`. The offline fixture catalog deliberately
contains these twelve entries plus Pikachu, with synthetic pagination/failure/stale
scenarios; its totals/order are not production facts. Source facts are not fabricated.
Existing assets were reused; no generated images or screenshots are committed.

## Integration and remaining work

PL-001 PR #2 reached `main` before PL-002 PR #3 was merged into the PL-001 branch.
[Integration PR #4](https://github.com/hugofamorim/pokelab/pull/4) carries PL-002 into
`main`; PL-003 targets the PL-002 branch until that integration is merged. Retarget PL-003
to `main` afterward and rerun checks as needed. No PR is merged automatically.
Remote CI and review status are tracked by the PL-003 PR when published.

Cold details may remain slow under upstream timeouts; names stay usable while enrichment
finishes. Per-instance admission is not distributed rate limiting. Abort stops browser
work, not guaranteed cancellation inside NestJS. Existing cache retention/stale-age limits
remain. No production performance or full WCAG certification claim is made.
Next smallest issue: PL-004, name/ID search with documented matching semantics and URL
state. Type/generation filters and remaining detail sections are later M1 increments.
