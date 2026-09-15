# Fase 3 — Início / catálogo

> **Fonte de verdade visual.** Os agentes do pipeline não têm acesso ao MCP do
> Figma. Tudo abaixo foi extraído com `get_design_context` e transcrito aqui.
> **Não invente nem estime medida, cor, raio ou copy.** Se faltar, peça extração.
> Complementa `specs/02-design-system.md`, que traz header, footer, filtros,
> card desktop e as duas composições de shell — leia os dois.

Figma `BliVZDosX5BcSpvhYvdE0V`. Desktop `2:2` · Mobile `14:5226`.

---

## 1. Hero — node `70347:239`

1200×450, `pl-[40px]`, conteúdo de 1160 centrado, coluna de texto 600 + arte 450.

| Parte | Especificação |
| --- | --- |
| Sobretítulo | "Bem-vindo à Kurio" — 14px medium, `leading-[16px]`, `tracking-[1.4px]`, `foreground` |
| Título | "SEJA DONO DO FUTURO" / "DA ARTE DIGITAL" — 43px bold, **`leading-[70px]`**, duas linhas |
| Texto | 14px regular, `leading-[24px]`, `text-secondary`, largura 557 |
| CTA | "EXPLORAR" — 140×40, `bg-primary`, `rounded-[6px]`, `pl-[28px] pr-[36px]`, 16px bold `leading-[20px]` em `ink` |
| Arte | 450×450, `rounded-[24px]`, `object-cover` |
| Paginação | 3 pontos, 40×8, abaixo do CTA (gap 44) |

**Estrutura de gaps — aninhada, não chapada** (`70342:2672`). Transcrever só os
tamanhos não bastou: o aninhamento é que produz o ritmo vertical.

```
flex-col gap-[44px] items-end w-[600px]   ← items-end joga os pontos à DIREITA
├ flex-col gap-[32px] w-full
│ ├ flex-col gap-[4px] w-full
│ │ ├ flex-col gap-[8px]   (sobretítulo + título)
│ │ └ parágrafo
│ └ CTA
└ pontos
```

Copy exata do texto: "Descubra NFTs selecionados de criadores emergentes e
consagrados. Colecione arte digital rara, apoie artistas e tenha uma parte da
cultura da internet."

A arte do hero é um dos `public/nft/ape-0{1..4}.webp` — o Figma reutiliza os
mesmos 4 assets em toda a página.

## 2. Toolbar — node `70351:239`

842 de largura, altura 18, `justify-between`.

- **Abas** (gap 20, 15px medium `leading-[16px]`): "Todos os NFTs" (ativa, em
  `text-accent`) · "Novos lançamentos" · "Em alta" (inativas em `foreground`).
  Sublinhado de 101px sob a aba ativa, em `primary`, a 23px do topo.
- **Ordenação** (bloco de 300 à direita): rótulo "Ordenar por:" 15px regular em
  `foreground`, valor "Listados recentemente" a 110px, e seta de 16×16 a 278px.

As abas são **atalhos de ordenação**, não filtros separados — mapear para o
parâmetro de `sort` na URL e manter coerência com o seletor de ordenação.

## 3. Grid do catálogo — desktop

3 colunas de 258, passo horizontal 292 (gap 34), passo vertical 412 (gap 56).
Container do grid: 842 de largura. Card desktop em `specs/02-design-system.md` §4.

## 4. Card mobile — node `15:5499`

**Diferente do desktop, não é o mesmo componente reescalado.**

| Parte | Especificação |
| --- | --- |
| Placa | 175×200, `rounded-[20px]`, gradiente `linear-gradient(139.55deg, #241612 12%, #2f1d15 106.59%)` |
| Artwork | 168×168, `rounded-[16px]`, centrado |
| Título | 15px regular, `foreground`, `pl-[8px]` |
| Preço | 16px bold, `text-accent` |
| Badge de raridade | 68×32, `bg-primary`, canto superior esquerdo a `top-[16px]`, texto 13px medium em `ink` (ex.: `RARO`) |

O grid mobile é **masonry de 2 colunas escalonadas** (`Column L` 175×513,
`Column R` 175×544, gap 16) — a coluna direita começa mais abaixo. Não é grid
regular. Cards mobile também mostram coração de favorito no canto superior
direito, que o desktop não tem.

## 5. Paginação — node `70342:2825`

Botões de 35×35, `rounded-[4px]`, gap 8.

