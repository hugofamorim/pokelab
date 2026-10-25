import { generationCardQuerySchema } from '../../../../lib/generation-catalog';
import { getGenerationCards } from '../../../../lib/generation-catalog-server';

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const input = Object.fromEntries(params);
  if (
    [...params.keys()].some((key) => params.getAll(key).length !== 1) ||
    !generationCardQuerySchema.safeParse(input).success
  )
    return Response.json(
      { code: 'INVALID_GENERATION_CARDS_QUERY' },
      { status: 400, headers: { 'Cache-Control': 'no-store' } },
    );
  const result = await getGenerationCards(input, request.signal);
  return Response.json(result ?? { code: 'GENERATION_CARDS_UNAVAILABLE' }, {
    status: result ? 200 : 503,
    headers: { 'Cache-Control': 'no-store' },
  });
}
