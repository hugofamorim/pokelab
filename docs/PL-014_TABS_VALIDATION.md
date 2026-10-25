# PL-014 — Functional detail tabs

Date: 2026-10-25 (America/Sao_Paulo). User-requested visual follow-up before continuing M1.
Base: PL-014 head `62987ce`, in open [PR #17](https://github.com/hugofamorim/pokelab/pull/17).
All mandatory docs/design guidance and existing components were reviewed. No required file
was missing. The generated `next-env.d.ts` change was backed up under ignored
`.cache/pl-014-tabs-next-env.original` and is preserved outside commits.

## Result

- Six functional tabs display exactly one section at a time. Attributes are the default;
  the hero, return link and small exploration/project footer remain shared. Separate sections
  reuse the existing components and responsive surfaces instead of the former two-column
  combined attributes/abilities/identity layout.
- Native section hash links remain valid. Clicking/keyboard activation changes only the
  hash, preserving movement version/page and catalog return context. Back/forward/reload
  restore the section. The project footer's existing `#sobre` remains independent.
- ARIA tablist/tab/tabpanel associations, unique IDs, roving tabindex, Left/Right wrapping,
  Home/End and Enter/Space. Inactive sections are removed from visible/accessibility/focus
  navigation by CSS. The selected panel is keyboard focusable.
- Native anchors plus CSS select a single section before application hydration; existing
  React inline streaming scripts still apply server data. Full disabled-JS support is not
  newly claimed. No automatic scrolling away from the tab menu after enhanced activation.
- Existing server resource streaming/caching is preserved, including inactive sections;
  no lazy-fetching claim. Tab switches retain child state and admitted requests can finish
  while hidden. No new API, shared contract, dependency, migration, environment or artwork.

## Validation

- Initial focused run: 31/32 passed. The remaining test wrongly treated `#sobre` (the
  project footer) as a species-tab alias; corrected both the new resolver and expectation
  to preserve the actual existing footer behavior. No assertion/check was disabled.
- Final format/lint/typecheck, 733 unit/integration tests and production build passed.
  All 64 browser cases passed in one full run (1.9 minutes), with retries zero and
  the existing 180s global limit unchanged.
- Six new browser cases cover four widths (375/768/1280/1600), exactly one visible and
  accessible panel, tab/query/return identity, history/reload, keyboard/zoom, native links
  before hydration and the independent project footer.
- Existing description/evolution/moves cases now select their corresponding tab. Assertions
  still verify actual source facts, retries, stale data, failures and cancellation. Where
  attributes are inactive, tests assert zero accessible meters and six preserved DOM meters,
  reflecting the requested behavior rather than dropping data checks.
- Live Bulbasaur smoke passed across all six tabs at 375/768/1280/1600px, using the
  user's `fromPage=1&moveVersion=9&movePage=3` context. Exactly one visible/accessibility
  panel, unchanged query, working history and zero JavaScript errors were verified.
  Live captures under ignored `artifacts/detail-tabs-live-*.png` were visually inspected
  at all four widths. Existing fixed shell elements can appear offset in tall page
  screenshots; tab visibility and horizontal bounds were also checked in the actual viewport.
- Updates the existing open PR #17 rather than creating a dependent PR for this requested
  visual revision. The working branch was switched back to `feat/pl-014-moves-panel`
  before commits/publication, preserving all changes. Updated Linux CI is pending publication.
  M1 remains in progress. No merge performed by this task.