- **Página atual**: `bg-primary`, número 18px bold `leading-[16px]` em `ink`
- **Demais**: borda 1px `border-strong`, número 18px regular em `foreground`
- **Próxima**: mesma borda, seta de 18×18

## 6. Banner de NFT em destaque — node `70410:3791`

Sidebar, 310 de largura, `pt-[24px] pb-[4px]`, fundo
`linear-gradient(to bottom, rgba(210,138,76,0.1), rgba(210,138,76,0.03))`.

- "NFT EM DESTAQUE" — 24px bold `leading-[32px]`, `text-accent`, `px-[20px]`
- "OFERTA LIMITADA" — 22px bold `leading-[16px]`, `foreground`, centralizado
- Arte 310×368, `rounded-[22px]`, `object-cover`
- Três elementos decorativos sobrepostos: um quadrado de 22px com borda 2px
  `#46a358` a 20% de opacidade, e dois círculos com gradiente âmbar (45px e 15px)

## 7. Comportamento — o que o desafio exige (§3 e §4)

Nada disto é decoração; é o que vale nota.

- **Busca, filtros, ordenação e paginação compõem o estado da URL** via
  `validateSearch` do TanStack Router, e sobrevivem a refresh e ao histórico.
  Nada de `useState` para esses parâmetros.
- **Filtros são combináveis**, e mudar qualquer filtro **reinicia a paginação**.
- As consultas refletem os parâmetros enviados à API; tratar resultado vazio,
  falha e **resposta fora de ordem** (o cenário `out-of-order` do MSW existe
  exatamente para isto e segue sem cobertura desde a fase 1).
- Estados de carregamento com **skeleton shimmer** preservando dimensão, vazio,
  erro e atualização em segundo plano.
- Cancelar ou descartar resposta obsoleta.
- Query keys incluem usuário e parâmetros, isolando cache entre buscas.

## 8. Dívidas da fase 2 que vencem agora

De `ARCHITECTURE.md` §"Dívidas para a fase 3" — as duas primeiras são obrigatórias
nesta fase:

1. **Zoom 200%** — o gatilho registrado dizia "revisitar antes de qualquer conteúdo
   do footer se tornar funcional". A coluna "Coleções" do footer vira filtro nesta
   fase, então o footer passa a ter conteúdo funcional que some a 200% de zoom.
   Resolver: §8 do desafio exige ausência de perda de conteúdo com zoom.
2. **Cenários `empty` e `out-of-order`** — sem cobertura desde a fase 1. O catálogo
   é o primeiro consumidor real dos dois; cobrir em `catalog.spec.ts`.
3. `header.tsx:14-18` — `pathname.startsWith('/')` marca "Início" ativo em qualquer
   rota, inclusive 404. A tabela de prefixos cresce nesta fase.
4. Sombreamento de `--color-foreground`, `rounded-xl` do card, thumb `bg-white` do
   slider, variantes extras do badge — calibrar ao consumir.

## 9. Fora de escopo

A seção editorial "Diário da Cunhagem" e os dois cards promocionais existem no
frame, mas o desafio diz que páginas editoriais não fazem parte da entrega. Se
implementados como blocos estáticos da home, não podem aparentar navegação
funcional para páginas que não existem.

Detalhe do NFT é a fase 4 — aqui só a navegação até ele.

---

# Resolução das Open Questions do Planner

Extraí o que faltava e verifiquei o que o Figma realmente contém. **Três das seis
não eram lacunas de transcrição — são coisas que o design não especifica.**

## OQ1 — Busca no desktop: não existe estado expandido

O header tem só o ícone de 20×20. Varri o arquivo: não há campo de busca desktop
expandido, nem overlay, nem modal. O único campo de busca desenhado é o mobile
("Explorar coleções", `70395:239`).

**Decisão:** o ícone abre um campo inline no header, reaproveitando o `Input` já
adaptado e o mesmo tratamento visual do campo mobile (h40, `bg-surface-dark`,
`rounded-[6px]`). Registrar em `ARCHITECTURE.md` como desvio consciente: o design
não cobre o estado, e busca é requisito de §3.

## OQ2 — Ordenação: o Figma mostra um rótulo, a API define quatro valores

Transcrito no Figma: apenas "Listados recentemente". Não há dropdown aberto.
`NftSort` em `src/types/nft.ts:21` já define os quatro valores suportados pelo
handler (`nfts.ts:23`).

**Decisão** — rótulos em português para os valores que já existem, sem inventar
ordenação nova:

