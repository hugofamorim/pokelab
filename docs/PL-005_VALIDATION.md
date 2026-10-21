# PL-005 — Cached single-type catalog API

Date: 2026-10-21. Branch: `feat/pl-005-type-filter-api`, based on integrated `main`
at `66ba715` (PRs #6/#7 merged). M1 remains incomplete; no type-filter UI in this increment.

## Acceptance delivered

- `GET /v1/pokemon?type=electric&page=1&pageSize=20` accepts exactly one canonical
  supported type, preserves pagination bounds and adds explicit response filter identity.
  Unfiltered listing, detail and summary contracts remain compatible. Search/generation/
  multi-type/unknown/repeated query combinations fail before upstream access.
- Typed PokéAPI adapter validates requested type, association slot, canonical reference
  URLs and unique entry IDs/names; normalized indexes sort by entry ID, preserve forms
  and do not fetch details/species or infer images/stats. Empty membership is supported.
- Source resources are bounded to 1 MiB and 10,000 members. Streamed/decompressed byte
  counting does not trust Content-Length. Invalid UTF-8/JSON/schema/size is rejected
  without retries; transient/transport failures retain a single retry. Unread HTTP
  error bodies are cancelled, including existing detail/list requests.
- One validated PostgreSQL index per type, shared across pages/sizes and in-flight work.
  Type loads share four admission slots with details/pages, without nested admission.
  Existing TTL and stale fallback preserve original source freshness. Corrupt cache data
  cannot be used as a fresh or stale index. No dependency/env/migration changes.
- OpenAPI exposes the 18-value type enum and optional response type, with API policy,
  scope, cache keys and limits documented. Pure domain logic remains framework independent.

## Exact local validation

| Command                          | Result                                                      |
| -------------------------------- | ----------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Passed, lockfile unchanged                                  |
| `pnpm db:migrate`                | Passed, existing migration and no pending migrations        |
| `pnpm format:check`              | Passed                                                      |
| `pnpm lint`                      | Passed                                                      |
| `pnpm typecheck`                 | Passed                                                      |
| `pnpm test`                      | Passed: 245 tests (5 domain, 78 contracts, 119 API, 43 web) |
| `pnpm build`                     | Passed, NestJS and Next.js with Cache Components            |
| `pnpm test:e2e`                  | Passed: all 21 existing offline browser scenarios           |

62 new automated cases: canonical/unsupported/combined query semantics; unique sorted
membership and maximum count; form/secondary-slot preservation; unsafe reference URLs;
requested identity mismatch; oversized declared and streamed bodies; JSON/UTF-8/transport/
HTTP/timeout errors and cancellation/retry budgets; deduplication across page sizes;
persistent cache reuse; stale page freshness; corrupt cache rejection; isolated type keys;
mixed global admission/join/recovery; database outages; typed HTTP/empty/error responses.
The former API invalid-type example now uses unsupported `stellar` instead of `grass`;
dedicated tests validate the newly supported type behavior. The original unfiltered-only
query schema stays strict for web callers. No quality checks are disabled.

Browser regression covers catalog/search/detail at 375/768/1280/1600px, keyboard, zoom,
loading, empty/error/stale/artwork states, URL pagination/history and hydration behavior.
No visible UI was changed. CI is offline; live PokéAPI is never used by tests.

## Real integration evidence

One `/api/v2/type/electric` response was captured on 2026-10-21; only its original `id`,
`name` and `pokemon` fields are retained in `apps/api/test/fixtures/type-electric.json`.
The observed 114 members are fixture evidence, not a production constant. Source schema:
[PokéAPI Types and TypePokemon](https://pokeapi.co/docs/v2#types).

Production NestJS + PostgreSQL smoke returned Pikachu/Raichu first for a two-entry
electric page, 114 total references, and separate form IDs on later pages. Different
pages/sizes kept `fetchedAt: 2026-10-21T21:46:39.473Z`, `stale: false`; beyond-total
page was empty, duplicate type returned 400, unfiltered page/detail remained functional,
and `/docs-json` exposed 18 types. A separate Prisma process re-read and validated the
same persistent index, with 114 entries and expiry `2026-10-22T21:46:39.473Z`.

## Review and remaining work

Local checks passed. The PL-005 PR targets `main`; remote CI/review will be linked after
publication. No merge is performed automatically. Current type membership is not a
generation filter or battle simulation. Existing stale-age cutoff, cache retention,
alias duplication and distributed rate-limiting limitations remain.
Next smallest issue: PL-006, responsive single-type controls with URL pagination/reset
and filter-aware detail return. Generation filters and remaining detail resources follow.
