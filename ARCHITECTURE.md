# ARCHITECTURE

Decisões e desvios da spec/design system que não são óbvios lendo o código.
`CLAUDE.md` referencia este arquivo como a casa dessas entradas.

## Fase 2 — Design system, dívidas de fixtures/E2E, shell de layout

1. **768 é tratado como mobile.** O Figma não tem frame tablet. Spec §11
   recomenda tratar 768 como mobile porque a tab bar escala bem até lá. O
   shell usa um único breakpoint, `lg` (1024px): abaixo dele, composição
   mobile (search bar + tab bar); a partir dele, composição desktop (header +
   footer). 768 cai do lado mobile.

2. **Footer é desktop-only (`hidden lg:block`).** O frame mobile (`14:5226`)
   não mostra footer nenhum — o rodapé mobile é ocupado pela tab bar fixa.
   Inventar um layout mobile para as três faixas densas do §9 violaria a
   regra "não invente"; omitir é o que o próprio Figma mostra. Revisitar
   **antes de qualquer conteúdo do footer se tornar funcional** (fase 3: a
   coluna "Coleções" vira filtro; ajuda/carteiras viram links). Hoje a perda
   do footer sob zoom 200% é aceitável porque todo o conteúdo é inerte, mas o
   CHALLENGE §8 lista "perda de conteúdo com zoom" como obrigatório — no
   momento em que o footer carregar conteúdo funcional sem equivalente na
   composição mobile, esta decisão expira.

3. **Placeholders de conteúdo pendentes de extração fina.** Nenhum destes é
   uma medida (raio, cor, tamanho) — são glifos ou strings que a transcrição
   do design system não nomeia:
   - glifo do FAB da tab bar (node `70395:245`): `Plus` (lucide-react)
     provisório, `// ponytail: glifo não transcrito, calibrar com node
     70395:245`;
   - os 5 ícones sociais do footer (§9 faixa 3): a extração pede
     Twitter/Instagram/Facebook/Youtube/Linkedin, mas o lucide-react
     instalado (v1) não distribui mais ícones de marca — cada rede usa um
     glifo genérico (`AtSign`, `Camera`, `ThumbsUp`, `Play`, `Link2`) com
     `aria-label` da rede real, 30x30, provisórios até uma extração de SVG de
     marca ou biblioteca dedicada;
   - e-mail e telefone da faixa 2 do footer: `contato@kurio.com` e
     `+55 11 5555-0100`, provisórios.

   A copy dos 3 blocos de destaque e do bloco de newsletter da faixa 1 do
   footer **não é mais placeholder**: foi extraída do Figma e persistida no
   §9 de `specs/02-design-system.md` (textos de corpo dos 3 medalhões e
   título/placeholder/texto de apoio da newsletter), e o código já a entrega
   fielmente.

4. **Indicador não-cromático do item ativo da tab bar.** Exigido pelo
   CHALLENGE §8 (estado nunca só por cor), ausente no Figma por ser ajuste de
   acessibilidade: o item ativo da tab bar leva `aria-current="page"` **e**
   um ponto de 4px (`size-1 rounded-full bg-current`) sob o ícone, presente
   só no item ativo. Cor (`text-text-accent`) continua presente, mas nunca é
   o único sinal de estado.

## Dívidas herdadas da fase 2 — situação após a fase 3

O item 6 (cenários `empty`/`out-of-order`) foi **quitado** na fase 3, com prova
real: o teste assere que o título do filtro descartado some do grid depois que a
resposta lenta aterrissa. Os outros 5 seguem abertos e estão repetidos na lista
da fase 4 abaixo, com a numeração de lá.

1. `src/components/layout/header.tsx:14-18` — `pathname.startsWith('/')`
   marca "Início" ativo em qualquer rota (inclusive 404); trocar por
   igualdade exata / prefixo mais específico quando a tabela crescer.
2. `src/index.css:24,65` — sombreamento de `--color-foreground` sobre o
   alias `--foreground` (mesma armadilha da colisão `--secondary`);
   consolidar ou comentar.
3. `src/components/ui/card.tsx:12` — `rounded-xl` (10px) foge do raio de
   sistema de 6px; alinhar para `rounded-lg`.
4. `src/components/ui/slider.tsx:62` — thumb `bg-white` fora da paleta;
   calibrar cor quando o filtro de preço nascer.
5. `src/components/ui/badge.tsx:15-19` — variantes `secondary`/`link`/`ghost`
   não usadas; podar ou justificar, espelhando o button.
6. `src/mocks/scenarios.ts:12,14` — cenários `empty`/`out-of-order` sem
   teste E2E (dívida desde a fase 1); cobrir junto do `catalog.spec.ts`.

## Fase 3 — Início / catálogo

