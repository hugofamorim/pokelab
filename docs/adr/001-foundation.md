# ADR-001 — M0 foundation and public cache

Status: accepted for M0, 2026-10-21.

Use pnpm/Turbo with independently buildable Next and Nest apps. Contracts expose
Zod schemas and inferred DTOs; the domain package has no network, framework, or
database dependencies. Do not implement M1–M4 features to populate the shell.

Keep upstream integration behind `PokeApiAdapter`, orchestration in `CatalogService`,
and storage behind `ResourceCache`. Production uses Prisma/PostgreSQL; offline HTTP
tests substitute in-memory storage and fixture fetch, while a dedicated integration
test verifies persistence against PostgreSQL. The browser never sees DATABASE_URL
or calls PokéAPI directly. Artwork is loaded through Next Image's allowlist.

Persistent cache makes PostgreSQL part of M0, as required by ARCHITECTURE.md. Only
one additive table is migrated. In-flight deduplication and admission limits remain
per instance; a distributed limiter and retention jobs are future operational work.

Use bundled Nunito Sans, the existing original logo, accessible native controls,
typed tokens for all 18 types, and a mobile-specific navigation layout. Do not add
future feature links, fictitious trainer profiles, analysis scores, or catalog cards
whose data has not been retrieved. A reusable PokemonCard is supplied for M1.

The detail screen is server rendered under Suspense with Cache Components enabled.
Next does not duplicate the API cache or require live upstream during build.
