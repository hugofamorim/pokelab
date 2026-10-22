'use client';
import { useEffect, useId, useRef, useState, useTransition } from 'react';
import type { FormEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Search, X } from 'lucide-react';
import { normalizeSearch, searchHref } from '../lib/catalog-search';

const validationMessage =
  'Use o nome completo ou um ID de 1 a 999999, com até 64 caracteres.';
export function CatalogSearchField() {
  const searchParams = useSearchParams();
  const initialValue = (searchParams.get('search') ?? '').slice(0, 64);
  return <SearchField key={initialValue} initialValue={initialValue} />;
}
export function SearchFieldFallback() {
  return (
    <form
      className="catalog-search"
      role="search"
      aria-label="Busca de Pokémon"
      action="/pokedex"
      method="get"
    >
      <label htmlFor="search-fallback">Qual Pokémon você quer conhecer?</label>
      <div className="search-controls">
        <div className="search-input-wrap">
          <input
            id="search-fallback"
            type="search"
            name="search"
            maxLength={64}
            placeholder="Nome completo ou ID"
          />
        </div>
        <button className="button button-primary" type="submit">
          Buscar Pokémon
        </button>
      </div>
      <p>Nome completo ou ID. Exemplos: pikachu, mr-mime ou 25.</p>
    </form>
  );
}
export function SearchField({ initialValue = '' }: { initialValue?: string }) {
  const fieldId = useId();
  const helpId = `${fieldId}-help`;
  const errorId = `${fieldId}-error`;
  const inputRef = useRef<HTMLInputElement>(null);
  const hasActivated = useRef(false);
  const validationTimer = useRef<ReturnType<typeof setTimeout> | undefined>(
    undefined,
  );
  const [error, setError] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();
  const router = useRouter();
  useEffect(() => {
    // Both React Activity and the browser back/forward cache can restore a draft.
    // The committed URL remains the source of truth when that screen becomes active.
    const restore = () => {
      const committed = (
        new URL(window.location.href).searchParams.get('search') ?? ''
      ).slice(0, 64);
      if (inputRef.current) inputRef.current.value = committed;
      clearTimeout(validationTimer.current);
      validationTimer.current = setTimeout(
        () =>
          setError(
            normalizeSearch(committed) === null ? validationMessage : null,
          ),
        300,
      );
    };
    if (hasActivated.current) restore();
    else {
      hasActivated.current = true;
      // A user can type before passive effects run. Initial activation validates
      // that draft without replacing it with the URL's default value.
      const draft = inputRef.current?.value ?? '';
      clearTimeout(validationTimer.current);
      validationTimer.current = setTimeout(
        () =>
          setError(normalizeSearch(draft) === null ? validationMessage : null),
        300,
      );
    }
    const onPageShow = (event: PageTransitionEvent) => {
      if (event.persisted) restore();
    };
    window.addEventListener('pageshow', onPageShow);
    window.addEventListener('popstate', restore);
    return () => {
      window.removeEventListener('pageshow', onPageShow);
      window.removeEventListener('popstate', restore);
      clearTimeout(validationTimer.current);
    };
  }, []);
  function validateDraft(value: string) {
    clearTimeout(validationTimer.current);
    validationTimer.current = setTimeout(
      () =>
        setError(normalizeSearch(value) === null ? validationMessage : null),
      300,
    );
  }
  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const term = normalizeSearch(inputRef.current?.value ?? '');
    if (term === null) {
      setError(validationMessage);
      return;
    }
    startTransition(() => router.push(term ? searchHref(term) : '/pokedex'));
  }
  function clear() {
    if (inputRef.current) inputRef.current.value = '';
    clearTimeout(validationTimer.current);
    setError(null);
    startTransition(() => router.push('/pokedex'));
  }
  return (
    <form
      className="catalog-search"
      role="search"
      aria-label="Busca de Pokémon"
      action="/pokedex"
      method="get"
      onSubmit={submit}
    >
      <label htmlFor={fieldId}>Qual Pokémon você quer conhecer?</label>
      <div className="search-controls">
        <div className="search-input-wrap">
          <Search size={20} aria-hidden="true" />
          <input
            id={fieldId}
            type="search"
            name="search"
            ref={inputRef}
            defaultValue={initialValue}
            maxLength={64}
            autoComplete="off"
            spellCheck={false}
            placeholder="Nome completo ou ID"
            aria-describedby={`${helpId}${error ? ` ${errorId}` : ''}`}
            aria-invalid={error ? true : undefined}
            onChange={(event) => validateDraft(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Escape') {
                event.preventDefault();
                clear();
              }
            }}
          />
          <button
            type="button"
            className="search-clear"
            aria-label="Limpar busca"
            onClick={clear}
          >
            <X size={18} aria-hidden="true" />
          </button>
        </div>
        <button
          className="button button-primary"
          type="submit"
          disabled={pending}
        >
          {pending ? 'Buscando…' : 'Buscar Pokémon'}
        </button>
      </div>
      <p id={helpId}>Nome completo ou ID. Exemplos: pikachu, mr-mime ou 25.</p>
      {error && (
        <p id={errorId} className="search-error" role="alert">
          {error}
        </p>
      )}
      <span className="sr-only" role="status">
        {pending ? 'Consultando o Pokémon…' : ''}
      </span>
    </form>
  );
}
