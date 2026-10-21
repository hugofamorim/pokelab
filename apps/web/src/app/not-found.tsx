import Link from 'next/link';
export default function NotFound() {
  return (
    <section className="data-state">
      <h1>Página não encontrada</h1>
      <Link href="/" className="button button-primary">
        Voltar ao laboratório
      </Link>
    </section>
  );
}
