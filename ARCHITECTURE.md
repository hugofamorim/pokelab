# PokéLab — Architecture and Technical Decisions

## Baseline stack

- Monorepo: pnpm workspaces + Turborepo, Node.js current supported LTS pinned with `.node-version` and `packageManager` field.
- Web: Next.js App Router, React, TypeScript strict, Tailwind CSS, shadcn/ui, Motion sparingly, React Hook Form + Zod, optional TanStack Query for interactive client caching.
- API: NestJS, typed REST controllers/DTOs, OpenAPI, modular services and auth guards.
- Domain: TypeScript package without framework dependencies; pure analysis functions.
- DB: PostgreSQL + Prisma, migrations committed, DB indexes/uniqueness constraints. Redis optional only if measured load warrants shared cache/queues.
- Tests: Vitest for domain/web, Jest and Supertest for API, Playwright E2E, deterministic fixtures and mocked PokéAPI.
- Tooling: Docker Compose for DB, GitHub Actions. Use versions current and mutually compatible _when scaffolding_; pin package versions and lockfile after verified installation.

## Context diagram

Browser -> Next.js web (SSR + interactive editor) -> NestJS API (catalog adapter, team and auth endpoints) -> PostgreSQL for users, teams, share snapshots and optional upstream-response cache.
NestJS catalog adapter -> PokéAPI v2 (read-only upstream). No API key needed. External data never treated as trusted.
`packages/pokemon-domain` consumes normalized DTOs, not raw PokéAPI models.
`packages/contracts` provides schema/type contracts (Zod or generated OpenAPI client); avoid divergent DTO definitions.

## Upstream integration

- Only use https://pokeapi.co/api/v2/ endpoints by constructed, allowlisted resource paths; never fetch arbitrary caller-supplied URLs (SSRF defense).
- Expected resources: `/pokemon/{id-or-name}`, `/pokemon-species/{id-or-name}`, `/evolution-chain/{id}`, `/type/{id-or-name}`, `/move/{id-or-name}`, `/generation/{id}` plus paginated listing.
- Distinguish `pokemon` (form-specific playable data) from `pokemon-species` (species, flavor, evolution reference); IDs are not always interchangeable.
- Normalize required fields to app DTOs. Validate and restrict upstream fields; do not forward entire responses to clients.
- Cache every upstream resource locally in a persistent/shared cache or appropriately configured server cache. Start with DB-backed `ExternalResourceCache` keyed by canonical path and source version with `fetchedAt`, `expiresAt`, `payload`, optional ETag if supplied. Keep a small in-memory L1 for development only if useful.
- Example policy: stable species/type metadata 7 days; Pokemon details 24 hours; error responses short negative cache (e.g. 60s for 404), avoid caching transient 5xx. Make TTL configurable.
- In-flight deduplication, bounded concurrency (e.g. 4 concurrent upstream requests per instance), timeout (~5s), bounded exponential retry with jitter for transient failures. No aggressive bulk prefetching.
- Be prepared for changing upstream datasets; do not hardcode total number of Pokémon, assume every sprite exists or claim all entities are supported.
- Allow graceful stale-if-error for previously cached public data; expose source freshness in metadata and logs.

## Cache Components/Next.js

PL-003 adds `/pokedex?page=…` with a fixed 12-entry page size. References are fetched
server-side inside Suspense; the client immediately renders their real names/IDs, then
loads summaries in sequential groups of four through the same-origin Next.js
`/api/catalog/summaries` gateway. Only server modules read `API_URL` or call NestJS;
the browser never calls PokéAPI or PostgreSQL. Both gateway and browser validate batch
identity/order against the requested IDs. Requests are uncached at the web layer; NestJS
owns public data freshness. Navigation cancels browser work, retry targets failed IDs,
and summary/detail/pagination links disable speculative prefetch. Existing in-flight
NestJS work may finish after a browser cancellation, under the existing admission bounds.
`fromPage` on detail links is validated and converted to a constructed internal return URL.

