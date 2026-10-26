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

PL-009 adds `/pokedex?page=…&generation=…` as a separate I–IX species-introduction
mode, with explicit URL validation and `fromGeneration` return links. Native filter
anchors reset page/search/type and disable prefetch; rows scroll horizontally on mobile.
Shared pagination/state components preserve the active mode on retry and recovery.
Server-side species references appear immediately; unresolved species have no guessed
detail link. Only the visible twelve references are hydrated, in sequential groups of four.

The same-origin `/api/catalog/generation-cards?speciesIds=…` gateway first resolves
default mappings, then requests summaries only for resolved, distinct Pokémon IDs.
It verifies ordered batch identity, mapped ID/name, owning species ID/name and `isDefault`.
The browser repeats response validation and checks species names against the SSR index.
Expected failures remain per item; source identity contradictions never render ready cards.
Mapping and summary freshness remain separate; an unavailable summary can retain mapping
freshness without enabling an unverified link. The combined server deadline is 135 seconds,
with request cancellation propagated; the browser deadline is 140 seconds. NestJS owns
resource caching/admission. Previously admitted Nest work may complete after cancellation.
Grid keys include generation/page, navigation cancels obsolete browser work, and retries
target failed species only. No backend endpoint, dependency, migration or env changes.

- Avoid runtime `fetch()` calls outside Suspense when `cacheComponents` is on. Separate cached public data from request-scoped private data. Use framework caching deliberately; do not mix private session data in shared cache.
- Do not add route segment `dynamic = 'force-dynamic'` while Cache Components is enabled. Run `next build` in CI to catch prerender errors.

## Species descriptions — PL-010

`GET /v1/pokemon-species/:speciesId/description` uses explicit owning species IDs;
no form-to-species equality is assumed. The adapter validates matching identity,
language/version references, at most 512 entries of 8192 characters and a 1 MiB
streamed body. Selection is deterministic: first nonblank `pt-br` entry in upstream
order, otherwise first `en`; unsupported/empty collections yield `description: null`.
Whitespace/control characters become single spaces. Source language and version are
retained without automatic translation or a claim that this is the newest game's text.

Descriptions have their own normalized cache projection, key
`pokeapi-v2:normalized-v1:species-description/{id}`, using the existing TTL, four shared
resource slots, in-flight deduplication and stale-if-error. PL-008 mapping cache keys
remain compatible: the same upstream species may be fetched once for each distinct
projection per TTL. A future shared richer species cache can consolidate those reads;
no migration/cache invalidation or catalog enrichment is needed for this increment.
Freshness of descriptions remains independent from mappings/Pokémon attributes.

The detail's `#sobre-especie` panel sits inside its own Suspense boundary; its failure
does not replace the detail. The server client verifies species ID **and name** against
the owning species from the Pokémon DTO and uses a 15s deadline/no web cache. Retry
refreshes the current route, retaining query/hash; Nest owns cached source data.
The panel is rendered before application hydration, but streamed HTML requires React's
inline scripts to apply. Fully disabled JavaScript is not supported by this streamed detail.
No dependency, environment, infrastructure or domain-framework coupling is added.

## Evolution resource composition — PL-011

`GET /v1/pokemon-species/:speciesId/evolution` first loads a validated species-to-chain
reference, then constructs an evolution-chain path from its explicit numeric chain ID.
Species, Pokémon entry, Pokémon form and evolution-chain IDs are distinct. No resource
URL is followed and no Pokémon detail/artwork/type enrichment occurs.

The source tree is normalized iteratively into a bounded parent-before-child node list,
preserving sibling order, species identity, baby flags, all condition alternatives and
the separate breeding `babyTriggerItem`. Maximums: 1 MiB per resource, 64 species nodes,
8 levels including root, 64 alternatives per edge, 25 allowed natures, 32 expression
variables and 512 expression characters. Nodes have unique species IDs/names, one root,
connected preceding parents and no cycles. Modern source fields retain version-group,
default flag, region, required/result Pokémon **form** references, steps/move/damage
requirements and expressions. Expressions are opaque metadata and are never evaluated;
source percentages are not battle probabilities. Unknown condition fields fail validation
rather than disappearing. Empty child conditions mean unspecified requirements.

