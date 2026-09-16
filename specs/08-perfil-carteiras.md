# Fase 8 — Perfil do Colecionador e Carteiras

Transcrição do Figma `BliVZDosX5BcSpvhYvdE0V`, página `0:1`. Fonte única de verdade
visual: os agentes do pipeline não têm acesso ao Figma.

| Tela | Desktop | Mobile |
| --- | --- | --- |
| Perfil do Colecionador | `9:1238` → Body `70386:263` | **não existe** |
| Carteiras | `9:1670` → Body `70390:266` | **não existe** |

Ambas as telas **não têm frame mobile**. O `CLAUDE.md` exige que funcionem mesmo
assim — derivação na seção 5.

## 1. Shell compartilhado — Account Sidebar

As duas telas são o **mesmo layout**: `flex gap-28 items-start`, com a sidebar de
`310px` fixa à esquerda e o formulário em `flex-1`. A sidebar é idêntica nas duas
(nodes `70420:4536` no perfil e `70420:4594` nas carteiras) — **um componente só**.

`bg surface-card`, `py-8`, largura 310.

| Item | Ícone | Tamanho ícone | Gap |
| --- | --- | --- | --- |
| *(título)* "Meu perfil" | — | — | `p-10`, 18px bold lh 16, `foreground` |
| Dados do perfil | `User` | 18 | **16** |
| Carteiras | `Iconly/Light-Outline/Location` | 20 | 12 |
| Atividade | `shopping 1` | 18 | 12 |
| Lista de interesse | `heart 1` | 16 | 12 |
| Ofertas | `Iconly/Curved/Activity` | 18 | 12 |
| Arquivos baixados | `Iconly/Curved/Download` | 18 | 12 |
| Suporte | `Iconly/Curved/Danger Triangle` | 18 | 12 |
| *(divisória)* `Line 2` | — | — | h 0, borda topo |
| Sair | `Iconly/Curved/Logout` | 20 | 8, `h-40` |

Todos os rótulos: **15px regular, lh 45**, cor `text-accent` — exceto "Sair", que é
**15px bold, lh 15**. `px-16` em cada linha. O `lh 45` é o que dá altura à linha;
não trocar por `py`.

**Estado ativo**: `border-l-6 border-primary`. No perfil está em "Dados do perfil"
(`70420:4539`), nas carteiras em "Carteiras" (`70420:4601`). O item ativo **não
muda de cor** — todos já são `text-accent`. Logo o estado ativo é **só a barra
esquerda**, o que viola "estado nunca só por cor" de forma inversa: é só forma.
Aceitável para leitores de tela via `aria-current="page"`, que é obrigatório aqui.

✅ **DECIDIDO — cinco dos oito itens não têm tela.** Atividade, Lista de interesse,
Ofertas, Arquivos baixados e Suporte não existem no Figma nem no desafio. O usuário
decidiu: **renderizar os cinco**, sem tela.

Como: item inerte, **não** `<a>` nem `<Link>`. Renderizar como `<span>` ou `<button
disabled>` com `aria-disabled="true"` e um `title` curto ("Em breve"). Nada que
navegue — link para rota inexistente devolve 404 e conta como defeito.

Visual: mesmo `text-accent` dos outros (o Figma não desenha estado desabilitado
aqui), mas sem `cursor-pointer` e sem hover. O estado não pode ser só cor: o
`aria-disabled` é o que carrega a informação. Registrar no ARCHITECTURE.md.

## 2. Perfil do Colecionador — `70386:239` (Profile Form)

`flex-col gap-32`. Título "Perfil do colecionador" 16px bold lh 16 `foreground`.

### 2.1 Fields — `70386:240` (gap 24)

