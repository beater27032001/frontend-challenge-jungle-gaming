# KURIO — Marketplace de NFTs

Resposta ao desafio técnico de frontend descrito em [`docs/CHALLENGE.md`](docs/CHALLENGE.md):
um marketplace de NFTs com descoberta, compra e conta do colecionador, em desktop e mobile,
rodando inteiramente contra dados simulados na camada de rede.

A stack é a obrigatória do §2 do desafio: **React 19 · TypeScript · TanStack Router ·
TanStack Query · Axios · Socket.IO · Tailwind CSS v4 · shadcn/ui · MSW · Playwright ·
Lighthouse**, com Vite como build e pnpm como gerenciador.

- **Deploy público:** <https://frontend-challenge-jungle-gaming.vercel.app/> — build da
  branch `main` pela integração com o GitHub. O `vercel.json` cuida do SPA rewrite (rota
  profunda como `/nft/nft-003` abre direto) e dos headers do service worker do MSW
  (`no-cache` + `Service-Worker-Allowed`), sem os quais os mocks não sobem em produção.

  > A URL serve o que estiver em `main`. Fases entregues mas ainda não mergeadas aparecem
  > aqui como entregues e **não** estarão no ar até o merge — rode local para vê-las.
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

> Entre por **Entrar** no header (desktop: modal sobre o catálogo; mobile: tela cheia em
> `/login`). Depois de autenticar você volta para a página de onde saiu.

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

Todas as telas do fluxo principal estão de pé: catálogo (`/`), detalhe (`/nft/nft-001`),
login e cadastro, carrinho (`/carrinho`), pagamento (`/pagamento`), perfil (`/perfil`) e
carteiras (`/carteiras`). Cada cenário abaixo traz o caminho pela tela; onde ainda citamos
a rota REST, é porque ela é a forma mais direta de provocar o estado, não porque falte
interface. Todos têm cobertura executável em `e2e/`.

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
   `session_expired`. Na interface, o interceptor do Axios detecta o `session_expired` uma
   vez por rajada (não um toast por query em voo) e leva ao login, de onde o `redirect`
   devolve à página de origem.

### Conflito de cadastro — `register-conflict`

Ponto de entrada na interface: **Entrar → Criar conta** e submeter com um e-mail já
cadastrado. O erro chega associado ao campo de e-mail, não só num toast. No nível REST:

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
`GREEN10` aplica 10% de desconto.

Na interface: adicione um NFT ao carrinho, abra **/carrinho** e use o campo de cupom do
resumo. O erro aparece associado ao campo. Subtotal, desconto, taxa de rede e total vêm
sempre de `POST /api/quote` — nunca de cálculo local.

### Preço alterado durante a compra — `price-changed`

1. Com itens no carrinho, vá para `/pagamento`.
2. `window.__mocks.setScenario('price-changed')`.
3. Clique em **Confirmar compra**.
4. **Esperado:** a compra **não** acontece. O preço da edição subiu 10% entre a cotação e o
   pedido, a API responde 409 `quote_outdated`, e a tela avisa e **bloqueia o confirmar** até
   você recotar. É o passo 4 do cenário obrigatório do §7 do desafio.

Para ver o aviso chegar **em tempo real**, sem recarregar, deixe `/pagamento` aberto e rode
`window.__mocks.realtime.editNftPrice('nft-003', '2.5')` noutra aba do console: o evento
`nft.updated` invalida a cotação e o confirmar trava sozinho.

### Edição esgotada durante a compra — `sold-out`

Igual ao anterior, com `sold-out`: o confirmar é bloqueado porque a API responde 409
`availability_conflict` — o `available` da edição cotada foi a zero. O NFT `nft-013` já
nasce esgotado na fixture, e `nft-007`/`nft-021` nascem com 2 e 1 unidades — úteis para
exercitar limite de quantidade no detalhe, sem cenário nenhum.

### Timeout após criar o pedido, com recuperação por idempotência — `order-timeout`