`species-evolution-reference/{speciesId}` and `evolution-chain/{chainId}` under the
existing normalized-v1 namespace have separate caches, in-flight maps and source metadata.
The reference's global resource slot is released before chain admission. Different species
join one chain operation; all operations share the existing four slots with other catalog
resources, without a new queue or nested admission. Existing TTL, one retry and per-attempt
timeout apply to each resource. Two sequential uncached resources mean up to four upstream
attempts; future web consumers must budget for the composed request rather than reuse a
single-resource deadline. Duplicate species projections may fetch species once per projection/TTL.

Membership ID **and name** are cross-checked after source composition. Only an explicit
null species reference returns a null chain; a one-node family is a valid nonnull chain.
Source/cache failures remain errors, with independent stale metadata on successful cached
rescue. Species/chain 404 never retries or rescues expired data. No UI, environment,
dependency, migration or framework coupling in the pure domain package is introduced.

## Evolution detail panel — PL-012

The `#evolucoes` panel has its own Suspense boundary and server-only API usage.
Its client validates the shared response and owning species ID **and name**, without
assuming equality with Pokémon entry IDs. The 70s server deadline accommodates the
two sequential resource stages under the allowed 15s upstream timeout and one retry
per resource. Metadata/source failures do not replace Pokémon attributes or descriptions.
Null reference, one-node family, unspecified conditions, missing source and request errors
remain distinct. Each source has its own timestamp/stale notice. Route retry reuses the
shared refresh button, retaining query/hash and Nest-owned cache behavior.

The species tree preserves real parent/child nesting and source sibling order. Desktop
places the root beside wrapped branches; mobile/tablet stack/wrap with explicit parent
labels and an owning-species marker. Accessible heading names distinguish species from
entry names. Native nested `details` expose every condition record and every shared
field, including false/zero/null, version/default/form metadata and opaque expressions.
Display formatting has exhaustive compile-time field labels; no eligibility is evaluated.
Native details work before application hydration, retaining the existing inline-streaming
script requirement for server content. Identifiers remain original source names.

There is no automatic variety/detail fan-out. A user selects one species to resolve through
the existing same-origin generation-card gateway with a single explicit species ID.
Existing mapping/summary schema and SSR-name matching are reused. Only validated ready
results render the existing Pokémon card; failed/unresolved references have no guessed
link. Selection changes/unmount cancel browser work (140s request deadline against the
existing 135s gateway bound); already-admitted server work may finish within its bounds.
Only the selected preview is retained. Mapping and Pokémon freshness remain independent.
Refreshing the source chain timestamp resets preview state. Card navigation reconstructs
validated browse/type/generation/search return context and disables speculative prefetch.
Default previews are explicitly separate from forms named by individual conditions.

No new API endpoint, dependency, migration, environment variable or asset is introduced.

## Version-scoped moves — PL-013

`GET /v1/pokemon/:pokemonId/moves?versionGroup=…&page=…&pageSize=…` uses a canonical
numeric Pokémon entry ID, never an inferred species ID. `versionGroup` is required;
there is no implicit latest game or generation-to-game mapping. One bounded validated
Pokémon projection stores all source learning records, with species/default identity,
move references and version-group/method/level/nullable order. Page/group projections
happen after resource admission. References are constructed/validated, never followed.
Groups and moves sort by explicit resource ID; source record order remains intact.
Only groups with learning records are listed. A requested group absent from that dataset
returns null identity and no records, not a statement of game availability or impossibility.

`GET /v1/moves/:moveId` independently returns one explicitly marked `current-source`
snapshot (type, damage class, power, PP, accuracy, priority) and separate selected
`past_values` change fields (version group, type, power, PP, accuracy). It does not
resolve historical battle values, class rules, effects, transfer legality or learnability.
Unknown and nullable values are preserved; a metadata lookup alone cannot establish
that a Pokémon learns the move. Consumers must label current attributes independently
from a selected learning version and cross-check requested move ID/name before composition.

Cache keys `pokemon-learnset/{entryId}` and `move-metadata/{moveId}` use normalized-v1;
independent resource freshness, pending maps and the existing four admission slots,
TTL, one retry, timeouts and stale-if-error apply. Neither endpoint fans out. There is
no extra queue, batch endpoint, web change, dependency, env variable or migration.
The same raw Pokémon may be fetched once per projection/TTL (detail versus learnset).
Both resources have 1 MiB streamed/decompressed body caps. Limits: 2,000 moves,
512 learning records/move, 128 version groups and 128 historical records. Contradictory
version/method identities, duplicate records and mismatched requested IDs are rejected.
404s do not retry or rescue stale data. Existing operational cache-retention/stale-age
and per-instance-only throttling limitations remain. API/contract tests are offline.

