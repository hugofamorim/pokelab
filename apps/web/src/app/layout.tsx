import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import '@fontsource/nunito-sans/400.css';
import '@fontsource/nunito-sans/600.css';
import '@fontsource/nunito-sans/700.css';
import '@fontsource/nunito-sans/800.css';
import './globals.css';
import { AppShell } from '../components/app-shell';
export const metadata: Metadata = {
  title: 'PokéLab — Trainer Studio',
  description:
    'Um laboratório de descobertas Pokémon. Explore tipos, atributos e habilidades com dados da PokéAPI.',
};
export default function RootLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="pt-BR">
      <body>
        <AppShell>{children}</AppShell>
      </body>
    </html>
  );
}