PL-004 adds the separate `/pokedex?search=…` exact-lookup mode. A strict web query parser
accepts a full canonical name/ID (up to 64 raw characters) or pagination, never both.
The existing server detail client performs one NestJS request and revalidates returned
identity before projecting the shared summary. Search is submitted explicitly; 300 ms
debounce applies only to local validation, not network calls. Case/outer-space normalization
also redirects on the server, covering HTML submission before hydration. The search form
has its own stable Suspense boundary outside streamed results, unique label IDs, and
restores the committed URL term after React Activity or browser history-cache restoration.
Validated `fromSearch` constructs the internal detail return link. No list search/index,
bulk fetch, new backend endpoint or direct browser upstream access is introduced.

PL-006 connects the single-type index to `/pokedex?page=…&type=…`. The web parser
accepts one canonical type with pagination, while exact search remains a separate mode.
Selecting a type resets page/search; submitting search clears the filter. Filter links
use the existing typed palette and disable speculative prefetch; mobile scrolls the
chip row horizontally and desktop wraps it. The stable filter boundary reads committed
URL state independently of streamed results. The server verifies returned page, size
and type identity; grid boundaries include both page and type to discard obsolete loads.
Validated `fromType` plus `fromPage` constructs internal return URLs for ready and
unavailable cards. Retry/first-page recovery retains the active filter. No new API,
dependency, database migration or environment variable is introduced.

- Avoid runtime `fetch()` calls outside Suspense when `cacheComponents` is on. Separate cached public data from request-scoped private data. Use framework caching deliberately; do not mix private session data in shared cache.
- Do not add route segment `dynamic = 'force-dynamic'` while Cache Components is enabled. Run `next build` in CI to catch prerender errors.

## Domain module model

- Entities/value objects: `PokemonRef`, `PokemonType`, `Ruleset`, `TeamSlot`, `Team`, `TypeEffectiveness`, `CoverageReport`.
- Pure `getDefenseMultiplier(attackType, defenderTypes, chart): number`: multiply effectiveness for dual types; immunity multiplies to zero.
- `analyzeTeam(team, chart): TeamAnalysis`: per-type matrix, team weaknesses/resistances, counts; empty slots excluded.
- Optional `analyzeOffensiveCoverage(selectedMoveTypes, chart)` strictly labeled with its assumptions.
- A type-chart fixture should be committed for a pinned generation with upstream/source citation, validation hash, and tests (Fire -> Grass = 2, Electric -> Ground = 0, Ice -> Dragon/Flying = 4, Ground -> Flying = 0).
- Forms/moves/abilities may vary by game version; treat unsupported cases as unknown or exclude rather than invent facts.

## Database (suggested logical model)

- User: id UUID, displayName, email unique normalized, passwordHash/identity provider ref, createdAt, updatedAt, emailVerifiedAt.
- Session: id, userId, refreshTokenHash, expiresAt, revokedAt, createdAt; rotate/revoke server-side.
- Team: id, ownerId, title, description?, ruleset, visibility (`PRIVATE` or `UNLISTED`), createdAt, updatedAt, version.
- TeamSlot: id, teamId, slotIndex (0–5 unique per team), pokemonId, pokemonName, formId?, selectedMoveIds JSON/relational as needed.
- SharedTeamSnapshot: id opaque, teamId, snapshot JSON schema version, revokedAt?, createdAt, expiresAt?; snapshot is immutable and sanitized.
- Favorite: unique (userId, pokemonId).
- ExternalResourceCache: cacheKey unique, payload JSONB, fetchedAt, expiresAt, sourceETag?.
- All team/favorite queries server-filter by authenticated ownerId. Never rely on client-provided ownerId.
- Database migrations are reviewed, tested, forward-compatible; separate destructive operations into deliberate migrations.

## REST contract proposal (versioned under /v1)

### Public catalog

