# PokéLab — Trainer Studio | Product Specification

Status: product specification v1.0. M0 foundation implemented; M1 in progress (PL-001 paginated references API); M2–M5 planned. Validation and review status: ROADMAP.md. Language of product UI: Brazilian Portuguese default, English-ready. Repository: `hugofamorim/pokelab`.

## Vision

Build a polished, independent Pokémon training and analysis application that turns PokéAPI data into a usable, educational tool: discover Pokémon, construct teams of six, analyze matchups, and share strategies. This is a full-stack portfolio case demonstrating advanced UI, integration, domain algorithms, persistence, accessibility, engineering quality, and operations. Do not clone existing games or promise competitive-battle accuracy.

## Target users / jobs

- Casual explorer: find a Pokémon, browse data, understand evolution and moves.
- Team planner: assemble and compare teams, discover duplicate weaknesses and coverage gaps.
- Returning trainer: save, revise, and share teams across devices.
- Technical reviewer: inspect source, tests, architecture, design and reproducibility quickly.

## Design principles

- Playful but premium; original product identity, not an official Pokémon replica.
- Guest-first: a visitor can use the Pokédex, create a temporary team and generate a shareable configuration without login.
- Transparent calculations: document generation rules and assumptions; never call type-only analysis a full battle simulation.
- Fast and resilient: cache external responses; show loading/error/empty states; tolerate partial PokéAPI outages.
- Accessible: WCAG 2.2 AA target, keyboard navigation, screen reader labels, reduced-motion alternative, contrast.
- Privacy conscious: minimum account data, no passwords/tokens exposed in logs; allow deleting user-owned data.

## MVP (M0–M3)

### Pokédex

- Paginated searchable catalog by ID/name, type(s), generation; URL query parameters represent filters.
- Pokémon detail: names, images, types, base stats, abilities, height/weight, species flavor text where provided, evolution chain, curated move list; clearly label differences between species, variants and forms.
- Fallback for missing localization, artwork or incomplete metadata.
- Progressive loading, responsive cards, keyboard-friendly filter controls and meaningful empty states.

### Team Builder

- Guest team up to 6 slots; add/remove/reorder Pokémon; allow duplicate species in sandbox but make duplicate setting explicit (default rule: disallow duplicates for a simple standard team).
- Select supported Pokémon form where applicable; show type and stat summaries.
- Save draft in browser (local storage) with schema version and validation; import/export team via compact, validated, versioned URL payload; URLs must not contain secrets.
- Name team and annotate strategy (optional, bounded length).

### Team Analyzer

- Defense matrix for the 18 attack types vs selected Pokémon types (using the selected generation/type dataset).
- Multipliers computed by multiplying per-type matchups; supported result classes 0, 0.25, 0.5, 1, 2, 4 (and other mathematically valid multipliers when rules demand).
- Team-level weakness/resistance/immunity counts, duplicate weaknesses, balanced-type distribution and simple recommendations with transparent, deterministic rules.
- Offensive type coverage based on _selected move types_ when explicitly configured, or _own Pokémon types_ as a clearly labeled type-only approximation. Never claim a move is learnable unless API move learnability has been validated for chosen game/version.
- Baseline ruleset pinned to a documented generation (initial recommendation: modern 18-type chart / Generation IX where data supports it), with test fixtures. No items, abilities, weather, STAB or damage formula in MVP.

## M4 account features

- Account signup/login/logout, email verification and password reset with secure, short-lived tokens; session management and server-side authorization.
- Private saved teams, edit/duplicate/delete, optional public share snapshots with opaque IDs; share link revocation. Public team pages MUST not leak user email/private notes.
- Favorite Pokémon and basic trainer profile without requiring excessive personal data.
- Guest-to-account import with explicit confirmation and conflict handling.

## Out of scope for MVP

- Real-time player-versus-player, full turn-based battle simulation, Elo leaderboard, trading, shiny hunting automation, scraping, payment, AI-generated tactical advice and unrestricted social features. These require later specs and separate acceptance criteria.

## Nonfunctional targets (initial goals, verify in CI and production)

- TypeScript strict; no `any` at boundaries without a documented exception; upstream data validated at runtime.
- Reliable unit tests for every type-effectiveness rule, and integration tests for caching, persistence and authorization.
- CI lint, typecheck, tests, build; no ignored red checks. Production smoke test.
- Core Web Vitals goals on real deployed pages: LCP <=2.5s, INP <=200ms, CLS <=0.1 at p75, measured not assumed.
- API P95 response targets for cached catalog/details <=500ms in test environment; report measurement conditions.
- External API requests throttled and cached; avoid burst fanout; logs and diagnostics do not expose credentials.

## User journeys / acceptance examples

1. Guest loads catalog, searches `pikachu`, opens detail, explores type/stats/evolution, returns with filters intact.
2. Guest builds six-Pokémon team, replaces member, views weaknesses, refreshes page and retains draft.
3. Guest copies public team configuration URL and opens it in another browser to restore a _valid_ team without account data.
4. Logged-in user saves team, reloads on different device, edits it, revokes share; another user cannot access private data.
5. Upstream API fails: show helpful error, retry with backoff, and use a cached response where appropriate.

## Portfolio deliverables

Live demo; README with problem and architecture; screenshot/video; ADRs; endpoint docs; database schema; unit/integration/E2E tests; CI badge backed by workflow; design decisions; transparent limitations, independent/unofficial disclaimer.
