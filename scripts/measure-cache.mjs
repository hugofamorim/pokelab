// Explicit local measurement, never part of offline CI and never an index drain.
import { performance } from 'node:perf_hooks';
import {
  pokemonResponseSchema,
  pokemonPageResponseSchema,
  combinedFilterResponseSchema,
} from '../packages/contracts/dist/index.js';

const base = 'http://127.0.0.1:3001';
const samples = 20;
const endpoints = [
  { path: '/v1/pokemon/25', schema: pokemonResponseSchema, timeout: 15000 },
  {
    path: '/v1/pokemon?page=1&pageSize=12',
    schema: pokemonPageResponseSchema,
    timeout: 15000,
  },
  {
    path: '/v1/pokemon/filter-scan?type=electric&generation=1&limit=4',
    schema: combinedFilterResponseSchema,
    timeout: 125000,
  },
];
const rows = [];
for (const endpoint of endpoints) {
  async function request() {
    const start = performance.now();
    const response = await globalThis.fetch(base + endpoint.path, {
      signal: globalThis.AbortSignal.timeout(endpoint.timeout),
    });
    if (!response.ok)
      throw new Error(`Measurement failed: HTTP ${response.status}`);
    const body = await response.json();
    const elapsedMs = performance.now() - start;
    const value = endpoint.schema.parse(body);
    if (
      'items' in value &&
      value.items.some(
        (item) => 'status' in item && item.status === 'unavailable',
      )
    )
      throw new Error(
        'Unavailable candidates cannot establish a ready-cache measurement',
      );
    const metadata =
      'type' in value.meta
        ? [
            value.meta.type,
            value.meta.generation,
            ...value.items
              .filter((item) => 'meta' in item)
              .map((item) => item.meta),
          ]
        : [value.meta];
    if (metadata.some((meta) => meta.stale))
      throw new Error('Fresh cached sources required for this measurement');
    return { elapsedMs, snapshot: JSON.stringify(metadata) };
  }
  const warm = await request();
  const times = [];
  for (let index = 0; index < samples; index++) {
    const result = await request();
    if (result.snapshot !== warm.snapshot)
      throw new Error(
        'Source metadata changed during the measurement; rerun on a stable warm cache',
      );
    times.push(result.elapsedMs);
  }
  const ordered = times.toSorted((a, b) => a - b);
  const p95 = ordered[Math.ceil(samples * 0.95) - 1];
  rows.push({
    path: endpoint.path,
    samples,
    warmupExcluded: true,
    sourceMetadataStable: true,
    p50Ms: Number(ordered[Math.ceil(samples * 0.5) - 1].toFixed(2)),
    p95Ms: Number(p95.toFixed(2)),
    maxMs: Number(ordered.at(-1).toFixed(2)),
    under500ms: p95 <= 500,
  });
}
console.log(
  JSON.stringify(
    {
      at: new Date().toISOString(),
      node: process.version,
      platform: process.platform,
      base,
      concurrency: 1,
      method:
        'HTTP response body and JSON parsing; schema validation excluded; one warm-up per route',
      results: rows,
    },
    null,
    2,
  ),
);
if (rows.some((row) => !row.under500ms)) process.exitCode = 1;
