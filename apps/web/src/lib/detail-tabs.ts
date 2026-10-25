export const DETAIL_TABS = [
  { id: 'atributos', label: 'Atributos' },
  { id: 'habilidades', label: 'Habilidades' },
  { id: 'dados', label: 'Dados do Pokémon' },
  { id: 'sobre-especie', label: 'Sobre a espécie' },
  { id: 'evolucoes', label: 'Evoluções' },
  { id: 'movimentos', label: 'Movimentos' },
] as const;
export type DetailTab = (typeof DETAIL_TABS)[number]['id'];
export function detailTabFromHash(hash: string): DetailTab {
  const id = hash.slice(1);
  return DETAIL_TABS.find((tab) => tab.id === id)?.id ?? 'atributos';
}
