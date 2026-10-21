import { pokemonSummaryQuerySchema } from '@pokelab/contracts';
import { getSummaryBatch } from '../../../../lib/catalog-server';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const input = Object.fromEntries(params);
  if (
    [...params.keys()].some((key) => params.getAll(key).length !== 1) ||
    !pokemonSummaryQuerySchema.safeParse(input).success
  )
    return Response.json({ code: 'INVALID_SUMMARY_QUERY' }, { status: 400 });
  const result = await getSummaryBatch(input, request.signal);
  return Response.json(result ?? { code: 'CATALOG_UNAVAILABLE' }, {
    status: result ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
