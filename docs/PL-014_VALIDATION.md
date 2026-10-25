# PL-014 — Version-scoped moves detail panel

Date: 2026-10-25 (America/Sao_Paulo).
Branch: `feat/pl-014-moves-panel`, based on PL-013 head `131722f`.
At audit, main was `3633611` and PL-013 PR #16 was open/mergeable with passing CI.
Before publication, its merge into `main` at `bdb395a` was verified using GitHub metadata
and Git ancestry. No unmerged dependency remains; no PR is merged by this task.
All mandatory docs and existing assets were reviewed. No missing required file or new
architectural conflict was found. The original generated `next-env.d.ts` change is backed
up under ignored `.cache/pl-014-next-env.original` and excluded from commits.

## Implemented behavior

- Independent moves Suspense panel validates detail/learning Pokémon ID/name, species
  ID/name, default identity, explicit version, page and fixed size six. Other detail
  sections remain usable during failure/loading. Invalid URL values, missing resource,
  no groups/records, out-of-range page and stale/error/retry are distinguished.
- No game selected automatically. Initial explicit group-1 API probe discovers choices;
  its items are discarded. The required native selector/form commits `moveVersion`,
  resets movement page and preserves constructed catalog return fields. Pagination
  preserves version/page/hash/return context and disables speculative prefetch.
- Six movement cards per page, complete native learning disclosures, original source
  methods/IDs and all levels/orders including zero and null. No guessed acquisition rules.
- Attribute queries occur only on user selection, through a canonical single-ID same-origin
  gateway. Shared schema/ID validation on the server and additional ID/name matching in the
  browser prevent wrong-source joins. Only one preview is retained; abort plus synchronous
  attempt invalidation rejects obsolete work on selection/navigation.
- Current attributes have an explicit snapshot label and original freshness, separately
  from selected-version learning and historical changes. Existing known type badges are
  reused; unknown type names retain source text. Null current values and null historical
  overrides have different labels. No historical battle stat, effects, competitive legality,
  game availability or damage inference.
- Reuses shell/panels/buttons/palette/retry/artwork. Two-column wider layouts, single-column
  mobile; selected card spans the grid and current fields use two columns where they fit.
  Native form/details work before app hydration; inline streaming scripts remain necessary.
  Metadata interactions need hydration. Fully disabled-JS detail is not claimed.
- No backend API/schema/environment/dependency/migration/asset generation change. Nest
  cache/admission remains authoritative; single-resource server/gateway deadline is 45s,
  browser deadline 50s. Already-admitted Nest work can finish after browser cancellation.

## Evidence and checks

- Frozen install, ESLint, strict typecheck, web tests (190) and production build passed.
- Full suite passed: 733 tests (domain 5, contracts 185, API 353, web 190), including
  PostgreSQL persistence. The 35 new web tests cover scope/identity, canonical URL state,
  return context, fixed bounds/deadlines, missing/error, cancellation propagation,
  no-store gateway validation/sanitization and null/history/source-name handling.
- Eight new Playwright cases passed in isolation. Initial full regression had 57/58:
  the loading test wrongly assumed cold cache. The offline cache fixture now delays the
  explicit loading key even after earlier tests warm it; no production delay, retries,
  assertion removal or quality-check suppression was added. The complete rerun passed
  all 58 cases in 2.1 minutes. The final entry/version/page boundary-key reset and layout
  revision also passed a complete 58-case run (2.1 minutes), with the full 733-test suite.
- Real production smoke passed for Pikachu, Charm and Bulbasaur: no initial metadata
  requests, one request per selected move, six visible Bulbasaur records, no JavaScript
  errors or horizontal overflow at 375/768/1280/1600px. Current Fairy/historical Normal
  Charm fields remained separate. Live captures under ignored `artifacts/moves-live-*.png`;
  final module and actual viewport captures were refreshed and visually inspected at all
  four widths after the selected-card refinement. Viewport captures also confirm the
  unfocused skip link remains offscreen; tall element captures can include fixed navigation
  artifacts. Scrolling keeps controls reachable, with no actual viewport obstruction.
- Offline source projections reuse PL-013 Pikachu/Charm fixtures and add only `/move/5`
  and `/move/6`, captured on this date. Other test entries intentionally represent controlled
  empty/missing/error/mismatch states. No live PokéAPI in CI. Global browser timeout remains
  180s and retries remain zero. Local production servers use the F: checkout.
- PR publication and Linux CI pending at this implementation checkpoint.

## Remaining M1 work

PL-015: bounded combined type/generation filtering, explicit species/default-entry semantics
and API contracts, followed by controls/URL/return handling and final integrated acceptance.
Historical battle-value resolution, effects, transfer legality, Team Builder, Analyzer,
accounts and cloud persistence are outside this increment. M1 is not marked complete.
