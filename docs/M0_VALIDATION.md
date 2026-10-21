# M0 validation

M0 is in validation. Do not treat this implementation as a completed milestone until
the local checks, real-data smoke test, browser checks and remote PR checks pass.

## Environment

Windows / PowerShell, Node 24.20.0, pnpm 12.6.0, PostgreSQL 17.7 through Docker.
The machine shut down during the first validation run. Work resumed from the same
feature branch; one interrupted text file (`next.config.ts`) was restored and the
generated dependency installation was repaired. Product specifications and assets
were preserved.

## Results

- Repository audit and required document review: complete.
- One real PokéAPI request captured as a minimized fixture: complete (Pikachu #25).
- Docker PostgreSQL health and additive cache migration: verified before shutdown;
  PostgreSQL restarted after resuming.
- First production build: found NestJS 12 ESM configuration and OpenAPI schema
  typing issues. Corrected using ESM imports and Zod's OpenAPI schema target.
- `pnpm install --frozen-lockfile`: passed after repair; lockfile unchanged by install.
- `pnpm db:generate`, `pnpm db:migrate`: passed; migration replay reports no pending migrations.
- `pnpm lint`, `pnpm typecheck`, `pnpm format:check`, `git diff --check`: passed.
- `pnpm test`: 39 passed (domain 5, contracts 11, web client 4, API 19).
  Includes HTTP cache hit/deduplication, invalid upstream, form/species separation,
  stale fallback, timeout/retry, admission limits and PostgreSQL persistence.
- `pnpm build`: passed for all four packages; Next renders a static shell with
  streamed request data, Cache Components and Partial Prefetching enabled.
- `pnpm test:e2e`: 6 passed, including 375/768/1280/1600px, no horizontal overflow,
  loading, not-found/outage, retry link, missing artwork/abilities, keyboard skip
  link and 200% CSS zoom. API and artwork are offline in these tests.
- Real-data smoke: API Pikachu #25, species #25, electric, 0.4 m, 6 kg, six stats;
  repeated requests preserved `fetchedAt`, `stale: false`. One local observation:
  first request 429 ms, cached request 10 ms. This is not a P95/load-test claim.
- OpenAPI `/docs-json` exposes the normalized endpoint schema: verified.
- Production browser with real artwork: four screenshots, no JavaScript page errors.
  Desktop/mobile images inspected visually; body/caption readability improved and
  build/browser acceptance repeated successfully afterward.
- Remote PR and CI: pending publication and observed remote checks.

## Reproduction and artifacts

Commands are documented in README. Tests require local PostgreSQL with migrations.
The sandbox changes LOCALAPPDATA between calls, so this session installed Chromium
into ignored `.cache/ms-playwright` and set `PLAYWRIGHT_BROWSERS_PATH` for browser
commands. Normal local and CI installations can use Playwright's default location.

Ignored screenshots: `artifacts/detail-{375,768,1280,1600}.png` (offline states),
`artifacts/live-detail-{375,768,1280,1600}.png` (real artwork).

## Remaining scope and limitations

- M1–M5 remain unimplemented. Next smallest task: PL-001 bounded catalog endpoint.
- Cache deduplication/admission are per instance. Aliases use separate cache keys;
  stale responses have no maximum age and retention is operational follow-up.
- No deployment, production performance claim, full assistive-technology audit or
  legal clearance of third-party artwork is implied by local checks.
- Jest's ESM VM mode prints Node's experimental-feature warning; checks remain enabled.

This file is updated with observed final command results during delivery.
