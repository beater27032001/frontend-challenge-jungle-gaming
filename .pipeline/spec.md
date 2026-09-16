# Spec: Fase 5 — Conta e sessão (modal de auth, sessão, logout limpo, favoritos otimistas)

## Open Questions
None. Três pontos que seriam perguntas foram resolvidos por derivação, explicitamente
permitida pelo dono do projeto sob prazo — todos registrados em ARCHITECTURE.md pelo Coder:

1. **Cadastro (`9:1022`) não extraído** → derivar do modal de login já transcrito
   (specs/05-auth.md §3): mesma estrutura, aba "Criar conta" ativa, campo **Nome**
   acima do E-mail (mesma spec visual do campo E-mail). Sem "confirmar senha" — o
   contrato (`registerSchema`) não o tem.
2. **Mobile (`16:1022`/`16:1228`) não extraído** → modal fluido: `w-full max-w-[500px]`,
   `mx-4`, mesmos blocos internos; nada travado em 414 (CLAUDE.md).
3. **Header logado não tem frame extraído** → derivação mínima: avatar 24px + nome do
   usuário + botão "Sair" no lugar do botão "Entrar". Sem dropdown.

## Goal
Ligar a UI de conta à API que existe desde a fase 1: modal único de login/cadastro
(500×600, duas abas) roteado por search param, sessão recuperável após refresh,
logout/troca de usuário sem vazamento de cache (eliminatório §11), tratamento do
cenário `session-expired` preservando contexto, e favoritos com atualização
otimista + rollback — a exigência do §4 ainda não cumprida por nenhuma fase.
Backend zero: handlers, merge de carrinho e 118 testes de contrato já existem.

## Decisão de roteamento (registrar em ARCHITECTURE.md)
**Search param no root**: `?auth=login | register`, via `validateSearch` em
`src/routes/__root.tsx`. Justificativa: o modal sobrepõe **qualquer** página (a de
fundo continua montada — é o "retorno ao fluxo anterior" do §3 de graça), sobrevive
a refresh/histórico (regra CLAUDE.md de estado na URL) e fechar = remover o param
preservando os demais (`q`, `page`, filtros). Rota aninhada exigiria replicar o
modal sob cada rota de fundo — mais código, mesmo resultado.

## Files to create / modify
- `src/index.css` — tokens novos: `--color-text-coral: #f0805f` e
  `--text-title-20-medium` (20px/500/lh 16, seguir o padrão das escalas existentes).
  **Não** criar `--color-success` (sem consumidor — YAGNI, spec 05 §2 admite).
- `src/routes/__root.tsx` — `validateSearch` tipando `auth?: 'login' | 'register'`
  (valor inválido → `undefined`); renderizar `<AuthModal />` no layout quando `auth`
  estiver presente.
- `src/features/auth/auth-modal.tsx` — **novo**. Modal com as duas abas e os dois
  formulários (react-hook-form + `zodResolver` com `loginSchema`/`registerSchema`
  de `@/types` — reusar, não redeclarar). Usa `Dialog` de `src/components/ui/dialog.tsx`
  (focus trap/Esc nativos do Radix) e `Form`/`Input`/`Label`/`Button` existentes.
  Medidas: seção "Visual" abaixo.
- `src/features/auth/use-auth.ts` — **novo**. Mutations `useLogin`, `useRegister`,
  `useLogout` + a rotina de higiene de cache (ver "Assinaturas").
- `src/features/auth/use-session.ts` — atualizar o doc comment (a fase 5 chegou);
  exportar `const sessionKey = ['session'] as const` para reuso nas mutations.
- `src/features/nft/favorites.ts` — **novo** (favoritos são domínio nft; não criar
  diretório novo). `favoritesOptions(scope)` + `useToggleFavorite(scope)` otimista.
- `src/features/nft/components/nft-card-mobile.tsx` — habilitar o coração (remover
  `disabled` da fase 4); comportamento na seção "Favoritos".
