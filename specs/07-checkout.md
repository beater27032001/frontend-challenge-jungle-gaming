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

## 6. Mobile — `16:748` (414×896)

Extraído. Uma única coluna `Content` (`70398:239`, `x 28, y 32, 358×832`) com dois
filhos: o bloco de conteúdo (`70410:4218`, 358×605) e o **Confirm Button**
(`70398:249`, `y 772, 358×60`) — ou seja, há **107px de folga** entre o fim do
conteúdo e o botão. Não é barra fixa: é o último elemento da coluna.

Diferença estrutural relevante: **o mobile não tem formulário de pagamento**.
Onde o desktop pede nove campos, o mobile pede só a escolha de carteira. Isso
ajuda a resolver a tensão registrada na seção 3 — ver 6.6.

### 6.1 Screen Header — `70398:240` (358×44)

Idêntico ao do carrinho mobile: círculo 35×35 + `Arrow-Left 2` 20×20 em `+7,+7`.
Título "Pagamento com carteira" em `x 59, y 9`, **20px bold, lh 16**.

### 6.2 Barra "Carteira conectada" — `70304:365` (y 60, h 16)

`justify-between`. Esquerda "Carteira conectada" 16px bold `foreground`; direita
"Trocar carteira" **14px bold** `text-accent` — é ação, precisa ser `<button>`.

### 6.3 Wallet Cards — `70398:241` (y 92, gap 20)

Dois cards `358×93`, `bg surface-card`, **raio 14**.

| Elemento | Posição | Estilo |
| --- | --- | --- |
| Radio/indicador | `x 19, y 38–39, 16×16` | ver abaixo |
| Nome | `x 54, y 15–16` | 16px bold, `foreground` |
| Detalhe (2 linhas) | `x 54, y 38, w ~202` | 14px regular, **lh 22**, `text-secondary` |
| Menu `⋮` | `x 336, y 39, 3×15` | `Group 87`/`Group 88` |

- **Reserva** (`70398:242`): `nova.kurio.eth` / `Rede Polygon`. Indicador
  `Group 90` (não-selecionado). Tem sombra `0 20px 20px rgba(10,6,4,0.45)`.
- **Principal** (`70398:243`): `0xA91F…E82C` / `Rede principal Ethereum`.
  Indicador `Ellipse 46` (**selecionado**). Sem sombra.

⚠️ A sombra está no card **não-selecionado** e o selecionado é o plano. Contra a
intuição; transcrito como está. O estado selecionado se distingue pelo indicador,
não pela elevação — logo o indicador **não pode ser só cor**: usar `role="radio"`
+ `aria-checked` e um preenchimento visível, não um tom diferente do mesmo círculo.

### 6.4 Wallet Options — `70398:244` (y 314, 359 largura, gap 16)

Título "Carteira e rede" 16px bold. Três opções `359×65`, `bg surface-card`,
**raio 15**, cada uma com:

| Elemento | Posição | Estilo |
| --- | --- | --- |
| Avatar | `x 14, y 13, 40×40` | círculo (`Ellipse 44`) |
| Marca | `x ~27, y 24` | 14px bold, `text-accent` — glifo "W"/"M" |
| Nome | `x 65, y 25` | 14px regular, `foreground` |
| Indicador | `x 326, y 25, 16×16` | `Ellipse 45`/`43` selecionado; `Group 89` não |

- WalletConnect — sombra `0 0 20px`; marca "W"; **selecionado**
- MetaMask — sombra `0 0 20px`; marca "M"; **selecionado**
- Coinbase Wallet — sombra `0 0 40px`; ícone `Iconly/Curved/Wallet` 24×24 em
  `x 22, y 21`; **não selecionado**

⚠️ **Duas opções aparecem selecionadas ao mesmo tempo.** É erro de estado no
Figma, não multi-seleção. Implementar como radiogroup de seleção única.

⚠️ Os nós `16:918` (Frame) e `16:915` (Group 86, um `paypal 1`) estão
**`hidden="true"`** — resíduo de um desenho anterior com PayPal. Ignorar: este
fluxo é só carteira.

### 6.5 Total Row — `70398:248` (y 589, h 16)

`justify-end`, gap 28 entre label e valor: "Total:" 16px bold `foreground` e
`8.936 ETH` **18px bold `text-accent`**, alinhado à direita. Mesmo par do carrinho
mobile — e o **mesmo valor**, o que confirma que a cotação atravessa as duas telas.

### 6.6 Confirm Button — `70398:249` (y 772, 358×60)

Raio 40, "Confirmar compra" **15px bold** em `ink`, gradiente
`108.48deg, #d28a4c 3.96% → rgba(210,138,76,0.8) 121.97%` — praticamente o mesmo
do CTA do carrinho (108.86deg), com 15px em vez de 16px.

### 6.7 A tensão dos nove campos, resolvida pelo mobile

O mobile não coleta nome nem e-mail: coleta **carteira e rede**. Isso reforça a
recomendação já feita na seção 3 — renderizar e validar o que o desenho pede, e
enviar só `payer: { name, email }`, que é o que `src/types/order.ts:15` aceita.
No mobile, `payer` vem da sessão (fase 5), não de campo de formulário.

Decisão a confirmar antes de implementar: se o mobile é o comportamento canônico,
os nove campos do desktop são **supérfluos ao contrato** e viram campos de
apresentação. Alternativa honesta e mais barata: no mobile, seguir o desenho
exatamente; no desktop, manter os nove campos com validação real mas mapeando
apenas os dois que o contrato aceita.

### 6.8 Confirmação em mobile

**Não existe frame mobile.** O `CLAUDE.md` já registra que precisa funcionar.
Derivar do modal desktop (`70376:239`, 578×821) como folha inferior no padrão do
Payment Summary do carrinho mobile: `rounded-t-[40px]`, `bg surface-card`,
`pt-24 px-24 pb-36`. Registrar a derivação no ARCHITECTURE.md.