## Moves detail panel — PL-014

The independent `#movimentos` Suspense panel validates entry ID/name, owning species
ID/name and default status against the detail before displaying learning records.
`moveVersion` is an explicit numeric source version group; `movePage` is bounded to
1–1000 and requires a version. Repeated, array or invalid movement values give a
panel-local invalid state, leaving other detail sections usable. Return context is
reconstructed using the existing validated catalog helpers, including type/generation/search.

Without a selection, the server probes explicit group 1/page 1 to discover available
source groups through the existing PL-013 API. Its learning items are discarded; the
UI presents a required placeholder and displays no moves until a user selects a group.
No latest game or automatic game selection is inferred. A native GET form retains only
constructed catalog return fields and the selected version, resetting movement pagination.
Native pagination links keep version/page/return context and `#movimentos`, with prefetch
disabled. The UI renders at most six distinct moves and every matching learning record,
using native details. Group IDs sort as the API supplies; they do not establish chronology.

Attributes remain separate from learning records. Selecting one card calls same-origin
`GET /api/moves/:id`, which accepts only a canonical numeric ID and no query parameters,
uses the fixed Nest path and revalidates response identity. The browser repeats shared
schema validation and matches both move ID/name against the selected learning reference.
Only one preview is retained; changing selection/unmount aborts work, and synchronous
attempt invalidation rejects obsolete results even before effect cleanup. Source timestamp,
entry, version and page changes reset preview state. No eager metadata fan-out occurs.

The metadata view explicitly labels a current-source snapshot, preserves null/zero values,
reuses known type badges (original source label for unsupported type names), and keeps
selected historical changes behind a native disclosure. Historical null overrides remain
distinct from current unknown values. Learning and metadata freshness are independent;
the selected learning game is never used to label current attributes as historical stats.
No effects, class changes, transfer/competitive legality or damage simulation is inferred.

Single-resource server/gateway deadlines are 45s (allowing two 15s attempts plus jitter and
cache work); the browser deadline is 50s. Requests/responses/errors are no-store at the
web layer, with cancellation propagated; already-admitted Nest work can still finish.
Loading/error/missing/no-record/out-of-range/stale states are local to the panel or preview.
Responsive cards use two columns on tablet/desktop and one on mobile; a selected card spans
the grid with two-column current fields on wider screens. Native form/disclosures work
before application hydration; streamed HTML still needs React inline scripts and attribute
queries need hydration. No full JavaScript-disabled detail support is claimed.

No new Nest endpoint, shared contract, domain-framework coupling, dependency, migration,
environment variable or asset is introduced. Existing logo, shell, buttons, panels, retry,
artwork and typed palette are reused. Offline fixtures never call live PokéAPI in CI.

## Detail tabs — PL-014 visual follow-up

The former scroll-only section menu is now a typed tab list with exactly one visible
panel: attributes, abilities, identity, species description, evolutions or moves. The
hero stays visible. Existing section IDs are preserved as hash links; attributes is
the default for an empty/unrecognized hash. `#sobre` continues to address the project
footer, not species metadata. Movement/catalog query parameters remain untouched.

The client subscribes to hash/history changes using `useSyncExternalStore`, with unique
ARIA tab/panel associations and roving focus. Left/Right wrap, Home/End jump, Enter/Space
activate. Same-page activation adds a history entry without scrolling the menu out of
view; back/forward/reload restore the selected section. Native anchors and CSS `:target`
plus `:has` select a single server-rendered section before hydration. Before the client
can read the hash, no tab falsely claims ARIA selection and all native anchors are focusable;
hydration then supplies the current selection and roving tabindex.

Inactive panels use `display:none`, excluding their content and controls from visual,
keyboard and accessibility navigation. Existing server streaming/resource fetching is
preserved; this is not lazy fetching of inactive data. Child component state stays mounted,
so moving between tabs retains move choices/previews; admitted requests may finish while
a tab is hidden. Existing cache, validation, deadlines and on-demand enrichment are unchanged.
No API, domain, environment, dependency, migration or asset changes are introduced.

## Bounded combined-filter composition — PL-015

