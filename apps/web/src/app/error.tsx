'use client';
import { Button } from '../components/button';
export default function ErrorPage({ reset }: { reset: () => void }) {
  return (
    <section className="data-state" role="alert">
      <h1>O laboratório encontrou um imprevisto.</h1>
      <p>Tente carregar a página novamente.</p>
      <Button onClick={reset}>Tentar novamente</Button>
    </section>
  );
}
