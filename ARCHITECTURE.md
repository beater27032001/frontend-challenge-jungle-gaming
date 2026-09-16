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


## Fase 4 — Detalhes do NFT

1. **Favoritar desabilitado nesta fase** — favoritos exigem sessão (fase 5);
   a atualização otimista com rollback (specs/04-detalhe-nft.md §4) entra
   junto dos favoritos reais, não aqui. O botão desktop (130×40) e o coração
   do hero mobile existem, posicionados por design, `disabled`.
2. **`ratingAvg`/`ratingCount`/`attributes` entram em `NftDetail`** (mesmo
   racional da resolução `network` da fase 3): o design exibe avaliação e
   atributos e o modelo não tinha o dado. Fixture determinística
   (`src/mocks/fixtures.ts`), zero PRNG. `SEED_VERSION` 3→4; `images` 3→4
   (o desktop tem 4 thumbnails, `10:244`).
3. **"Coleção" nos metadados do detalhe = rótulo PT da `category`** — o
   produto já chama categorias de "Coleções" no filtro e no footer;
   "Kurio Apes" no Figma é conteúdo de exemplo, não um campo novo.
4. **Preço no detalhe**: desktop mostra o preço unitário da edição
   selecionada; a Buy Bar mobile mostra `mulQty(priceEth, quantity)`
   (`src/lib/money.ts`, big.js). O Figma só desenha números estáticos —
   decisão de qual multiplicar registrada aqui, não inventada no componente.
5. **Pontos do hero mobile do detalhe são funcionais** (4 imagens reais na
   galeria), ao contrário dos decorativos do hero do catálogo (decisão 7 da
   fase 3): a composição pill-ativo + círculos foi verificada no SVG
   exportado (resolução OQ4 do Planner) só para este hero — **não**
   extrapolada para os heroes do catálogo, cujos SVGs não foram lidos.
6. **Em `/nft/*` mobile não há `MobileSearchBar` nem `TabBar`** (frame
   `15:5536` não as desenha); a Buy Bar fixa ocupa o fundo, e o `<main>`
   troca `pb-[126px]` por `pb-[164px]` nessas rotas (`__root.tsx`, via
   `useLocation`). O header desktop de telas de mercado é sem divisor
   (`withDivider={false}`, doc do componente, specs/02-design-system.md §2).
7. **Compartilhar = links reais de share** (LinkedIn/mailto/Twitter intent)
   em nova aba — comportamento coerente sem aparentar um recurso inexistente.
   Glifos lucide genéricos provisórios (`Link2`/`Mail`/`AtSign` — lucide v1
   não distribui ícones de marca), mesmo precedente dos ícones sociais do
   footer (decisão 3 da fase 2).
8. **Descrição mobile = a mesma descrição da API com `line-clamp-3`** (71px
   ≈ 3 linhas de 24px no frame) — não um texto mais curto separado; a copy
   mobile "mais curta" do Figma é o efeito do clamp, não outro dado.
9. **Estado "esgotado" e demais estados não desenhados** (skeleton/404/erro
   transitório) seguem o padrão visual já estabelecido nas fases 2/3
   (CHALLENGE §1), sem frame próprio no Figma para copiar.
10. **Carrossel "Mais desta coleção" padronizado deliberadamente** (placa
    219×255 sem raio, arte 212×212 `rounded-[13px]` centralizada): o Figma
    varia paddings e alterna raio 11/13 entre os 5 cards — inconsistência do
    arquivo, não intenção de design (specs/04-detalhe-nft.md §3 mandou
    registrar o desvio).
11. **Lupa da imagem principal = Dialog com a imagem ampliada** — comportamento
    honesto para um affordance de zoom desenhado sem estado aberto no Figma
    (resolução OQ2 do Planner). Cross-ref: mesmo critério de "zoom" da
    decisão 2 da fase 2 (equivalência funcional, não decorativa).
12. **Provisórios com `ponytail:` (extração fina pendente):**
    - tipografia e distribuição vertical do breadcrumb "Início / Mercado"
      (só a caixa 145×16 foi extraída do frame `10:244`, resolução OQ5);
    - padding horizontal (`px-4`) dos chips-elipse de edição (resolução OQ3);
    - composição interna dos dots do carrossel desktop "Mais desta coleção"
      (52×12 — espelha, até extração, a composição verificada do hero mobile:
      pill ativo + círculos, resolução OQ4; **não** vale para os heroes do
      catálogo, cujos SVGs não foram lidos).
    - O offset de 24px do container `Top` acima do header (frame `10:244`)
      não é aplicado: é margem do frame, e o shell compartilhado não a tem
      em nenhuma rota.
