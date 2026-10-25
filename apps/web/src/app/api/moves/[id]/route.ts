import { getMoveMetadata } from '../../../../lib/moves-server';
import { validMoveId } from '../../../../lib/moves';

export async function GET(
  request: Request,
  { params }: { params: Promise<{ id: string }> },
) {
  const { id } = await params;
  const headers = { 'Cache-Control': 'no-store' };
  if (!validMoveId(id).success || new URL(request.url).searchParams.size !== 0)
    return Response.json(
      { code: 'INVALID_MOVE_QUERY' },
      { status: 400, headers },
    );
  const result = await getMoveMetadata(id, request.signal);
  return Response.json(
    result.kind === 'ready'
      ? result.value
      : {
          code:
            result.kind === 'missing' ? 'MOVE_NOT_FOUND' : 'MOVE_UNAVAILABLE',
        },
    {
      status:
        result.kind === 'ready' ? 200 : result.kind === 'missing' ? 404 : 503,
      headers,
    },
  );
}
