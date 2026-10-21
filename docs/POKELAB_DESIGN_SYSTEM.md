# PokéLab — Guia de Estilo & Design System

**Versão:** 1.0 · **Status:** especificação de implementação · **Público:** Codex e equipe de frontend · **Idioma da interface:** português brasileiro (i18n-ready)

> Fonte visual: mockups mobile e desktop aprovados nesta conversa. As imagens são **referências de aparência**, não especificações exatas de dados ou regras de negócio. Este guia complementa `PRODUCT.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `AGENTS.md` e `docs/DOMAIN_RULES.md`; regras de domínio e API desses documentos prevalecem sobre textos ilustrativos presentes nos mockups.

## 1. Conceito e princípios

**PokéLab = laboratório lúdico de estratégias.** Deve parecer um produto digital de alta qualidade: alegre e colecionável sem sacrificar legibilidade, clareza de dados ou uso em desktop. Linguagem: amarelo pastel + branco-creme + navy; cantos generosamente arredondados; elementos decorativos circulares; criaturas como protagonistas visuais; sombras suaves; microinterações sutis.

1. **Conteúdo primeiro:** personagens são destaques, mas estatísticas e controles permanecem legíveis.
2. **Cores semânticas:** cores por tipo reforçam o significado; nunca depender somente de cor para comunicar estado.
3. **Desktop é workspace, mobile é fluxo:** não ampliar mecanicamente a tela de celular.
4. **Progressive disclosure:** visão rápida em cards, detalhes em páginas, explicação dos cálculos no analisador.
5. **Produto real, não mockup estático:** estados vazios, falhas, skeletons, loading, teclado e acessibilidade são obrigatórios.
6. **Sem features fictícias:** não exibir moedas, níveis, inventário, conquistas, pontuação 78/100, rankings ou notas por estrelas a menos que tenham sido implementados e explicados no produto. Não atribuir raridade arbitrária nem efetividade inventada.

## 2. Design tokens

### 2.1 Cores fundamentais

Valores propostos a partir das referências (aproximações de projeto, **não extração colorimétrica**):

| Token | Hex | Uso |
|---|---|---|
| `--pl-canvas` | `#FFF5BA` | Fundo externo amarelo-creme |
| `--pl-canvas-accent` | `#FFE66D` | Faixas e halos decorativos |
| `--pl-brand` | `#FFD43B` | Botão principal, seleção, destaques |
| `--pl-brand-hover` | `#F5BF22` | Hover do primário |
| `--pl-brand-deep` | `#F5A623` | Detalhes quentes e ilustração |
| `--pl-surface` | `#FFFFFF` | Cards e painéis |
| `--pl-surface-warm` | `#FFFDF3` | Shell e superfícies suaves |
| `--pl-surface-muted` | `#F6F7FA` | Inputs, controles secundários |
| `--pl-ink` | `#111B39` | Títulos e informação principal |
| `--pl-body` | `#46516A` | Texto comum |
| `--pl-muted` | `#778198` | Metadados e placeholders |
| `--pl-border` | `#E9EAF0` | Linhas e contornos |
| `--pl-success` | `#218A59` | Sucesso, operacional |
| `--pl-warning` | `#B9700A` | Atenção |
| `--pl-danger` | `#D54446` | Erro/remoção |
| `--pl-focus` | `#315FBE` | Foco visível |

**Observação:** amarelo da marca serve para acentos e botões, **não** para parágrafos longos em branco. Use `--pl-ink` em botões amarelos. Estados e contrastes precisam passar WCAG AA nas combinações reais.

### 2.2 Cores dos 18 tipos

Usar nos badges e halos com variantes `foreground` (texto), `soft` (fundo leve) e `solid` (marcadores fortes). Os valores abaixo são **tokens visuais**, não propriedades da PokéAPI.

