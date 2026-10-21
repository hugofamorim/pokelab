# Public API — M0

Development origin: `http://localhost:3001`. OpenAPI UI: `/docs`, JSON: `/docs-json`.
Only `GET /v1/pokemon/:idOrName` is implemented. It is public and read-only.

The identifier is trimmed and lowercased: positive integer IDs up to six digits or
lowercase hyphen-separated names, maximum 64 characters. Invalid paths and arbitrary
URLs are rejected before network access. No caller-controlled upstream origin or redirect.

Response schema is generated from `packages/contracts` into OpenAPI. Example shape:

```ts
{
  data: {
    id: number; name: string;
    species: { id: number; name: string };
    isDefault: boolean; artwork: string | null;
    types: PokemonType[];
    heightMeters: number; weightKg: number;
    stats: { name: StatName; value: number }[];
    abilities: { name: string; hidden: boolean }[];
  };
  meta: { source: 'pokeapi-v2'; fetchedAt: string; stale: boolean };
}
```

Pokémon IDs identify entries/forms, not necessarily species. The species ID is parsed
from a validated species resource reference, which is never fetched as an arbitrary URL.
All six unique base stats and one or two unique supported types are required.
Artwork is nullable and allowlisted to PokéAPI's sprite repository. Missing optional
artwork and an empty ability list remain explicit; data is never invented.

Errors: `{ code, message, requestId }`, with sanitized Portuguese messages and no
stack trace. Statuses: 400 invalid identifier, 404 absent Pokémon, 502 incompatible
upstream payload, 503 unavailable upstream/admission limit. Unexpected internal
failures are sanitized to 500. Errors are not persisted as successful cache entries.

## Cache and request policy

- PostgreSQL stores normalized validated public DTOs with source/schema version in
  the key, `fetchedAt`, and `expiresAt`. Reads revalidate payloads.
- Default TTL 24 hours; configurable between 60 seconds and 7 days.
- Same canonical identifier shares in-flight work per API instance. Four distinct
  requests can be active; excess requests receive a bounded 503 instead of queuing.
- Each upstream attempt has a 5-second default timeout (100–15000 ms configurable).
  Transient failures retry once after a 150–249 ms jittered delay. No 404/schema retries.
- If upstream fails transiently or with a schema mismatch, validated expired public
  data can be returned with `stale: true` and its original `fetchedAt`.
- No transient failure caching, bulk scraping, startup prefetch, or Redis. Numeric
  and named aliases have separate cache keys. Cache rows currently need an operational
  retention policy before public deployment; stale responses have no age cutoff yet.
- Database connection timeout 2 seconds, pool max 4. Cache writes log only a generic
  failure and do not discard a valid upstream response. Reads depend on PostgreSQL.
- Per-instance admission limits are not distributed rate limiting. That and HTTP
  edge controls are deployment work, not evidence of load-tested production readiness.

Upstream documentation and fair-use policy: [PokéAPI v2](https://pokeapi.co/docs/v2).