- `src/features/nft/components/nft-detail-desktop.tsx` e `nft-detail-mobile.tsx` —
  habilitar o botão/ícone Favoritar, mesmo comportamento.
- `src/components/layout/header.tsx` — habilitar "Entrar" (`Link` para a rota atual
  com `search: (prev) => ({ ...prev, auth: 'login' })`); estado logado (avatar +
  nome + "Sair").
- `src/lib/api.ts` — interceptor de resposta para `session_expired` (ver abaixo).
- `src/main.tsx` — registrar o handler de sessão expirada (navegação + limpeza),
  onde router e queryClient já coexistem.
- `ARCHITECTURE.md` — registrar: decisão do search param, as 3 derivações acima,
  social/esqueci-a-senha sem backend, e que "limpar subscriptions" no logout é
  vazio até o Socket.IO nascer (fase 6/7) — quando nascer, o disconnect entra na
  mesma rotina `resetPrivateState`.
- `e2e/runtime-behavior.spec.ts` (+ `e2e/helpers.ts` se precisar) — novos testes;
  o repo consolida em 2 specs por decisão da fase anterior, **não** criar spec novo.

## Function / API signatures

```ts
// src/features/auth/use-auth.ts
export function useLogin(): UseMutationResult<Session, unknown, LoginRequest>
export function useRegister(): UseMutationResult<Session, unknown, RegisterRequest>
export function useLogout(): UseMutationResult<void, unknown, void>

// Higiene de cache — o coração eliminatório da fase. Interna ao módulo:
// login/register onSuccess:  queryClient.clear(); queryClient.setQueryData(sessionKey, session)
// logout onSuccess:          queryClient.clear()   // volta todo mundo a 'guest'
// clear() derruba TODO o cache (privado e público); o catálogo refaz fetch — custo
// aceito, é a garantia mais simples de zero vazamento entre usuários.
// Erros: 401 invalid_credentials → erro no nível do form (login);
// 409 email_taken → erro associado ao campo email (register);
// 400 validation_error → mapear error.details[campo] para os campos.
// Formato do erro da API: { error: { code, message, details? } } (src/mocks/utils.ts).

// src/features/nft/favorites.ts
export function favoritesOptions(scope: string) // queryKey: ['favorites', scope]
// GET /favorites → FavoritesResponse { nftIds: string[] }; enabled só com sessão.
export function useToggleFavorite(scope: string): UseMutationResult<
  FavoritesResponse, unknown, { nftId: string; favorited: boolean }>
// favorited=false → PUT /favorites/:nftId ; true → DELETE /favorites/:nftId
// Otimista (padrão canônico TanStack v5):
//   onMutate: cancelQueries(['favorites', scope]); snapshot; setQueryData togglando o id
//   onError:  setQueryData(snapshot) + toast.error (padrão de use-add-to-cart)
//   onSettled: invalidateQueries(['favorites', scope])

// src/lib/api.ts
export function onSessionExpired(handler: () => void): void
// Interceptor de resposta do axios: status 401 && error.code === 'session_expired'
// → chama o handler UMA vez por rajada (debounce simples por flag) e repassa o erro.
// O 401 'unauthorized' do visitante anônimo NÃO dispara o handler.

// src/main.tsx — registro:
// onSessionExpired(() => {
//   queryClient.clear()
//   toast.error('Sessão expirada. Entre novamente para continuar.')
//   router.navigate({ search: (prev) => ({ ...prev, auth: 'login' }), replace: true })
// })  // URL de fundo intacta = contexto preservado para retomada (§3)
```

## Visual do modal (specs/05-auth.md §3 — transcrito do Figma, não normalizar)
- Container 500×600 (`max-w-[500px]`, mobile fluido), `bg-surface-card`, barra de
  10px em `primary` colada no rodapé, X de 18px no canto superior direito.
