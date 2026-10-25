import { Suspense } from 'react';
import { getPokemon } from '../../../lib/pokemon';
import { PokemonDetail } from '../../../components/pokemon-detail';
import { DataState, DetailSkeleton } from '../../../components/states';
import Link from 'next/link';
import { ArrowLeft } from 'lucide-react';
import { catalogReturnHref } from '../../../lib/catalog-search';
type PageProps = {
  params: Promise<{ id: string }>;
  searchParams: Promise<Record<string, string | string[] | undefined>>;
};
async function Detail({ params, searchParams }: PageProps) {
  const { id } = await params;
  const back = catalogReturnHref(await searchParams);
  const result = await getPokemon(id);
  return (
    <>
      <Link className="detail-back" href={back} prefetch={false}>
        <ArrowLeft size={16} aria-hidden="true" />
        Voltar à Pokédex
      </Link>
      {result.kind === 'ready' ? (
        <PokemonDetail {...result.value} catalogReturn={back} />
      ) : (
        <DataState kind={result.kind} identifier={id} />
      )}
    </>
  );
}
export default function Page({ params, searchParams }: PageProps) {
  return (
    <Suspense fallback={<DetailSkeleton />}>
      <Detail params={params} searchParams={searchParams} />
    </Suspense>
  );
}
