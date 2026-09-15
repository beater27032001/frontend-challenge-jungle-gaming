# Fase 4 — Detalhes do NFT

> **Fonte de verdade visual.** Extraída do Figma e transcrita aqui — os agentes do
> pipeline não têm acesso ao MCP. **Não invente nem estime medida, cor ou copy.**
> Complementa `specs/02-design-system.md` e `specs/03-catalogo.md`.
>
> ⚠️ **Esta transcrição está INCOMPLETA.** Bati no limite de chamadas do MCP do
> Figma (plano Starter) antes de extrair o mobile. O que está marcado
> `[EXTRAÇÃO PENDENTE]` não pode ser implementado por estimativa — veja §5.

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

`[EXTRAÇÃO PENDENTE]` medidas internas dos cards do carrossel.

## 4. Mobile — node `15:5536`, estrutura confirmada por metadata + screenshot

**Não é o desktop reescalado**, como em todas as fases anteriores. São três
camadas sobrepostas:

| Camada | Node | Geometria |
| --- | --- | --- |
| Hero | `70396:241` | 414×506, arte com pontos de carrossel em `y=365` (56×7) |
| Details Sheet | `70396:242` | 414×504, começa em **y=392** — sobrepõe o hero |
| Buy Bar | `70396:245` | 414×164, fixa em **y=732** |

Do screenshot, confirmado visualmente:

- Seta de voltar e coração de favoritar **flutuam sobre a arte**, em botões
  circulares nos cantos superiores.
- A avaliação vira um **pill compacto** `★ 4.8(19)` à direita do título — o
  desktop usa 5 estrelas e texto por extenso.
- "Edição:" com os mesmos chips do desktop (`1/10`, `1/10`, `1/50` selecionado,
  `ABERTA`).
- Metadados em três linhas, iguais às do desktop.
- Buy Bar: rótulo "Qtd." + stepper `−` `1` `+` à esquerda, preço `1.19 ETH` à
  direita, e abaixo o botão "Comprar NFT" com um botão de carrinho ao lado.

`[EXTRAÇÃO PENDENTE]` — **não implementar por estimativa**:

1. Medidas internas do `Details Sheet` (`70396:242`): raio do topo, padding,
   gaps, e a geometria do pill de avaliação.
2. Medidas do `Buy Bar` (`70396:245`): alturas, larguras dos dois botões,
   tamanho do stepper, e se há borda ou sombra separando do conteúdo.
3. Geometria dos botões flutuantes de voltar e favoritar.
4. Gradiente de fundo do hero mobile.

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
