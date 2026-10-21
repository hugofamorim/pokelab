# PL-004 — Exact name/ID search

Date: 2026-10-21. Branch: `feat/pl-004-name-id-search`, based on PL-003 head `69f9402`.
M1 remains incomplete; type/generation filters and detail enrichment are still pending.

## Acceptance delivered

- Explicit search submission through button or Enter; full canonical PokéAPI name/ID
  with case/outer-space normalization, a 64-character raw limit and strict URL validation.
  Blank search returns to browsing. Search and pagination cannot be combined.
- Shareable `/pokedex?search=…` with normalized redirects before data access. Search
  reuses the existing server-only detail client, bounded NestJS adapter and cache. It
  makes no catalog list or summary-batch request and never invents matches.
- One shared-summary card, distinct absence/outage/invalid/loading states, retry, and
  original stale source date. Returned identity must match the requested name or ID.
- Labelled input, visible help, 300 ms local validation debounce, safe inline error,
  clear button, Escape, pending state, keyboard and mobile controls. No per-keystroke
  network request, suggestions, substring/fuzzy search or localization aliases.
- Search-aware detail return, reload, browser back and bounded internal return links.
  Search form lives outside streamed results with unique IDs. React Activity and browser
  history-cache restoration synchronize the committed URL rather than an old draft.
  Native GET submission also works before hydration; streamed results still require JS.
- Existing logo/assets/tokens/cards reused. No new dependency, environment, migration,
  production backend endpoint, team/account/analyzer feature or generated image.

## Local checks

| Command                          | Result                                                     |
| -------------------------------- | ---------------------------------------------------------- |
| `pnpm install --frozen-lockfile` | Passed; lockfile/dependencies unchanged                    |
| `pnpm db:migrate`                | Passed; existing migration, no pending migrations          |
| `pnpm format:check`              | Passed                                                     |
| `pnpm lint`                      | Passed                                                     |
| `pnpm typecheck`                 | Passed                                                     |
| `pnpm test`                      | Passed: 183 tests (domain 5, contracts 61, API 74, web 43) |
| `pnpm build`                     | Passed; Cache Components/Suspense enabled                  |
| `pnpm test:e2e`                  | Passed: 21 offline browser scenarios                       |

Twenty new web tests cover normalization, query combinations, input bounds, safe return
links, single-request lookup, identity mismatches, missing/malformed/offline responses
and rejecting invalid terms before fetching. Eight new browser scenarios cover four
widths (375/768/1280/1600), name and numeric ID, one-result/no-pagination mode, detail
return, clear/Escape, URL refresh/history, draft validation without network requests,
not-found, invalid queries, outage/retry, stale data, loading, keyboard, 200% zoom and
HTML submission before hydration. All thirteen previous catalog/detail tests also pass.
Fixtures are offline and reuse captured real Pokémon facts; CI never calls live PokéAPI.

Browser tests initially revealed an old/new form overlap during streamed transitions,
history-cache draft restoration, and submission before hydration. The stable form boundary,
unique IDs, URL synchronization and server normalization address those behaviors; checks
remain enabled and the final complete suite passed without test retries.

## Real-data and visual checks

Production Next.js, NestJS and PostgreSQL: queries `25`, `pikachu` and `10025` returned
real normalized data. Entry 10025 remained `meowstic-female`, species 678. Search opened
detail and returned to `search=pikachu`. The result illustration loaded successfully.
No summary batches, browser JavaScript errors or horizontal overflow at 1600px/375px.
Inspected ignored screenshots: `artifacts/search-real-1600.png`,
`artifacts/search-real-375.png`, plus `artifacts/search-{375,768,1280,1600}.png` offline.

## Integration and limits

PL-002 is in `main` via PR #4. PL-003 PR #5 was merged into the old PL-002 branch
afterward; [PR #6](https://github.com/hugofamorim/pokelab/pull/6) integrates the validated
catalog into `main`. PL-004 also targets `main`: merge #6 first to narrow the PL-004 diff
automatically. No retarget, force push or automatic merge is needed. Remote CI/review
will be tracked by the published PL-004 PR.

This increment is exact lookup, not a full searchable index. Type/generation filters,
substring search and remaining detail resources need separate contracts. Existing alias
cache duplication, stale-age/retention limits and deployment rate-limiting work remain.
Next smallest issue: PL-005, cached type-filter API with validated membership, bounded
pagination and explicit combination semantics before implementing type filter controls.
