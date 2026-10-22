# PL-008 — Bounded explicit default-variety resolution

Date: 2026-10-22. Branch: `feat/pl-008-default-variety-resolution`.
Based on integrated `main` at `3c714c3` after PRs #8/#9/#10 were merged by the user.
M1 increment; M1 as a whole remains incomplete. New PR targets `main`; no automatic merge.

## Scope and decisions

`GET /v1/pokemon-species/default-varieties?speciesIds=1,413` accepts at most twelve
distinct canonical species IDs with the existing bounded ID grammar. Ordered items expose
either explicit `{ species, pokemon }` references plus original species-source metadata,
or an unavailable code. Species IDs/names and Pokémon IDs/names remain independent.

The adapter constructs `/pokemon-species/{id}`, validates matching identity, canonical
Pokémon URLs, unique variety IDs/names and exactly one default flag regardless of position.
Bounds: 128 varieties and 1 MiB streamed/decompressed source bytes. No referenced URL
is fetched and no Pokémon detail or full-generation enrichment occurs. Runtime schemas
are shared and OpenAPI documents input/results. Species 404 is `SPECIES_NOT_FOUND`
without retry/stale rescue; other source failures retain bounded timeout/retry behavior.

One normalized persistent mapping per species reuses TTL/stale-if-error and source
freshness. Overlapping species and identical ordered batches join existing work. Mapping
batches have two workers/two distinct-batch slots, separately from summary batch admission;
all resource operations share the existing four global slots. Expected errors are per item;
unexpected errors use the sanitized HTTP envelope. No dependency, env or migration changes.

Source: [PokéAPI species varieties](https://pokeapi.co/docs/v2#pokemon-species).

## Verification

| Check                                 | Result                                                                  |
| ------------------------------------- | ----------------------------------------------------------------------- |
| Frozen installation                   | Passed; lockfile/versions unchanged                                     |
| PostgreSQL / migration deployment     | Healthy; no pending migrations                                          |
| Automated tests                       | 436 passed: domain 5, contracts 126, API 231, web 74                    |
| Final formatting/lint/typecheck/build | Passed after the search regression repair                               |
| Browser regression                    | All 29 scenarios covered locally; full-attempt/per-file breakdown below |

There are 77 new contract/API cases: canonical query bounds, distinct IDs/names,
order-independent explicit default selection, wrong species/default ambiguity, duplicates,
unsafe/excessive resources, malformed JSON/UTF-8, timeout/retry/404 cancellation,
cache reuse/stale/corruption, source identity, overlapping/identical batches, two-worker
and batch/global admission bounds, complete twelve-item outage (at most 24 source attempts),
per-item absence/malformed data/database failures, HTTP sanitization and OpenAPI.
CI tests remain offline. No quality gate or timeout was relaxed.

The initial browser attempt found a search restoration race at 375px and exceeded the
existing 180-second suite limit on the local machine. Investigation found initial effect
and non-persisted `pageshow` restoration could erase a draft typed during hydration,
causing an empty submission. The repair validates the first draft without replacing it;
React Activity reactivation, `popstate` and persisted `pageshow` still restore committed
URL state. A dedicated browser regression simulates initial versus persisted pageshow.
Existing keyboard/history/no-JavaScript submission checks are retained. This interaction
repair introduces no visual redesign or generation control.

The corrected full local run passed its first twenty scenarios without assertion errors,
then hit the unchanged global limit before nine remaining scenarios. The complete search
file then passed all 9 tests, including initial/persisted pageshow and HTML submission;
the complete type-filter file passed all 7 tests. Together with the 7 catalog and 6 detail
tests already passed on the same final build, all 29 scenarios were covered locally.
CI still runs the complete unchanged-timeout suite in one invocation.
The local production web app uses port 3002 because another project owns port 3000;
that process was inspected and left untouched. API remains on port 3001.

## Real integration evidence

One real `/pokemon-species/413` response was captured; the fixture retains only original
`id`, `name` and `varieties`. It maps species `wormadam` to default `wormadam-plant`,
with the explicit default flag. A separate synthetic test uses unequal species/entry IDs
to prove the implementation does not assume numeric equality; it is not application data.

Production NestJS/PostgreSQL returned that mapping with
`fetchedAt: 2026-10-22T19:11:19.174Z`, `stale: false`. A repeated request returned the same
mapping/freshness. The mapped summary independently confirmed `name: wormadam-plant`,
owning species `413 / wormadam` and `isDefault: true`. Invalid/repeated/combined mapping
queries returned 400 and OpenAPI exposed the new route. A separate Prisma process
re-read and validated the same mapping with expiry `2026-10-23T19:11:19.174Z`.

An additional real-browser smoke on port 3002 verified draft preservation through initial
pageshow, exact Pikachu search, loaded official artwork and no JavaScript runtime errors,
with desktop/mobile captures `artifacts/pl-008-live-search-{375,1600}.png`. The first
attempt displayed the controlled unavailable state during an API `CACHE_UNAVAILABLE`;
subsequent API and browser requests succeeded without code/environment changes. Both
localhost and explicit IPv4 API requests were checked. Offline layout captures were also
visually inspected, with artwork intentionally blocked by those tests.

Review: [PR #11](https://github.com/hugofamorim/pokelab/pull/11) targets `main` without
a stacked dependency. Implementation/documentation head `7aed4e6` was submitted to
[Linux CI #48](https://github.com/hugofamorim/pokelab/actions/runs/39839931755).
That run passed all checks, including 436 automated tests and all 29 browser scenarios
together under the existing 180-second suite limit.
The [branch workflow history](https://github.com/hugofamorim/pokelab/actions/workflows/ci.yml?query=branch%3Afeat%2Fpl-008-default-variety-resolution)
tracks subsequent heads; PR checks provide the final Linux result. No automatic merge.

## Remaining work

PL-009: visible-page generation controls, URL pagination/reset and detail return,
bounded same-origin mapping/summary gateways, cancellation/retry, partial failures and
cross-source identity/freshness validation. Combined type/generation/search modes,
evolution/moves/localization remain separate M1 work. Existing cache retention/stale-age,
alias duplication and deployment rate-limit limitations remain.
