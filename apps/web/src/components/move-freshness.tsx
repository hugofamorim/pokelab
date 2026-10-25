import type { SourceMetadata } from '@pokelab/contracts';
export function MoveFreshness({
  label,
  meta,
}: {
  label: string;
  meta: SourceMetadata;
}) {
  return (
    <p className={meta.stale ? 'stale-notice' : 'footnote'}>
      {label} · {meta.stale ? 'dados salvos' : 'consulta'} em{' '}
      <time dateTime={meta.fetchedAt}>
        {new Date(meta.fetchedAt).toLocaleString('pt-BR', {
          timeZone: 'America/Sao_Paulo',
        })}
      </time>
      .{meta.stale && ' A fonte está indisponível no momento.'}
    </p>
  );
}
