# M0 audit — 2026-10-21

## Initial state

The working directory contained the six required specifications, a planning README,
and 30 existing raster assets. There was no local Git repository, application,
manifest, lockfile, environment configuration, database, or CI workflow.
All required documents were read before implementation. The referenced page mockups
were absent; the design-system document is the available visual specification.
The logo was visually inspected and reused; avatars and decorative icon crops are
retained in the original asset directory, unused until a relevant feature exists.

The confirmed remote `https://github.com/hugofamorim/pokelab` contains an initial
`.gitignore` commit. It was fetched and merged into the foundation branch without
rewriting either history. The connected GitHub API account initially returned 404;
Git transport can read the repository. No pre-existing application was overwritten.

## Scope and decisions

- Issue PL-000 / branch `feat/pl-000-foundation`: M0 only.
- Web → independent Nest REST API → validated PokéAPI adapter. Shared Zod contracts
  and framework-independent type vocabulary/unit conversion.
- PostgreSQL/Prisma is required now by the architecture's persistent public cache.
  No user, session, team, authentication, or share models are introduced.
- Native semantic controls plus small reusable React components; Tailwind 4 setup
  and CSS tokens. No dialog, form library, animation package, or shadcn generator is
  necessary for this read-only milestone; these can be adopted with actual controls.
- Cache Components is enabled; request-dependent work lives beneath Suspense.
  Public cache policy belongs in the API; Next fetches the API without another cache.
- Next 16.4.2, React 19.3.1, Nest 12.2.0, Prisma 7.10.1 and Node 24.20.0;
  exact dependency versions and pnpm lockfile. Prisma's `latest` tag pointed at an
  8.0 release candidate, so stable 7.10.1 was selected. TypeScript 6.0.3 respects
  ts-jest's `<7` peer constraint; ESLint 9.39.5 respects eslint-config-next's peers.
- Nunito Sans is bundled locally, avoiding a Google Fonts request during builds.
- Nest 12 is ESM-only; the API and Jest transformer use ESM, with explicit `.js`
  import specifiers for emitted Node modules. Node's VM modules flag is used only by Jest.
- No material conflict among product/domain requirements. The broader detail screen
  (evolutions, moves, flavor text) is M1. M0 displays fields from one Pokémon endpoint.

## Acceptance evidence

See `docs/M0_VALIDATION.md` for commands, observed results, and outstanding gates.
Remote CI success is a separate gate from local verification.
