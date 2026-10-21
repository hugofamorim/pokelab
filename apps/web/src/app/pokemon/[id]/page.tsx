import { Suspense } from 'react';
import { getPokemon } from '../../../lib/pokemon';
import { PokemonDetail } from '../../../components/pokemon-detail';
import { DataState, DetailSkeleton } from '../../../components/states';
async function Detail({ params }: { params: Promise<{ id: string }> }) {
  const { id } = await params;
  const result = await getPokemon(id);
  return result.kind === 'ready' ? (
    <PokemonDetail {...result.value} />
  ) : (
    <DataState kind={result.kind} identifier={id} />
  );
}
export default function Page({ params }: { params: Promise<{ id: string }> }) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Detail params={params} />
    </Suspense>
  );
}
