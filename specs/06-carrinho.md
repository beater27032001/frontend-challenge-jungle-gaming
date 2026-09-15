# Fase 6 — Carrinho

> **Fonte de verdade visual.** Extraída do Figma e transcrita aqui — os agentes do
> pipeline não têm acesso ao MCP. **Não invente medida, cor ou copy.**
> Complementa `specs/02-design-system.md`.

Figma `BliVZDosX5BcSpvhYvdE0V`. Desktop `11:1278` · Mobile `16:360`.

---

## 1. Layout — node `70369:240` ("Cart Body"), 1200×388

Duas colunas, `justify-between`: tabela de itens à esquerda, **Resumo da carteira**
de 332 à direita.

Acima do Cart Body há um bloco de 244×16 em `y=0` (breadcrumb ou título de seção,
não extraído em detalhe).

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

## 6. Pendência de extração

`[EXTRAÇÃO PENDENTE]` o mobile (`16:360`) não foi extraído. Nas quatro fases
anteriores o mobile **nunca** foi o desktop reescalado — não derivar por analogia;
pedir extração antes de implementar.
