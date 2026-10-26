# M1 — Integrated Pokédex acceptance

Audit: PL-017, branch `feat/pl-017-m1-acceptance`, based on integrated `main`
`19d4485` (PR #19). Local acceptance passed on 2026-10-25 America/Sao_Paulo
(2026-10-26 UTC). Reviewed-head remote results belong to the pull request checks;
local results alone do not close the milestone. No M2–M5 feature was started.

Published in [PR #20](https://github.com/hugofamorim/pokelab/pull/20). Its checks record
the remote result for the reviewed head; the PR description links the verified CI run.

## Acceptance matrix

| M1 criterion                                                             | Evidence                                                                                      | Result                                      |
| ------------------------------------------------------------------------ | --------------------------------------------------------------------------------------------- | ------------------------------------------- |
| Exact name/ID search, canonical input and URL/history                    | `search.spec.ts`, catalog-search unit tests; live Pikachu journey                             | Passed                                      |
| Paginated catalog, individual type/generation modes                      | `catalog.spec.ts`, `type-filter.spec.ts`, `generation.spec.ts`                                | Passed                                      |
| Combined current entry type/species-introduction generation              | `combined-filter.spec.ts`, combined contracts/API/web tests; PL-016 live variant evidence     | Passed                                      |
| Stats, types, abilities, size/weight and explicit entry/species identity | `detail.spec.ts`, normalized contracts/API tests; real Pikachu attributes                     | Passed                                      |
| Species descriptions and source-language fallback                        | Description unit/API tests, detail browser cases; live species text                           | Passed                                      |
| Branched evolutions, conditions and verified default-variety links       | `evolution.spec.ts`; live Pikachu -> Pichu entry 172                                          | Passed                                      |
| Version-scoped moves, methods/levels and on-demand current metadata      | `moves.spec.ts`; live red-blue mega-punch selection                                           | Passed                                      |
| Functional tabs, hashes, keyboard and preserved movement state           | `detail-tabs.spec.ts` and active-panel accessibility assertions                               | Passed                                      |
| Cross-feature return context, including partial evolution failure        | New `m1-journey.spec.ts` at 375/1280px; live evolution returns to original exact search       | Passed                                      |
| Loading, empty/missing data/art, errors, retries and stale sources       | Existing catalog/detail/generation/evolution/moves/combined cases and deterministic API tests | Passed                                      |
| Responsive layout and zoom                                               | Functional suite at 375/768/1280/1600px, 200% zoom; real desktop/mobile captures              | Passed                                      |
| Accessible names, semantics, contrast and reduced motion                 | New axe audit at 375/1280px, eight states each, complementary gradient bounds                 | Passed within stated audit scope            |
| Reproducible install, schema, checks and production build                | Frozen install, Prisma deploy, format/lint/typecheck/test/build                               | Passed locally; remote checks tracked on PR |

Scope remains the accepted bounded Pokédex: one selected type, optionally combined
with species-introduction generation, plus separate exact-name/ID search. Dual-typed
Pokémon display both types. Multiple selected filter types and fuzzy/localized-name
search are extensions. Moves are actual version-scoped learning records, not tactical
recommendations or competitive legality. No team builder/analyzer/account behavior is implied.

## Audit changes

The desktop brand link displayed `TRAINER STUDIO` but its explicit accessible name
omitted that visible text. Axe reported `label-content-name-mismatch`; its name now
includes `PokéLab Trainer Studio`. The decorative heading spark is hidden from the
accessibility tree. Existing visual assets and tokens are preserved.

`@axe-core/playwright` 4.14.0 is an exact development-only dependency, with the
transitive resolution pinned by the lockfile. `pnpm test:a11y` uses its own 90s audit
budget and `test-results/accessibility` output. Functional E2E still has the unchanged
180s global budget, one worker and zero retries. CI runs both steps; no rule is disabled,
excluded or suppressed. Existing offline Nest fixtures are reused without live upstream calls.

Axe checks WCAG 2 A/AA, 2.1 A/AA and 2.2 AA tags for exact search, combined partial
results and all six active detail tabs. Incomplete findings are retained in the JSON
reports, not silently treated as passes. Text over gradients receives a complementary
calculation using computed foregrounds and a conservative per-channel lower bound of
pastel gradient stops, including transparent stops composited on their base. These
specific text/background bounds pass 4.5:1, including large text. Generation chip labels
(`I` -> `Geração I`, etc.) include their visible text. Decorative glyphs carry no information.

This is automated/semantic and keyboard evidence, not certification of full WCAG
conformance or testing with a physical screen reader. Manual assistive-technology and
production performance review remain part of the broader M5 showcase work.

## Commands and local results

- `pnpm install --frozen-lockfile`: passed with the audited lockfile.
- `pnpm db:migrate`: one existing migration, no pending migrations, no schema change.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm build`: passed.
- `pnpm test`: **833 passed** (domain 5, contracts 219, API 383, web 226).
- `pnpm test:e2e`: **73 passed in 2.4m**, including two new integrated journeys.
- `pnpm test:a11y`: **2 passed in 16.3s**, sixteen audited page/panel states.
- Real production-build smoke: exact Pikachu search -> abilities -> original species
  description -> explicit red-blue learnset -> mega-punch current metadata -> Pichu
  default preview/detail -> original Pikachu search. Mobile overflow check passed.
- Screenshots: `artifacts/m1-live-catalog-desktop.png`, `m1-live-detail-desktop.png`,
  `m1-live-detail-mobile.png`; real detail desktop/mobile captures were visually reviewed.
  Existing suite captures retain the four-width coverage and missing-art fallback.
- Existing generated `apps/web/next-env.d.ts` dev imports are preserved outside commits.
  The complete source repository remains at `F:\Projetos\pokelab`; configured `G:`
  contained only `node_modules` at audit. Local preview is restored on port 3000.

## Cache latency measurement

Run `pnpm build`, start the production API and local PostgreSQL, then
`node scripts/measure-cache.mjs`. This script is explicit local validation, outside CI.
It requests only three fixed routes, one warm-up plus twenty sequential samples each,
validates normalized responses and refuses unavailable/stale/changing-source results.
It never drains indexes or bypasses caches. Keep JSON output with the measurement record.

Measured 2026-10-26T01:13:25Z on Windows, Node 24.20.0, local production Nest API,
Docker PostgreSQL 17.7 and concurrency 1; no load generator. Timing includes HTTP body
read and JSON parsing, excludes client schema validation and warm-up. P95 is nearest-rank
sample 19/20. Source metadata stayed fresh and unchanged throughout every group.

| Route                                                        | Samples | P50     | P95     | Maximum |
| ------------------------------------------------------------ | ------- | ------- | ------- | ------- |
| `/v1/pokemon/25`                                             | 20      | 15.27ms | 16.42ms | 16.46ms |
| `/v1/pokemon?page=1&pageSize=12`                             | 20      | 15.14ms | 16.31ms | 17.74ms |
| `/v1/pokemon/filter-scan?type=electric&generation=1&limit=4` | 20      | 14.82ms | 15.78ms | 15.90ms |

These samples meet the initial cached-API <=500ms P95 test-environment target. They do
not establish production P95 under load or deployed Core Web Vitals. LCP/INP/CLS p75
requires a deployed population and remains unmeasured here. Resource fan-out, admission,
cache reuse, timeouts and body limits remain covered by offline API tests.

## Stability observation and review gate

PL-016 recorded one pre-hydration native `#sobre` footer viewport failure in its initial
full run. Three isolated repetitions and the subsequent full run passed unchanged.
This audit attempted twelve additional fresh native fragment navigations with app JS
blocked, all passing, and the final 73-case run also passed that original case. No
root cause was demonstrated; no speculative fix, retry policy or weakened assertion
was introduced. Retain the observation for later stability monitoring.

No blocking gap was found in the defined M1 acceptance scope. The milestone exit gate
is this committed matrix plus green checks for the reviewed PR head. Review/merge is a
separate user action. The next milestone is M2; plan its six-slot guest editor only after
this delivery has been reviewed. M2–M5 have not started.
