# Fase 6 — Carrinho

> **Fonte de verdade visual.** Extraída do Figma e transcrita aqui — os agentes do
> pipeline não têm acesso ao MCP. **Não invente medida, cor ou copy.**
> Complementa `specs/02-design-system.md`.

Figma `BliVZDosX5BcSpvhYvdE0V`. Desktop `11:1278` · Mobile `16:360`.

---

## 1. Layout — node `70369:240` ("Cart Body"), 1200×388

Duas colunas, `justify-between`: tabela de itens à esquerda, **Resumo da carteira**
de 332 à direita.

Acima do Cart Body, um bloco de 244×16 em `y=0` (`70402:3337`): é o **breadcrumb**
`Início / Mercado / Carrinho` (`11:1309`), não um título de seção. Mesmo padrão e
mesma tipografia do breadcrumb da fase 4 (14px, separadores em `text-secondary`,
item atual em `foreground` com `aria-current="page"`).

⚠️ O desktop **não desenha título de página**. O `<h1>` ainda precisa existir para
leitor de tela — renderizar em `sr-only`. (O mobile tem título visível: "Carrinho
de NFTs" no Screen Header, `16:415`.)

## 2. Tabela de itens — `70369:241`, `gap-[12px]`

### Cabeçalho — `70369:242`, `pr-[24px]`

Cinco colunas, todas 16px: **NFTs** (bold, largura 250) · **Preço** (medium, 77) ·
**Edições** (bold, 75) · **Total** (medium, 87) · coluna vazia de 24 para o ícone
de remover. Régua de 1px abaixo.

### Linha — `70369:244`, altura **70**, `bg-surface-card`, `pr-[24px]`

| Parte | Especificação |
| --- | --- |
| Arte | 70×70, `rounded-[6px]`, `object-cover`; `gap-[16px]` até o texto |
| Título | 16px bold, `leading-[16px]`, `foreground` |
| ID do token | 14px regular, `secondary` (#b39463), `gap-[6px]` do título |
| Preço unitário | 16px bold, **`text-secondary`** (#cfb28c) |
| Stepper | botões 20×30, `bg-primary`, borda 1px `#140d0a`, `rounded-[20px]`, `drop-shadow-[0_4px_6px_rgba(20,13,10,0.15)]`, ícone 16; número 17px regular `leading-[24px]`; `gap-[12px]` |
| Total da linha | 16px bold, **`text-accent`**, largura 87 |
| Remover | ícone de lixeira 24×24 |

O stepper é **o mesmo da Buy Bar mobile** (fase 4) — reaproveitar o componente.

## 3. Resumo da carteira — `70370:239`, largura 332, `gap-[24px]`

- **Título** "Resumo da carteira": 18px bold `leading-[16px]`, com régua abaixo
- **Código promocional**: rótulo 14px bold; campo de 40 de altura, borda 1px
  `primary`, **`rounded-[3px]`**, `pl-[8px]`, placeholder 12px em `secondary`
  ("Digite o código promocional..."); botão **Aplicar** embutido à direita,
  102×40, `bg-primary`, cantos arredondados só à direita, 15px bold em `ink`
- **Taxas** (`gap-[12px]`, tudo em `foreground`):
  - Subtotal — rótulo 15px, valor **18px** alinhado à direita
  - "Desconto do lançamento" — rótulo e valor 15px
  - Taxa de rede — rótulo 15px, valor 18px, e abaixo **"Taxa estimada"** em 12px
    `text-accent`
- **Total**: rótulo 16px bold em `foreground`, valor **18px bold em `text-accent`**
- **CTA**: botão de 40 de altura, largura total, `bg-primary`, `rounded-[3px]`,
  texto 15px bold em `ink` — **"Conectar e finalizar"**; abaixo, link
  "Continuar explorando" em 15px `text-accent`

⚠️ **O raio aqui é 3px**, contra 5px nos modais de auth e 6px no resto do sistema.
O Figma é inconsistente entre telas. Transcrito como está; se normalizar, registrar.

## 4. Comportamento — §3

- Adicionar, alterar e remover **respeitando a disponibilidade por NFT e edição**.
- **Carrinho persiste após refresh** e os itens do visitante são preservados ao
  autenticar — `mergeGuestCartInto` já faz isso no mock desde a fase 1, e a fase 5
  dispara o login; esta fase só precisa não atrapalhar.
- **Cupom**: aplicar e remover, tratando código inválido e expirado. As fixtures
  têm `GREEN10` (válido) e `EXPIRED20` (expirado).
- **Subtotal, desconto, taxa de rede e total vêm da API**, não de cálculo local —
  `POST /api/quote` já existe e é a fonte. Valores em ETH são string decimal com
  `big.js`; nunca `number`.
- **Refletir alteração de preço e disponibilidade recebida enquanto o carrinho
  está aberto** — é o gancho da fase 9, que roda em paralelo. Coordenar.

## 5. O que já existe

`GET/POST/PATCH/DELETE /api/cart` e `/api/cart/items`, mais `POST /api/quote`,
prontos desde a fase 1 com testes de contrato cobrindo cupom inválido/expirado,
conflito de disponibilidade e a matemática de subtotal/desconto/taxa/total.

`useAddToCart` já existe da fase 4.

## 6. Mobile — `16:360` (414×896)

Extraído. Duas camadas empilhadas, **não é o desktop reescalado**: a tabela de 5
colunas desaparece por completo e dá lugar a cards.

### 6.1 Estrutura da tela

| Camada | Node | Geometria |
| --- | --- | --- |
| Content | `70397:239` | `x 0, y 32, 414×518` |
| Payment Summary | `70397:245` | `x 0, y 554, 414×342` |

O Payment Summary é a folha inferior fixa, irmã do Content — mesmo padrão da Buy
Bar da fase 4, mas com **raio 40 só no topo** (`rounded-t-[40px]`), fundo
`surface-card` e padding `pt-24 px-24 pb-36`.

### 6.2 Screen Header — `70397:240` (358×44, x 28)

- Botão voltar: círculo 35×35 em `x 0, y 0`, ícone `Arrow-Left 2` 20×20 em `+7,+7`.
  Mesmo componente do header mobile da fase 4.
- Título "Carrinho de NFTs": `x 96, y 9`, **20px bold, lh 16**.

### 6.3 Cart Items — `70397:241` (358 largura, gap 20)

Cada item é um card `358×100`, `bg #241612`, **raio 14**, sombra
`0 6px 20px rgba(10,6,4,0.45)`. Layout absoluto no Figma; em código é grid.

| Elemento | Posição | Estilo |
| --- | --- | --- |
| Thumb | `x 0, y 0, 100×100` | raio 14 só à esquerda (`rounded-l-[14px]`) |
| Título | `x 109, y 13` | 15px bold, lh 16, `foreground` |
| Edição | `x 109, y 35` | 14px regular, lh 16, `text-secondary` — copy `Edição: 1/50` |
| Preço | `x 109, y 69` | **18px bold, lh 16, `text-accent`** |
| Stepper | `x 261, y 38` | ver 6.4 |
| Lixeira | `x 313, y 42, 24×24` | `Iconly/Curved/Delete`, **só no item 3** |

⚠️ **A lixeira colide com o botão `+` no próprio Figma, e isso foi verificado.**
O stepper (`16:665`) ocupa `x 261` + 81 = até 342, com o `+` em `x 318..342`; a
lixeira (`16:463`) está em `x 313..337`. Sobrepostos. Não é erro de transcrição:
é o arquivo. Leitura adotada: uma linha à direita — stepper, depois lixeira —
centralizada verticalmente, sem sobreposição.

⚠️ A thumb aparece duplicada no Figma (`Rectangle 106` + uma cópia
`mix-blend-multiply` deslocada 1–2px). É artefato de composição do designer para
escurecer a imagem, **não** dois elementos. Em código: uma `<img>` só.

⚠️ O ícone de lixeira existe em **um** dos quatro cards (`Item 3`, o único com
quantidade 2 selecionada). Não é regra de negócio do desenho — é o designer
mostrando o estado. **Implementar remover em todos os itens**; §3 exige remoção.

### 6.4 Stepper do card (81×29, origem `x 261, y 38`)

| Parte | Offset relativo | Estilo |
| --- | --- | --- |
| Botão `−` | `+0, +0, 24×24` | `Group 65`/`Group 72` — SVG circular, mesma moldura do `+` |
| Quantidade | `+37, +7` | 16px regular, **lh 22**, `foreground` |
| Botão `+` | `+57, +0, 24×24` | círculo raio 31, `bg surface-raised`, borda `border` |
| Glifo `+` | `+62.9, +5` | 21px regular, `foreground` |

Os botões são 24×24 — **abaixo do alvo de toque de 44px**. Envolver em área
clicável de 44px com `::before`/padding negativo sem mover o visual, ou o
requisito de acessibilidade mobile cai.

### 6.5 Payment Summary — `70397:245`

`flex-col justify-between`, então o bloco de valores fica no topo e o CTA colado
no fundo dos 342px.

**Promo Input — `70397:246`** (largura total, `h-50`, raio 40, `bg surface-card`,
borda `border`, `drop-shadow 0 6px 10px rgba(10,6,4,0.45)`, `pl-16`):

- placeholder "Digite o código promocional…" — **13px regular, lh 22**, `secondary`
- botão "Aplicar": `97×50`, raio 40, 15px bold, `foreground`,
  gradiente `96.02deg, rgba(210,138,76,0.54) 0.94% → #d28a4c 105%`

**Linhas de valor** (gap 12, todas `justify-between`, largura total):

| Linha | Label | Valor |
| --- | --- | --- |
| Subtotal | 15px regular, `foreground` | 16px regular, lh 16, direita |
| Desconto do lançamento | 15px regular | `(-) 00.00`, 15px regular |
| Taxa de rede | 15px regular | 0.016 ETH, 16px regular + legenda |
| Total | **16px bold** | **18px bold, `text-accent`** |

A linha de Taxa de rede é `flex-col items-end`: a linha label/valor, e abaixo
dela, alinhada à direita, a legenda "Taxa estimada" em **12px regular, lh 16,
`text-accent`**.

**Checkout Button — `70397:251`**: largura total, `h-60`, raio 40, texto
"Conectar e finalizar" 16px bold em `ink`, gradiente
`108.86deg, #d28a4c 3.96% → rgba(210,138,76,0.8) 121.97%`.

⚠️ Dois gradientes distintos (96.02deg no Aplicar, 108.86deg no CTA) — transcritos
como estão. Se forem normalizados num token, registrar no ARCHITECTURE.md.

⚠️ **Copy divergente**: o CTA mobile diz "Conectar e finalizar" e o desktop também.
Mas a ação não conecta carteira nenhuma nesta fase — leva ao checkout (fase 7).
Manter a copy do Figma e não fingir conexão.

### 6.6 Tokens

Verificado em `src/index.css`: `--text-caption-13` (linha 42) e `--text-caption-12`
(linha 41) **já existem**. `--text-title-21`, usado pelo glifo `+` do stepper, não
existe — criar nesta fase.
