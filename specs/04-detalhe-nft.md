# Fase 4 — Detalhes do NFT

> **Fonte de verdade visual.** Extraída do Figma e transcrita aqui — os agentes do
> pipeline não têm acesso ao MCP. **Não invente nem estime medida, cor ou copy.**
> Complementa `specs/02-design-system.md` e `specs/03-catalogo.md`.


Figma `BliVZDosX5BcSpvhYvdE0V`. Desktop `10:244` · Mobile `15:5536`.

---

## 1. Tokens novos que esta tela introduz

Não existem em `src/index.css` e precisam ser adicionados:

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-surface-raised` | `#2f1d15` | superfícies elevadas (já aparecia no gradiente do card mobile) |
| `--text-title-20` | `1.25rem` | quantidade no stepper (`leading-[28px]`) |
| `--text-title-22` | `1.375rem` | preço no detalhe (`leading-[16px]`, bold) |
| `--text-heading-28` | `1.75rem` | título do NFT (bold) |
| `--color-amber` | `#e3a44e` | aparece no pill de avaliação mobile |

## 2. Desktop — bloco Product, node `70342:2764`

Duas colunas, `gap-[32px]`, altura 448.

### Coluna de imagens — `70363:239`, largura 573, `gap-[28px]`

- **Thumbnails**: coluna de 100px, `gap-[16px]`, 4 itens de 100×100 com
  `rounded-[8px]`. O selecionado leva borda 1px em `primary`. Atrás de cada um há
  uma placa `bg-surface-card` `rounded-[6px]` de 100×100, em `top` 0/116/232/348.
- **Imagem principal** — `70342:2683`: 444×444, `bg-surface-card`,
  `rounded-[6px]`, `p-[16px]`, com a arte de 404×404 em `rounded-[24px]`.
- Ícone de 30×30 sobreposto em `left-[530px] top-[15px]`.

### Coluna de detalhes — `70342:2763`, `flex-1`, `justify-between`

| Parte | Especificação |
| --- | --- |
| Título | 28px bold, `foreground` |
| Preço | 22px bold, `leading-[16px]`, `text-accent` |
| Avaliação | 5 estrelas de 15px (a última em estado vazio) + "19 avaliações de colecionadores", 15px regular |
| Régua | 1px, largura 573, abaixo do bloco de título |
| "Sobre este NFT:" | 15px bold `leading-[16px]`; corpo 14px `leading-[24px]` em `text-secondary`, largura 574 |
| "Edição:" | 15px bold; chips de 28px de altura, `gap-[6px]` |
| Chips de edição | larguras 36 / 42 / 46 / 66 (`1/1`, `1/10`, `1/50`, `ABERTA`); 14px; o selecionado em `text-accent` medium, os demais em `text-secondary` regular |
| Stepper | dois botões de 33×49,5 em `bg-primary`, `rounded-[33px]`, borda 1px `#140d0a`, `drop-shadow-[0_6.6px_9.9px_rgba(20,13,10,0.15)]`; número 20px `leading-[28px]`; `gap-[12px]` |
| COMPRAR | 130×40, `bg-primary`, `rounded-[6px]`, 14px bold `leading-[20px]` em `ink` |
| Favoritar | 130×40, borda 1px `primary`, `rounded-[6px]`, ícone de coração 20px + 14px medium em `text-accent`, `gap-[8px]` |
| Metadados | 15px regular em `secondary`, `gap-[12px]`: "ID do token: #0042" · "Coleção: Kurio Apes" · "Atributos: Óculos, Esmeralda, Raro" |
| Compartilhar | "Compartilhar este NFT:" 15px bold + 3 ícones (LinkedIn 15×14,4 · mensagem 18 · Twitter 16×12,2), `gap-[8px]` |

Copy exata da descrição: "Um colecionável digital finalizado à mão da coleção
Kurio Editions, verificado na Ethereum, com arte desbloqueável e acesso para
colecionadores."

## 3. Desktop — "Mais desta coleção"

Abaixo do Product: `Section Heading` (1200×28) com o título e uma régua, depois
`Frame 204` (1200×347) com os cards e `Carousel Dots` (52×12) centralizados em
`x=574`. Cards mostram arte, título e preço — ex.: "Cosmic Bloom #118", "1.29 ETH".

**Cards** — `70342:2799`, 5 visíveis, `justify-between`, cada um `flex-col gap-[12px]`:

| Parte | Especificação |
| --- | --- |
| Placa | ~219 de largura × **255** de altura, `bg-surface-card`, **sem raio** |
| Artwork | ~212 quadrada, `object-cover` |
| Título | 15px regular, `foreground` |
| Preço | 16px bold, `leading-[16px]`, `text-accent` |
| Dots | 52×12, centralizados, `gap-[32px]` abaixo dos cards |

