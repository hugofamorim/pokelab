'use client';
import { useId, useSyncExternalStore } from 'react';
import type { ReactNode, KeyboardEvent, MouseEvent } from 'react';
import {
  Activity,
  Sparkles,
  Database,
  BookOpen,
  GitBranch,
  Zap,
} from 'lucide-react';
import { DETAIL_TABS, detailTabFromHash } from '../lib/detail-tabs';
import type { DetailTab } from '../lib/detail-tabs';

const icons = {
  atributos: Activity,
  habilidades: Sparkles,
  dados: Database,
  'sobre-especie': BookOpen,
  evolucoes: GitBranch,
  movimentos: Zap,
};
function subscribe(listener: () => void) {
  window.addEventListener('hashchange', listener);
  window.addEventListener('popstate', listener);
  return () => {
    window.removeEventListener('hashchange', listener);
    window.removeEventListener('popstate', listener);
  };
}
const snapshot = () => detailTabFromHash(window.location.hash);
const serverSnapshot = (): DetailTab | null => null;
export function DetailTabs({
  panels,
}: {
  panels: Record<DetailTab, ReactNode>;
}) {
  const scope = useId();
  const active = useSyncExternalStore(subscribe, snapshot, serverSnapshot);
  function activate(event: MouseEvent<HTMLAnchorElement>, id: DetailTab) {
    if (
      event.button !== 0 ||
      event.metaKey ||
      event.ctrlKey ||
      event.shiftKey ||
      event.altKey
    )
      return;
    event.preventDefault();
    if (window.location.hash !== `#${id}`) {
      window.history.pushState(window.history.state, '', `#${id}`);
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    }
  }
  function navigate(event: KeyboardEvent<HTMLAnchorElement>, index: number) {
    if (event.key === ' ' || event.key === 'Enter') {
      event.preventDefault();
      event.currentTarget.click();
      return;
    }
    const next =
      event.key === 'Home'
        ? 0
        : event.key === 'End'
          ? DETAIL_TABS.length - 1
          : event.key === 'ArrowRight'
            ? (index + 1) % DETAIL_TABS.length
            : event.key === 'ArrowLeft'
              ? (index + DETAIL_TABS.length - 1) % DETAIL_TABS.length
              : null;
    if (next === null) return;
    event.preventDefault();
    const target =
      event.currentTarget.parentElement?.querySelectorAll<HTMLAnchorElement>(
        '[role="tab"]',
      )[next];
    target?.focus();
    target?.click();
  }
  return (
    <div className="detail-tabs" data-active-tab={active ?? undefined}>
      <div
        className="section-nav"
        role="tablist"
        aria-label="Informações do Pokémon"
      >
        {DETAIL_TABS.map((tab, index) => {
          const Icon = icons[tab.id];
          return (
            <a
              key={tab.id}
              href={`#${tab.id}`}
              role="tab"
              id={`${scope}-tab-${tab.id}`}
              aria-controls={`${scope}-panel-${tab.id}`}
              aria-selected={active === tab.id}
              tabIndex={active === null || active === tab.id ? 0 : -1}
              onClick={(event) => activate(event, tab.id)}
              onKeyDown={(event) => navigate(event, index)}
            >
              <Icon size={17} aria-hidden="true" />
              {tab.label}
            </a>
          );
        })}
      </div>
      {DETAIL_TABS.map((tab) => (
        <div
          key={tab.id}
          className="detail-tab-panel"
          data-tab={tab.id}
          data-visible={active === tab.id ? 'true' : undefined}
          role="tabpanel"
          id={`${scope}-panel-${tab.id}`}
          aria-labelledby={`${scope}-tab-${tab.id}`}
          tabIndex={0}
        >
          {panels[tab.id]}
        </div>
      ))}
    </div>
  );
}
