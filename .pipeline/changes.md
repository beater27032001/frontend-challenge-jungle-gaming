# Changes

## Status
implemented

## Contexto importante antes de ler o resto

Esta fase teve **duas rodadas de implementação**, não uma. A primeira seguiu
`.pipeline/spec.md` (que resolvia "Cadastro"/"Mobile"/"Header logado" por
derivação, sob prazo, porque `specs/05-auth.md` só tinha as seções 1–6). No
meio do trabalho, `specs/05-auth.md` ganhou as seções 7–9 com a extração real
do Figma — e ela **contradiz a derivação** em dois pontos estruturais:
mobile não é o modal do desktop encolhido, é rota de tela cheia própria; e o
roteamento não pode ser search param (`?auth=`), tem que ser rota real
(`/login`, `/cadastro`), porque o mobile prova que são páginas. A implementação
foi **refeita do zero** em cima da extração real. O que está descrito abaixo é
a versão final; a primeira rodada (modal via `?auth=login`) foi descartada por
completo — nenhum arquivo dela sobrevive.

Também: a sessão teve uma queda de rede no meio (o agente foi derrubado pelo
watchdog). O trabalho sobreviveu porque estava na árvore de arquivos, não em
memória de conversa — mas por isso a verificação final (rodar a suíte, achar e
consertar o bug de logout) aconteceu **depois** da retomada, e é a parte mais
importante deste relatório.

## O que mudou, arquivo por arquivo

### Novo
- `src/routes/login.tsx` — rota `/login`, `validateSearch` com `redirect`
  (`z.string().startsWith('/').optional().catch(undefined)`); renderiza
  `LoginDesktop` + `LoginMobile` juntos (`hidden lg:*`/`lg:hidden`, mesmo
  padrão de `nft.$nftId.tsx`).
- `src/routes/cadastro.tsx` — irmã de `/login`, mesmo `redirect`, renderiza
  `RegisterDesktop` + `RegisterMobile`.
- `src/features/auth/auth-desktop.tsx` — `LoginDesktop`/`RegisterDesktop`.
  Dialog do Radix (`DialogPrimitive.Content`/`DialogOverlay` diretos, não
  `<DialogContent>` — ver "Decisões não triviais" abaixo) só monta em
  `>=1024px` via `useMediaQuery`. 500×largura, raio 8, tabs reais (`<Link>`
  com `role="tab"`), barra de 10px só no login (specs/05-auth.md §7.4).
