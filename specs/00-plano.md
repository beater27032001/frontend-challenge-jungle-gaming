# Plano de entrega — GreenMint

Uma fase por vez, na branch `dev`, executada via `/pipeline`.
**Ao fim de cada fase: parar, mostrar o resultado, esperar validação, só então commitar.**

Cada fase referencia a seção do desafio (`docs/CHALLENGE.md`) que ela fecha.

| # | Fase | Seções do desafio | Estado |
| --- | --- | --- | --- |
| 0 | Fundação | §2 stack, §8 tokens | **aguardando validação** |
| 1 | Contratos + MSW | §5, §6 | a fazer |
| 2 | Design system | §8 | a fazer |
| 3 | Início / catálogo | §3 catálogo | a fazer |
| 4 | Detalhes do NFT | §3 detalhe | a fazer |
| 5 | Conta e sessão | §3 conta | a fazer |
| 6 | Carrinho | §3 carrinho | a fazer |
| 7 | Checkout + confirmação | §3 pagamento | a fazer |
| 8 | Perfil + carteiras | §3 perfil/carteiras | a fazer |
| 9 | Tempo real | §7 | a fazer |
| 10 | Testes E2E | §9 | a fazer |
| 11 | A11y + performance | §8, §10 | a fazer |
| 12 | Deploy + documentação | §12 | a fazer |

---

## Fase 0 — Fundação

Vite + React 19 + TS; Tailwind v4 com os tokens do Figma; shadcn/ui configurado;
TanStack Router file-based; TanStack Query; Axios único; MSW em chunk dinâmico;
Playwright em desktop 1440 e mobile 390; `.gitignore`, `.env.example`, `CLAUDE.md`.

**Pronto quando:** `pnpm build`, `pnpm typecheck` e `pnpm test` passam, e a tela de
smoke prova Router + Query + Axios + MSW + tokens ligados de ponta a ponta.

## Fase 1 — Contratos + MSW

Tipos de todos os recursos de §5 em `src/types/`. Banco em memória com persistência
local, fixtures com ≥2 usuários e volume suficiente para exercitar filtro e paginação.
Handlers REST completos. Motor de cenários configurável cobrindo a lista de §6:
latência variável, resposta fora de ordem, falha de conexão, 4xx/5xx, sessão expirada,
conflito de cadastro, cupom inválido/expirado, preço alterado, edição esgotada,
timeout pós-criação com recuperação por idempotência, pagamento confirmado e recusado.
Reset restaura integralmente o cenário conhecido.

**Pronto quando:** cada cenário é selecionável e reprodutível, e o reset devolve o
estado inicial exato.

## Fase 2 — Design system

Componentes shadcn/ui adaptados à identidade: button, input, select, dialog, drawer,
skeleton, badge, card, form, toast. Shell de layout com header, footer e navegação
responsiva. Skeleton com shimmer que preserva dimensão. Calibrar raios e espaçamentos
reais por `get_design_context`.

**Pronto quando:** os primitivos batem com o Figma em 390, 768 e 1440.

## Fase 3 — Início / catálogo

Destaques, catálogo, busca, filtros combináveis, ordenação, paginação — tudo na URL,
sobrevivendo a refresh e histórico. Mudança de filtro reinicia a paginação. Estados de
vazio, erro e carregamento. Descarte de resposta obsoleta.

## Fase 4 — Detalhes do NFT

Galeria, informações, edição, quantidade, favoritos, compra. Acesso direto, NFT
inexistente, edição indisponível, limite de quantidade. Favoritos persistem para o
usuário autenticado — **é aqui que entra a atualização otimista com rollback** exigida
por §4.

## Fase 5 — Conta e sessão

Login, cadastro, logout, sessão recuperável após refresh. Rotas privadas protegidas
pelo Router. Expiração durante navegação e durante checkout, preservando contexto para
retomada. Logout limpa cache privado e subscriptions.

## Fase 6 — Carrinho

Adicionar, alterar, remover respeitando disponibilidade por NFT e edição. Persistência
após refresh. Merge do carrinho do visitante ao autenticar. Cupom com código inválido
ou expirado. Subtotal, desconto, taxa de rede e total vindos da API.

## Fase 7 — Checkout + confirmação

Validação dos campos, seleção de carteira e rede, simulação de conexão/recusa/
desconexão. Revalidação de preço, disponibilidade, cupom e taxas antes de confirmar;
mudança exige nova confirmação. Chave de idempotência bloqueando pedido duplicado em
clique repetido e em reenvio após timeout. Pedido pendente, confirmado e recusado, com
recuperação após refresh. Recibo é snapshot imutável.

## Fase 8 — Perfil + carteiras

Edição de dados, avatar, troca de senha. Carteiras principal e secundária. Validação
de formulário e de erro vindo da API. Alteração confirmada permanece após refresh.

Transcrição do Figma em `specs/08-perfil-carteiras.md`. Nenhuma das duas telas tem
frame mobile: a derivação está na seção 5 do spec. Três decisões de escopo esperam
o usuário (itens de menu sem tela, campos desenhados fora do contrato, `DELETE
/api/wallets/:id`).

## Fase 9 — Tempo real

`nft.updated` e `order.updated` via socket.io-client contra o binding MSW. Identidade
estável, recurso afetado e versão. Tolerar duplicata e evento antigo sem regredir
estado mais recente. Reconciliar com REST após reconexão. Liberar listeners no fim do
ciclo de vida. Cenário obrigatório: NFT no carrinho muda de preço → interface avisa →
checkout bloqueia cotação desatualizada.

## Fase 10 — Testes E2E

Os 12 cenários de §9, em Chromium desktop e mobile. Estado isolado por teste, controle
de relógio, latência e disparo de evento. Regressão visual de início, detalhe, carrinho
e pagamento com baseline versionada. Relatório HTML e traces.

## Fase 11 — A11y + performance

Auditoria de teclado, foco, semântica e contraste. Lighthouse em início e detalhe,
mobile e desktop, três medições, mediana reportada. Metas: Performance ≥90,
Accessibility ≥95, Best Practices ≥95, SEO ≥90. Registrar LCP, CLS e TBT.

## Fase 12 — Deploy + documentação

Deploy com SPA fallback para que acesso direto e refresh funcionem. `README.md` com
setup, variáveis, credenciais fictícias, seleção e reset de cenário, e como reproduzir
cada fluxo de falha. `ARCHITECTURE.md` com contratos REST e eventos, política de
sessão, estado do carrinho, estratégia de cache e reconciliação REST ↔ Socket.IO.