Implemented increments are documented in `docs/API.md`: PL-001 returns reference pages;
PL-002 offers `/v1/pokemon/summaries?ids=…` for at most 12 explicit entry IDs. Summary
DTOs are projected from the shared validated detail schema, preserving form/species identity.
Two workers per batch reuse detail cache and in-flight work; at most two batches run per
instance. Workers share the existing four admission slots with individual details/pages.
There is no separate summary cache, eager list enrichment or new infrastructure. Expected
per-item failures return explicit unavailable results; unexpected failures use the sanitized
HTTP error envelope. The proposed search/filter API below remains future work.

PL-005 implements only the optional single-type filter on `GET /v1/pokemon`. Canonical
18-type names share pagination validation; multi-type, search and generation combinations
remain rejected. The adapter constructs `/type/{type}`, validates requested type identity,
slot (1/2), canonical Pokémon reference URLs and unique IDs/names, then sorts references
by Pokémon entry ID. Forms remain separate entries; no species IDs or detail data are inferred.
The source body is limited to 1 MiB of streamed/decompressed bytes (also rejecting an
oversized declared length), and normalized indexes allow at most 10,000 members.

Each type has one persistent `pokemon-type-index/{type}` cache key under the existing
source/schema namespace. Different pages/sizes join the same in-flight index load; pages
are projected after that load, avoiding nested admission or repeated page-level copies.
Type loads share the existing four slots with pages/details and use the existing configurable
24-hour default TTL/stale-if-error policy. Fresh/stale metadata belongs to the index and
is preserved across pages. No distributed limiter, new database model, environment or dependency.
Unread HTTP error bodies are cancelled before retries. Type resource schema/byte failures
are 502 without retry; transport/HTTP failures retain one bounded retry and 503 handling.

- Implemented: GET `/v1/pokemon?type=&page=&pageSize=` -> bounded references and source metadata, optional single-type identity. List-level search and generation/multi-type combinations remain future work; exact web search uses detail lookup.
- GET `/v1/pokemon/:idOrName` -> normalized detail, explicit form metadata.
- GET `/v1/pokemon/:idOrName/evolution` -> normalized evolution chain.
- GET `/v1/types` -> supported type chart/ruleset list.
- POST `/v1/analysis/teams` -> validates up to six slots and returns deterministic analysis, with no persistent state for guest.

### Identity & teams (M4)

- POST `/v1/auth/register`, `/v1/auth/login`, `/v1/auth/refresh`, `/v1/auth/logout`; POST `/v1/auth/forgot-password`, `/v1/auth/reset-password`, `/v1/auth/verify-email`.
- GET `/v1/me`, GET/POST `/v1/teams`, GET/PATCH/DELETE `/v1/teams/:id`, POST `/v1/teams/:id/duplicate`.
- POST `/v1/teams/:id/share`, DELETE `/v1/teams/:id/share/:shareId`; GET `/v1/shared-teams/:shareId` (sanitized snapshot).
- GET/POST/DELETE favorites, with valid pokemon IDs.
- Consistent error envelope: `{code, message, details?, requestId}`; avoid returning upstream raw errors.
- Document endpoint status codes, auth requirements, request/response schemas, pagination and constraints via OpenAPI.

## Auth/security for M4

- Password hashing: Argon2id (or equally reviewed alternative), rate limit auth endpoints, generic reset response, validated short-lived reset/verify tokens stored hashed.
- HttpOnly Secure SameSite cookie strategy where appropriate; CSRF protection for cookie-authenticated mutations; CORS allowlist; refresh rotation + reuse detection.
- Never use localStorage for auth tokens. User-generated text is escaped. Validate URL payload, lengths and enumerations.
- Public shares use unguessable opaque IDs, only intentionally published fields; revoke links.
- Security headers, audit for sensitive account events, secret scanning and dependency scanning in CI.

## Architecture decision records to author

ADR-001 Monorepo and independent NestJS API; ADR-002 guest-first and auth deferral; ADR-003 PokéAPI adapter and caching policy; ADR-004 ruleset pinning and scope limits; ADR-005 private-team authorization and share snapshots; ADR-006 error-handling and observability.