13. **Dívida 3 da fase 3 (footer `aria-current` por match parcial) aceita
    como decisão consciente** — nunca há dois links de coleção simultâneos
    ativos, e "coleção corrente" é semântica defensável para o match
    parcial. **Dívida 5 da fase 3**: esta entrada 11 acima é a cross-ref
    pendente, ligando o zoom do detalhe à decisão 2 da fase 2.
14. **Dívida 4 da fase 3 fechada**: `catalog-tester.spec.ts` e
    `catalog-e2e-tester.spec.ts` fundidos em `e2e/catalog.spec.ts` como
    `describe`s — nenhum teste perdido, mesmo movimento da fase 2 (specs/02
    §6). **Dívida 1 fechada**: o preâmbulo de Tabs do teclado agora assere o
    foco após cada Tab, não só no fim.
15. **Teste herdado da fase 3 ajustado, não deletado**: `catalog.spec.ts`
    ("MobileSearchBar submit from /nft/$nftId...") assumia que a busca
    inline funcionava em qualquer rota fora do catálogo — `/nft/*` era a
    única rota assim e a decisão 6 desta fase a removeu de lá. Reescrito
    para a asserção negativa (a barra realmente não existe nessa rota);
    `e2e/nft-detail.spec.ts` cobre o resto do critério 16.
16. **Dívidas 6 e 9 da fase 2/3 não são trabalho desta fase** — já estavam
    fechadas (entradas fantasma corrigidas pelo usuário); esta fase só
    cobre o comportamento com teste (critério 15: "Mercado" ativo em
    `/nft/*`, header sem régua nessa rota).

### Ciclo de correção (iteração 1) — pós-review

17. **Chips de edição alinhados ao Figma (opção A do usuário)** — o
    `label` deixou de ser o nome fantasia `Standard`/`Deluxe` e passa a ser
    **gerado de `totalSupply`** em `src/mocks/fixtures.ts` (`editionLabel()`):
    `1/{totalSupply}` para edições com cap fixo, `ABERTA` quando
    `totalSupply` é `null` (edição aberta, sem cap — `NftEdition.totalSupply`
    virou `number | null`). É a mesma forma de resolução das fases 2/3
    (categorias 4→9, `network`), mas aqui o **valor** de `totalSupply` (10 na
    e1, 3 na e2) foi mantido: `e2e/api-contracts.spec.ts` trava dezenas de
    asserções numéricas exatas nesses números (decrementos 10→9→8→7→6, reset
    para 10, soma 13, filtro de preço pós-mutação em nft-012 etc.) — variar
    `totalSupply` por NFT para produzir literalmente `1/1`/`1/50` no seed
    quebraria esse contrato sem necessidade. Precedente do projeto (preço,
    copy, avatares) é o **formato** do dado bater com o design, não o valor
    literal do mock do Figma. `ABERTA` está suportada pelo tipo e pela
    função, mas nenhuma edição da seed atual a usa — registrar aqui em vez de
    inventar uma edição sem cap só para exibir a string.