1. **Zoom 200% resolvido por equivalência funcional.** O gatilho da decisão 2
   (fase 2) — "revisitar antes de qualquer conteúdo do footer se tornar
   funcional" — foi acionado pela coluna "Coleções" do footer, que agora
   navega para `/?category=...`. A resolução não é reexibir o footer no
   mobile (o frame `14:5226` não tem footer): é garantir que a mesma função
   (filtrar por categoria) tem equivalente completo na composição mobile — o
   `Sheet` de filtros aberto pela `MobileSearchBar`, que já existia como
   primitivo desde a fase 2 sem consumidor. A decisão 2 continua válida com o
   gatilho quitado, coberta em `e2e/runtime-behavior.spec.ts` (620px) e em
   `e2e/catalog.spec.ts` (equivalência funcional do filtro).
2. **`network` entra no modelo de NFT** (`NftSummary`/`NftDetail`/
   `NftListParams`, `src/types/nft.ts`). A seção "Rede" do painel de filtros
   (specs/02-design-system.md §3) não tinha dado para filtrar — renderizá-la
   sem filtro violaria "ações fora do escopo não devem aparentar sucesso
   funcional" (CHALLENGE §3). Fixture determinística em
   `src/mocks/fixtures.ts` (`NETWORKS[(i + Math.floor(i / 9)) % 3]`,
   deliberadamente não `i % 3`: com 9 categorias o gcd seria 3 e cada
   categoria mapearia para uma única rede, matando a combinabilidade
   categoria×rede) e filtro em `src/mocks/handlers/nfts.ts`. `SEED_VERSION`
   sobe de 2 para 3.
3. **Busca desktop: estado expandido não existe no Figma.** O ícone de
   busca do header (20×20, antes `disabled`) passa a alternar um campo
   inline reaproveitando o tratamento visual do campo mobile — desvio
   consciente, já que busca é requisito do desafio (§3) e o arquivo não
   desenha esse estado. `aria-expanded` no botão; Enter grava `q`, Escape
   fecha sem gravar e devolve o foco ao botão.
4. **Rótulos de ordenação** (`src/features/nft/labels.ts`): só "Listados
   recentemente" está transcrito no Figma. Os outros 3 valores de `NftSort`
   (`price-asc`/`price-desc`/`popular`) recebem rótulo em português sem
   introduzir nenhuma ordenação nova — a API já suportava os 4 desde a fase 1.
5. **Badge de raridade restrito a acima de comum.** O Figma só desenha
   `RARO`; `ÉPICO`/`LENDÁRIO` seguem o mesmo estilo (68×32 de referência,
   `bg-primary`, 13px medium ink), mas a largura passa a ser por conteúdo
   (`LENDÁRIO` não cabe em 68px fixos). `common` nunca renderiza badge.
6. **Hero mobile: fundo aproximado em CSS.** O Figma exporta um SVG de
   máscara com gradiente + 2 círculos para o hero mobile (366×190); sem
   acesso ao MCP do Figma para extrair o SVG, o fundo foi aproximado com um
   gradiente radial em `primary` sobre `bg-card` (`hero.tsx`). Revisitar se a
   baseline visual da fase 10 acusar divergência.
7. **Pontos decorativos dos heroes (`aria-hidden`).** Nem o frame desktop
   nem o mobile têm um segundo/terceiro slide desenhado — um carrossel de um
   slide só seria pior que nenhum. Os pontos (3× 40×8 no desktop, 3× 33×7 no
   mobile) são puramente decorativos.
8. **Mapeamento aba↔sort do toolbar** (`catalog-toolbar.tsx`): "Todos os
   NFTs" grava `sort: undefined` (default `newest`); "Novos lançamentos"
   grava `sort: 'newest'` explícito; "Em alta" grava `sort: 'popular'`. A aba
   ativa é derivada da URL (`popular`→Em alta, `newest` explícito→Novos
   lançamentos, ausente ou `price-*`→Todos os NFTs). A API não tem uma
   "janela de lançamento" própria — specs/03-catalogo.md §2 já descreve as
   abas como atalhos de ordenação, não filtros novos.
9. **Adaptações mobile sem frame correspondente:** o seletor de ordenação
   mora dentro do `Sheet` de filtros (não existe toolbar no frame mobile); a
   paginação renderiza abaixo do masonry; o banner "NFT EM DESTAQUE" é
   desktop-only (a sidebar inteira é `hidden lg:flex`, o frame mobile não o
   mostra).
10. **Placeholders provisórios pendentes de extração fina** (todos com
    comentário `ponytail:` no código, sem consumidor de medida exata no
    Figma disponível a este pipeline):
    - offset do coração de favorito e do badge de raridade no card mobile
      (`nft-card-mobile.tsx`);
    - offset da coluna direita do masonry (`mt-8` provisório em
      `catalog-grid.tsx`; o frame mostra L 513 / R 544 sem o delta exato);
    - posições e gradiente exato das 3 decorações do banner de destaque
      (`featured-banner.tsx`);
    - posição do grupo de artes sobrepostas do hero mobile dentro do card
      (`hero.tsx`) — só o offset relativo entre as duas imagens foi
      transcrito (`ml-[14px] mt-[88px]`), não a posição do grupo no card.
