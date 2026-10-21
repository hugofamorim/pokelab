import Image from 'next/image';
import Link from 'next/link';
import type { ReactNode } from 'react';
import { BookOpen, FlaskConical, ArrowUpRight, Sparkles } from 'lucide-react';
export function AppShell({ children }: { children: ReactNode }) {
  return (
    <div className="app-shell">
      <a className="skip-link" href="#main">
        Pular para o conteúdo
      </a>
      <aside className="sidebar">
        <Link href="/" className="brand" aria-label="PokéLab — início">
          <Image
            src="/assets/brand/pokelab-logo.png"
            width={200}
            height={67}
            alt="PokéLab"
            priority
          />
          <span>TRAINER STUDIO</span>
        </Link>
        <div className="nav-label">SEU LABORATÓRIO</div>
        <nav aria-label="Navegação principal">
          <Link
            href="/pokedex"
            prefetch={false}
            className="nav-item active"
            aria-current="page"
          >
            <BookOpen size={21} />
            Explorar Pokémon
            <span className="nav-dot" />
          </Link>
          <a className="nav-item" href="#sobre">
            <FlaskConical size={21} />
            Sobre o projeto
            <ArrowUpRight size={16} />
          </a>
        </nav>
        <div className="sidebar-note">
          <span className="note-icon">
            <Sparkles size={22} />
          </span>
          <strong>
            Grandes estratégias
            <br />
            começam com curiosidade.
          </strong>
          <p>
            Conheça os Pokémon.
            <br />
            Explore cada detalhe.
          </p>
          <span className="small-label">FEITO PARA EXPLORAR</span>
        </div>
        <div className="sidebar-footer">
          <span className="status-dot" /> Explore · Descubra · Conheça
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <Link href="/" className="mobile-brand">
            <Image
              src="/assets/brand/pokelab-logo.png"
              width={135}
              height={45}
              alt="PokéLab"
            />
          </Link>
          <div className="desktop-breadcrumb">
            Trainer Studio <span>/</span> <strong>Explorar Pokémon</strong>
          </div>
          <span className="guest-label">
            <span className="guest-icon">
              <FlaskConical size={18} />
            </span>
            Modo visitante
          </span>
        </header>
        <main id="main" tabIndex={-1}>
          {children}
        </main>
        <footer id="sobre" className="footer">
          <div>
            <strong>PokéLab</strong> · Um laboratório de descobertas.
          </div>
          <p>
            Projeto independente e não oficial. Pokémon e suas imagens pertencem
            aos respectivos titulares. Dados:{' '}
            <a
              href="https://pokeapi.co/docs/v2"
              target="_blank"
              rel="noreferrer"
            >
              PokéAPI ↗
            </a>
            .
          </p>
        </footer>
      </div>
      <nav className="mobile-nav" aria-label="Navegação móvel">
        <Link href="/pokedex" prefetch={false} aria-current="page">
          <BookOpen size={20} />
          Explorar
        </Link>
        <a href="#sobre">
          <FlaskConical size={20} />O projeto
        </a>
      </nav>
    </div>
  );
}
