# Codex Agent Instructions — PokéLab Trainer Studio

**Project:** `hugofamorim/pokelab` (planned) — an independent, open-source full-stack Pokémon team strategy platform. Read `PRODUCT.md`, `ARCHITECTURE.md`, `ROADMAP.md`, and `docs/DOMAIN_RULES.md` before editing code. These files are the source of truth for the product; resolve conflicts by reporting them and preferring tested, secure behavior.

## Mission
Deliver a publicly demonstrable, beautiful and genuinely engineered product: Pokédex, team builder, explainable type-analysis, with accounts and shared teams in a later milestone. Portfolio quality matters more than raw feature count. Do not create a simple tutorial Pokédex or a copy of a Pokémon game.

## Operating protocol
1. Inspect repository state, existing code/config, branch and CI before implementing. Do not overwrite working functionality, automatically upgrade major versions, or initialize over an existing repo.
2. Identify current milestone and task; describe a compact plan, acceptance criteria and impacted files.
3. Work incrementally on `feat/pl-###-short-description` branches. One coherent task/PR at a time. Do not force-push, rewrite history or merge a PR without explicit authorization.
4. Prefer clear implementations to overengineering. Keep framework-agnostic analysis in `packages/pokemon-domain`, no calls to PokéAPI in domain functions.
5. Cover new domain logic with deterministic tests and HTTP interactions with mocked/fixture tests. Never call live PokéAPI in CI.
6. Run local lint, typecheck, tests, build; if unavailable, report what was actually run and why. Don't disable checks, use `@ts-ignore` or silence lint to get a green CI.
7. Update docs, changelog/README sections when architecture, contracts, or env variables change. Report changed files, exact validation results, follow-up tasks and known limitations.
8. Respect user consent for external mutations/commits; never claim actions happened if not verified.

## Tech and boundaries
- TypeScript strict, Next.js App Router, NestJS REST, PostgreSQL/Prisma, pnpm + Turborepo, Tailwind/shadcn. Current compatible stable versions pinned in lockfile; do not guess compatibility.
- Use server-side adapter for PokéAPI v2, runtime validation, canonical allowlisted paths, caching and bounded requests. Refer to https://pokeapi.co/docs/v2 and its fair-use policy. No bulk unsolicited scraping.
- No frontend direct access to database and no PostgreSQL/Prisma in pure domain package.
- Do not duplicate types manually across layers where contracts can be shared/generated.
- Cache public upstream data only; keep private session/team data isolated by user.
- Avoid `dynamic = 'force-dynamic'` if Next.js `cacheComponents` is enabled. Use correct caching, Suspense and build validation.
- Prefer accessible UI controls, controlled error/loading/empty states, keyboard-friendly interactions, reduced motion and mobile-first responsiveness.

## Domain guardrails
- Clearly distinguish species, specific Pokémon form and evolution stage; never assume all IDs map 1:1.
- Default team has max six members, and default duplicate-species restriction is on; model optional sandbox duplicates explicitly.
- Compute effectiveness from validated, pinned chart. Compound for dual types; immunities yield zero.
- Type-only analysis ≠ battle simulation. No claims about damage, win probability, abilities, items or available moves unless explicitly implemented and validated.
- Validate and bound any imported/sharable guest team payload; no personally identifiable information in URLs.
- Public share snapshots are immutable, sanitized and revocable when created from accounts.

## Security and privacy
- All inputs validated server-side, including upstream responses. Do not fetch user-supplied arbitrary URLs; enforce page limits and timeouts.
- Authentication and private team storage introduced in M4 only, unless approved; never put credentials in localStorage. Hash passwords/tokens properly; protect cookie actions from CSRF; enforce owner-only authorization at service/query layer.
- No secrets or real `.env` committed. Use `.env.example` with harmless placeholders. Use prepared statements/Prisma, and error responses without internal traces.
- Respect Pokémon-related trademarks/artwork and PokéAPI attribution; never imply official affiliation. Use compliant asset sources or neutral placeholders when unclear.

## Design System

Before implementing or modifying any user interface,
you must read the following document:

- docs/POKELAB_DESIGN_SYSTEM.md

Follow the design tokens, reusable components, responsive
layout patterns, accessibility standards, and asset usage
guidelines defined in this document.

Visual references establish the intended design direction,
but all data displayed in the interface must be accurate
and sourced from the API or the application's domain logic.

Do not unnecessarily recreate existing components.
Maintain visual and functional consistency across
desktop and mobile experiences.

## Delivery sequence
Execute milestones in order: M0 foundation + adapter; M1 Pokédex; M2 Team Builder; M3 deterministic analyzer; M4 auth/cloud saves; M5 production showcase. At each milestone write a concise status summary and propose the next smallest issue. Do not start future milestone features without need.

## Definition of done
- Feature works against specified acceptance scenarios and gracefully handles upstream failures.
- Tests cover critical success, boundary, and failure cases; CI all green.
- Typecheck, lint, build pass without suppressed errors. Prisma migrations safe/reproducible.
- API schemas documented, README kept current, and performance/security considerations noted.
- Demo images/data do not expose personal information or third-party secrets.

## First Codex task
1. Audit current repository (it may be empty) and document findings.
2. Create M0 skeleton only if missing; pin supported runtime and dependency versions.
3. Create a sample typed PokéAPI v2 adapter with caching, validation and one normalized endpoint.
4. Build a minimal elegant web shell displaying a fetched Pokémon through NestJS.
5. Write offline unit/integration tests and GitHub Actions job; run all checks; document exact next steps.
