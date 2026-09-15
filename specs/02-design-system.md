# Fase 2 — Design system

> **Este arquivo é a única fonte de verdade visual para quem implementa.**
> Os agentes do pipeline não têm acesso ao MCP do Figma. Tudo abaixo foi extraído
> com `get_design_context` e `download_assets` e transcrito aqui. **Não invente
> medida, cor ou raio** — se faltar algo, peça a extração, não estime.

Arquivo Figma: `BliVZDosX5BcSpvhYvdE0V`, página `0:1`.

---

## 0. A marca é KURIO, não GreenMint

O wordmark no header diz **KURIO** (node `I70522:3240;70504:3015;70486:510`).
"Marketplace de NFTs GreenMint" é o nome da *página* no Figma, não do produto.

- Tudo visível ao usuário usa **KURIO**: header, `<title>`, meta description.
- Chaves internas (`greenmint:db:v1`, `greenmint:scenario`) **ficam como estão** —
  são invisíveis e renomear só geraria churn e quebraria os 142 testes.

## 1. Calibração confirmada

O `--radius: 0.5rem` da fase 0 era provisório e está **errado**.

| Token | Valor real | Onde foi medido |
| --- | --- | --- |
| `--radius` | **6px** | Botão Entrar e botão Aplicar, ambos `rounded-[6px]` |
| Raio do artwork de NFT | **15px** | `NFT Artwork 03`, `rounded-[15px]` |

Corrigir `--radius` em `src/index.css` para `0.375rem`.

## 2. Header — node `70522:3240` ("Header With Divider")

Largura 1200, altura 45. Estrutura: linha do header + régua de 1px embaixo.

```
[KURIO 160x34]  ...  [Nav gap-40]  ...  [Ações gap-28]
                                          Busca 20x20
                                          Carrinho 24x24 + badge 16x16
                                          Botão Entrar 100x35
```

- **Wordmark**: "KURIO", 14px bold, `tracking-[1.4px]`, cor `foreground`.
- **Nav**: 4 itens — Início, Mercado, Criadores, Aprenda. Gap 40px. Item ativo em
  `text-accent` com sublinhado; inativos em `foreground`, 16px regular.
  O ativo é `Início` em Início/Entrar/Criar conta/Perfil/Carteiras, e `Mercado`
  nas quatro telas do fluxo de mercado.
- **Botão Entrar**: 100x35, `bg-primary`, `rounded-[6px]`, texto 16px medium em
  `ink`, com ícone de logout 20x20 à esquerda, gap 4px.
- **Badge do carrinho**: 16x16, número 10px medium em `ink`.
- **Divisor**: a régua pertence ao frame hospedeiro. A documentação do componente
  no Figma avisa: as telas de mercado usam Header Row **sem** divisor.

Ícones (busca, carrinho, logout) são glifos genéricos — usar **lucide-react**, que
já está instalado. Não baixar SVG para eles.

## 3. Filtros — node `70485:382`

Painel lateral, largura fixa **310px**, `bg-surface-card`, `p-[20px]`.
Gap entre seções: **40px**. Gap título→lista: **12px**. Lista com `px-[12px]`.

- **Título de seção**: 18px bold, `leading-[16px]`, cor `foreground`.
- **Linha de lista**: 15px, `leading-[40px]` (essa é a altura da linha).
  Selecionado em `text-accent`; não selecionado em `text-secondary`.
  Contagem à direita, mesmo tamanho, **bold**.
- **Faixa de preço**: slider com dois thumbs de 15px, trilho preenchido 161px.
  Legenda 15px em `foreground`. Botão **Aplicar**: `bg-primary`, `px-[12px]`,
  `py-[8px]`, `rounded-[6px]`, texto 16px bold `leading-[20px]` em `ink`.

### ⚠️ Divergência entre o design e as fixtures da fase 1

| | Design (Figma) | Fixtures (fase 1) |
| --- | --- | --- |
| Categorias | 9: Arte digital, Fotografia, Música, Arte 3D, Colecionáveis, Generativa, Jogos, Assinaturas, Utilidade | 4: art, gaming, music, photography |
| Redes | 3: Ethereum, Polygon, **Solana** | 2: ethereum, polygon |

**Resolver nesta fase**, estendendo as fixtures e os tipos para bater com o design —
a tela de catálogo da fase 3 precisa dos dois lados alinhados. Ao mexer nas
fixtures, lembrar que `SEED_VERSION` precisa subir e que os testes que asseram
contagens/categorias vão precisar de atualização.

## 4. Card de NFT — node `70342:2678`

Container 258 de largura, `flex-col`, gap **12px**.