| Tipo | `solid` | `soft` |
|---|---|---|
| Normal | `#8E969F` | `#F0F1F3` |
| Fire | `#F16B3A` | `#FFF0E8` |
| Water | `#3195E9` | `#E8F5FF` |
| Electric | `#E6A500` | `#FFF5CD` |
| Grass | `#35A85D` | `#E6F8E9` |
| Ice | `#29AEBE` | `#E6FAFC` |
| Fighting | `#C7534E` | `#FCEAE8` |
| Poison | `#9655CD` | `#F2E9FD` |
| Ground | `#B88049` | `#F8EDDF` |
| Flying | `#7589D7` | `#EEF0FF` |
| Psychic | `#EE638A` | `#FFEBF2` |
| Bug | `#80A43B` | `#F2F7E5` |
| Rock | `#AA8747` | `#F6F0E4` |
| Ghost | `#7959AE` | `#F0EAFA` |
| Dragon | `#695BD9` | `#EEECFF` |
| Dark | `#55586A` | `#ECEEF2` |
| Steel | `#728D9F` | `#EAF1F5` |
| Fairy | `#D87DB2` | `#FCEAF6` |

**Badges:** por padrão fundo `soft`, texto colorido escuro validado com contraste; alternativa sólido com texto branco/ink somente quando contraste cumprir AA. Badges sempre incluem texto, ícone opcional. Tipos duplos exibem **ambos**.

### 2.3 Fonte e hierarquia

- Preferir `Nunito Sans` (Google Fonts/next/font, pesos 400–800) pela suavidade e legibilidade; fallback `system-ui, sans-serif`. Alternativa `Plus Jakarta Sans` para corpo caso a análise visual evidencie melhor leitura; não misturar mais de duas famílias.
- `display`: 48/56, 800 (desktop hero); mobile 34/40.
- `h1`: 32/40 desktop, 26/34 mobile, 800.
- `h2`: 24/32 desktop, 22/28 mobile, 800.
- `h3`: 18/26, 700–800.
- `body`: 16/24, 400–600; `small`: 14/20; `caption`: 12/18.
- Números de estatísticas em fonte tabular (`font-variant-numeric: tabular-nums`). Textos nunca devem ser convertidos em imagens.

### 2.4 Grid, raio, elevação e movimento

- Escala de espaçamento: múltiplos de 4px; preferências `4, 8, 12, 16, 20, 24, 32, 40, 48`.
- Raio: `sm=10px`, `md=16px`, `lg=22px`, `xl=28px`, `2xl=36px`, `pill=9999px`.
- Sombra: `card: 0 8px 28px rgba(17,27,57,.06)`, `hover: 0 12px 32px rgba(17,27,57,.10)`.
- Contornos em `#E9EAF0` 1px; um card pode usar sombra pequena + borda discreta, não ambas fortes.
- Animações: 120–180ms para hover/foco, 180–260ms para transições de painel. Respeitar `prefers-reduced-motion`; evitar parallax intenso.
- Tamanho mínimo de alvo interativo: 44×44px no mobile. Ícones usuais 20–24px; decorativos maiores por necessidade, nunca para substituir rótulos essenciais.

## 3. Layouts responsivos

### 3.1 Breakpoints e shell

- Mobile `<640px`: cabeçalho compacto, conteúdo vertical, cards em 1 coluna, filtros em scroll horizontal, nav inferior somente se realmente usada no produto.
- Tablet `640–1023px`: catálogo em 2 colunas; sidebar colapsável/drawer; analisador empilha cards.
- Desktop `>=1024px`: **sidebar fixa** 236–260px, topbar com pesquisa e perfil, canvas claro, conteúdo com `max-width: 1440px` e gutters 24–40px.
- Wide `>=1440px`: catálogo de 3–4 colunas conforme card `min-width: 240px`; Team Builder à esquerda (~60%) + análise à direita (~40%). Evitar textos espremidos.
- Shell desktop: fundo externo amarelo suave e superfície de trabalho predominantemente branca; o amarelo NÃO deve consumir todo o espaço de conteúdo.

### 3.2 Home/Pokédex

**Desktop**: sidebar esquerda com logo, navegação primária (Pokédex, Minhas Equipes, Analisador; extras só se implementados), topbar (busca global, perfil), chips horizontais de tipo, `FeaturedPokemon` hero (texto + imagem grande + resumo verídico), grade `PokemonCard` abaixo. A arte do Pokémon pode transbordar sutilmente sobre o halo de tipo, nunca sobre controles.

**Mobile**: logo e avatar no topo, busca em largura total, filtro em chips horizontais, cards de largura total com texto à esquerda e imagem à direita; navegação compacta inferior. Rolagem contínua com paginação/“carregar mais” acessível; não carregar catálogo completo.

### 3.3 Detalhe de Pokémon

