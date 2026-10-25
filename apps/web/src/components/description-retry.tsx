import { RouteRetry } from './route-retry';

export function DescriptionRetry() {
  return (
    <RouteRetry
      label="Tentar descrição novamente"
      pendingLabel="Atualizando descrição…"
    />
  );
}