| Parte | Especificação |
| --- | --- |
| Placa | 258x300, `bg-surface-card`, **sem raio** |
| Artwork | 250x250, `rounded-[15px]`, `object-cover`, offset 4px da esquerda |
| Título | 16px regular, `leading-[16px]`, cor `foreground` |
| Preço | 18px bold, `leading-[16px]`, cor `text-accent` |

Grid do catálogo: 3 colunas, gap horizontal 34px (258 + 34 = 292 de passo),
gap vertical 56px (356 + 56 = 412 de passo por linha).

## 5. Assets — já baixados, dívida do picsum quitada

`public/nft/ape-01.webp` … `ape-04.webp`

O design usa **apenas 4 artworks**, reutilizados em todos os cards. Originais eram
PNG 1254x1254 (~2MB cada); convertidos para WebP 800x800 q80 — **160 KB no total**,
contra 8 MB dos originais.

**Substituir as 6 referências a `picsum.photos`** em `src/mocks/fixtures.ts` e
`src/mocks/handlers/auth.ts` por estes assets locais, ciclando deterministicamente
pelo índice do NFT (`ape-0${(i % 4) + 1}.webp`). Isso fecha a dívida que o Reviewer
marcou com prazo "antes da primeira baseline visual" — e esta é a fase em que as
baselines nascem.

Avatares de criador e de usuário também precisam sair do picsum; usar iniciais em
`bg-surface-dark` ou recortes dos mesmos assets.

## 6. Consolidação dos testes E2E — pré-requisito, antes de qualquer spec novo

Recomendação do Reviewer da fase 1, a executar **no começo** desta fase:

1. Extrair `boot`/`apiFetch`/`login`/`setScenario` para `e2e/helpers.ts` — hoje
   estão duplicados em três arquivos.
2. Fundir `mock-boot-revalidation.spec.ts` no bloco `Boot param cleanup` de
   `runtime-behavior.spec.ts`, e `nft-catalog-session-integrity.spec.ts` como um
   `describe` de `api-contracts.spec.ts`. Alvo: **2 arquivos**.
3. Daqui em diante, specs por domínio (`catalog.spec.ts`, `checkout.spec.ts`),
   nunca por iteração de pipeline.

Trocar também o `Number(priceEth)` da checagem pairwise por comparação via big.js.

## 7. O que a fase 2 entrega

**Primitivos shadcn/ui** em `src/components/ui/`, adaptados à identidade (não no
estilo padrão do shadcn): button, input, select, checkbox, slider, dialog, drawer,
skeleton, badge, card, form, toast.

**Shell de layout**: header desktop, footer, tab bar mobile e o container de
1200px (`max-w-content`). Ver seções 9 e 10 — **mobile NÃO usa drawer de nav**.

**Skeleton com shimmer** que preserva as dimensões do conteúdo e respeita
`prefers-reduced-motion` (o media query global já está em `index.css`).

**Nenhuma tela de negócio** — catálogo é fase 3. O que se entrega aqui são as peças
e o shell, verificáveis em 390, 768 e 1440.

## 8. Critério de pronto

- `pnpm build`, `pnpm typecheck`, `pnpm lint` e `pnpm test` passam;
- os 142 testes existentes continuam verdes (ajustados onde as fixtures mudaram);
- nenhuma referência a `picsum.photos` em lugar nenhum do repositório;
- `e2e/` com 2 arquivos de spec e um `helpers.ts`;
- `--radius` corrigido para 6px;
- header desktop renderiza **KURIO**; mobile usa a tab bar inferior, não o header;
- layout correto em 390, 768 e 1440.


---

## 9. Footer — node `70492:696`

Três faixas empilhadas, largura total, conteúdo idêntico em todas as telas.

### Faixa 1 — medalhões + newsletter (`bg-surface-card`, h 250, p 32)

Três colunas de destaque separadas por régua vertical de 1px em `primary`, mais a
coluna de newsletter (357 de largura).

- **Medalhão**: 74x74, `bg-primary`, `rounded-[37px]` (círculo), letra 24px bold em
  `ink` — as letras são `W`, `C`, `D`.
- **Título**: 17px bold, `leading-[16px]`, `foreground`.
- **Texto**: 14px regular, `leading-[22px]`, `text-secondary`, largura 204.
- Gap interno de cada bloco: 12px.

**Copy exata, transcrita do Figma** (node `70492:696`) — não parafrasear:

| Letra | Título | Texto de corpo |
| --- | --- | --- |
| `W` | Segurança da carteira | Proteja sua carteira e colecione arte digital verificada com confiança. |
| `C` | Criadores em destaque | Conheça artistas, estúdios e comunidades que moldam a cultura digital na rede. |
| `D` | Alertas de lançamentos | Receba calendários de cunhagem, novidades de listas de acesso e análises do mercado. |

