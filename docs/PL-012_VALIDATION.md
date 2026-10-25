# PL-012 — Accessible evolution detail panel

Date: 2026-10-24 (America/Sao_Paulo); source timestamps are UTC.
Branch: `feat/pl-012-evolution-panel`, based on PL-011 head `36bbdda`.
At audit, `main` was `01c8d0f`: PL-010 PR #13 had merged, while PL-011 PR #14
was reported open at audit. Before publication, its merge into `main` at `243b81a`
was verified using GitHub metadata and Git ancestry. No unmerged dependency remains;
no PR is merged by this task.
All mandatory documents/assets were present and reviewed. The pre-existing generated
`next-env.d.ts` difference was copied under ignored `.cache/` for preservation.

## Implemented acceptance

- Independent `#evolucoes` Suspense panel uses the shared species-based response contract
  and verifies owning species ID **and name**. Its 70s deadline accounts for two resource
  stages with the permitted 15s per-attempt upstream timeout/retry. Attributes/descriptions
  remain visible during evolution failures. Explicit null reference, one-node family,
  unspecified conditions, missing source, error/retry and independent stale sources differ.
- Species tree preserves parent/child nesting, sibling order, branches, root/baby markers
  and selected species identity. Desktop shows root beside wrapped branches; tablet/mobile
  wrap/stack with explicit parent text. Native nested details expose all source records
  and every shared condition field with original identifiers. Exhaustive labels cover
  null/false/zero, source version/default/form scope and opaque expressions/percentages.
  No eligibility/availability or battle outcome is calculated or implied.
- Species headings have explicit accessible names, distinct from Pokémon-entry headings.
  Controls have visible focus and mobile targets; text and long source expressions wrap.
  Native condition details work before client hydration, retaining the existing inline
  streaming-script requirement. Fully disabled JavaScript is not supported by the route.
- No automatic mapped-card fetches. User selection requests exactly one explicit species
  through the existing same-origin generation-card gateway. Existing mapping/summary
  validation, source-name matching, Pokémon cards/artwork/badges are reused. Only ready
  validated entries receive links; unavailable references never guess Pokémon IDs.
  The selected preview is retained; changing selection/navigation aborts obsolete browser
  work. Existing 135s gateway/140s browser deadlines remain. Already-admitted server work
  may finish under existing bounds. An attempt token invalidates old results synchronously
  on selection, including the window before React effect cleanup. Mapping and Pokémon
  freshness have separate notices.
- Preview links reconstruct validated browse/type/generation/search return context;
  prefetch stays disabled. Refreshing chain source data resets preview state. Default
  previews are explicitly separate from forms named in individual conditions.
- Reuses a shared route-refresh button for description/evolution retries. Existing shell,
  logo, type tokens and artwork remain. No backend endpoint, dependency, migration or env.

## Local checks

- Frozen installation passed; lockfile unchanged.
- PostgreSQL healthy; `pnpm db:migrate`: no pending migrations.
- Lint, strict typecheck and production build passed on the final UI source.
- `pnpm test`: **632 passed** — domain 5, contracts 163, API 309, web 155.
  Adds 26 web cases covering identity/topology/source boundary failures, null versus
  single-node data, 70s timeout, sanitized errors, safe return URLs and complete field
  display preserving zero/false/null and opaque expressions.
- `pnpm test:e2e`: **50 passed in one invocation**, 1.6 minutes. All original 41 remain
  enabled plus 9 new scenarios for four widths, keyboard-native condition disclosure,
  real branching, validated on-demand navigation, failure/absence/single-node/unknown
  conditions, retry with origin/hash retention, 200% zoom, form-scoped expressions,
  selection cancellation, independent freshness and cross-source name rejection.
  Global timeout remains 180s and retries remain zero. CI never calls live PokéAPI.
- Final documentation formatting check passed; Linux publication checks are tracked below.

The first browser run found ambiguous `pikachu` headings after adding species nodes.
Species headings were given explicit accessible names; the original detail tests were
preserved and passed afterward. Visual review also fixed narrow preview names and refined
root/branch desktop placement. No quality checks were disabled or errors suppressed.
For production checks, only the verified Next dev process and ignored `.next/dev` output
were stopped/cleared to avoid the known dev/prod generated-type collision.

## Real source and visual verification

New fixtures: captured raw evolution chains 1/10 and normalized Nest details for
Eevee 133, Vaporeon 134 and Dunsparce 206. Existing real chains 67/103 are reused.
The browser fixture keeps its original limited catalog/generation totals; additional
detail fixtures do not silently expand those indexes. Controlled null, synthetic
one-node, omitted-condition, outage, identity-mismatch and stale-cache cases exist only
for offline tests, never production data. Captures date: 2026-10-24 America/Sao_Paulo.

Production browser smoke against real Nest data verified Eevee's **8 direct branches**
at 375/768/1280/1600px. No mapping request occurred on initial panel load. Selecting
Vaporeon made exactly one gateway request (`speciesIds=134`), loaded its actual artwork,
and linked `/pokemon/134?fromSearch=eevee`. No horizontal overflow or browser runtime
errors occurred at any width. The native condition showed `water-stone (#84)` and
the source form reference. Dunsparce preserved two distinct form records and opaque
expressions, including `dudunsparce-three-segment (#10424)` without inferring an entry URL.

Final ignored real captures: `artifacts/evolution-live-{375,768,1280,1600}.png`,
`evolution-live-condition.png`, `evolution-live-forms.png`. Offline captures:
`evolution-{width}.png`, `evolution-form-zoom.png`. Desktop/mobile/tablet captures are
visually inspected for hierarchy, relationship clarity, source metadata, wrapping,
preview artwork and readable conditions. Fixed mobile navigation can appear mid-image
in long element captures; controls remain scrollable/reachable in the viewport.

Published for review in [PR #15](https://github.com/hugofamorim/pokelab/pull/15),
targeting integrated `main`. Initial Linux validation is tracked in
[CI run 68](https://github.com/hugofamorim/pokelab/actions/runs/40152621909).
Final publication-head verification is recorded in PR checks. No PR was merged by this task.

## Remaining work

PL-013: bounded version-aware move metadata contracts/API retaining learn method/level,
before curated moves UI. Combined filters remain M1 work; M2–M5 have not started.
Source condition identifiers remain original names; the panel does not simulate game
rules or promise form availability. Full JavaScript-disabled streaming, existing backend
stale-age/retention and deployment rate-limits remain outside this increment.