1. Em `/pagamento`, rode `window.__mocks.setScenario('order-timeout')`.
2. Clique em **Confirmar compra**. A primeira tentativa falha como erro de rede — o cliente
   não sabe se o pedido nasceu.
3. Clique em **Tentar novamente**.
4. **Esperado:** volta **o mesmo pedido**, não um segundo. A chave de idempotência é derivada
   da cotação e da carteira, não sorteada, então o reenvio é reconhecido. É o que impede
   pedido duplicado por clique repetido ou por reenvio após timeout.

No nível REST, o equivalente é repetir o `POST /api/orders` com a mesma `Idempotency-Key`.

### Pagamento recusado — `payment-declined`

Em `/pagamento`, rode `window.__mocks.setScenario('payment-declined')` e confirme a compra.
O pedido nasce `pending` e resolve para `declined` em vez de `confirmed` — **nenhuma
confirmação aparece**, porque a regra do projeto é que só pedido confirmado pela simulação
vira confirmação.

**Repare no carrinho depois:** os itens voltam, e o estoque também. A criação debita de
imediato (reserva otimista, que é o que impede dois pedidos concorrentes de levarem a mesma
edição), mas recusa é terminal e estorna — o §3 exige preservar os itens em falha. Se o
catálogo estiver aberto noutra aba, o estoque volta lá em tempo real, via `nft.updated`.

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
| `pnpm lighthouse` | Auditoria Lighthouse do **build de produção** (`pnpm build` + `pnpm preview` na 4173), em `/`, `/nft/nft-001`, `/carrinho` e `/perfil`, desktop e mobile. |

Os resultados do Lighthouse, com as limitações da medição, ficam em
[`docs/lighthouse.md`](docs/lighthouse.md) — regerado por `pnpm lighthouse`. Os JSON
crus vão para `lighthouse-reports/` (não versionado).

As baselines de regressão visual ficam em `e2e/__screenshots__/` e são geradas por
`e2e/visual.spec.ts` (7 telas × desktop 1440 e mobile 390). Regravar só com
`pnpm test:update-snapshots` e **olhando o diff** — baseline atualizada sem revisão
transforma regressão em novo normal.

## Estrutura

```
src/
  routes/      rotas file-based do TanStack Router (routeTree.gen.ts é gerado)
  features/    um diretório por domínio: nft, cart, auth, checkout, account, realtime
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

- **Rode a suíte com `--workers=1`.** São **564 testes** (desktop 1440 + mobile 390), e a
  última rodada completa deu **556 passed · 8 skipped · 0 failed**. Os 8 pulados são
  específicos de um breakpoint — geometria que só existe no frame mobile, por exemplo.

  Com paralelismo alto em máquina carregada, o `vite preview` é morto por pressão de memória
  (`Killed: 9`) e **todo** teste falha em seguida com `net::ERR_CONNECTION_REFUSED`. Isso não
  é flake de teste nem regressão: é o servidor morrendo. Provado por controle — a mesma
  revisão, sem alteração nenhuma, colapsou de 380/380 para 79/301 com a máquina sob carga.

  O flake residual conhecido é **1 falha em 1112 execuções** (`runtime-behavior.spec.ts:539`,
  só em desktop): `boot()` resolve quando o MSW responde, não quando o React montou o header.
  Caracterizado, não perseguido. Detalhes em `ARCHITECTURE.md`, "Limitação conhecida".

- **Regressão visual: 14 baselines, e dois pontos cegos conhecidos.** `e2e/visual.spec.ts`
  cobre início, detalhe, login, carrinho, pagamento, perfil e carteiras em 1440 e 390. O gate
  foi provado por mutação (trocar `--color-primary` de `#d28a4c` para `#4c8ad2`): **12 das 14
  acusaram**. As duas que não acusaram — carrinho e pagamento no mobile — passam porque o CTA
  dessas composições **fixa `#d28a4c` num gradiente inline** em vez de usar o token
  (`cart-mobile.tsx`, `checkout-mobile.tsx`, `nft-detail-mobile.tsx`, `account/fields.tsx`).
  A baseline está certa; é o token que está furado.