⚠️ **O Figma é inconsistente entre os cards** e isso NÃO deve ser replicado: os
paddings da placa variam por card (`pb-8 pl-20 pr-12 pt-4` no primeiro,
`pb-24 pt-20 px-4` no segundo e terceiro, `pb-28 pt-16 px-4` nos dois últimos), e
o raio da arte alterna entre 11 e 13. Larguras vão de 219 a 220 e artes de 212 a
213. Padronize: **placa 219×255, arte 212×212 com `rounded-[13px]`, centralizada**
— o valor que aparece em 4 dos 5 cards. Registre o desvio no `ARCHITECTURE.md`.

**Heading da seção** — `70342:2782`, 1200×28: título "Mais desta coleção" com
régua ao lado.

**Comportamento**: são NFTs relacionados, então devem vir da API — mesma coleção
ou mesma categoria, excluindo o NFT atual. Não são dado fixo.

## 4. Mobile — node `15:5536`

**Não é o desktop reescalado.** Três camadas sobrepostas.

### 4.1 Hero — `70396:241`, 414×506

Fundo: `linear-gradient(137.64deg, #241612 11.999%, #2f1d15 106.59%)` cobrindo
os 414×506 — o mesmo par de cores do card mobile do catálogo.

Bloco de conteúdo em `left-[28px] top-[23px]`, largura 361, `flex-col gap-[8px]`:

- **Linha de botões flutuantes** (`justify-between`, largura total): voltar à
  esquerda e favoritar à direita. Ambos **35×35**, `bg-surface-raised`, borda 1px
  `border-strong`, `rounded-[17.5px]`. Ícone de voltar 20×20 (`p-[8px]`); coração
  16×14,2 centralizado.
- **Arte**: altura **356**, largura total, `rounded-[24px]`, `object-cover`.

Pontos de carrossel: 56×7 em `left-[179px] top-[365px]` — centralizados sob a arte.

### 4.2 Details Sheet — `70396:242`, 414×504, sobrepõe o hero a partir de y=392

`bg-surface-card`, **`rounded-t-[31px]`**, `pt-[32px] pb-[24px] px-[24px]`,
`flex-col gap-[12px]`.

| Parte | Especificação |
| --- | --- |
| Título | 20px bold, `leading-[16px]`, `foreground` |
| Pill de avaliação | **80,16×27**, borda 1px `primary`, `rounded-[32px]`; estrela 14px, nota "4.8" 14px medium em `foreground`, "(19)" 14px regular em `text-secondary` |
| Descrição | 14px regular, `leading-[24px]`, `text-secondary`, largura 361, altura 71 |
| "Edição:" | 15px bold `leading-[16px]`; gap 8 até os chips |
| Chips | altura 28, **`gap-[12px]`** (o desktop usa 6); larguras 42 / 42 / 46 / 66; selecionado em `text-accent` medium, demais em `text-secondary` regular |
| Token Info | 3 linhas, 15px regular em `secondary`, `gap-[12px]` |

Copy da descrição mobile é **mais curta** que a do desktop: "Um colecionável
digital 1/50 finalizado à mão da coleção Kurio Editions, verificado na Ethereum."

### 4.3 Buy Bar — `70396:245`, 414×164, fixa em y=732

`bg-surface-card`, **`rounded-t-[40px]`**, `pt-[20px] pb-[36px] px-[24px]`,
`drop-shadow-[0_0_10px_rgba(10,6,4,0.45)]`. Conteúdo em `flex-col gap-[20px]`.

**Linha 1** (`justify-between`):
- "Qtd." 15px medium em `text-secondary`, `gap-[8px]` até o stepper
- Stepper `gap-[12px]`: botões **20×30**, `bg-primary`, borda 1px `#140d0a`,
  `rounded-[20px]`, `drop-shadow-[0_4px_6px_rgba(20,13,10,0.15)]`, ícone 16px;
  número 18px medium `leading-[25px]`
- Preço à direita: **20px bold** `leading-[16px]` em `text-accent`

**Linha 2** (`gap-[12px]`):
- **"Comprar NFT"**: 196×60, `rounded-[40px]`, `pl-[48px] pr-[44px] py-[20px]`,
  fundo `linear-gradient(100.37deg, #d28a4c 3.96%, rgba(210,138,76,0.8) 121.97%)`,
  texto 16px bold `leading-[20px]` em `ink`
- **Botão de carrinho**: 60×60, `bg-surface-raised`, borda 1px `border-strong`,
  `rounded-[40px]`, ícone 20px, `p-[20px]`

