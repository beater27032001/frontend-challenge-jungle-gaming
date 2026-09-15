# KURIO — Marketplace de NFTs

Resposta ao desafio técnico de frontend descrito em [`docs/CHALLENGE.md`](docs/CHALLENGE.md):
um marketplace de NFTs com descoberta, compra e conta do colecionador, em desktop e mobile,
rodando inteiramente contra dados simulados na camada de rede.

A stack é a obrigatória do §2 do desafio: **React 19 · TypeScript · TanStack Router ·
TanStack Query · Axios · Socket.IO · Tailwind CSS v4 · shadcn/ui · MSW · Playwright ·
Lighthouse**, com Vite como build e pnpm como gerenciador.

- **Deploy público:** `TODO: preencher a URL da Vercel` — o `vercel.json` (SPA rewrite +
  headers do service worker do MSW) já está no repositório, mas a URL ainda não foi
  publicada.
- **Decisões, desvios do Figma e limitações detalhadas:** [`ARCHITECTURE.md`](ARCHITECTURE.md).
- **Plano de fases e estado da entrega:** [`specs/00-plano.md`](specs/00-plano.md) e a seção
  [Estado da entrega](#estado-da-entrega) abaixo.

---

## Setup

Requisitos fixados em `package.json`: **Node >= 22** e **pnpm 10.10.0**
(`packageManager`, então o Corepack usa a versão certa automaticamente).

```bash
git clone <url-do-repositorio>
cd frontend-challenge-jungle-gaming
cp .env.example .env     # opcional: os defaults do .env.example já são os de demonstração
pnpm install
pnpm dev                 # http://localhost:5173, com mocks ligados
```

Não há serviço externo, backend ou credencial privada: o checkout limpo roda sozinho.

## Variáveis de ambiente

Todas vêm de `.env.example`, e os valores de lá são exatamente os usados em dev, preview e
no build de demonstração.

| Variável | Default | O que faz |
| --- | --- | --- |
| `VITE_ENABLE_MSW` | `true` | Liga a camada de mocks. É o único interruptor: `src/mocks/index.ts` lê `import.meta.env.VITE_ENABLE_MSW !== 'false'`. Só com `false` o app passa a falar com um backend real. |
| `VITE_API_BASE_URL` | `/api` | Base do Axios (`src/lib/api.ts`). Relativa de propósito, para o service worker do MSW interceptar igual em dev, preview e deploy. |
| `VITE_SOCKET_URL` | `/` | Endpoint do Socket.IO servido pelo binding MSW (`@mswjs/socket.io-binding`). |

Os mocks são **ativados por configuração e vão ligados no build de demonstração**, como o §6
do desafio exige: são carregados por `import()` dinâmico, então o bundle do MSW (~400 kB)
fica fora do chunk principal e nem é baixado quando `VITE_ENABLE_MSW=false`.

## Credenciais fictícias

Dois usuários semeados em `src/mocks/fixtures.ts`. O banco de mock guarda apenas
`sha256(salt + senha)`; as senhas em claro existem só como comentário na fixture, para quem
precisa entrar.

| Usuário | E-mail | Senha | Estado semeado |
| --- | --- | --- | --- |
| Ana Volt | `ana@greenmint.dev` | `GreenMint#1` | 3 favoritos, 2 itens no carrinho, 1 pedido confirmado, 2 carteiras (Ethereum principal + Polygon) |
| Bruno Chain | `bruno@greenmint.dev` | `GreenMint#2` | 1 favorito, carrinho vazio, 1 carteira |


> **Sobre o domínio `@greenmint.dev`**: a marca do produto é **KURIO**, como o
> wordmark do Figma mostra. "GreenMint" foi o nome usado internamente na fase 0,
> antes de a identidade real ser extraída do arquivo de design, e sobreviveu nos
> e-mails das fixtures e nas chaves de `localStorage` (`greenmint:db:v1`,
> `greenmint:scenario`). São identificadores internos: renomeá-los exigiria subir
> o `SEED_VERSION` e ajustar dezenas de asserções de teste, sem ganho visível.
> Tudo que o usuário vê diz KURIO.
Cupons da fixture: `GREEN10` (10% válido) e `EXPIRED20` (20%, expirado — serve para o fluxo
de cupom inválido).

> A tela de login/cadastro é a fase 5, em andamento. Hoje as credenciais são usadas via
> `POST /api/auth/login` (é o que a suíte E2E faz, ver `e2e/helpers.ts`).

## Cenários de mock

O motor de cenários mora em `src/mocks/scenarios.ts` e envolve **toda** rota `/api/*` exceto
`/api/health` (deixada de fora justamente para ser alcançável em qualquer cenário de falha).
O cenário ativo é persistido em `localStorage`, então sobrevive a refresh.

### Como selecionar

Três formas, todas equivalentes:

1. **Pela URL** (consumida uma vez e removida do endereço via `history.replaceState`, para um
   refresh na mesma URL não repetir):
   ```
   http://localhost:5173/?mock-scenario=slow
   ```
2. **Pelo console do navegador**, sem recarregar:
   ```js
   window.__mocks.setScenario('server-error')
   window.__mocks.getScenario()   // cenário ativo
   window.__mocks.scenarios       // os 13 nomes válidos
   ```
3. **No Playwright**, antes da primeira navegação:
   ```ts
   await page.addInitScript(() => localStorage.setItem('greenmint:scenario', 'offline'))
   // ou, já com a página aberta, o helper do projeto:
   await setScenario(page, 'offline')   // e2e/helpers.ts
   ```

### Como resetar

O reset restaura **integralmente** a fixture inicial (usuários, NFTs, favoritos, carrinhos,
pedidos, cupons, contadores):

- `http://localhost:5173/?mock-reset=1` — param de boot, também de uso único;
- `window.__mocks.reset()` — no console;
- `bootReset(page)` — nos testes (`e2e/helpers.ts`).

Trocar de cenário também zera os contadores internos de `out-of-order` e `flaky`. Voltar ao
comportamento normal é `setScenario('default')`.

### Os 13 cenários

| Cenário | O que faz |
| --- | --- |
| `default` | Sucesso. Latência semeada de 150–350 ms (PRNG determinístico, sem `Math.random`); pagamento confirma. |
| `empty` | `GET /api/nfts` responde lista vazia (`total: 0`); o resto segue normal. |
| `slow` | 2500 ms fixos em toda rota — é o cenário dos skeletons. |
| `out-of-order` | 1ª chamada da página: 1500 ms; as seguintes: 100 ms. Produz resposta obsoleta chegando depois da atual. |
| `offline` | Toda rota `/api` (exceto `/api/health`) falha como erro de conexão (`HttpResponse.error()`). |
| `server-error` | Toda rota responde 500 `{ code: 'transient' }`. |
| `flaky` | A 1ª chamada de cada par rota+método responde 503 `transient`; a repetição sucede. |
| `session-expired` | Toda rota autenticada (incluindo `GET /api/auth/session`) responde 401 `session_expired`. |
| `register-conflict` | `POST /api/auth/register` responde 409 `email_taken` incondicionalmente. |
| `price-changed` | `POST /api/orders`: sobe 10% no preço da 1ª edição cotada → 409 `quote_outdated`. |
| `sold-out` | `POST /api/orders`: zera o `available` da 1ª edição cotada → 409 `availability_conflict`. |
| `order-timeout` | `POST /api/orders`: a 1ª tentativa por `Idempotency-Key` falha como erro de rede; a repetição com a mesma chave recupera o mesmo pedido. |
| `payment-declined` | Pedidos resolvem para `declined` em vez de `confirmed`. |

## Reproduzindo os fluxos de falha

Roteiro para quem nunca abriu o projeto. Em todos os casos: `pnpm dev`, e a base é
`http://localhost:5173`. Sempre que quiser voltar ao estado limpo, abra
`http://localhost:5173/?mock-reset=1` e rode `window.__mocks.setScenario('default')`.

As telas entregues hoje são **Início/catálogo** (`/`) e **Detalhes do NFT**
(`/nft/nft-001`). Os cenários cujo ponto de entrada na interface pertence a uma fase ainda
não entregue (carrinho, checkout, login) estão marcados abaixo com a rota REST pela qual
reproduzi-los — cada um tem cobertura executável em `e2e/api-contracts.spec.ts`.

### Carregamento lento e skeletons — `slow`

1. Abra `http://localhost:5173/?mock-scenario=slow`.
2. **Esperado:** os cards do catálogo aparecem como skeletons com shimmer, preservando as
   dimensões finais (sem salto de layout), por ~2,5 s; depois o conteúdo real entra.
3. Navegue para um NFT e recarregue com `/nft/nft-001` — a galeria, os metadados e a barra de
   compra também nascem em skeleton.
4. Com `prefers-reduced-motion: reduce` ativo no sistema, o shimmer não anima (tratado
   globalmente em `src/index.css`).

### Resultado vazio — `empty`

1. Abra `http://localhost:5173/?mock-scenario=empty`.
2. **Esperado:** o grid mostra o estado vazio com o título **"Nenhum NFT encontrado"**, e a
   região `aria-live` do grid anuncia o mesmo texto. Não é erro: filtros e busca continuam
   operáveis.

### Falha de conexão — `offline`

1. Abra `http://localhost:5173/?mock-scenario=offline`.
2. **Esperado:** o catálogo mostra **"Não foi possível carregar o catálogo."** com o botão
   **"Tentar novamente"**. Nada de tela branca, nada de spinner infinito.
3. No console, volte ao normal (`window.__mocks.setScenario('default')`) e clique em
   **Tentar novamente**: o grid carrega — é o caminho de recuperação.
4. Em `/nft/nft-001` o equivalente é **"Não foi possível carregar este NFT."** + **"Tentar
   novamente"**.

### Erro HTTP 5xx — `server-error`

1. Abra `http://localhost:5173/?mock-scenario=server-error`.
2. **Esperado:** mesmo tratamento do `offline` (mensagem de erro + retry). A diferença é o
   que o app recebeu: 500 com corpo `{ error: { code: 'transient' } }`.
3. O Query está configurado com `retry: 1` em queries (`src/lib/query.ts`), então há uma
   tentativa automática antes de o estado de erro aparecer.

### Falha transitória com recuperação — `flaky`

1. Abra `http://localhost:5173/?mock-scenario=flaky`.
2. **Esperado:** o catálogo carrega **normalmente**, apesar de a primeira chamada de cada
   rota ter respondido 503 — é a retentativa do Query fazendo o trabalho. O 503 fica visível
   na aba Network do DevTools.
3. É o cenário para distinguir "falha permanente" de "falha transitória": em `server-error` a
   interface para no erro, aqui ela se recupera sozinha.

### Resposta fora de ordem — `out-of-order`

1. Abra `http://localhost:5173/?mock-scenario=out-of-order`.
2. Assim que a página aparecer, **aplique um filtro** (por exemplo uma categoria na sidebar,
   ou o filtro mobile no `Sheet`) e em seguida **troque para outro** rapidamente.
3. **Esperado:** quando a primeira resposta (a de 1500 ms) finalmente chega, ela é
   **descartada** — o grid continua mostrando o resultado do filtro atual, e o título do
   filtro abandonado não reaparece. A URL e o grid nunca divergem.

### Sessão expirada / acesso não autorizado — `session-expired`

1. Abra `http://localhost:5173/?mock-scenario=session-expired` e vá para `/nft/nft-001`.
2. Clique em **Comprar** (adiciona ao carrinho via `POST /api/cart/items`).
3. **Esperado:** um toast de erro com a mensagem vinda da API — nenhum sucesso otimista. A
   regra do projeto é que nada é confirmado antes da resposta do mock.
4. No nível REST: `GET /api/auth/session` e qualquer rota autenticada respondem 401
   `session_expired`. A tela de login e a retomada do fluxo após reautenticar são da fase 5.

### Conflito de cadastro — `register-conflict`

Ponto de entrada na interface: tela de cadastro (fase 5, em andamento). Hoje:

```js
window.__mocks.setScenario('register-conflict')
await fetch('/api/auth/register', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ name: 'Nova', email: 'nova@kurio.dev', password: 'Senha#123' }),
}).then((r) => r.status)   // 409, code 'email_taken'
```

### Cupom inválido ou expirado

Não depende de cenário: está na fixture. `POST /api/quote` com `couponCode: 'EXPIRED20'`
responde 400 `coupon_expired`, e um código inexistente responde 400 `coupon_invalid`;
`GREEN10` aplica 10% de desconto. A interface do cupom é a fase 6.

### Preço alterado durante a compra — `price-changed`

1. `window.__mocks.setScenario('price-changed')`.
2. Cote e tente criar o pedido (`POST /api/quote` e depois `POST /api/orders`).
3. **Esperado:** 409 `quote_outdated` — a cotação usada não vale mais, porque o preço da
   edição subiu 10% entre a cotação e a criação do pedido. A tela de pagamento que exibe isso
   e pede nova confirmação é a fase 7.

### Edição esgotada durante a compra — `sold-out`

Igual ao anterior, com `sold-out`: `POST /api/orders` responde 409
`availability_conflict` porque o `available` da edição cotada foi a zero. O NFT `nft-013` já
nasce esgotado na fixture, e `nft-007`/`nft-021` nascem com 2 e 1 unidades — úteis para
exercitar limite de quantidade no detalhe, sem cenário nenhum.

### Timeout após criar o pedido, com recuperação por idempotência — `order-timeout`

1. `window.__mocks.setScenario('order-timeout')`.
2. Envie `POST /api/orders` com um header `Idempotency-Key` seu.
3. **Esperado:** a primeira tentativa falha como erro de rede (o cliente não sabe se o pedido
   nasceu). **Repita a mesma chamada com a mesma `Idempotency-Key`:** a resposta traz **o
   mesmo pedido**, não um segundo. É o que impede pedido duplicado por clique repetido ou
   reenvio.

### Pagamento recusado — `payment-declined`

`window.__mocks.setScenario('payment-declined')` e crie um pedido: ele resolve para
`status: 'declined'` em vez de `confirmed`. A tela de confirmação com o resultado recusado é a
fase 7.

## Comandos

| Comando | O que faz |
| --- | --- |
| `pnpm dev` | Vite em modo dev, com mocks ligados. |
| `pnpm build` | `tsr generate && tsc -b && vite build`. |
| `pnpm preview` | Serve o build (é o alvo da suíte Playwright, porta 4173). |
| `pnpm typecheck` | Gera a árvore de rotas e checa tipos sem emitir. |
| `pnpm lint` | oxlint. |
| `pnpm test` | Playwright em `desktop-chromium` (1440×900) e `mobile-chromium` (Pixel 7, 390×844). Sobe `pnpm build && pnpm preview` sozinho. |
| `pnpm test:ui` | Playwright em modo UI. |
| `pnpm test:report` | Abre o relatório HTML da última rodada. |
| `pnpm test:update-snapshots` | Regrava as baselines visuais. |
| `pnpm routes` | Regera `src/routeTree.gen.ts`. |

Auditoria Lighthouse: **ainda sem comando próprio** — é a fase 11 (ver
[Limitações](#limitações-conhecidas)).

## Estrutura

```
src/
  routes/      rotas file-based do TanStack Router (routeTree.gen.ts é gerado)
  features/    um diretório por domínio: nft, cart, auth, checkout, profile, wallets
  components/  ui/ = shadcn adaptado à identidade; resto = compartilhado entre features
  lib/         api.ts (axios), query.ts (queryClient), money.ts (big.js), utils.ts
  mocks/       MSW: handlers, db em memória + persistência, fixtures, cenários, controles
  types/       contratos REST e payloads de evento
e2e/           specs Playwright + helpers + baselines visuais
specs/         plano de fases e a spec de cada fase
docs/          CHALLENGE.md (o enunciado original)
```

Convenções que valem a leitura antes de mexer: todo REST passa por `src/lib/api.ts`; valores
em ETH são `string` decimal com aritmética em `big.js` (nunca `number`); busca, filtro,
ordenação e paginação moram na URL via `validateSearch`; query keys incluem o usuário e os
parâmetros da consulta. Nenhum dado fictício vive fora de `src/mocks/`.

## Limitações conhecidas

Registro honesto; o detalhamento de cada decisão está em `ARCHITECTURE.md`.

- **Flake residual na suíte E2E.** `pnpm test` roda 380 testes (desktop + mobile) e passa em
  cerca de **3 de cada 4 rodadas completas** sob paralelismo padrão. O que resta é
  **infraestrutura de teste, não código de aplicação**: a fonte conhecida é uma tolerância de
  tempo de parede em `e2e/runtime-behavior.spec.ts:118` (assere que o cenário `slow` demora
  ~2500 ms com teto de 3500 ms), apertada quando a máquina está sob carga. Com
  `pnpm test -- --workers=1` a suíte passa de forma consistente. Três famílias de flake
  anteriores foram diagnosticadas e corrigidas na causa raiz (itens 20 a 22 do
  `ARCHITECTURE.md`); esta não foi perseguida até 100% por decisão de prazo — o conserto é
  asserir só o piso da latência.
- **Regressão visual não feita.** Não há baselines versionadas de início, detalhe, carrinho e
  pagamento (§9 do desafio). A infraestrutura está pronta (`snapshotPathTemplate`,
  `maxDiffPixelRatio: 0.01`, `pnpm test:update-snapshots`), mas as capturas ficaram de fora
  por decisão de prazo. É a fase 10.
- **Auditoria Lighthouse não feita.** Sem medições, sem métricas reportadas e sem comando de
  auditoria — decisão de prazo, fase 11.
- **Antes de cada rodada de `pnpm test`, mate processos na porta 4173.** `vite preview`
  esquecido de rodadas anteriores contamina a medição: já produziu 25 falhas espúrias em
  arquivos não relacionados.
- **Desvios do Figma e placeholders.** Vários itens de extração fina (offsets, um gradiente de
  hero aproximado em CSS, ícones de marca substituídos por glifos genéricos do lucide v1,
  e-mail/telefone do footer) estão listados um a um no `ARCHITECTURE.md`. O tema é
  **dark-only**: o Figma não tem versão clara, e não existe toggle.
- **Footer é desktop-only**, como o próprio frame mobile mostra; a função equivalente
  (filtrar por coleção) existe no mobile pelo `Sheet` de filtros.
- **Transporte de tempo real.** O Socket.IO roda sobre `@mswjs/socket.io-binding` — um binding
  do protocolo dentro do service worker, não um servidor Socket.IO real. Reconexão e
  transporte se comportam como o binding define, não como um servidor de produção.

## Estado da entrega

O trabalho é feito uma fase por vez (`specs/00-plano.md`), cada uma revisada e mergeada por
PR para `dev`. Histórico das entregas em `.pipeline/history/LOG.md`.

| # | Fase | Estado |
| --- | --- | --- |
| 0 | Fundação (Vite, Router, Query, Axios, MSW, tokens) | entregue |
| 1 | Contratos REST + camada MSW (fixtures, db, 13 cenários) | entregue |
| 2 | Design system (shadcn adaptado, shell responsivo) | entregue |
| 3 | Início / catálogo (busca, filtros, ordenação, paginação na URL) | entregue |
| 4 | Detalhes do NFT (galeria, edição, quantidade, compra) | entregue |
| 5 | Conta e sessão (login, cadastro, logout, rotas privadas) | **em andamento** |
| 6 | Carrinho | a fazer |
| 7 | Checkout + confirmação | a fazer |
| 8 | Perfil + carteiras | a fazer |
| 9 | Tempo real (`nft.updated`, `order.updated`) | **em andamento** |
| 10 | Testes E2E completos + regressão visual | a fazer |
| 11 | Acessibilidade + Lighthouse | a fazer |
| 12 | Deploy + documentação | em andamento (este README; URL pública pendente) |

O que já está de pé e pode ser avaliado hoje: os **13 cenários de mock** com seleção e reset,
os contratos REST completos de §5 (catálogo, favoritos, carrinho, cotação, pedidos, perfil,
carteiras, auth), o **catálogo** com estado na URL sobrevivendo a refresh e histórico, o
**detalhe do NFT** com acesso direto, 404, edição indisponível e limite de quantidade, e a
suíte Playwright em desktop e mobile cobrindo esses fluxos mais os contratos REST.

Favoritos com atualização otimista e rollback dependem de sessão (fase 5): o controle existe
no detalhe, `disabled`, e entra junto do login — não há favoritar de fachada.