11. **Dívida 1 da fase 2 fechada:** `header.tsx` trocou
    `pathname.startsWith('/')` por igualdade exata para "Início" e adicionou
    "Mercado" (ativo em `pathname.startsWith('/nft')`, spec 02 §2); numa 404
    nenhum item fica ativo. **Dívida 4 fechada:** `slider.tsx` calibrado —
    thumb e trecho ativo do trilho em `primary`, trilho inativo em
    `border-soft` (specs/03-catalogo.md resolução OQ3; cor não transcrita,
    registrada como calibração). Dívidas 3 (`card.tsx` `rounded-xl`) e 5
    (variantes do badge) permanecem: nenhum consumidor desta fase as aciona.
12. **Migração da prontidão E2E:** `boot()` (`e2e/helpers.ts`) não depende
    mais do texto da tela de smoke — espera `window.__mocks` (instalado por
    `startWorker()` antes do React montar) e confirma `GET /api/health` com
    200. `awaitMswReady(page)` é exportado para reuso; as 15 asserções
    inline que liam `getByRole('status')` com "MSW respondeu" foram trocadas
    mecanicamente pela mesma chamada.
13. **Seção editorial "Diário da Cunhagem" e cards promocionais omitidos por
    completo** — o desafio exclui conteúdo editorial da entrega; blocos
    estáticos sem destino real aparentariam navegação funcional.
14. **Testes de fase 2 com asserções sobre estado `disabled`/ordem de
    tabulação do header e da `MobileSearchBar` atualizados** (não deletados)
    em `e2e/runtime-behavior.spec.ts`: a busca (desktop e mobile) e o filtro
    mobile deixaram de ser placeholders `disabled` nesta fase, então
    "próximo controle focável após X" mudou de destino em várias asserções
    herdadas da fase 2 — mesmo precedente da fase 2 quando as 9
    categorias/3 redes obrigaram a atualizar testes de fixture já existentes
    (specs/02-design-system.md §3).


## Dívidas para a fase 4

Achados `[minor]` da revisão da fase 3 mais o que sobrou da fase 2, num só lugar
— artefato de `.pipeline/` é sobrescrito pela fase seguinte, este arquivo não.

**Da revisão da fase 3:**

1. `e2e/catalog.spec.ts:387-391` — flake de ~1 em 20 (mobile, "Buscar" não
   focado após 4 Tabs). Preâmbulo com contagem fixa de Tabs sem asserção
   intermediária, mesma classe do flake de slider. Asserir foco a cada Tab.
2. `src/features/nft/components/catalog-toolbar.tsx:78` — prop `total`
   recebida e nunca usada. API morta: remover ou consumir.
3. `src/components/layout/footer.tsx:84` — o `<Link search={{ category }}>`
   literal ganha `aria-current` injetado pelo router por match parcial. O
   Reviewer julgou aceitável (nunca há dois, e "coleção corrente" é semântica
   defensável), mas é decisão implícita: ou alinhar com
   `activeOptions={{ exact: true }}`, ou registrar a aceitação aqui.
4. `e2e/catalog.spec.ts` + `catalog-tester.spec.ts` + `catalog-e2e-tester.spec.ts`
   — 3 arquivos, 1.346 linhas, um domínio. O padrão "um spec por agente"
   voltou; consolidar por domínio, como a fase 2 fez.
5. `ARCHITECTURE.md` decisão 2 (fase 2) — falta uma linha de cross-ref
   apontando que a fase 3 resolveu o mérito do zoom.

**Herdadas da fase 2, ainda abertas:**

6. ~~`src/components/layout/header.tsx` — `pathname.startsWith('/')`~~
   **JÁ FECHADA na fase 3.** `header.tsx:17-21` usa igualdade exata para `/` e
   prefixo `/nft` para "Mercado". Entrada obsoleta: montei esta lista a partir
   dos achados do Reviewer sem conferir se a fase 3 já os tinha resolvido. A
   fase 4 só cobre o comportamento com teste.
7. `src/index.css` — sombreamento de `--color-foreground` sobre o alias
   `--foreground`, mesma armadilha da colisão `--secondary` já corrigida.
8. `src/components/ui/card.tsx` — `rounded-xl` (10px) fora do raio de sistema.
9. ~~`src/components/ui/slider.tsx` — thumb `bg-white`~~ **JÁ FECHADA na
   fase 3.** O thumb usa `primary` e o trilho inativo `border-soft`. Mesma
   origem do erro do item 6.
10. `src/components/ui/badge.tsx` — variantes não usadas; podar ou justificar.

**Nota sobre esta lista:** duas entradas (6 e 9) nasceram obsoletas porque eu
as copiei dos achados do Reviewer sem verificar o código. O Planner da fase 4
pegou conferindo. Ao montar a lista da fase 5, **verificar cada item contra a
árvore antes de registrar** — dívida fantasma custa tempo de quem for quitá-la.

**Observação de design, não dívida técnica:**

11. No mobile o botão de filtro não é fixo (doc-y 16, sem ancestral `sticky`).
    Para filtrar no meio da lista o usuário precisa rolar até o topo. Está
    **fiel ao Figma**, que não mostra barra fixa — mas é fricção real, e vale
    reconsiderar se a fidelidade permitir.