Três linhas `justify-between`, cada uma com dois campos de **417px**. Todos os
inputs: `h-40`, **raio 3**, borda `border` (#3f2319), sem fundo.

Label padrão: 15px regular lh 15 `foreground`, seguido de `*` em **22px regular,
lh 29, `text-coral` (#f0805f)**. Gap label→input: **10**.

| Linha | Esquerda | Direita |
| --- | --- | --- |
| 1 | Nome de exibição * | Nome de usuário * |
| 2 | E-mail * | Nome ENS * |
| 3 | Apelido da carteira * | Avatar *(sem asterisco)* |

**Campo ENS — `70386:249`** (417×40, composto): select `.eth` de `78px` à esquerda
(texto `.eth` 15px regular em `x 10, y 13`, `Arrow-Down` 20×20 centrado
verticalmente em ~`x 53`), e input de `329px` em `x 88`. Gap efetivo de 10px entre
as duas caixas. Gap label 4 nesta linha, não 10.

**Campo Avatar — `70386:252`**: label "Avatar" 15px regular, **sem asterisco**.
Controles em `flex gap-24 items-center`:
- preview `50×50`, **raio 25** (círculo), `bg surface-raised` (#2f1d15), borda
  `border`, `p-12`, com `Iconly/Curved/Image 2` 24×24 dentro
- botão "Alterar": `98×40`, raio 3, `bg primary`, texto 14px bold em `ink`
- "Remover": 14px regular lh 16 `foreground`, gap 20 do botão — **é ação, precisa
  ser `<button>`**, não texto

### 2.2 Alterar senha — `70386:255` (gap 24)

Título "Alterar senha" **16px medium** lh 16 `foreground`. Três campos empilhados,
gap label→input **12** (não 10):

- Senha atual
- Nova senha
- Confirmar nova senha

Todos usam o componente **Password Input** (`70504:2973`): 417×40, raio 3, borda
`border`, `px-16`, `justify-end`, com `Iconly/Light-Outline/Hide` 20×20 à direita.
O componente **não tem nó de texto** — a documentação do Figma pede adicionar um
TEXT node em vez de destacar a instância. Em código: `<input type="password">` com
o toggle como `<button>` de `aria-pressed`.

Nenhum dos três tem asterisco, mas os três são obrigatórios para trocar senha.

### 2.3 Salvar — `70386:262`

`131×40`, raio 3, `bg primary`, "Salvar" 14px bold em `ink`.

### 2.4 Contrato vs. desenho — tensão real

`src/types/profile.ts` aceita `{ name?, avatarUrl?, bio? }` e **e-mail é imutável**
(comentário explícito no arquivo). O desenho pede seis campos, marca **e-mail como
obrigatório com asterisco**, e não tem campo de bio.

| Campo do Figma | Destino no contrato |
| --- | --- |
| Nome de exibição | `name` ✅ |
| Nome de usuário | **não existe** |
| E-mail | existe em `Profile`, **read-only** no PATCH |
| Nome ENS | **não existe** |
| Apelido da carteira | `Wallet.label` da carteira **primária** ✅ |
| Avatar | `avatarUrl` ✅ |
| *(ausente)* | `bio` existe no contrato e não é desenhado |

✅ **DECIDIDO — estender o mock.** O usuário decidiu que todo campo desenhado deve
salvar de verdade. Nada de campo decorativo: input que o usuário preenche e a API
ignora é mentira de UI, e a regra 5 do desafio proíbe.

O que muda em `src/types/profile.ts` e `src/mocks/handlers/profile.ts`:

| Campo | Ação |
| --- | --- |
| Nome de usuário | **adicionar** `username` a `Profile` e a `updateProfileSchema` |
| Nome ENS | **adicionar** `ensName` a `Profile` e a `updateProfileSchema` |
| Apelido da carteira | **fica na tela** — edita `Wallet.label` da primária via `PATCH /api/wallets/:id` |
| E-mail | continua **imutável**: `readOnly` + `aria-describedby` explicando |
| `bio` | fica no contrato, **sem campo na tela** (o Figma não desenha) |

`username` precisa ser único por usuário — o handler deve devolver **409** em
colisão, como `POST /api/wallets` já faz com endereço, e a UI associa o erro ao
campo. `ensName` é texto livre com o sufixo `.eth` vindo do select de 78px; guardar
o valor completo, não só o prefixo.

Os dois campos entram nas fixtures (`src/mocks/fixtures.ts`) e ganham teste de
contrato — incluindo o 409 de `username` duplicado, que precisa **falhar uma vez**
antes de virar verde, pela regra do `CLAUDE.md`.

#### ⚠️ Correção do usuário — "Apelido da carteira" NÃO sai da tela

A versão anterior desta seção mandava remover o campo, alegando que `Wallet.label`
pertencia à §3. Estava errado: o campo **está desenhado neste frame** (`9:1238`,
linha 3, coluna esquerda, ao lado do Avatar) e tem destino real.

Como fica:

- O campo carrega o `label` da carteira com `role: 'primary'` (`GET /api/wallets`).
- O submit manda `PATCH /api/profile` **e**, se o apelido mudou,
  `PATCH /api/wallets/{id da primária}`.
- **Usuário sem carteira nenhuma**: o campo **não some** — renderiza desabilitado,
  com texto explicando que é preciso cadastrar uma carteira antes e link para
  `/carteiras`. Campo que some sem explicação é pior que campo desabilitado que se
  explica.

O layout correto da grade de campos, para não se perder de novo:

| Linha | Esquerda | Direita |
| --- | --- | --- |
| 1 | Nome de exibição * | Nome de usuário * |
| 2 | E-mail * | Nome ENS * (select `.eth` + input) |
| 3 | Apelido da carteira * | Avatar |

O e-mail permanece imutável porque o contrato o definiu assim na fase 1 e trocar
e-mail sem reverificação seria inventar um fluxo que o desafio não pede.

`POST /api/profile/password` já existe e cobre o bloco de senha inteiro, incluindo o
erro `currentPassword: 'Senha atual incorreta.'`.

## 3. Carteiras — `70390:239` (Wallets Form)

Mesmo shell, `flex-col gap-32`.

### 3.1 Section Heading — `70390:240` (gap 8)

- Title Row `justify-between`: "Carteira principal" **17px bold lh 16**
  `foreground` · "Adicionar" **16px medium lh 16** `text-accent` — é `<button>`
- Subtítulo: "Estas carteiras ficam disponíveis no pagamento e para receber NFTs
  comprados." 14px regular **lh 15** `text-secondary`

### 3.2 Fields — `70390:242` (gap 24)

Cinco linhas, dois campos de 417 cada. Mesmos tokens da seção 2.1 (h 40, raio 3,
borda `border`, label 15px + `*` coral 22px). **Gap label→input: `mb-[-4px]`** no
label, não gap positivo — o Figma usa margem negativa; em código equivale a ~4px.

| Linha | Esquerda | Direita |
| --- | --- | --- |
| 1 | Nome de exibição * | Apelido da carteira * |
| 2 | Rede * *(select)* | Nome do perfil * |
| 3 | Endereço da carteira * | *(input sem label)* |
| 4 | Tipo de carteira * *(select)* | Código de indicação * |
| 5 | E-mail * | Nome ENS * |

Placeholders (14px regular lh 15, **`secondary` #b39463**, em `x 13, y 12`):
- Rede: "Selecione uma rede" + `Arrow-Down` em `x ~389` (93.29% left)
- Endereço da carteira: "Endereço 0x da carteira"
- Linha 3 direita: "ENS ou carteira secundária (opcional)" — **é o único campo
  declaradamente opcional da tela**
- Tipo de carteira: "Selecione uma carteira" + `Arrow-Down`

A Field Row 3 é `items-end` (as outras são `items-start`), porque o campo da
direita não tem label e precisa alinhar pela base.

O campo ENS da linha 5 é o **mesmo composto** da seção 2.1: `78px` `.eth` +
`Arrow-Down` + `329px` em `x 88`.

### 3.3 Salvar carteira — `70390:262`

`131×40`, raio 3, `bg primary`, "Salvar carteira" 14px bold `ink`, centrado.

### 3.4 Carteira secundária — `70390:263` (gap 12)

- Title Row: "Carteira secundária" 17px bold `foreground`; à direita um bloco
  `Actions` de `343×16` com três elementos posicionados:
  - `Ellipse 22` 16×16 em `x 0` — é um **checkbox/radio**, sem preenchimento
  - "Igual à carteira principal" em `x 24`, 14px regular lh 16 `foreground`
  - "Adicionar" em `x 251`, **16px medium** `text-accent` — `<button>`
- Estado vazio: "Você ainda não adicionou uma carteira secundária." 14px regular
  lh 15 `text-secondary`

Este bloco é o **estado vazio da lista de carteiras secundárias**. Não há desenho
de lista preenchida — derivar do card mobile de carteira do checkout
(spec 07 §6.3: `358×93`, raio 14, nome 16px bold, detalhe 14px lh 22
`text-secondary`, menu `⋮`), que é o único card de carteira que o Figma tem.

### 3.5 Contrato vs. desenho — tensão real

`src/types/wallet.ts` aceita `{ label, address, network, role }` com
`address` validado por `/^0x[a-fA-F0-9]{40}$/` e `network` em
`['ethereum','polygon','solana']`. Dez campos desenhados, quatro no contrato.

| Campo do Figma | Destino |
| --- | --- |
| Apelido da carteira | `label` ✅ |
| Endereço da carteira | `address` ✅ |
| Rede | `network` ✅ (três opções, não livre) |
| "Carteira principal"/"secundária" | `role` ✅ — vem da seção, não de campo |
| Tipo de carteira | **não existe** |
| Nome de exibição, Nome do perfil, E-mail, Nome ENS | pertencem ao **perfil** |
| Código de indicação | **não existe** |

✅ **DECIDIDO — estender o mock, mesma regra da §2.4.**

| Campo do Figma | Ação |
| --- | --- |
| Tipo de carteira | **adicionar** `type` a `Wallet` e a `walletSchema` |
| Código de indicação | **adicionar** `referralCode` (opcional) a `Wallet` |
| Nome de exibição, Nome do perfil, E-mail, Nome ENS | **remover da tela** |

Os quatro campos de perfil saem daqui: são da tela de perfil, duplicados na tela
errada pelo designer. Gravar perfil e carteira na mesma submissão seria inventar
comportamento que o desafio não pede — e o usuário já tem onde editá-los.

`type` é **enum, não texto livre** — o Figma mostra um select ("Selecione uma
carteira"). As opções não estão desenhadas; derivar das que o pagamento mobile
oferece (spec 07 §6.4): `metamask`, `walletconnect`, `coinbase`. Isso amarra as duas
telas: a carteira cadastrada aqui é a que aparece lá.

`referralCode` é o único campo **opcional** dos dois que entram — o Figma marca com
asterisco, mas código de indicação obrigatório trancaria o cadastro de quem não tem
um. Renderizar sem asterisco e registrar o desvio no ARCHITECTURE.md.

Ambos entram nas fixtures e ganham teste de contrato.

✅ **DECIDIDO — criar `DELETE /api/wallets/:id`.** `src/mocks/handlers/wallets.ts`
só tem GET, POST e PATCH. O usuário decidiu que o menu `⋮` oferece **Remover**.

O menu `⋮` passa a ter três ações: **Definir como principal** (`PATCH` com
`role: 'primary'`, já funciona), **Editar** (`PATCH`, já funciona) e **Remover**
(`DELETE`, a criar).

Regras do handler novo:

- `404` se a carteira não existe ou não é do usuário da sessão
- **não remover a última carteira `primary`** quando ela é a única da lista →
  `409 conflict`, mensagem explicando. Sem primária o pagamento (spec 07 §6.3)
  perde a carteira selecionada.
- remover uma `primary` quando **existe** secundária: promover a mais antiga a
  `primary` no mesmo request, e a UI avisa **qual** foi promovida. Promoção silenciosa
  é a mesma armadilha do rebaixamento abaixo.
- `persist()` ao fim, como os outros handlers

Testes de contrato obrigatórios, e o do 409 precisa **falhar uma vez** antes de
virar verde — regra do `CLAUDE.md`:

1. remover secundária → 204, lista encurta
2. remover a única primária → 409, lista intacta
3. remover primária com secundária existente → 204 + secundária promovida
4. remover carteira de outro usuário → 404 (isolamento, regra eliminatória 4)

Na UI, remover pede **confirmação** — é destrutivo e irreversível.

⚠️ `POST /api/wallets` já devolve **409 em endereço duplicado** e rebaixa as outras
a `secondary` quando entra uma `primary`. Os dois caminhos precisam de UI: o 409
com erro associado ao campo de endereço, e o rebaixamento com feedback acessível —
o usuário não pode descobrir que perdeu a primária só ao recarregar.

## 4. Comportamento exigido

- **Sem vazamento entre usuários** (regra eliminatória 4): as query keys de perfil
  e carteiras incluem o id do usuário; logout limpa cache privado.
- **Feedback acessível** em cada mutation: salvar perfil, trocar senha, salvar
  carteira, definir primária.
- Erros do servidor **associados ao campo** (`aria-describedby` + `aria-invalid`),
  não só num toast. O handler de senha já devolve `{ currentPassword: … }` e o de
  carteira devolve 409 sem campo — mapear o 409 para o input de endereço.
- **Navegação por teclado** na sidebar com foco visível; o item ativo com
  `aria-current="page"`.

## 5. Derivação mobile (nenhuma das duas telas tem frame)

Padrão dos frames mobile existentes (fases 3, 4, 6, 7 — todos 414 de largura com
`x 28` de margem, ou seja conteúdo de **358**):

1. **Sidebar vira navegação superior**, não drawer: os itens do menu são o índice
   da seção. Em ≤767px, renderizar como lista de links no topo da página ou como
   `<Sheet>` acionado por botão no header — o padrão do header mobile das fases
   anteriores já tem um drawer, reusar esse componente.
2. **Campos de 417px viram largura total** (`w-full`, máx 358): as linhas de dois
   campos empilham em uma coluna. As cinco Field Rows das carteiras viram dez
   campos empilhados — gap 24 entre eles, como no desktop.
3. **Screen Header** no padrão do carrinho/pagamento mobile: círculo voltar 35×35
   + título 20px bold lh 16 em `x 59`.
4. **Botão Salvar**: no desktop é `131×40` raio 3. Em mobile, os frames existentes
   usam CTA de largura total, `h-60`, **raio 40**, com gradiente
   `108.5deg, #d28a4c → rgba(210,138,76,0.8)`. Seguir o padrão mobile, não
   reescalar o botão desktop — foi exatamente essa a lição das quatro fases
   anteriores.
5. **Campo ENS composto** (78 + 329): em 358 de largura, `78px` + gap 10 + resto.

Registrar as cinco derivações no `ARCHITECTURE.md` como desvio consciente, com
o motivo (ausência de frame) e a referência ao frame de onde cada padrão veio.

## 6. O que já existe

`GET/PATCH /api/profile`, `POST /api/profile/password`, `GET/POST/PATCH
/api/wallets` — prontos desde a fase 1, com testes de contrato. Falta apenas o
`DELETE /api/wallets/:id`, se o menu `⋮` for implementado (ver 3.5).

## 7. Tokens

Verificado em `src/index.css`: **quase tudo já existe**.

| Token | Situação |
| --- | --- |
| `--color-text-coral: #f0805f` | ✅ linha 36 — o asterisco de obrigatório (19 campos) |
| `--color-surface-raised: #2f1d15` | ✅ linha 33, criado na fase 4 |
| `--text-body-17` (17px) | ✅ linha 46 — títulos de seção das carteiras |
| `--text-caption-12` / `--text-caption-13` | ✅ linhas 41–42 |
| `--text-title-21` (21px/16) | ❌ **não existe** — só o glifo `+` do stepper usa; se a fase 6 já criou, reusar |

Nada mais a criar. O `--color-text-coral` já estava lá desde a fase 2 mas **não
consta na paleta do `CLAUDE.md`** — acrescentar lá ao implementar esta fase.