`GET /v1/pokemon/filter-scan?type=electric&generation=1&after=0&limit=4` combines
current entry type and owning-species introduction generation. API v2's type members are
Pokémon references, while generation members are species references; no ID/name equality
between those resource kinds is assumed. All current type entries, including nondefault
variants, are eligible candidates. Historical typing, form introduction and game availability
are deliberately outside these semantics. The existing single-type/species-generation routes
and current separate web controls are unchanged.

The application service loads the existing type and generation indexes, releases both resource
operations, selects ascending type-entry IDs strictly greater than `after`, and requests only
that bounded window through the existing summary service. Default four, maximum twelve
candidates; two distinct scan operations per instance, in-flight deduplication for identical
queries, the existing two summary workers/two summary batches and four shared resource slots.
No queue, new cache model, combined-result cache or eager all-catalog indexing is added.
Index helpers are shared with the existing routes. Both index operations settle before scan
admission is removed, including synchronous admission errors, preventing orphaned resources.

Each candidate is matched using normalized entry ID/name, current type and owning species.
ID/name contradictions in either direction become per-item `INVALID_UPSTREAM`, not exclusions.
Valid foreign-generation species yield `excluded`; missing/failed details yield `unavailable`.
Ready/excluded results retain the existing summary projection/freshness. The cursor advances
across every evaluated reference, including failures; a caller can retry the same input window.
Index failures/admission failures are sanitized top-level errors, never fabricated empty sets.

This is a keyset candidate scan, not a page containing a fixed number of matches. Responses
expose ordered outcomes, scanned count, next entry ID, `hasMore` and type-index candidate count;
there is no global match total. Empty windows and exhausted cursors remain explicit. Type,
generation and detail freshness are independent, with existing TTL/revalidation/stale-if-error.
404 details do not retry or rescue stale data. Consumers must reset scan progress if either
index timestamp changes and account for unknown candidates even at exhaustion. Cross-request
source updates are not a transactional snapshot; no automatic full-index drain is authorized.

Both indexes retain their existing 1 MiB/10,000-member caps. Reused Pokémon detail reads
(standalone, summaries and scans) now use the existing streamed/decompressed JSON reader with
a 2 MiB per-resource cap. Exact-boundary, declared-length and streamed-overflow cases are
tested; a real Mew sample was 675,204 UTF-8 bytes. Normalized cache DTOs/keys stay compatible.
Two index resources plus up to twelve detail resources bound a cold scan to fourteen unique
reads, each with the existing timeout/one retry. A future web consumer must budget for the
composed work, use small windows and explicit loading/retry rather than a single-resource deadline.

No frontend/domain-package code, dependencies, migrations, env variables or assets change.
The pure domain package remains framework-independent. OpenAPI and shared Zod contracts
document the query, scope, progress and partial statuses; deterministic tests use captured
resources and clearly identified synthetic scheduling/boundary datasets. Existing deployment
rate limiting, cache retention and unlimited stale-age limitations remain.

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
- PL-007: GET `/v1/pokemon-species?generation=1&page=1&pageSize=20` -> species
  introduced in one supported generation (I–IX), sorted by explicit `speciesId`.
  One constructed `/generation/{id}` request populates a normalized persistent index
  per generation, with the existing TTL, stale-if-error, in-flight deduplication and
  four shared admission slots. Pages/sizes project that index; no species/detail fan-out.
  Generation ID/name, canonical species URLs, uniqueness, 10,000 members and 1 MiB
  streamed/decompressed response bounds are validated. This separate route avoids
  interpreting species IDs as form-specific Pokémon IDs. PL-009 supplies generation
  controls; combined type/generation queries remain future work.
- PL-008: GET `/v1/pokemon-species/default-varieties?speciesIds=1,413` -> at most 12
  ordered explicit species-to-default-Pokémon mappings, with per-item availability and
  species-source freshness. The adapter validates one default flag, every variety URL,
  uniqueness, matching species ID, at most 128 varieties and a 1 MiB body cap. No Pokémon
  detail request follows. One normalized mapping cache per species serves overlapping
  batches. Two workers/two distinct mapping batches have independent batch admission;
  their resource operations share the existing four global slots with summaries and
  other resources. Cache TTL/stale handling is reused; species 404 is explicit without
  retry/stale rescue. Future card consumers must cross-check mapped Pokémon summaries
  against owning species/default identity and expose both sources' freshness.
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