O stepper mobile é **menor** que o desktop (20×30 contra 33×49,5) e o botão
principal é pill de 60 de altura, não o retângulo de 40 do desktop.

## 5. Comportamento — o que o desafio exige (§3 e §4)

- **Acesso direto** à rota funciona, e **NFT inexistente** cai em estado tratado.
- **Edição indisponível** (esgotada) não pode ser selecionável nem comprável.
- **Limite de quantidade** respeita o `available` da edição escolhida.
- **Favoritos persistem para o usuário autenticado** — e é aqui que entra a
  **atualização otimista com rollback** que o §4 exige em pelo menos uma
  interação. Sem sessão (fase 5 ainda não existe), definir o comportamento:
  provavelmente exigir login e não aparentar sucesso.
- Galeria troca a imagem principal ao selecionar thumbnail.
- A compra leva ao carrinho — que é a fase 6; aqui só a ação e seu resultado.

## 6. Dívidas da fase 3 que vencem aqui

De `ARCHITECTURE.md` §"Dívidas para a fase 4". A **6 vence agora**: o
`pathname.startsWith('/')` do header marca "Início" ativo em qualquer rota — e a
rota de detalhe deixa de ser stub nesta fase, então a tabela de prefixos cresce.


---

# Resolução das Open Questions do Planner

Cinco levantadas, cinco resolvidas. Três saíram dos **SVGs exportados** que o
`get_design_context` já havia entregue — baixei e li o fonte, sem gastar chamada.

## OQ1 — Cards do carrossel

Transcritos na §3 acima, com o aviso sobre a inconsistência do Figma.

## OQ2 — O ícone 30×30 em `left-530 top-15` é uma LUPA

`<circle r="14.5" fill="#2F1D15" stroke="#3F2319"/>` mais o glifo de lupa. Ou
seja: botão circular de 30px em `surface-raised` com borda `border-strong`,
sobreposto ao canto superior direito da imagem principal.

**Função**: ampliar a arte. Comportamento honesto nesta fase: abrir a imagem em
tamanho maior num Dialog (o primitivo já existe e está exercitado), ou ficar
desabilitado se o zoom sair do escopo. **Não** pode ser decorativo e clicável.

## OQ3 — Chips de edição: elipse com traço, sem preenchimento

Baixei os SVGs dos quatro chips:

| Estado | Traço | Preenchimento |
| --- | --- | --- |
| Não selecionado | `#3f2319` (border-strong) | nenhum |
| **Selecionado** | `#d28a4c` (primary) | nenhum |
| `ABERTA` | `#3f2319` (border-strong) | nenhum |

Traço de **1px**. E o detalhe que se erra fácil: o path desenha uma **elipse
inscrita na caixa**, não um pill. Em CSS é `border-radius: 50%` — `rounded-full`
num chip de 66×28 produziria um stadium de pontas semicirculares e lados retos,
que é outra forma.

O estado selecionado se distingue por **cor do traço e peso da fonte** (medium
contra regular) — mas o §8 proíbe estado só por cor, então acrescente
`aria-pressed` ou `role="radio"` com `aria-checked`.

## OQ4 — Pontos do hero mobile: pill ativo + dois círculos

Não são três pontos iguais. O SVG de 56×7 contém:

- `<rect width="28" height="7" rx="3.5" fill="#D28A4C"/>` em x=0 — o **ativo**, um
  pill de 28 de largura
- `<circle cx="38.5" r="3.5" fill="#D28A4C"/>`
- `<circle cx="52.5" r="3.5" fill="#D28A4C"/>`

Gaps de 7 entre eles. Todos em `primary` — o inativo não muda de cor, muda de
**forma**, o que já satisfaz "estado não apenas por cor".

O hero do catálogo (`specs/03-catalogo.md` §1) usa 40×8 e o mobile 33×7 — **não
assuma que seguem esta mesma composição**; aqueles não foram verificados no SVG.

## OQ5 — Ritmo vertical do desktop

Do metadata do frame `10:244`:

| Elemento | Posição |
| --- | --- |
| `Top` (container) | y=24, altura 553 |
| `Header Row` | y=0 dentro de Top, altura 45 |
| **Breadcrumb "Início / Mercado"** | 145×16 |
| `Main` | y=77, altura 476 |
| `Product` | y=28 dentro de Main → y absoluto 105 |

**Achado que eu não tinha transcrito**: existe um **breadcrumb "Início / Mercado"**
entre o header e o bloco Product. É navegação, não decoração — precisa ser link
real para `/`, com o item atual não sendo link.

O tamanho do glifo `+`/`−` do stepper desktop está no SVG dos botões: os frames
internos são de **26,4px** dentro do botão de 33×49,5.