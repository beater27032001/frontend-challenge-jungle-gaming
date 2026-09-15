# Fase 7 — Pagamento e confirmação

> **Fonte de verdade visual.** Extraída do Figma e transcrita aqui — os agentes do
> pipeline não têm acesso ao MCP. **Não invente medida, cor ou copy.**

Figma `BliVZDosX5BcSpvhYvdE0V`. Pagamento `11:2862` · Confirmação `11:4385` ·
mobile `16:748`.

**Esta é a fase mais eliminatória do desafio.** O §11 reprova "compra confirmada
sem resposta da simulação" e "fluxos principais apenas visuais".

---

## 1. Estrutura: confirmação é um MODAL sobre o pagamento

Os dois frames compartilham a **mesma** `Checkout Page` (`70504:3190`). A
confirmação é o modal `70376:239` (578×821) por cima. Não são duas rotas.

Isso casa com o §3: *"exibir a confirmação somente para pedido efetivamente
confirmado na simulação"* — o modal só monta quando a API confirma.

## 2. Página de pagamento — `70504:3190`, 1200, `gap-[32px]`

Breadcrumb **"Início / Mercado / Pagamento"**, 15px bold. Header com "Mercado"
ativo. Duas colunas, `gap-[32px]`: formulário (flex-1) e "Seus NFTs" (405).

### Formulário — "Perfil do colecionador", 17px bold

Duas sub-colunas de largura igual, `gap-[24px]`, campos com `gap-[12px]`.
Todo campo: altura **40**, borda 1px `border-strong`, **`rounded-[3px]`**,
`pl-[12px]`; placeholder 14px em `secondary`; rótulo 15px `leading-[15px]` em
`foreground`, com **asterisco de obrigatório em 22px `text-coral`**.

| Coluna esquerda | Coluna direita |
| --- | --- |
| Nome de exibição | Nome de usuário |
| Rede *(select, "Selecione uma rede")* | Nome do perfil |
| Endereço da carteira *("Endereço 0x da carteira")* | ENS ou carteira secundária (opcional) |
| Tipo de carteira *(select, "Selecione uma carteira")* | Código de indicação |
| E-mail | Nome ENS *(select `.eth`, 78 de largura)* |

Abaixo: rádio **"Usar outra carteira?"** (15px) e textarea **"Observação do
colecionador (opcional)"**, 350×152, mesmo raio e borda.

### ⚠️ Tensão entre o design e o contrato — precisa de decisão

O contrato de pedido (`src/types/order.ts:15`) aceita **`payer: { name, email }`**
mais carteira e rede. Mas o formulário desenhado tem **nove campos**: nome de
exibição, nome de usuário, nome do perfil, código de indicação, nome ENS, ENS
secundária, observação…

A maioria **não tem para onde ir**. O §3 diz "validar os campos do layout", mas o
§11 reprova fluxo que aparenta funcionar sem backend.

Três saídas, e o Planner deve escolher e justificar:
1. Renderizar todos, validar todos, enviar só o que o contrato aceita — e registrar
   que os demais são de perfil, não de pedido.
2. Renderizar só o que o contrato usa — perde fidelidade.
3. Estender o contrato para aceitá-los — é o precedente das fases 2, 3 e 4
   (categorias, `network`, labels de edição), mas é o mais caro.

Havendo prazo curto, a **1** é a mais defensável: mantém o layout, valida como o §3
pede, e não inventa backend.

### Coluna "Seus NFTs" — 405

- Cabeçalho **NFTs / Subtotal**, 16px, com régua
- Itens de **70** de altura, `bg-surface-card`: arte 70×70 `rounded-[8px]`, título
  16px bold, ID do token 14px em `secondary`, quantidade `(x N)` 14px em
  `text-secondary`, subtotal **18px bold em `text-accent`**
- "Tem um código promocional? Aplique aqui" — 14px centralizado
- Subtotal / Desconto do lançamento / Taxa de rede — rótulo 15px, valor 18px; e
  **"Taxa estimada"** em 12px `text-accent` centralizado