| Valor | Rótulo |
| --- | --- |
| `newest` | Listados recentemente *(transcrito do Figma)* |
| `price-asc` | Menor preço |
| `price-desc` | Maior preço |
| `popular` | Em alta |

## OQ3 — Painel de filtros: seções confirmadas, e um descompasso real

As três seções **estão** transcritas em `specs/02-design-system.md` §3, com títulos:
**"Coleções"** (as 9 categorias), **"Faixa de preço"** (slider + Aplicar) e
**"Rede"** (Ethereum, Polygon, Solana). Não há seção de raridade no painel — o
design não tem.

**O descompasso:** `network` não existe no modelo de NFT. Não está em `NftSummary`,
não está em `NftDetail`, não está em `NftEdition`. O tipo `Network` só é usado em
carteiras e na taxa de rede da cotação. Ou seja, a seção "Rede" do design não tem
dado para filtrar.

**Decisão: adicionar `network` ao NFT.** Renderizar a seção sem filtrar violaria
"ações fora do escopo não devem aparentar sucesso funcional" (§3), e omiti-la
custaria fidelidade. É uma mudança pequena — campo na fixture distribuído
deterministicamente, mais `network` no schema de query de `nfts.ts` — e alinha dado
e design, igual ao que a fase 2 fez com as 9 categorias.

Sobre a **raridade**: existe no dado (`NftRarity`) e a API já filtra por ela, mas o
design não tem seção de filtro para isso. Não inventar seção; a raridade aparece
como badge no card mobile.

**Ordem da sidebar** (frame `2:2`, por coordenada y): painel de filtros em y=0, e o
banner "NFT EM DESTAQUE" abaixo, em y=809.

Sobre o **thumb do slider** (dívida 4 da fase 2): o Figma desenha os dois thumbs
como círculos de 15px, e o trilho preenchido em 161px — mas **não transcreve cor de
preenchimento**. Usar `primary` no thumb e no trecho ativo do trilho, e
`border-soft` no inativo; registrar como calibração.

## OQ4 — Badge de raridade: o Figma tem um só

Varri o arquivo inteiro: existe apenas **`RARO`**. Não há `COMUM`, `ÉPICO` nem
`LENDÁRIO` desenhados, e nem todo card mobile leva badge — no frame, só um leva.

**Decisão:** badge aparece apenas para raridades acima de comum, com os rótulos
`RARO`, `ÉPICO` e `LENDÁRIO` seguindo o estilo transcrito de `RARO` (68×32,
`bg-primary`, 13px medium em `ink`). Largura passa a ser por conteúdo, já que
"LENDÁRIO" não cabe em 68px. Registrar em `ARCHITECTURE.md`.

## OQ5 — Hero mobile — node `70395:240`, extraído agora

366×190, `rounded-[12px]`, `p-[16px]`. **Não é o hero desktop reescalado.**

| Parte | Especificação |
| --- | --- |
| Fundo | SVG de máscara com gradiente e dois círculos decorativos, cobrindo 366×190 |
| Sobretítulo | "Bem-vindo à Kurio" — 12px medium, `leading-[16px]`, `foreground` |
| Título | "SEJA DONO DA" / "CULTURA DIGITAL" — 18px bold, `leading-[29px]`, largura 190 |
| Texto | "Descubra NFTs selecionados de criadores do mundo todo." — 12px regular, `leading-[18px]`, `text-secondary` |
| CTA | "EXPLORAR" + seta 16px — **link, não botão preenchido** — 12px bold, `leading-[14px]`, `text-accent`, gap 8 |
| Artes | Duas sobrepostas: 138×138 e 58×58, ambas `rounded-[16px]`; a menor deslocada `ml-[14px] mt-[88px]` |
| Pontos | 33×7, abaixo do bloco (gap 16) |

O gradiente do fundo é um SVG exportado. Reproduzir com CSS a partir dos tokens
(`primary` a baixa opacidade sobre `surface-card`) e registrar como aproximação —
ou pedir extração do SVG se a fidelidade não bastar.

## OQ6 — Pontos do hero: não há segundo slide

Desktop tem 3 pontos (40×8), mobile tem 33×7. Mas **existe um único conteúdo de
hero em cada frame** — não há slides 2 e 3 desenhados em lugar nenhum.

**Decisão: decoração estática, `aria-hidden`.** Construir carrossel exigiria
inventar dois slides que o design não tem, e um carrossel com um slide só é pior
que nenhum. Registrar em `ARCHITECTURE.md`.
