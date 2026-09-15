# Fase 5 — Conta e sessão

> **Fonte de verdade visual.** Extraída do Figma e transcrita aqui — os agentes do
> pipeline não têm acesso ao MCP. **Não invente medida, cor ou copy.**
> Complementa `specs/02-design-system.md`.

Figma `BliVZDosX5BcSpvhYvdE0V`. Login `9:115` · Cadastro `9:1022` · mobile `16:1022` e `16:1228`.

---

## 1. A descoberta que muda o roteamento

**Login e cadastro são o MESMO modal, com duas abas** — não duas páginas. O nó
`70381:239` ("Sign In Modal") é um overlay de **500×600** posicionado sobre a
instância de "Marketplace Page", e seu cabeçalho traz:

```
Entrar  |  Criar conta
```

separados por uma régua vertical de 1px em **`text-coral #f0805f`**, com a aba ativa
em `text-accent` e a inativa em `foreground`, ambas 20px medium `leading-[16px]`.

Isso casa com o §3 do desafio: *"Login: autenticação, validação e **retorno ao fluxo
anterior**"* — modal preserva o contexto de onde o usuário estava, que é exatamente
o comportamento pedido.

**Implicação**: a rota não precisa ser uma página cheia. Pode ser search param
(`?auth=login`) ou rota aninhada com o catálogo de fundo. Decidir e registrar.

## 2. Tokens novos

| Token | Valor | Uso |
| --- | --- | --- |
| `--color-text-coral` | `#f0805f` | régua entre as abas |
| `--color-success` | `#00a66c` | ainda sem consumidor identificado |
| `--text-title-20-medium` | 20px / 500 / `lh 16` | abas do modal |

Marcas de terceiros (Google `#4086f4`/`#59c36a`/`#ffda2d`, Facebook `#3b5999`) são
cor de logo, **não** entram na paleta do projeto.

## 3. Modal — node `70381:239`, 500×600, `bg-surface-card`

Empilhamento vertical, largura total, com inset horizontal por bloco.

### Cabeçalho — `pt-[48px]`, `px-[48px]`, `gap-[40px]`

- Abas: `gap-[8px]`, 20px medium, régua de 1px em `text-coral`
- Subtítulo: 13px regular, `leading-[16px]`, `foreground`, centralizado —
  **copy exata**: "Entre para gerenciar sua carteira, coleção e perfil de criador."

### Formulário — `pt-[24px]`, `px-[80px]`, `gap-[12px]`

| Campo | Especificação |
| --- | --- |
| E-mail | altura 40, borda 1px `border-strong`, `rounded-[5px]`, `px-[16px] py-[12px]`, placeholder 14px em `secondary` |
| Senha | **borda 1px `primary`** (é o estado de foco desenhado), 16px em `foreground`, com ícone de olho 22×20 à direita |
| "Esqueceu a senha?" | 14px em `text-accent`, alinhado à direita |

O raio aqui é **5px**, não os 6px do resto do sistema — transcrito do Figma, não
normalizar sem decidir.

### CTA — `pt-[24px]`, `px-[80px]`

Botão de altura **45**, largura total, `bg-primary`, `rounded-[5px]`, texto 16px
bold em `ink`.

### Social — `pt-[24px]`, `gap-[12px]`

- Divisor: régua + "Ou continue com" 13px regular, `gap-[12px]`
- Dois botões de altura 40, borda 1px `border-strong`, `rounded-[5px]`, `px-[80px]`
  no container: **"Continuar com Google"** e **"Continuar com Facebook"**, 13px
  medium em `text-secondary`, ícone de 20px, `gap-[12px]`

### Detalhes

- Barra de 10px em `primary` colada no rodapé do modal (`top: 590`)
- Botão de fechar `X` de 18px no canto superior direito

## 4. Comportamento — §3 e §4

**Obrigatório:**

- Cadastro, login, logout e sessão integrados à API simulada.
- **Sessão recuperável após refresh.**
- **Expiração durante a navegação e durante o checkout**, preservando o contexto
  para retomada.
- **Logout e troca de usuário limpam cache privado e subscriptions.** É eliminatório
  (§11): "exposição de dados entre usuários".
- Rotas privadas protegidas pelo Router: checkout, perfil, carteiras, favoritos e
  pedidos exigem autenticação.
- Validação de formulário **e erros vindos da API** — conflito de e-mail no cadastro
  já existe no mock (`register-conflict`).
- Retorno ao fluxo anterior após autenticar.

**A exigência do §4 que ainda não foi cumprida em nenhuma fase**: atualização
otimista com rollback em pelo menos uma interação. O plano aponta **favoritos**, e
esta é a fase que os habilita. Implementar aqui.

**Honestidade obrigatória (§3, e a mesma regra do botão da newsletter na fase 2):**
Google, Facebook e "Esqueceu a senha?" **não têm backend**. Ficam desabilitados ou
com aviso explícito — nunca simulando sucesso. Registrar em `ARCHITECTURE.md`.

## 5. O que já existe e não precisa ser construído

Os handlers estão prontos desde a fase 1, com 118 testes de contrato cobrindo:

| Endpoint | Cobertura existente |
| --- | --- |
| `POST /api/auth/register` | conflito de e-mail (409), validação |
| `POST /api/auth/login` | credencial inválida, sessão criada |
| `POST /api/auth/logout` | limpeza de sessão |
| `GET /api/auth/session` | 401 anônimo, sessão expirada, cookie |

E o **merge do carrinho de visitante ao autenticar** já está implementado e testado
em `mergeGuestCartInto` — a fase 5 só precisa disparar o login; o mock faz o resto.

Senha nunca em claro: as fixtures guardam hash + salt.

## 6. Cenários do MSW que esta fase deve exercitar

`session-expired` e `register-conflict` existem desde a fase 1 e seguem **sem
consumidor real**. Esta fase é o primeiro consumidor dos dois.

## 7. Pendências de extração

`[EXTRAÇÃO PENDENTE]` — o modal de **cadastro** (`9:1022`) não foi extraído; presumo
que seja o mesmo modal com a aba "Criar conta" ativa e campos adicionais, mas **não
verifiquei**. E os mobile (`16:1022`, `16:1228`) também não. Pedir extração antes de
implementar essas partes.