- `src/features/auth/auth-mobile.tsx` — `LoginMobile`/`RegisterMobile`. Telas
  cheias (`bg-ink`, logo KURIO, título, form h-50/raio 10, CTA 358×60/raio
  10, link para a outra tela). Cópia diferente da desktop (CTA "Criar
  perfil" vs "Criar conta", título "Criar perfil de colecionador").
- `src/features/auth/auth-schemas.ts` — `registerFormSchema` (estende
  `registerSchema` com `confirmPassword` + `refine`, client-only — nunca vai
  para a API) e `applyLoginError`/`applyRegisterError` (mapeiam
  401/409/400 do axios para erro de campo ou de form).
- `src/features/auth/fields.tsx` — `PasswordField` (toggle de olho, os dois
  campos de senha, as duas superfícies) e `TextField`, compartilhados entre
  desktop/mobile/login/cadastro.
- `src/features/auth/social.tsx` — `SocialDivider`/`SocialButtonsList`/
  `SocialButtons`/`EsqueceuSenha`, todos `disabled` com `title` explicando a
  ausência de backend.
- `src/features/auth/use-auth.ts` — `useLogin`/`useRegister`/`useLogout`.
  Login/registro: `queryClient.clear()` + `setQueryData(sessionKey, session)`.
  Logout: `queryClient.clear()` + **`window.location.reload()`** — ver bug
  encontrado e corrigido, abaixo.
- `src/features/nft/favorites.ts` — `favoritesOptions(scope)` +
  `useToggleFavorite(scope)` otimista (onMutate/onError com rollback/onSettled
  invalidate), exatamente como o spec pediu.
- `src/lib/use-media-query.ts` — hook `matchMedia`, usado para não montar o
  Dialog do Radix em `<lg` (ver decisão 3 abaixo).

### Modificado
- `src/routes/__root.tsx` — sem mudança de roteamento por search param (isso
  foi descartado); só ajustou `isAuthRoute` para suprimir MobileSearchBar/
  TabBar em `/login`/`/cadastro` no mobile.
- `src/features/auth/use-session.ts` — exporta `sessionKey`; doc comment
  atualizado.
- `src/components/layout/header.tsx` — "Entrar" agora é `<Button asChild>`
  com `<Link to="/login" search={{redirect: pathname}}>` (deixa de ser
  `<button disabled>`); estado logado mostra avatar + nome + "Sair".
- `src/features/nft/components/nft-card-mobile.tsx` — coração habilitado;
  visitante navega para `/login`; logado dispara `useToggleFavorite`.
- `src/features/nft/components/nft-detail-desktop.tsx` /
  `nft-detail-mobile.tsx` — mesmo padrão, via `isFavorited`/`onToggleFavorite`
  recebidos por prop (estado elevado à rota, mesmo padrão de compra).
- `src/features/nft/detail-state.ts` — `NftDetailViewProps` ganha
  `isFavorited`/`onToggleFavorite`.
- `src/routes/nft.$nftId.tsx` — computa favoritos/toggle e passa por prop.
- `src/lib/api.ts` — interceptor `onSessionExpired` (debounce de 300ms por
  flag; só dispara em `session_expired`, nunca em `unauthorized`).
- `src/main.tsx` — registra o handler: `queryClient.clear()` + toast +
  `router.navigate({ to: '/login', search: { redirect } })`.
- `src/index.css` — `--color-text-coral`, `--text-title-20-medium` (+
  `--line-height` companion).

## O que NÃO ficou pronto / decisões que o spec não cobria

1. **Bug real encontrado e corrigido: logout não propagava para todos os
   consumidores da query de sessão.** Depois de "Sair", o Header (um
   `useSession()`) atualizava para "Entrar" corretamente, mas o card do
   catálogo (outro `useSession()`, mesma query key) continuava mostrando o
   favorito do usuário anterior — vazamento real do §11. Instrumentei com
   `window.__debug*` ad-hoc (removido, não sobrou no código) e confirmei:
   Header re-renderizou 5x refletindo a mudança; a rota `/` parou de
   renderizar completamente depois do clique em "Sair" (4 renders, todos
   ainda com a sessão antiga, nenhum depois). Não achei a causa raiz de por
   que dois consumidores da mesma query React Query reagem diferente a um
   `queryClient.clear()`. **Correção**: `useLogout` agora faz `clear()` +
   `window.location.reload()` — garante zero vazamento para qualquer
   componente, não depende de nenhum observador específico se comportar.
   Testado depois da correção: 2/2 passou em 3 rodadas limpas. Login/registro
   continuam 100% client-side (sem reload) porque ali `setQueryData` explícito
   já prova, testado, que todo consumidor assenta — só o logout tem esse
   problema. Registrado em ARCHITECTURE.md item 15 (fase 5) com o convite
   para quem revisitar reproduzir isolado e decidir se é bug do TanStack
   Query ou nosso.

2. **"Modal sobre o catálogo" no desktop não mantém a página de fundo
   montada de verdade.** O Figma pede o catálogo visível atrás do overlay;
   fazer isso de verdade exigiria rotas paralelas/intercepting routes, que o
   TanStack Router não tem nativamente. Implementei o Dialog do Radix
   centrado sobre um overlay escuro, com Header/Footer renderizando por trás
   (não escondidos), e `redirect` devolvendo o usuário à página exata de
   origem ao fechar/concluir — funcionalmente entrega o "retorno ao fluxo
   anterior" (§3) sem a camada visual literal. Registrado como o "bloco
   grande demais para redesenhar sob este prazo" em ARCHITECTURE.md item 2.

3. **`--color-success` não foi criado** (spec 05 §2 já admitia "ainda sem
   consumidor identificado") — YAGNI, nenhuma tela desta fase usa.

4. **Logout não existe no mobile** (sem header mobile, sem tela de Perfil até
   a fase 8) — dívida explícita, já prevista no plano ("Out of scope" do
   spec 05).

5. **Guard de rota (`beforeLoad`) não nasce nesta fase** — não existe rota
   privada ainda; o que a fase 5 protege, protege na interação (favoritar →
   `/login`).

Nenhuma pergunta ficou sem resposta registrada — todas as 3 derivações da
primeira rodada foram substituídas pela extração real; as decisões que
sobraram (a #2 acima, principalmente) estão em ARCHITECTURE.md, seção
"Fase 5", itens 1–17.

## O que o Tester/Reviewer devem focar

- **Zero vazamento entre usuários (§11, eliminatório)**: o bug real estava
  exatamente aqui. Testado e corrigido, mas é o ponto de maior risco se algo
  mudar em `use-auth.ts` ou em como as queries de favoritos/lista leem a
  sessão — qualquer refactor ali merece re-rodar
  `e2e/runtime-behavior.spec.ts -g "Logout limpa o cache"` isoladamente.
- Favoritos otimistas com rollback (slow/server-error) — cobertos, mas a
  asserção do estado intermediário (`true` antes do rollback) é sensível a
  timing sob paralelismo pesado (ver "Resultado real da suíte" abaixo).
- `redirect` inválido / ausente / apontando para rota que não existe mais —
  cobri o caso "não começa com /"; não cobri um `redirect` sintaticamente
  válido mas para uma rota inexistente (comportamento: navega lá, cai no
  404 do `__root__`, aceitável mas não testado explicitamente).
- Confirmar senha (client-only, nunca vai pra API) — vale confirmar que o
  Reviewer concorda com essa leitura do gap entre Figma e contrato.

## Resultado real da suíte (rodada limpa, pós-correção do bug de logout)

`pnpm test` completo, um worker de preview verificado por hash antes de cada
rodada (o ambiente teve contaminação de porta 4173 por outro agente correndo
em paralelo — várias rodadas anteriores deram falsos vermelhos por isso;
descartadas, não contam):

- **405 passed, 3 failed**, ~4.8min, 408 testes totais (380 + 28 novos da
  fase 5).
- As 3 falhas, investigadas uma a uma:
  1. `runtime-behavior.spec.ts:606` (skip-link é o primeiro foco) — **não é
     desta fase**, é o flake de `pressFirstTab` já documentado em
     ARCHITECTURE.md (item 22 da fase 4) sob paralelismo pesado.
  2. `runtime-behavior.spec.ts:1687` (favoritos otimistas, cenário
     server-error) — **é desta fase**, timing: perdeu a leitura do estado
     otimista `true` porque o rollback já tinha acontecido no primeiro poll.
     Passou 4/4 em rodadas isoladas (grep "fase 5", sem contenção de CPU).
     Registrado em ARCHITECTURE.md como a mesma família de flake já aceita.
  3. `api-contracts.spec.ts:715` (cenário `flaky`) — **não é desta fase**,
     arquivo/teste pré-existente, não toquei nele.
- Rodando só os 34 testes novos/alterados da fase 5 (`-g "fase 5|header
  renders KURIO"`), isolado: **34/34 passed**, de forma repetida (3 rodadas).

`pnpm typecheck`, `pnpm lint`, `pnpm build`: limpos.

## Verificação do gate (força-o a falhar uma vez)

O gate novo desta fase é o próprio teste de logout
(`e2e/runtime-behavior.spec.ts`, describe "Logout limpa o cache"). Antes da
correção (`clear()` sem reload) ele falhava consistentemente (2/2, desktop e
mobile) com o coração de Bruno mostrando `aria-pressed=true` herdado de Ana —
prova de que o gate realmente acusa vazamento, não é decorativo. Depois da
correção, 2/2 passa, repetido em 3 rodadas.