- **Lighthouse mede o app com o MSW dentro.** Os números de `docs/lighthouse.md` são de um
  bundle que carrega service worker, handlers e fixtures em produção, porque a demo não tem
  backend. Mobile fica na casa dos **80** por causa disso; desktop, 95–99. O run de `/perfil`
  usa perfil semeado + `--disable-storage-reset` (sessão exige cookie), o que também deixa o
  cache quente: não é comparável com os outros.

- **Antes de cada rodada de `pnpm test`, mate processos na porta 4173.** `vite preview`
  esquecido de rodadas anteriores contamina a medição: já produziu 25 falhas espúrias em
  arquivos não relacionados.
- **As seções do fim da home foram medidas por captura, não extraídas.** Os cards
  promocionais e o "Diário da Cunhagem" foram construídos a partir de captura de tela do
  Figma, porque a cota do MCP de design estourou. Proporções e escala seguem a régua do
  catálogo (gap 56, raio 14, arte quadrada). Nada ali finge navegar: "Explorar" leva ao
  catálogo e "Ler mais" é texto inerte, não link.
- **Cinco defeitos visuais da entrega vieram de lacunas na transcrição do Figma**, não de erro
  de implementação — alinhamento, cor de texto e uma seção inteira que o spec mandava omitir.
  O padrão e o que aprender com ele estão em `ARCHITECTURE.md`, "O que a transcrição do Figma
  errou".
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
| 5 | Conta e sessão (login, cadastro, logout, favoritos) | entregue |
| 6 | Carrinho (quantidade, remoção, cupom, cotação) | entregue |
| 7 | Checkout + confirmação | entregue |
| 8 | Perfil + carteiras | entregue |
| 9 | Tempo real (`nft.updated`, `order.updated`) | entregue |
| 10 | Testes E2E completos + regressão visual | entregue (14 baselines) |
| 11 | Acessibilidade + Lighthouse | entregue (`docs/lighthouse.md`) |
| 12 | Deploy + documentação | entregue (este README + Vercel) |

O que já está de pé e pode ser avaliado hoje:

- os **13 cenários de mock**, com seleção e reset;
- os contratos REST completos do §5 — catálogo, favoritos, carrinho, cotação, pedidos,
  perfil, carteiras e auth;
- o **catálogo**, com busca, filtros, ordenação e paginação na URL, sobrevivendo a refresh
  e ao histórico;
- o **detalhe do NFT**, com acesso direto, 404, edição indisponível e limite de quantidade;
- **conta e sessão**: login, cadastro, logout, sessão expirada e retomada do fluxo, mais
  favoritos com atualização otimista e rollback;
- o **carrinho**: quantidade, remoção, cupom válido/inválido/expirado e cotação da API;
- o **checkout** (`/pagamento`): revalidação antes de confirmar, chave de idempotência
  derivada que impede pedido duplicado, os estados pendente/confirmado/recusado com
  recuperação após refresh, e a confirmação como modal sobre a própria página — só para
  pedido efetivamente confirmado pela simulação;
- **tempo real** pelo `socket.io-client`: `nft.updated` e `order.updated`, com guarda de
  versão, tolerância a duplicata e a evento antigo, e reconciliação após reconexão;
- o **perfil do colecionador** (`/perfil`) e as **carteiras** (`/carteiras`), rotas privadas
  protegidas no router: nome, nome de usuário (único, 409 associado ao campo), nome ENS,
  avatar e troca de senha; cadastro, edição, promoção a principal e remoção com confirmação
  de carteiras, com aviso de qual foi promovida ou rebaixada;
- a suíte **Playwright** em desktop (1440) e mobile (390) cobrindo tudo isso.

Todas as fases de fluxo estão entregues. O que fica de fora por decisão de prazo está em
**Limitações conhecidas**.
