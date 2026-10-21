import Link from 'next/link';
import { CloudOff, SearchX } from 'lucide-react';
export function DetailSkeleton() {
  return (
    <div
      className="detail-skeleton"
      role="status"
      aria-label="Carregando Pokémon"
    >
      <div className="skeleton skeleton-title" />
      <div className="skeleton skeleton-hero" />
      <div className="skeleton-grid">
        <div className="skeleton skeleton-panel" />
        <div className="skeleton skeleton-panel" />
      </div>
      <span className="sr-only">Consultando os dados do Pokémon…</span>
    </div>
  );
}
export function DataState({
  kind,
  identifier,
}: {
  kind: 'missing' | 'error' | 'invalid';
  identifier: string;
}) {
  const missing = kind !== 'error';
  return (
    <section className="data-state" role="status">
      {missing ? <SearchX size={44} /> : <CloudOff size={44} />}
      <span className="eyebrow">
        {missing ? 'NADA POR AQUI' : 'PAUSA NO LABORATÓRIO'}
      </span>
      <h1>
        {missing
          ? 'Pokémon não encontrado'
          : 'Não conseguimos carregar os dados'}
      </h1>
      <p>
        {missing
          ? 'Esse identificador não está disponível. Continue explorando com o Pikachu.'
          : 'A conexão com o serviço está indisponível. Aguarde um pouco e tente novamente.'}
      </p>
      {!missing && (
        <a
          className="button button-primary"
          href={`/pokemon/${encodeURIComponent(identifier)}`}
        >
          Tentar novamente
        </a>
      )}
      <Link
        className={`button button-${missing ? 'primary' : 'secondary'}`}
        href="/pokemon/25"
      >
        Conhecer o Pikachu
      </Link>
    </section>
  );
}
