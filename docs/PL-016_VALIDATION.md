# PL-016 — Combined filter controls

Branch: `feat/pl-016-combined-filter-ui`. Base: integrated main `5539ccc` (PR #18).
M1 remains in progress. No M2–M5 feature is introduced.

## Scope and decisions

- Preserve either selected type/generation while changing the other. Remove each independently;
  search remains exclusive and resets both. Existing single-filter pagination is preserved.
- Render one explicitly requested four-candidate group through the existing Nest endpoint,
  inside Suspense. Do not fetch extra candidates to fill matching cards or drain the index.
- Show matches, excluded entries and unknown outcomes separately. Empty nonfinal groups
  invite continuation; failures never mean exclusion or proof of no matches. No global total.
- Keep real nondefault entry/species identity, independent timestamps/stale status, and safe
  internal detail/movement/evolution return links. Nonzero cursor URLs require both index
  versions. Any changed index blocks cards/continuation and offers a restart.
- Use native accessible links, existing cards/artwork/retry controls and existing design tokens.
  No new asset, package, migration, API endpoint or environment variable.
- The server deadline is 125s for one four-candidate composed scan, including bounded
  cache reads/writes and retries. Existing Nest admission/resource caps remain unchanged.
- Groups replace each other; browser history revisits previous groups. History may restore
  a captured page, while fresh navigation/reload validates source versions. There is no
  accumulated count or persistence of earlier failed candidates across groups.

## Validation status

- `pnpm install --frozen-lockfile` passed without changing the lockfile.
- `pnpm format:check`, `pnpm lint`, `pnpm typecheck`, `pnpm test` and `pnpm build`
  passed. Final unit/integration counts: **833** (domain 5, contracts 219, API 383, web 226).
  Thirty-six new web tests cover strict queries, cursor/source context, response identity,
  partial outcomes, nondefault entry/species identity, source changes and failures.
- `pnpm test:e2e`: **71 passed in 2.3m**, one worker, retries zero and the existing
  180s global timeout unchanged. Seven new cases cover 375/768/1280/1600px and combined-mode
  zoom 200%, filter selection/removal, cursor/detail return/reload/history, partial failure,
  exclusion/end, source-change reset, failure retry, search, loading and invalid URLs.
- The first complete run had 70 passes and one pre-existing footer-fragment viewport
  failure before hydration. It passed three isolated repetitions and the final full run
  without code/test changes or retry-policy changes. Retain this observation for the
  final M1 stability audit; no root cause was established and no check was suppressed.
- Offline screenshots `artifacts/combined-{375,768,1280,1600}.png` were produced; 375px
  and 1280px were visually inspected. Browser artwork is deliberately blocked in CI to
  verify fallback. Existing detail tabs, versioned moves, evolution and individual modes pass.
- Live production frontend/API smoke returned Pikachu, Raichu, Magnemite and Magneton
  for electric + generation I; continuation used exclusive cursor 82 with both source
  timestamps. Detail return and mobile overflow checks passed. The type index contained
  114 candidates at capture time; this is not a combined-result total.
- Live entry 10100 rendered Raichu de Alola with owning species 26 and a nondefault label.
  The same four-candidate group also rendered Geodude/Graveler/Golem de Alola. All four
  image elements completed with positive natural width. Screenshots:
  `artifacts/combined-live-desktop.png`, `combined-live-mobile.png`, `combined-live-variant.png`.
  Real screenshots were inspected separately from the offline fallback captures.
- Local preview restored at port 3000; the existing generated `next-env.d.ts` dev imports
  are preserved outside the commits. Source checkout is `F:\Projetos\pokelab`; the
  configured `G:\Projetos\pokelab` held only `node_modules` during audit.
- Remote review and CI: pending publication; do not infer remote success from local checks.

## Remaining milestone work

Final integrated M1 audit: cross-feature acceptance, accessibility/performance evidence and
any gaps that audit exposes. Do not mark M1 complete based only on this increment.