**Desktop**: hero horizontal com imagem grande e detalhes; abas `Atributos / Evoluções / Movimentos / Confrontos / Sobre`, cards de atributos e habilidades em duas colunas; cadeia evolutiva em linha. Navegação teclado e URL refletindo aba quando fizer sentido.

**Mobile**: hero compacto com imagem dominante, abas roláveis, gráficos empilhados, evolução horizontal rolável com rótulos acessíveis.

### 3.4 Team Builder e Analyzer

**Desktop**: workspace em duas colunas, equipe em grade 2×3 (6 slots no total), painel de análise na direita com resumo, matriz de cobertura, fraquezas, resistências e recomendações explicadas. Slots vazios não devem aparecer como 7ª posição. Ações de adicionar, substituir, reordenar e remover devem ser claras; reordenação também disponível por teclado/botões.

**Mobile**: edição em cartões 2 colunas apenas se caberem com leitura adequada (em aparelhos pequenos, 1 coluna ou cartões condensados), botão fixo discreto para analisar, resultados em página/aba após a edição.

**Sem gráficos enganosos:** notas `85/100`, “Offense 82/100” e mensagens como “Great Team” vistas no mockup são **ilustrativas**. Não usar até existir fórmula documentada, validada e testada. O MVP exibe métricas determinísticas: número de fraquezas 2×/4×, imunidades, resistências e cobertura por tipo; explicar regraset/geração.

## 4. Biblioteca de componentes

| Componente | Variantes / comportamento | Regras |
|---|---|---|
| `AppShell` | desktop-sidebar / mobile-nav | Sem reflow abrupto; landmarks `nav`, `main` |
| `BrandLogo` | full / compact | Sempre manter proporção; fallback textual |
| `PageHeader` | heading, descrição, ações | Hierarquia h1 única por tela |
| `SearchField` | idle, focused, loading, error | Debounce 250–350ms, label acessível, Esc limpa |
| `TypeBadge` | soft / solid, tamanho sm/md | Texto e contraste obrigatório |
| `TypeFilter` | horizontal/overflow | Multi-seleção só se API suportar lógica explícita |
| `PokemonCard` | grid / list / featured | Número real, nome, tipos e arte com fallback |
| `PokemonArtwork` | hero / card / thumbnail | `object-contain`, proporção estável, fallback |
| `StatBar` | nome, valor, máximo de visualização | Normalização explicitada, `aria-label` com valor |
| `EvolutionChain` | horizontal / wrapped | Ramos de evolução quando presentes; não inventar linearidade |
| `TeamSlot` | empty / filled / pending | Máximo de seis; adicionar/remover/substituir |
| `TeamAnalysisPanel` | loading / ready / incomplete | Exibir cálculos reais e regraset |
| `CoverageMatrix` | por tipo atacante | Mostrar 0×, ¼×, ½×, 1×, 2×, 4× quando aplicável |
| `RecommendationCard` | suggestion / no-change | Explicação verificável, sem “IA” fictícia |
| `Button` | primary / secondary / ghost / danger | Focus visível, loading, disabled |
| `Dialog/Drawer` | seleção de Pokémon | Foco preso, fechar com Esc, rótulos |
| `EmptyState` | sem favoritos / equipe vazia | CTA contextual real |
| `Skeleton / ErrorState` | catálogo, detalhe, time | Retry; nunca spinner eterno |
| `Toast` | success / warning / error | Não substituir mensagens inline de formulário |

### Regras visuais de cards

- `PokemonCard` usa surface branco, `radius-xl`, halo `soft` correspondente ao **primeiro tipo** apenas como decoração; chips exibem todos os tipos; shadow discreta.
- A arte ocupa aproximadamente 35–48% do card no desktop, até 45% em mobile horizontal; `object-fit: contain`, sem cortar cabeça/cauda.
- Não mostrar ratings em estrelas, “special/legendary” ou preços/moedas sem dado e definição funcional.
- Se imagem não existir: silhouette/símbolo neutro estilizado e nome; sem quebrar layout.
- `TeamSlot` prioriza nome, sprite, tipos e comandos. Moves só quando usuário selecioná-los e modelo suportar.

## 5. Assets: política, nomes e integração

Os assets existentes foram separados neste contexto em `pokelab-assets-separated.zip`. Espera-se a instalação em `apps/web/public/assets/`:

