# PokéLab — Trainer Studio

An independent, open-source Pokémon discovery and strategy studio. M0 implements a responsive Pokémon detail screen backed by a separate NestJS API and a persistent, validated PokéAPI cache. M1 now includes paginated browsing and exact name/ID search. Type/generation filters, team building, analysis, accounts and cloud saves remain future work.

**PL-001** provides [paginated entry references](http://127.0.0.1:3001/v1/pokemon?page=1&pageSize=20), with strict query bounds, persistent caching and no detail fan-out.

**PL-002** adds [card summaries](http://127.0.0.1:3001/v1/pokemon/summaries?ids=1,25,10025): up to 12 distinct entry IDs, real types/artwork, explicit form/species identity and per-item availability/freshness. Two workers reuse the detail cache; two admitted batches share the existing four request slots. `PokemonCard` accepts the shared summary DTO.

**PL-003** adds [the Pokédex](http://localhost:3000/pokedex): 12 references per page, progressive types/artwork in sequential four-ID batches, explicit partial failure/retry, empty and stale states, URL pagination and a detail return link that preserves the originating page. Desktop uses a three-column grid at wide widths; tablet uses two columns and mobile uses full-width cards.

**PL-004** adds [exact name/ID search](http://localhost:3000/pokedex?search=pikachu). Submit a complete PokéAPI name or ID with Enter/the search button; case and outer whitespace are normalized, and an empty search returns to browsing. Input validation debounces for 300 ms; typing makes no network requests. Results, absence, outages and stale data have explicit states. Clear/Escape, reload, browser history and detail return preserve the URL's committed search. Substring/fuzzy/localized-name matching and type/generation filters remain future work.

## Run locally

Requirements: Node **24.20.0**, pnpm **12.6.0**, Docker with Compose. Exact dependencies are committed in `pnpm-lock.yaml`. Ports: web 3000, API 3001, PostgreSQL 5432.

```sh
pnpm install --frozen-lockfile
docker compose up -d --wait
# Copy .env.example to apps/api/.env.
# Create apps/web/.env.local with API_URL=http://127.0.0.1:3001.
pnpm db:generate
pnpm db:migrate
pnpm build
pnpm dev
```

Open [the app](http://localhost:3000/pokedex), [normalized JSON](http://localhost:3001/v1/pokemon/25), or [OpenAPI documentation](http://localhost:3001/docs). `/` redirects to `/pokedex`; `/pokedex?page=2` is directly shareable. Individual Pokémon can be opened by ID/name, e.g. `/pokemon/bulbasaur`. UI is Brazilian Portuguese; source ability names remain English.

For production smoke testing, use two terminals: `pnpm --filter @pokelab/api start` and `pnpm --filter @pokelab/web start`. The API binds to loopback; public deployment needs hosting/reverse-proxy configuration and operational hardening. Never expose development database credentials. `docker compose stop` preserves the database volume.

## Architecture

```text
Browser → Next.js App Router → NestJS REST → PokéAPI v2
                                  ↕
                          PostgreSQL / Prisma cache

packages/contracts       Zod schemas + inferred shared API DTOs
packages/pokemon-domain  Framework-independent types and unit conversions
```

The adapter constructs allowlisted upstream paths, validates responses, normalizes units and distinguishes entries/forms from species. Cached DTOs are revalidated, expire after 24 hours by default, and can be served stale with explicit freshness metadata during outages. In-flight requests are deduplicated; four unique requests per instance, one retry and timeouts bound upstream access. No live PokéAPI requests occur in CI.

The shell follows the [design system](docs/POKELAB_DESIGN_SYSTEM.md): pastel yellow, cream/white surfaces, navy text, bundled Nunito Sans, typed type colors, responsive navigation, real stats and abilities, accessible meters, loading/error states and artwork fallback. The existing original logo is reused.

## Verification

Start PostgreSQL and apply migrations before running tests:

```sh
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm exec playwright install chromium
pnpm test:e2e
```

Jest/Supertest cover the API using a captured PokéAPI fixture. A PostgreSQL integration test verifies persistence across clients. Vitest covers contracts, domain conversions and the web API client. Playwright starts an offline Nest fixture server and the production web app; it checks 375/768/1280/1600px, keyboard navigation, zoom and failure states. Browser artwork requests are blocked in offline tests; real artwork is verified separately. Screenshots go to ignored `artifacts/` and are uploaded by CI.

See [M0 validation](docs/M0_VALIDATION.md), [PL-001 validation](docs/PL-001_VALIDATION.md), [PL-002 validation](docs/PL-002_VALIDATION.md), [PL-003 validation](docs/PL-003_VALIDATION.md) and [PL-004 validation](docs/PL-004_VALIDATION.md) for actual results and outstanding gates. [GitHub Actions](.github/workflows/ci.yml) runs frozen installation, formatting, lint, typecheck, tests, build and offline browser checks with PostgreSQL.

## Configuration

| Variable                    | App        | Default / rule                                                   |
| --------------------------- | ---------- | ---------------------------------------------------------------- |
| `DATABASE_URL`              | API        | Required PostgreSQL URL; local placeholders for development only |
| `PORT`                      | API        | 3001, integer 1–65535                                            |
| `POKEAPI_TIMEOUT_MS`        | API        | 5000, integer 100–15000                                          |
| `POKEAPI_CACHE_TTL_SECONDS` | API        | 86400, integer 60–604800                                         |
| `API_URL`                   | Web server | `http://127.0.0.1:3001`, valid URL                               |

Environment files are ignored; only harmless examples are tracked. API validation reports invalid variable names without echoing credentials. Database settings and upstream configuration are never exposed to the browser.

## Documentation and next issue

- [Product](PRODUCT.md), [architecture](ARCHITECTURE.md), [roadmap](ROADMAP.md)
- [Domain rules](docs/DOMAIN_RULES.md), [design system](docs/POKELAB_DESIGN_SYSTEM.md), [agent instructions](AGENTS.md)
- [Initial audit](docs/M0_AUDIT.md), [ADR-001](docs/adr/001-foundation.md), [API/cache policy](docs/API.md)

Next smallest issue: **PL-005 — cached type-filter API**, with validated type membership, bounded pagination and explicit combination semantics before adding filter controls. Generation filters and detail enrichment remain separate M1 work. PL-002 reached `main` in PR #4. PL-003 was merged into the old PL-002 branch afterward; [integration PR #6](https://github.com/hugofamorim/pokelab/pull/6) carries the validated catalog into `main`. PL-004 also targets `main`; merging #6 first automatically narrows its diff, without retargeting. No PR is merged automatically.

## Attribution

Data: [PokéAPI v2](https://pokeapi.co/docs/v2), following its fair-use/caching policy. Test fixtures captured from `/api/v2/pokemon/25` and a single visible 12-entry page through the normalized NestJS API on 2026-10-21. The offline browser catalog deliberately uses a small thirteen-entry fixture set; its totals/order are test scenarios, not production catalog facts. Artwork is referenced from PokéAPI's sprite repository, never presented as original work. Nunito Sans/Fontsource and Lucide ship their respective licenses. Supplied brand assets remain in `pokelab-assets/`; only the logo is installed in the app.

Pokémon and associated names/artwork belong to their respective rights holders. This unofficial educational/portfolio project is not affiliated with or endorsed by Nintendo, Game Freak, Creatures or The Pokémon Company. Review asset rights before production publication.
