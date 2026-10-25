import { GENERATION_NAMES } from '@pokelab/contracts';
import { getGenerationPage } from '../lib/generation-catalog-server';
import { GenerationGrid } from './generation-grid';
import { CatalogPagination } from './catalog-pagination';
import { CatalogState } from './catalog-state';

export async function GenerationBrowse({
  page,
  generation,
}: {
  page: number;
  generation: number;
}) {
  const result = await getGenerationPage(page, generation);
  if (!result)
    return <CatalogState kind="error" page={page} generation={generation} />;
  if (!result.items.length)
    return <CatalogState kind="empty" page={page} generation={generation} />;
  const label = GENERATION_NAMES[generation - 1]!.replace(
    'generation-',
    '',
  ).toUpperCase();
  const start = (page - 1) * result.pageSize + 1;
  return (
    <>
      {result.meta.stale && (
        <p className="stale-notice" role="status">
          Índice de espécies salvo em{' '}
          <time dateTime={result.meta.fetchedAt}>
            {new Date(result.meta.fetchedAt).toLocaleDateString('pt-BR', {
              timeZone: 'America/Sao_Paulo',
            })}
          </time>
          . A fonte está indisponível no momento.
        </p>
      )}
      <div className="catalog-toolbar">
        <h2>Espécies da geração {label}</h2>
        <span>
          {start}–{start + result.items.length - 1} de{' '}
          {result.total.toLocaleString('pt-BR')}{' '}
          {result.total === 1 ? 'espécie' : 'espécies'}
        </span>
      </div>
      <p className="generation-description">
        Espécies introduzidas nesta geração, exibidas em sua variedade padrão
        atual. Não representa disponibilidade em jogos ou tipos históricos.
      </p>
      <GenerationGrid
        key={`${generation}:${page}`}
        references={result.items}
        page={page}
        generation={generation}
      />
      <CatalogPagination
        page={page}
        hasNext={result.hasNext}
        generation={generation}
      />
    </>
  );
}
