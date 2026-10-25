'use client';
import { useTransition } from 'react';
import { useRouter } from 'next/navigation';
export function RouteRetry({
  label,
  pendingLabel,
}: {
  label: string;
  pendingLabel: string;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  return (
    <button
      type="button"
      className="button button-secondary"
      disabled={pending}
      onClick={() => startTransition(() => router.refresh())}
    >
      {pending ? pendingLabel : label}
    </button>
  );
}
