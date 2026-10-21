# PL-002 — Bounded card-summary enrichment

Validated locally on 2026-10-21. Branch: `feat/pl-002-card-summaries`, based on
`feat/pl-001-paginated-catalog` at `e7f750e`. PL-001 PR #2 is still open; PL-002 is a
separate dependent change, with no automatic merge. M1 remains incomplete.

## Acceptance and implementation

- Shared runtime schemas and inferred DTOs for 1–12 distinct canonical numeric IDs,
  summary projection, ordered success/unavailable results and per-item source freshness.
- Public `GET /v1/pokemon/summaries?ids=…`, documented in OpenAPI and `docs/API.md`.
- Two workers per batch, at most two distinct batches; detail/page admission remains
  four per instance. Identical batches and overlapping detail work deduplicate.
- Existing validated PostgreSQL detail cache, TTL and stale-if-error reused. No separate
  summary storage. Missing artwork stays null; no fabricated types, species or image URLs.
- Numeric entry identity checked against upstream and cached detail payloads.
- Existing `PokemonCard` accepts `PokemonSummary`; no visible layout, assets, dependencies,
  environment, migrations, browsing/search/filter UI or later milestone changes.

## Local checks

| Check                            | Result                                                    |
| -------------------------------- | --------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Passed; lockfile unchanged                                |
| `pnpm db:migrate`                | Passed; existing migration applied, no pending migrations |
| `pnpm format:check`              | Passed                                                    |
| `pnpm lint`                      | Passed                                                    |
| `pnpm typecheck`                 | Passed, all packages                                      |
| `pnpm test`                      | Passed: 144 tests (domain 5, contracts 61, API 74, web 4) |
| `pnpm build`                     | Passed, NestJS and Next.js with Cache Components          |
| `pnpm test:e2e`                  | Passed: 6 existing offline browser tests                  |

New offline coverage: twelve-ID/order bounds, invalid HTTP queries, duplicate/repeated
inputs, two-worker concurrency, batch admission/recovery, global slot contention,
detail and batch deduplication, reuse across service instances, stale partial results,
404/503/schema failures, missing artwork, poisoned numeric cache and mismatched upstream
IDs, database outages and a maximum of 24 attempts during a twelve-ID outage.
An existing admission test requested ID 5 but expected the Pikachu fixture; it now requests
25, consistent with the strengthened entry-identity validation.

Browser regression checks cover 375/768/1280/1600px, horizontal overflow, keyboard skip
navigation, 200% text zoom, loading, retry, unavailable data and missing artwork.
Screenshots remain in ignored `artifacts/`. CI never calls live PokéAPI.

## Real-data smoke

Production API with PostgreSQL: `GET /v1/pokemon/summaries?ids=1,25,10025` returned
Bulbasaur (grass/poison), Pikachu (electric), and `meowstic-female` (psychic), with
allowlisted artwork URLs. The last entry is ID 10025, species 678, `isDefault: false`;
this confirms form/species distinction using real upstream data. Repeating the batch
returned identical payloads and original fetched timestamps. Existing cached data was
reused where available; one previously uncached form was fetched normally.
Encoded trailing newline returned 400; detail 25 and all three OpenAPI routes worked.

## Review and limits

Local gates passed. Remote CI and pull-request review are pending publication.
Per-instance bounds do not replace deployment rate limiting. Cold batches can be slow
under timeout/retry conditions; request budgets and worst-case timing are documented in
`docs/API.md`. Existing alias cache duplication, lack of stale-age cutoff and cache
retention limits still apply. Next smallest issue: PL-003, paginated browsing UI consuming
reference pages and explicit summary batches; M1 search/filter/detail enrichment follows.