**Newsletter** — copy exata do Figma:
- título: **"Antecipe-se ao próximo lançamento"**, 18px bold, `leading-[16px]`
- placeholder do campo: **"digite seu e-mail..."**
- texto de apoio abaixo do campo, 13px `leading-[22px]` em `text-secondary`:
  **"Receba lançamentos selecionados, histórias de criadores e novidades do mercado."**
 Campo com `bg-surface-dark`, h 40, `rounded-[6px]`,
`pl-[12px]`, `drop-shadow-[0_0_10px_rgba(10,6,4,0.45)]`, placeholder 14px em
`secondary`. Botão **Enviar** embutido à direita: 85x40, `bg-primary`, cantos
arredondados só à direita (`rounded-r-[6px]`), 18px bold em `ink`.

### Faixa 2 — banda da marca (`bg-surface-dark`, h 88, p 32, gap 92)

Quatro colunas: wordmark **KURIO** (14px bold, `tracking-[1.4px]`) · "Feito para
colecionadores, criadores e cultura" (14px, `leading-[22px]`) · e-mail de contato ·
telefone. Todas em `foreground`.

### Faixa 3 — colunas de links (`bg-surface-card`, h 236, p 32, gap 124)

Quatro colunas. Título 18px bold `leading-[16px]`; itens 14px regular
`leading-[30px]`; gap título→lista 8px.

- **Meu perfil**: Meu perfil, Minha coleção, Atividade, Estúdio do criador, Lista de interesse
- **Central de ajuda**: Central de ajuda, Como comprar NFTs, Carteira e segurança, Política do mercado, Denunciar item
- **Coleções**: Arte digital, Fotografia, Música, Arte 3D, Utilidade
- **Redes sociais** (228 de largura): título + 5 ícones de 30x30, gap 10px. Abaixo,
  "Carteiras compatíveis" com um chip: `bg-surface-dark`, borda 1px `border-soft`,
  `rounded-[6px]`, h 26, texto 9px bold em `text-accent`, `tracking-[0.1px]`,
  conteúdo `METAMASK  •  WALLETCONNECT  •  COINBASE`.

Rodapé final, centralizado, 14px `leading-[30px]`:
`© 2026 Kurio. Propriedade digital para todos.`

Ícones sociais: usar **lucide-react**, não baixar SVG.

Nota da documentação do componente no Figma: em telas com scrim de modal, o footer
fica **abaixo** do scrim na ordem de pintura.

## 10. Mobile — não existe header; a navegação é uma tab bar inferior

**Correção importante:** o frame mobile (`14:5226`) **não tem header** com wordmark,
nav ou carrinho. Nada de hambúrguer, nada de drawer de navegação.

### Topo — Search Bar (`70395:239`), 366x45, y=40

Campo de busca com ícone de lupa 22x22 e placeholder "Explorar coleções", mais um
botão de filtro separado à direita: 45x45, `bg-primary`, ícone de filtro 22x22.

### Rodapé — Tab Bar (`70395:245`), 414x126, fixa no fundo

Barra com **entalhe (notch)** e um **botão circular flutuante de 65px** centralizado
sobre o entalhe. Quatro ícones de 20x20 distribuídos: **Home** (ativo, em
`text-accent`), **Favoritos** (coração), **Carrinho**, **Perfil**.

O item ativo se distingue por cor (`text-accent` vs `text-secondary`) — como o
desafio proíbe estado apenas por cor, adicionar `aria-current="page"` e um
indicador não-cromático.

### Grid mobile — masonry de 2 colunas

`Column L` (175 de largura, 513 de altura) e `Column R` (175, 544), com 16 de gap.
As colunas são **escalonadas**: a direita começa mais abaixo. Não é um grid regular.

Os cards mobile mostram badges que o desktop não tem: **coração de favorito**
(canto superior direito) e **tag de raridade** (ex.: `RARO`, canto superior
esquerdo, `bg-primary`).

### Hero mobile

Banner 366x190 arredondado, com gradiente e dois círculos decorativos, título
"SEJA DONO DA CULTURA DIGITAL", sobretítulo "Bem-vindo à Kurio", CTA "EXPLORAR →"
e três pontos de paginação.

## 11. Implicação para o shell responsivo

O shell não é "um header que se adapta". São **duas composições distintas**:

| Viewport | Topo | Navegação |
| --- | --- | --- |
| Desktop (≥1024) | Header com KURIO + nav + busca + carrinho + Entrar | Nav horizontal no header |
| Mobile (<1024) | Search bar + botão de filtro | Tab bar inferior fixa com FAB |

Em 768 (tablet), o desafio exige que funcione; o Figma não tem frame. Decidir e
registrar em `ARCHITECTURE.md` — a escolha natural é tratar 768 como mobile,
já que a tab bar escala bem até ali.
