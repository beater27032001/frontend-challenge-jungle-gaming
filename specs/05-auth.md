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

## 7. Modal de cadastro — `70383:239` (Sign Up Modal)

Extraído. **Mesma casca do modal de login** (`70381:239`): 500 de largura,
`bg surface-card`, **raio 8**, `flex-col`, e o `X` de fechar no canto superior
direito (18×18, ~`x 469, y 12`).

Difere do login em três pontos, e só neles:

1. **Abas invertidas**: "Entrar" fica em `foreground` (inativa) e "Criar conta" em
   `text-accent` (ativa). Régua de 1px `text-coral` entre as duas, `gap 8`, ambas
   20px medium lh 16. É a mesma linha `9:1148` do login com o estado trocado.
2. **Subtítulo próprio**: "Crie seu perfil de colecionador e conecte uma carteira
   quando quiser." — 13px regular lh 16, `foreground`, centralizado, largura total.
3. **Quatro campos** em vez de dois.

### 7.1 Form — `70383:241` (`pt-24`, `px-80`, `gap-12`)

Todos os inputs: largura total, `h-40`, **raio 5**, borda `border` (#3f2319),
`px-16 py-12`, placeholder **14px regular lh 16 em `secondary` (#b39463)**.

| Ordem | Node | Placeholder | Extra |
| --- | --- | --- | --- |
| 1 | `70383:242` | Nome de usuário | — |
| 2 | `70383:243` | Digite seu e-mail | — |
| 3 | `70383:244` | Senha | `Iconly/Curved/Hide` 18×18 à direita |
| 4 | `70383:245` | Confirmar senha | **sem** ícone de olho |

⚠️ **Só o campo "Senha" tem o toggle de visibilidade; "Confirmar senha" não.**
Assimetria do desenho. Recomendação: dar o toggle aos dois — esconder um campo de
confirmação sem poder revelá-lo é hostil, e a fase 8 já usa o mesmo componente nos
três campos de troca de senha (spec 08 §2.2). Registrar o desvio.

⚠️ O ícone do campo 3 está posicionado por `inset` calculado, não por flex. Em
código: `justify-between` no input, não posição absoluta.

### 7.2 CTA — `70383:246` (`pt-24`, `px-80`)

Botão largura total, **`h-45`**, raio 5, `bg primary`, "Criar conta" 16px bold em
`ink`. Mesma altura do botão do login.

### 7.3 Social — `70383:248` (`pt-24`, `gap-16`)

- **Divisor** `70383:249`: duas linhas `flex-1` com "Ou continue com" no meio,
  13px regular lh 16 `foreground`, `gap 12`. O divisor é **largura total do modal**,
  sem o inset de 80px.
- **Botões** `70402:3596` (`px-80`, `gap-16`): duas instâncias do componente
  **Social Button** (`70483:263`) — Google e Facebook. Cada um `h-40`, raio 5, borda
  `border`, ícone 20×20 + rótulo **13px medium `text-secondary`**, `gap 12`,
  centralizado.

A documentação do componente no Figma é explícita: *"Always FILL width — the parent
container owns the horizontal inset (80px inside the auth modals, 0 on the mobile
screens)"*. Não fixar 340px, que é só o tamanho do frame do componente.

### 7.4 A barra de 10px no rodapé

`9:1230`: retângulo `500×10` em `bg primary`, posicionado em **`y 646`** — ou seja,
**fora** dos 600px de altura do modal, 46px abaixo do fim. É uma faixa decorativa
que o designer deixou solta, provavelmente sobra de outra composição.

Não implementar como elemento posicionado. Se a intenção era um acento no rodapé do
modal, a leitura honesta é `border-b-[10px] border-primary` no container — mas isso
é interpretação, não medida. **Deixar de fora** e registrar; o login não tem
equivalente, então incluir só no cadastro criaria assimetria não desenhada.

## 8. Mobile — login `16:1022` e cadastro `16:1228`

⚠️ **Descoberta que contradiz a seção 1**: no mobile, login e cadastro **não são
modal com abas — são duas páginas cheias**, cada uma com seu próprio frame de
414×896, logo KURIO no topo e link para a outra no rodapé. Não há barra de abas.

Isso muda a decisão de roteamento deixada aberta na seção 1: a rota precisa existir
de verdade (`/login` e `/cadastro`, ou `/entrar` e `/criar-conta`), porque no mobile
ela é a tela inteira. No desktop a mesma rota renderiza o modal sobre o catálogo.
**Uma rota, duas apresentações por breakpoint** — não dois mecanismos.

### 8.1 Container, idêntico nas duas telas

`bg ink`, `pt-80 px-28 pb-24`, `flex-col gap-40`. Conteúdo de **358** de largura
(414 − 2×28). O `rounded-[40px]` do frame é a moldura do device no Figma, **não**
raio de conteúdo — não implementar.

O ritmo de 40px é rígido e vale para os dois frames:

| Bloco | Login `y` | Cadastro `y` | Altura |
| --- | --- | --- | --- |
| Logo | 80 | 80 | 136 |
| Title | 256 | 256 | 16 |
| Form | 312 | 312 | 174 / **236** |
| CTA | — | 588 | 60 |
| Mobile Social Block | — | 688 | 124 |
| Link para a outra tela | — | 852 | 20 |

### 8.2 Logo — `70399:239` / `70410:4345`

Bloco de `358×136`, conteúdo centralizado: "KURIO" em **32px bold, `tracking 3.2px`**
(letter-spacing 10% da fonte), `foreground`, centralizado. O `h-136` com o texto de
42px de altura significa **muito ar em volta** — é intencional, não colapsar.

### 8.3 Title

- Login — `70399:240`: "Entrar", **20px bold lh 16**, centralizado
- Cadastro — `70399:249`: "Criar perfil de colecionador", mesma tipografia,
  centralizado (`x 27.5` de 358 confirma centro)

Note que o desktop usa 20px **medium** nas abas e o mobile 20px **bold** no título.
Tokens diferentes; `--text-title-20-medium` não serve aqui.

### 8.4 Form

Inputs mobile são **outro componente** que os do desktop: `358×50`, **raio 10**
(desktop: `h-40`, raio 5). Placeholder 14px regular lh 16 `secondary`, `pl-16`.

**Login — `70399:241` (`gap-12`)**

| Node | Conteúdo | Observação |
| --- | --- | --- |
| `70410:4221` | placeholder `contato@email.com` | borda `border` #3f2319 |
| `70410:4220` | valor `***********` em **16px regular `foreground`** + `Iconly/Curved/Hide` 18×18 | **borda `primary` #d28a4c** |
| `70399:242` | "Esqueceu a senha?" 14px regular `text-accent`, `justify-end` | é `<button>`, não texto |

⚠️ O segundo campo tem **borda `primary`** e conteúdo preenchido: é o estado de
**foco/preenchido**, não o padrão. O padrão é a borda `border` do primeiro campo.
Implementar `focus-visible:border-primary` e não pintar o campo de senha por padrão.

**Cadastro — `70399:250` (`gap-12`, 4 campos de 50px em `y` 0/62/124/186)**

| Node | Conteúdo |
| --- | --- |
| `70410:4348` | "User Name" |
| `70410:4349` | "Digite seu e-mail" |
| `70410:4351` | "Senha" + `Hide` 18×18 |
| `70410:4353` | "Confirmar senha" + `Hide` 18×18 |

⚠️ **Aqui os dois campos de senha têm o olho** — ao contrário do modal desktop
(§7.1), onde só "Senha" tem. Isso confirma a recomendação de dar o toggle aos dois
em todas as superfícies: o próprio Figma faz assim no mobile.

⚠️ **"User Name" está em `x 115.5`, ou seja centralizado**, enquanto os outros três
placeholders estão em `x 16`. Erro de alinhamento do designer. Usar `pl-16` nos
quatro. Além disso a copy está **em inglês** no meio de uma tela em português —
usar **"Nome de usuário"**, igual ao modal desktop (`9:1158`).

`[DERIVADO DA GEOMETRIA]` As cores, raios e pesos do form do cadastro mobile vêm do
cache de geometria do Figma mais o login mobile, extraído inteiro — os dois frames
são estruturalmente idênticos (mesmas dimensões, mesmo ritmo de 40px, mesma
instância de Social Block). O que **não** consegui confirmar: os nós `16:1291` e
`16:1301` (`Rectangle 49`) dentro dos campos de senha sugerem um **preenchimento de
fundo** que os dois primeiros campos não têm. Se ao implementar o campo de senha
parecer diferente dos outros no Figma, é isso. Tratar como estado, não como estilo
base — mesma leitura do campo com borda `primary` no login.

### 8.5 CTA

Login `70399:243` e cadastro `70399:251`: `358×60`, **raio 10**, `bg primary`,
rótulo 16px bold em `ink` — "Entrar" e "Criar perfil".

⚠️ **Raio 10 e cor plana**, contra **raio 40 e gradiente** nos CTAs de carrinho e
pagamento mobile (spec 06 §6.5, spec 07 §6.6). São componentes diferentes; não
unificar. Os CTAs de auth são retangulares arredondados, os de compra são pílulas.

### 8.6 Mobile Social Block — componente `70504:2994`

Instanciado nas duas telas (`70522:3213` no cadastro), `358×124`, `gap-12`:

- divisor: duas linhas `flex-1` + "Ou continue com" 13px regular lh 16
  `foreground`, `gap 10` *(o desktop usa `gap 12`)*
- dois **Social Button** largura total, `gap-16` — Google e Facebook

A documentação do componente avisa: *"Desktop variants differ in spacing and are
intentionally not instances of this"*. São dois componentes de propósito; não tentar
reusar um só.

### 8.7 Link para a outra tela

- Login `70399:247`: "Novo na Kurio? Crie uma conta" — 15px regular `text-secondary`
- Cadastro `70399:255`: "Já tem uma conta? Entre" — mesma tipografia, `h-20`

Ambos centralizados, largura total. **São navegação**: o trecho final ("Crie uma
conta" / "Entre") precisa ser `<Link>` com foco visível, não o parágrafo inteiro
clicável. Note a copy "Kurio" em caixa mista aqui, contra "KURIO" no logo.

## 9. Consequências para a implementação desta fase

1. **A rota é real, não só search param.** O mobile prova que login e cadastro são
   páginas. Uma rota por tela, e o desktop decide renderizar como modal sobre o
   catálogo. Revê a pergunta aberta da seção 1 — está respondida pelo desenho.
2. **Dois conjuntos de primitivos de input**, não um: `h-40`/raio 5 no modal
   desktop, `h-50`/raio 10 no mobile. Mesmo caso dos CTAs.
3. **O toggle de senha vale para os dois campos** em todas as superfícies.
4. **"User Name" → "Nome de usuário"** e `pl-16`: corrigir os dois erros do Figma.
5. **A faixa de 10px do cadastro desktop fica de fora** (§7.4).