- Cabeçalho `pt-[48px] px-[48px] gap-[40px]`: abas "Entrar | Criar conta" 20px
  medium `leading-[16px]` com régua vertical 1px `text-coral`; ativa em
  `text-accent`, inativa em `foreground`. Abas trocam via
  `navigate({ search: ..., replace: true })` — histórico não acumula troca de aba.
  Subtítulo 13px centralizado, copy exata: "Entre para gerenciar sua carteira,
  coleção e perfil de criador."
- Form `pt-[24px] px-[80px] gap-[12px]` (mobile: reduzir o inset para `px-6`,
  registrar): inputs altura 40, borda `border-strong`, `rounded-[5px]`,
  `px-[16px] py-[12px]`, placeholder 14px `secondary`; senha com toggle de olho
  22×20 (borda `primary` é o estado de FOCO desenhado — implementar como
  `focus:border-primary`, não borda fixa); "Esqueceu a senha?" 14px `text-accent`
  à direita, **desabilitado com `title`/aria explicando que não há backend**.
- CTA altura 45, largura total, `bg-primary`, `rounded-[5px]`, 16px bold `ink`.
  Raio do modal é **5px**, não os 6px do sistema.
- Social: divisor "Ou continue com" 13px + dois botões altura 40 ("Continuar com
  Google"/"Continuar com Facebook", 13px medium `text-secondary`, ícone 20px) —
  **`disabled`**, nunca simulando sucesso (§3; mesmo padrão do botão da newsletter).
- Estado pending da mutation: CTA desabilitado com feedback textual (a11y: não só cor).

## Favoritos — comportamento
- Visitante clica no coração/Favoritar → **não** chama a API; abre o modal
  (`search: { auth: 'login' }`). Após logar, segue na mesma página (modal fecha).
- Logado: coração reflete `favoritesOptions(scope)`; `aria-pressed` + ícone
  preenchido (`fill`) em `text-accent` quando favoritado — estado nunca só por cor
  (aria-pressed cobre). Clique dispara `useToggleFavorite` otimista.
- Rollback: com cenário `server-error`/`offline`, o coração volta ao estado
  anterior e um toast de erro aparece.

## Acceptance criteria
1. `/?auth=login` direto por URL abre o modal sobre o catálogo; Esc/X/overlay fecham
   removendo só o param `auth` (demais params preservados).
2. Login com `invalid_credentials` (senha errada) mostra "E-mail ou senha inválidos."
   associado ao form, sem fechar o modal.
3. Login com credencial válida (fixture existente, ex. a usada como `ANA` no e2e)
   fecha o modal, mantém a URL de fundo, e o header desktop passa a mostrar avatar +
   nome + "Sair".
4. Refresh após login mantém o usuário logado (cookie `gm_session` + `GET /auth/session`).
5. Cadastro na aba "Criar conta" com cenário `register-conflict` ativo mostra
   "Este e-mail já está cadastrado." associado ao campo e-mail; com cenário `default`
   e e-mail novo, autentica direto (201 já cria sessão) e fecha o modal.
6. Campos vazios/inválidos são barrados client-side (zod) com mensagem associada ao
   campo (`aria-describedby` via ui/form) antes de qualquer request.
7. Logout: após "Sair", `queryClient` não contém NENHUMA query de escopo do usuário
   (favoritos, sessão) — verificável na UI: corações voltam ao estado de visitante
   (desabilitados/neutros) e um novo login com OUTRO usuário nunca exibe favorito do
   anterior, nem por um frame (cache foi limpo, não invalidado).
8. Com sessão ativa e cenário `session-expired` ligado, a próxima chamada autenticada
   (ex.: togglar favorito) dispara: toast de sessão expirada + modal `?auth=login`
   aberto + URL de fundo inalterada. Relogar retoma na mesma página.
9. O 401 anônimo do boot (`unauthorized`) NÃO abre modal nem toast — os 380 testes
   existentes seguem verdes (inclusive `isExpectedBootNoise`).
10. Favoritar logado atualiza o coração ANTES da resposta (visível com cenário `slow`);
    com `server-error`, o coração reverte e aparece toast de erro.
11. Favorito persiste: favoritar, refresh, coração continua preenchido (GET /favorites).
12. Visitante clica no coração → modal de login abre, nenhuma chamada a /favorites.
13. Google/Facebook/"Esqueceu a senha?" não disparam request nem aparentam sucesso.
14. Teclado: foco preso no modal, foco visível, Esc fecha e devolve o foco ao gatilho
    (Radix cobre; não quebrar com autofocus manual).
15. `pnpm build`, `typecheck`, `lint` e `test` passam.

## Edge cases to cover
- Trocar de aba com o form sujo: não vaza valor/erro de um form no outro.
- `?auth=qualquercoisa` inválido → tratado como fechado, sem crash.
- Duplo clique rápido no coração: o estado final respeita a última resposta
  (`onSettled` + invalidate resolvem; não desabilitar o botão durante o voo é ok,
  mas o estado não pode "piscar" errado após as respostas).
- `session-expired` disparando em várias queries ao mesmo tempo → um único
  toast/navegação (flag de debounce no interceptor).
- Logout com cenário `offline`: mutation falha → toast de erro; não limpar a sessão
  local em falha (o cookie ainda existe no mock).
- Modal aberto em `/nft/:id` (não só no catálogo) — o root renderiza em toda rota.
- Cadastro com senha < 8: erro zod no campo, request não sai.

## Existing pattern to follow
- Mutations com toast: `src/features/cart/use-add-to-cart.ts` (extração de
  `error.response.data.error.message` via `isAxiosError`).
- Query options + scope por usuário: `src/features/nft/queries.ts` (`['recurso',
  scope, ...]`; favoritos: `['favorites', scope]`).
- `scope = session.data?.user.id ?? 'guest'` + `enabled: !session.isPending`:
  `src/routes/index.tsx`.
- Dialog adaptado (overlay `bg-ink/80`, focus trap nativo): `src/components/ui/dialog.tsx`.
- Honestidade de ação sem backend: botão da newsletter (fase 2) e comentários
  `disabled // fase 5 liga isto` nos próprios arquivos a editar.
- e2e: helpers `login`/`logout`/`apiFetch`/`isExpectedBootNoise` em `e2e/helpers.ts`;
  cenário via `localStorage['greenmint:scenario']` (`src/mocks/scenarios.ts`).

## Prototype / design reference
specs/05-auth.md §3 é a transcrição do Figma `9:115` (nó `70381:239`) — medidas,
cores e copy exatas acima. Cadastro e mobile derivados conforme "Open Questions".

## Out of scope
- **Guard de rota no Router (`beforeLoad`)**: não existe rota privada na fase 5 —
  checkout (7), perfil e carteiras (8) ainda não têm rota, e favoritos não têm
  página própria no Figma. O guard nasce com a primeira rota privada (fase 7), são
  ~5 linhas usando o `?auth=login` daqui. O que a fase 5 protege, protege na
  interação (coração → modal). Registrar em ARCHITECTURE.md.
- Logout no mobile: sem header mobile e sem tela de Perfil até a fase 8 — não há
  entrada de logout em < lg nesta fase. Registrar como dívida da fase 8.
- Expiração **durante o checkout** (spec 05 §4): o checkout não existe; o interceptor
  criado aqui já cobrirá, fase 7 só testa.
- Socket/subscriptions no logout: nenhum socket existe ainda; a rotina de limpeza
  ganha o `disconnect` quando ele nascer.
- Token `--color-success`, dropdown de usuário no header, "lembrar de mim",
  força de senha, aba Favoritos da TabBar — polimento sem exigência no desafio.
- Carrinho (6), pagamento (7), perfil/carteiras (8).