```text
public/assets/
├── brand/pokelab-logo.png
├── avatars/trainer-male.png
├── avatars/trainer-female.png
├── icons/icon-home.png
├── icons/icon-pokedex.png
├── icons/icon-team.png
├── icons/icon-explore.png
├── icons/icon-favorites.png
├── icons/icon-compare.png
├── icons/icon-settings.png
├── icons/icon-search.png
├── icons/icon-filter.png
└── ...demais icon-*.png
```

- Os assets da prancha foram recortados automaticamente e **precisam inspeção visual em 1×, 2× e sobre fundos claro/amarelo**. Podem conter halos/artefatos; não prometer vetorização ou recorte perfeito.
- A versão posterior do sino amarelo **sem bolinha vermelha** substitui `icons/icon-notifications.png` quando exportada/copiada corretamente. Estado unread deve ser indicador HTML/CSS separado, não embutido na imagem.
- **Fundos por tipo NÃO precisam ser PNGs:** implementar halos com CSS radial-gradients e SVG original reutilizável, usando tokens de tipo. Isso evita 18 arquivos pesados e escala perfeitamente.
- Use `next/image` com dimensões/aspect ratio e `alt` apropriado. Ícones meramente decorativos recebem `alt=""`/`aria-hidden`; botões possuem nome acessível.
- Ícones funcionais simples podem usar Lucide consistente; use os ícones ilustrados 3D apenas em pontos de destaque, evitando misturar dezenas de estilos/pesos visuais no menu.
- Assets oficiais de Pokémon consultados via PokéAPI devem respeitar atribuições/condições aplicáveis e não ser incluídos no código como se fossem criações próprias. **Não gerar ou hospedar imagens de terceiros sem conferir direitos de uso.**
- Como uma logo anterior foi gerada com frasco de laboratório em vez de esfera oficial, priorizar essa versão original e manter o título PokéLab distinto de marcas oficiais.

### Halo de tipo (sem personagens)

Estrutura sugerida: `.pokemon-halo { position: absolute; width: 72%; aspect-ratio: 1; border-radius: 50%; background: radial-gradient(circle at 35% 30%, white 0, var(--type-soft) 55%, transparent 75%); }` com círculos menores/linhas suaves opcionais. Em UI real o personagem e o halo são camadas independentes. Preferir `prefers-reduced-motion`.

## 6. Tokens de código inicial (Tailwind/CSS)

Proposta compatível com Tailwind CSS moderno; adaptar à configuração real do repositório sem trocar versões só para seguir este snippet:

```css
:root {
  --pl-canvas: #fff5ba;
  --pl-brand: #ffd43b;
  --pl-brand-hover: #f5bf22;
  --pl-ink: #111b39;
  --pl-body: #46516a;
  --pl-muted: #778198;
  --pl-surface: #ffffff;
  --pl-surface-warm: #fffdf3;
  --pl-border: #e9eaf0;
  --pl-focus: #315fbe;
  --pl-radius-card: 22px;
  --pl-shadow-card: 0 8px 28px rgb(17 27 57 / 6%);
}

.pokemon-card {
  background: var(--pl-surface);
  border: 1px solid var(--pl-border);
  border-radius: var(--pl-radius-card);
  box-shadow: var(--pl-shadow-card);
}

:focus-visible {
  outline: 3px solid var(--pl-focus);
  outline-offset: 3px;
}

@media (prefers-reduced-motion: reduce) {
  *, *::before, *::after { scroll-behavior: auto !important; animation-duration: .01ms !important; transition-duration: .01ms !important; }
}
```

Implementar `POKEMON_TYPE_TOKENS` como objeto TS tipado para os 18 tipos; **não** permitir strings não validadas definirem nomes de classe Tailwind arbitrários. Cores dinâmicas podem usar CSS custom properties seguras.

## 7. Interações, estados e conteúdo