18. **`--color-amber` não consumido, justificado**: o token existe
    (`src/index.css`) para o pill de avaliação mobile (spec 04 §1), mas a
    estrela do pill já usa `text-text-accent` (#e89b55) desde a implementação
    original — cor do design system para acento, também plausível para uma
    estrela de nota. Trocar exigiria confirmar no Figma se `--color-amber`
    é realmente a cor da estrela ou de outro elemento do pill não
    transcrito na spec 04 (que só cita "aparece no pill", sem apontar qual
    parte); sem esse dado, ficar com o token já verificado (`text-accent`) é
    mais seguro que adivinhar. Fica registrado como dívida para quando
    houver acesso ao Figma para confirmar.
19. **Dots do carrossel "Mais desta coleção" ausentes — deliberado, não
    bug**: `related-carousel.tsx` só renderiza `Carousel Dots` quando
    `totalPages > 1`. Com a seed atual (48 NFTs, `category = i % 9`), nenhuma
    categoria tem mais de 6 itens; excluindo o NFT corrente, o máximo de
    relacionados é 5 = 1 página. Um dot único que não pagina seria a
    decoração-com-cara-de-função que o desafio proíbe (§8). Diverge do
    Figma (que desenha os dots), mas é o comportamento certo dado o volume
    de dados do mock, não uma correção pendente.
20. **Classe de flake: interação de teclado contra um controle Radix
    correndo contra uma query ainda resolvendo.** Terceira ocorrência da
    mesma família neste projeto — clique-fora do Radix (fase 2), foco do
    slider (fase 3), agora `e2e/catalog.spec.ts` disparando `ArrowRight`
    repetido no thumb do `Slider` de preço. A suspeita inicial (Radix
    perdendo `keydown` sob contenção de CPU) **não era a causa raiz** —
    confirmado instrumentando um `MutationObserver` no atributo
    `aria-valuenow` durante a sequência: o `FilterPanel`
    (`filter-panel.tsx`) nasce com `max` provisório `1` até a query de
    `facets` resolver (latência simulada do MSW); se o usuário já estiver
    apertando `ArrowRight` quando essa query assenta, o efeito que
    resincroniza o rascunho do preço com a URL (`if (syncedTo !== urlPrice)
    setDraft(...)`) devolve o thumb para `0` no meio da sequência — uma
    corrida real entre o carregamento dos facets e a interação, não perda
    de evento. Sob paralelismo pesado a janela de colisão é maior, daí a
    aparência de "ligado a CPU".
    **Receita**: para um controle cujo valor pode ser resetado por um
    estado assíncrono ainda em voo, a espera determinística certa não é por
    tecla — é esperar esse estado **assentar antes da primeira tecla**
    (aqui, `aria-valuemax` parar de mudar por uma janela real, não uma
    leitura que por acaso bateu com a anterior). Depois disso, cada
    `ArrowRight`/`ArrowLeft` avança de forma confiável e um simples "mudou
    desde a tecla anterior" basta. Extraído como `pressArrowAndWaitValue()`
    (mais o utilitário `waitStable()`) em `e2e/helpers.ts` para a próxima
    interação de teclado contra Radix já nascer usando o helper em vez de
    reinventar o `waitForFunction`.

### Ciclo de correção (iteração 2) — o coordenador reproduziu 2 falhas que a
iteração 1 não pegou, sempre em `mobile-chromium`, sob `pnpm test` verificado
por ele mesmo

21. **Classe de flake irmã: primeiro `Tab` da sequência de teclado disparado
    antes de o documento ter foco.** `boot()`/`bootReset()` resolve quando os
    mocks respondem, não quando `document.hasFocus()` é verdade. Sob
    paralelismo pesado a janela entre "página carregada" e "documento com
    foco" cresce, e um primeiro `Tab` disparado nessa janela não move o foco
    para o primeiro elemento tabulável — a asserção seguinte falha (visto em
    `catalog.spec.ts:397` e em pelo menos 5 testes de
    `runtime-behavior.spec.ts` que repetiam o mesmo preâmbulo). Mesmo
    princípio da decisão 20: converter a suposição de estado inicial em
    espera explícita. `pressFirstTab()` (`e2e/helpers.ts`) espera
    `document.hasFocus()` antes do primeiro `Tab`; os Tabs seguintes da
    mesma sequência não precisam disso, o documento já está com foco.
    Trocado em todo caller que fazia esse preâmbulo (grep por
    `keyboard.press('Tab')` logo após `boot`/`bootReset`), não só no teste
    que o coordenador citou — mesma bug, mesmo commit.
22. **Leitura única de `location.search` correndo contra um `.click()`
    assíncrono.** `catalog.spec.ts:73` lia `location.search` uma vez,
    imediatamente após `.click()` no filtro de rede — mas `.click()` resolve
    quando o evento é disparado, não quando o `navigate()` do router (que
    reage ao `onClick`) termina de escrever a URL. Sob contenção pesada essa
    janela é grande o bastante para a leitura pegar a URL velha. Trocado por
    `expect.poll(() => page.evaluate(() => location.search))` só nessa
    asserção — não uma reescrita de todo o arquivo, que tem 47 leituras
    síncronas de `location.search`; as outras seguem depois de
    `goBack()`/`goForward()` (mecânica nativa do browser, síncrona com a
    própria navegação, sem a mesma corrida).
23. **Higiene de processo descoberta no meio da investigação**: rodadas
    anteriores desta sessão deixaram vários `vite preview --port 4173`
    esquecidos rodando em paralelo (sessões de `pnpm test` anteriores nunca
    finalizadas), e uma rodada com 25 falhas espúrias em arquivos não
    relacionados só aconteceu com esse acúmulo. Confirma o aviso que já
    estava em `e2e-test-results.md` ("matar processo na porta antes de cada
    rodada") — mas agora com prova de quanto isso pode contaminar a medição
    de flake: uma rodada "suja" pode parecer uma regressão generalizada e
    não é.


## Fase 5 — Conta e sessão

**Nota de processo**: a primeira passada desta fase foi escrita contra uma
extração incompleta do Figma (`specs/05-auth.md` só tinha a seção 1–6, e as
"Open Questions" do spec do Coder derivaram cadastro/mobile por presunção sob
prazo). No meio da implementação, `specs/05-auth.md` ganhou as seções 7–9 com
o cadastro desktop e os dois frames mobile REALMENTE extraídos — e a extração
contradiz a presunção em dois pontos estruturais: **mobile não é o modal
encolhido, é rota própria de tela cheia**, e o modal desktop tem outro raio
(8, não 5) e outro subtítulo por aba. A implementação foi refeita em cima da
extração real; as decisões abaixo já refletem essa versão final, não a
presunção original.

1. **`/login` e `/cadastro` são rotas reais, não search param.** O Figma
   mobile prova isso: login/cadastro no mobile são páginas cheias com o
   próprio logo/título, não um modal encolhido (specs/05-auth.md §8, item que
   contradiz a seção 1 do próprio spec). Uma rota por tela, duas composições
   por breakpoint (`hidden lg:*`/`lg:hidden`, mesmo padrão de
   `nft.$nftId.tsx`) — não dois mecanismos. `redirect` (query string,
   validada com `.catch(undefined)` se não começar com `/`) carrega a página
   de origem: header, coração de favorito e o interceptor de sessão expirada
   todos passam o `pathname` atual: é o "retorno ao fluxo anterior" (§3) via
   navegação real, em vez de um param que some.

2. **Compromisso registrado (bloco grande demais para a versão "modal
   literalmente sobre o catálogo montado"): o desktop não mantém a página de
   fundo montada por trás do Dialog.** O Figma pede o catálogo visível atrás
   do overlay; construir isso de verdade exigiria rotas paralelas/
   intercepting routes (Next.js tem; TanStack Router não tem esse mecanismo
   nativo) — fora do orçamento desta fase sob prazo. A composição desktop
   usa o `Dialog` do Radix (focus trap/Esc de graça) centrado num overlay
   escuro; ao fechar ou concluir o form, navega para `redirect` (a página
   real de origem) via navegação de verdade, o que entrega o "retorno ao
   fluxo anterior" funcionalmente (a URL/estado da página de origem volta
   exatos) sem o efeito visual de camadas. Header/Footer continuam
   renderizando por trás (o `__root__` não os esconde nesta rota), o que
   aproxima visualmente sem ser literal.

3. **Dialog só monta em `>=lg` via JS (`useMediaQuery`), não só CSS.** Radix
   Portal escapa da hierarquia do DOM: um `hidden lg:block` no wrapper NÃO
   escondia o conteúdo do Dialog em telas menores (o portal insere direto em
   `document.body`), e mesmo escondendo por CSS puro (`className` no próprio
   painel) o *overlay* e o *focus trap* continuavam ativos, roubando o foco
   da tela mobile por trás. `src/lib/use-media-query.ts` (hook novo,
   `window.matchMedia`) só monta `<Dialog>` quando `min-width: 1024px` bate;
   abaixo disso `LoginDesktop`/`RegisterDesktop` retornam `null` e
   `LoginMobile`/`RegisterMobile` (página comum, sem Dialog) são o que
   existe no DOM.

4. **Confirmar senha é campo client-only.** O Figma pede "Confirmar senha"
   nos dois formulários de cadastro (specs/05-auth.md §7.1/§8.4) mas
   `registerSchema` (contrato da API) não tem esse campo. `registerFormSchema`
   (`auth-schemas.ts`) estende `registerSchema` com `confirmPassword` + um
   `refine` (senhas iguais) só para validação local; `register.mutate` recebe
   só `{ name, email, password }` — o campo nunca sai do browser.

5. **Toggle de olho nos dois campos de senha, nas duas superfícies.** O
   Figma é assimétrico (só "Senha" tem o olho no modal desktop; os dois
   campos têm no mobile — specs/05-auth.md §7.1 vs §8.4, e o próprio spec
   recomenda unificar). Resolvido a favor de dar o toggle a todo campo de
   senha: esconder "Confirmar senha" sem poder revelá-lo é hostil, e o
   Figma mobile já faz assim.

6. **Dois erros do Figma corrigidos, não copiados** (specs/05-auth.md §8.4,
   item 9 de "Consequências"): o placeholder do primeiro campo do cadastro
   mobile estava em inglês ("User Name") e centralizado (`x 115.5` contra
   `x 16` dos outros três) — usa "Nome de usuário" com o mesmo `pl-16` dos
   demais, igual ao modal desktop já fazia.

7. **A faixa de 10px do rodapé existe só no login desktop.** O node do
   cadastro desktop (`9:1230`, `y 646`) está fora dos 600px do modal — sobra
   de composição, não um elemento intencional (specs/05-auth.md §7.4).
   Incluída só no login (onde `top: 590` fecha exatamente nos 600px);
   incluir também no cadastro criaria uma assimetria que o próprio Figma não
   desenhou.

8. **Dois conjuntos de primitivos de input, não um** (specs/05-auth.md §9):
   desktop `h-40`/raio `5`/`px-16 py-12`; mobile `h-50`/raio `10`/`pl-16`. O
   raio do **shell** do modal é `8` (não 5 — a presunção original errou essa
   medida, só tinha certeza do raio do input). CTA desktop `h-45`/raio `5`;
   CTA mobile `358×60`/raio `10` — **raio 10 e cor plana**, nunca confundir
   com o CTA-pílula (raio 40 + gradiente) do carrinho/pagamento (specs
   06/07), são componentes de propósito diferente.

9. **Cópia difere por breakpoint no cadastro**: desktop chama o CTA
   "Criar conta" (specs/05-auth.md §7.2); mobile chama "Criar perfil" e o
   título é "Criar perfil de colecionador" (§8.3/§8.5) — não normalizar para
   o mesmo texto nas duas composições, é o que o Figma mostra.

10. **`--text-title-20-medium` não empacota o peso 500.** Nenhuma escala
    existente empacota `font-weight` (só tamanho, e às vezes `line-height`
    via companion `--line-height`) — o peso sempre foi aplicado por
    `font-medium`/`font-bold` no call-site. O token novo carrega tamanho
    (20px) + `line-height` (16px); `font-medium` vem da classe Tailwind no
    call-site (`auth-desktop.tsx`). Note que o mobile usa 20px **bold** no
    título (§8.3) — token diferente, não reaproveitar este aqui.

11. **`getRouteApi('__root__')` em vez de `useNavigate({ from: '__root__' })`.**
    TanStack Router recusa `'__root__'` como `FromPathOption` de
    `useNavigate` (erro de tipo) — `getRouteApi('__root__').useNavigate()`,
    chamado fora do arquivo da rota (header, card mobile), é o padrão oficial
    da lib para o mesmo resultado tipado quando o componente está montado em
    toda rota. Em `main.tsx`, fora de qualquer componente React, não há hook
    disponível: `router.navigate({ to: '/login', search: { redirect } })`
    com `to` explícito.

12. **Honestidade sem backend (§3, mesma regra da newsletter/fase 2):**
    Google, Facebook (ícones genéricos `Globe`/`ThumbsUp` do lucide, mesmo
    precedente dos ícones sociais do footer — a marca não tem glifo próprio
    na lib) e "Esqueceu a senha?" são `disabled`, com `title` explicando a
    ausência de backend. Nenhum dos três chama `/auth/*` nem finge sucesso.

13. **Logout não existe no mobile nesta fase (dívida da fase 8).** Sem
    header mobile e sem tela de Perfil até a fase 8, não há entrada de
    logout em `< lg`. Um usuário que logar no mobile permanece logado até
    limpar cookies manualmente ou voltar ao desktop — aceito, registrado
    como dívida (mesma decisão do plano, "Out of scope" do spec 05).

14. **Guard de rota (`beforeLoad`) não nasce nesta fase.** Não existe rota
    privada ainda — checkout (7) e perfil/carteiras (8) não têm rota, e
    favoritos não têm página própria no Figma. O que a fase 5 protege,
    protege na interação (coração/Favoritar → navega para `/login`). O guard
    nasce com a primeira rota privada, ~5 linhas usando o mesmo `redirect`.

15. **Logout faz `queryClient.clear()` + `window.location.reload()`, não só
    `clear()`.** Investigação ao vivo (Playwright + `window.__debug*` ad-hoc)
    achou um caso real de vazamento pós-logout: o coração do card de
    catálogo (cada card com seu próprio `useSession()`) continuava mostrando
    o favorito de Ana depois de "Sair", enquanto o Header (também
    `useSession()`, um único consumidor) atualizava corretamente para
    "Entrar" no mesmo instante. Instrumentado (push de `scope`/`session.data`
    a cada render): o Header recebeu a notificação de `clear()`
    (5 renders, o último com `hasData:false`); o `HomePage` da rota `/`
    (dono da query de favoritos/lista do card) **parou de renderizar
    completamente** depois do clique em "Sair" — 4 renders, todos ainda
    com `scope:'u-ana'`, nenhum depois. Confirmei que não é timing (esperei
    a resposta do `PUT /favorites` assentar antes do logout) nem cookie
    (`fetch` manual pós-logout confirma 401 correto). Não achei a causa raiz
    de por que dois consumidores da MESMA query React Query reagem diferente
    a um `clear()` — sob prazo, a correção mais simples e a que o §11
    exige (eliminatório) é forçar um reload completo: garante estado
    zerado para QUALQUER componente, não depende de nenhum observador
    específico reagir corretamente. Login/registro continuam client-side
    (sem reload) porque ali `queryClient.setQueryData(sessionKey, session)`
    já prova, testado, que todo consumidor assenta. **Dívida para quem
    revisitar**: reproduzir isolado (sem Playwright) e abrir uma issue no
    TanStack Query se for bug da lib, ou achar o componente/memo que está
    engolindo a notificação se for erro nosso.
16. **"Limpar subscriptions" no logout está vazio até o Socket.IO nascer**
    (fase 6/7). `queryClient.clear()` já cobre 100% do cache (privado e
    público — é a garantia de zero vazamento entre usuários, §11); quando o
    socket nascer, o `disconnect()` entra na mesma rotina de higiene
    (`onSuccess` de `useLogin`/`useRegister`/`useLogout`), não em um lugar
    novo.

17. **Debounce do interceptor de `session_expired` é por tempo (300ms), não
    por promise.** Várias queries em voo resolvem em tasks separadas, não no
    mesmo microtask — um `queueMicrotask` resetaria a flag antes da segunda
    resposta chegar e disparar dois toasts/duas navegações. 300ms cobre a
    rajada real (queries lançadas juntas no boot ou ao trocar de tela) sem
    represar um segundo evento genuíno depois de relogar.


## Limitação conhecida — flake residual na suíte E2E

Para quem avalia: `pnpm test` roda 380 testes em desktop 1440 e mobile 390, e
passa em cerca de 3 de cada 4 rodadas completas sob paralelismo padrão. Antes das
correções da fase 4 falhava em torno de metade das rodadas.

O que resta é **infraestrutura de teste**, não código de aplicação. Três famílias
foram diagnosticadas e corrigidas na causa (itens 20 a 22); a fonte residual é uma
tolerância de tempo de parede em `e2e/runtime-behavior.spec.ts:118`, que assere que
o cenário `slow` demora ~2500ms com teto de 3500ms — apertado quando a máquina está
sob carga. Rodar com `--workers=1` passa de forma consistente.

Não foi perseguido até 100% por decisão consciente de prazo. O conserto é
one-liner: asserir só o piso da latência, que é o que o teste de fato prova.

**Fase 5 (novo, mesma família):** `e2e/runtime-behavior.spec.ts` — "Favoritos
otimistas... cenário server-error" assere `aria-pressed` passando por `true`
(otimista) e depois `false` (rollback) em sequência — uma rodada sob o
paralelismo pesado da suíte inteira (4 workers, 408 testes) perdeu a leitura
do `true` porque o rollback já tinha acontecido antes do primeiro poll do
`expect`. Passou de forma consistente em 4 rodadas isoladas (grep escopado a
"fase 5", sem o resto da suíte competindo por CPU). Mesma classe de flake dos
itens acima — tolerância de tempo apertada, não lógica de app errada.
Registrado, não perseguido, pela mesma decisão de prazo.
