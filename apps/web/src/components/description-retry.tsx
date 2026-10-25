'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';

export function DescriptionRetry() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="button button-secondary"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? 'Atualizando descrição…' : 'Tentar descrição novamente'}
    </button>
  );
}