- Estados: `initial`, `loading`, `ready`, `empty`, `error`, `stale`, `unauthorized` onde apropriado.
- Busca: resultados declarativos, termo visível, botão limpar, teclado; quando offline/erro, informar o motivo.
- Favoritos: visitante pode ter armazenamento local se explicitamente suportado; autenticado sincroniza com backend. Não sugerir sincronização inexistente.
- Salvar equipe: visitante salva localmente; persistência em nuvem apenas em M4. CTA muda conforme capacidade real.
- Não alterar cor/termo sem relação com Pokémon; manter nomes localizados coerentes. Dados técnicos podem seguir rótulos oficiais da fonte, respeitando idioma disponível.
- Feedback: toast depois de salvar, confirmação para remoção irreversível, skeleton compatível com card final (evitar CLS).
- Evitar flashes de login e bloqueio para funções guest-first.

## 8. Acessibilidade e performance

- WCAG 2.2 AA como alvo: contraste >=4.5:1 para texto comum (>=3:1 para texto grande), foco visível, operação por teclado, formulários com label.
- `aria-live="polite"` para alterações de busca/carregamento e status de salvamento, sem anúncios excessivos.
- `next/image`, carregamento lazy em listas; hero usa prioridade apenas quando for principal e visível; preferir WebP/AVIF gerados a partir de assets permitidos.
- Cards de Pokémon não devem carregar dezenas de detalhes de API antes de aparecer; DTOs próprios e cache no backend.
- Limitar animação visual, reduzir efeitos de blur extensivos em grade e respeitar mobile de baixo desempenho.
- Evitar imagens imensas para ícones 24px; redimensionar/exportar assets para densidades adequadas.

## 9. Rotas prioritárias e critérios visuais

| Rota (sugestão) | Modelo | Critérios |
|---|---|---|
| `/pokedex` | catálogo | pesquisa, chips, cards, paginação, responsividade |
| `/pokemon/[id]` | detalhe | hero, stat bars reais, evoluções corretas |
| `/team-builder` | editor | até 6 slots, estado vazio, ações acessíveis |
| `/analysis` | análise | cálculos reais, tipos, explicações, regraset |
| `/trainer` | fase M4 | estados autenticado/não autenticado; não criar antes |

### DoD visual por página

1. Revisar em **375px, 768px, 1280px e 1600px**.
2. Validar teclado, foco, contraste, screen reader básico e zoom 200%.
3. Verificar loading/erro/vazio, imagens ausentes e nomes longos.
4. Comparar screenshot real com referências para hierarquia, ritmo, cor e proporções — **não** copiar detalhes incorretos das imagens geradas.
5. Passar lint, typecheck, testes aplicáveis e build; documentar exceções.
6. Não adicionar dependências ou bibliotecas de animação sem benefício demonstrável.

## 10. Regras operacionais para o Codex

- Leia `AGENTS.md`, `PRODUCT.md`, `ARCHITECTURE.md`, `ROADMAP.md`, `docs/DOMAIN_RULES.md` e este documento antes de mudar componentes.
- Trabalhe por marco e PR, não crie cinco páginas simultaneamente sem ter componentes-base e tokens revisados.
- Primeiro implemente **tokens + AppShell + TypeBadge + PokemonCard + Loading/Error/Empty**; depois Pokédex, detalhe, Team Builder e Analyzer.
- Não usar o mockup como dataset. Números, tipos, nomes de movimentos, habilidade e recomendações vêm da API/regra testada.
- Construa Storybook apenas se agregar valor à revisão dos componentes; caso contrário, uma rota `/dev/ui` de desenvolvimento não publicada pode servir para testar estados.
- Ao terminar cada marco, apresente screenshot real em desktop/mobile, arquivos alterados, comandos executados, limites conhecidos e próximos passos.
- O design system é referência obrigatória de aparência, não justificativa para remover validações existentes nem para redesenhar o backend.

## 11. Referências visuais usadas

As referências previamente geradas nesta conversa incluem: `pokélab_guia_pokémon_pastel.png` (catálogo mobile), `detalhes_do_pikachu_no_pokélab.png` (detalhe mobile), `construtor_de_equipe_pokélab_pastel.png` (time mobile), `analisador_de_equipe_pokélab_em_tons_pastel.png` (análise mobile), `pokélab_explorando_o_mundo_pokémon.png` (catálogo desktop), `painel_pokémon_do_pikachu_no_pokélab.png` (detalhe desktop), `painel_pokélab_para_montar_equipe.png` (time e análise desktop). São fontes de **estilo/composição**, não imagens finais de produto nem documentação de regras.

---

**Frase-guia:** *“Uma experiência colecionável e divertida, com a precisão de uma ferramenta de engenharia.”*