- Régua, depois **Total**: 16px bold + 18px bold em `text-accent`

### "Carteira e rede" — 17px bold centralizado, `gap-[20px]`

Três opções de 45 de altura, `rounded-[3px]`, cada uma com rádio de 16px:
1. chip `METAMASK • WALLETCONNECT • COINBASE` (`bg-surface-dark`, borda
   `border-soft`, `rounded-[6px]`, 9px bold em `text-accent`)
2. "MetaMask" — 15px
3. "Coinbase Wallet" — **selecionada**, borda `primary`, com logo de 39×16

Botão **"Confirmar compra"**: 45 de altura, largura total, `bg-primary`,
**`rounded-[8px]`**, 15px bold em `ink`.

## 3. Modal de confirmação — `70376:239`, 578×821, `bg-surface-card`

- **Cabeçalho** (156, centralizado, `gap-[16px]`): ilustração 80×80 + **"Seus NFTs
  agora estão na sua carteira"**, 16px bold em `text-secondary`
- Régua de 1px em `primary`
- **Meta da transação** (65, `px-[36px]`), quatro blocos separados por réguas
  verticais de 31px, todos em `text-secondary` — rótulo 14px, valor 15px:
  **ID da transação** (`0xA91F…E82C`) · **Data** · **Total** · **Carteira**
- Régua de 1px em `primary`
- **Detalhes da transação** (`pt-[20px] pb-[48px] px-[44px]`): cabeçalho
  NFTs / Edições / Subtotal com `gap-[48px]`; itens de 70 com arte `rounded-[8px]`,
  `(x N)` e subtotal 18px em `text-accent`
- **Totais** (321 de largura): Taxa de rede e Total
- **Nota de rodapé**, 14px `leading-[22px]` em `text-secondary`, centralizada:
  "Transação confirmada na Ethereum. A propriedade foi transferida para sua
  carteira conectada e registrada na rede."
- Botão **"Ver no Etherscan"**: `bg-primary`, `p-[16px]`, `rounded-[5px]`, 16px bold
- Barra de 10px em `primary` no rodapé; `X` de fechar no canto

**O link do Etherscan é simulado** — o §3 diz que referências de transação e links
de exploração são simulados. Não pode abrir URL falsa que aparente ser real.

## 4. Comportamento — §3, e é aqui que a fase é ganha ou perdida

- **Revalidar preço, disponibilidade, cupom e taxas antes de confirmar.** Mudança
  exige **nova confirmação do usuário**.
- **Impedir pedido duplicado** em clique repetido e em reenvio após timeout. A
  chave de idempotência já existe no contrato e tem teste desde a fase 1: mesma
  chave devolve o mesmo pedido; mesma chave com body diferente devolve 409.
- **Pedido pendente, confirmado e recusado**, com recuperação após refresh ou
  reconexão. Confirmados e recusados são terminais.
- **Confirmação só para pedido efetivamente confirmado** pela simulação.
- **Preservar itens em falha**; após confirmação, remover do carrinho **apenas os
  itens e quantidades comprados**.
- **O recibo é snapshot imutável** — `Order.items` já é cópia da cotação e nunca
  relê o catálogo (`src/types/order.ts:23`). Alteração posterior no catálogo não
  pode mudar o recibo.
- **A cotação da API é a referência**; ETH em string decimal com `big.js`.

## 5. Cenários do MSW que esta fase deve exercitar

Existem desde a fase 1 e **nunca tiveram consumidor real**:
`price-changed` · `sold-out` · `order-timeout` · `payment-declined`

O `order-timeout` é o mais importante: primeira tentativa falha como erro de rede,
e a recuperação por idempotência precisa devolver o **mesmo** pedido.

## 6. Pendência de extração

`[EXTRAÇÃO PENDENTE]` o mobile (`16:748`) não foi extraído, e a Confirmação **não
tem frame mobile** — o `CLAUDE.md` já registra que precisa funcionar mesmo assim,
derivando do padrão dos outros frames mobile.
