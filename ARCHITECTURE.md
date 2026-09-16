# ARCHITECTURE

Decisões e desvios da spec/design system que não são óbvios lendo o código.
`CLAUDE.md` referencia este arquivo como a casa dessas entradas.

> **Como citar uma decisão.** A numeração é **por seção**, não global: mais de uma
> fase usa o mesmo número. Sempre qualifique com a fase — "fase 7, decisão 46" —
> como os comentários de código já fazem. As fases 2 a 5 recomeçam em 1; as 6, 7 e
> 9 continuam uma sequência herdada. Não renumerado de propósito: há referências
> cruzadas em comentários de teste e de código que quebrariam.

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


## Fase 6 — Carrinho

Decisões tomadas onde o Figma não desenha. Todas foram levantadas pelo agente da
fase e revisadas antes de entrar.

37. **Total da linha é calculado, não lido da cotação.** `mulQty` (`big.js`) sobre
    preço unitário × quantidade. A cotação também traz `lineTotalEth`, mas fica um
    instante atrasada em relação ao carrinho logo após mexer no stepper, e o
    número piscaria. Subtotal, desconto, taxa de rede e total **continuam vindo de
    `POST /api/quote`**, como o CLAUDE.md exige — a exceção é só a linha.
38. **Cupom recusado esconde desconto, taxa e total** (mostra `—`) e preserva o
    subtotal, que vem de `GET /cart`. A alternativa — cotar sem cupom em paralelo —
    custava mais código e escondia o erro.
39. **Cupom é normalizado para maiúsculo** antes de enviar; o mock compara exato.
40. **Remover cupom não existe no Figma.** Com cupom aplicado, o input fica
    `readOnly` com o código e o botão passa a "Remover". Copy nossa.
41. **Estado vazio não existe no Figma.** Card com "Seu carrinho está vazio" e link
    "Continuar explorando".
42. **Carrinho vazio remove a cotação do cache** em vez de invalidar: `POST /quote`
    com carrinho vazio responde 400, e invalidar geraria um erro de console a cada
    esvaziamento.
43. **A lixeira colide com o botão `+` no próprio Figma** (`313..337` contra
    `318..342`, verificado no arquivo, não erro de transcrição). Adotado: uma linha
    à direita, stepper e depois lixeira, sem sobreposição.
44. **Steppers do mobile são 24×24 no Figma**, abaixo do alvo de toque de 44px. A
    área clicável foi ampliada sem mover o visual.
45. **O stepper virou componente** (`src/components/quantity-stepper.tsx`),
    extraído da Buy Bar mobile da fase 4, que o tinha embutido. Ganhou focus ring,
    que a versão original não tinha.
46. **Defeito da fase 4 corrigido na origem:** `useAddToCart` não sincronizava
    cache nenhum, então o badge e a tela do carrinho só reagiriam depois do
    `staleTime` de 30s.
47. **O breadcrumb do desktop foi implementado como `<h1>` e corrigido depois.** O
    bloco de 244×16 é `Início / Mercado / Carrinho` (`11:1309`). A causa foi o spec
    dizer "breadcrumb ou título, não extraído em detalhe" — ambiguidade no spec
    vira escolha errada no código. O `<h1>` permanece em `sr-only`, porque o
    desktop não desenha título de página e leitor de tela precisa de um.

## Dívidas para as fases 7 e 8

Consolidado do que ficou aberto nas fases 5, 6 e 9. Quem pegar a fase 7 ou a 8
deve ler esta lista antes de planejar.

**Bloqueiam a fase 7 (checkout + confirmação)** — **as cinco foram fechadas
pela fase 7**; ver a seção "Fase 7" abaixo (decisões 43, 49 e 51, e o gate de
mutação na 52). Mantidas aqui por rastreabilidade.

1. **O CTA "Conectar e finalizar" do carrinho está `disabled`**, nas duas
   composições, com comentário apontando para cá. Não existia rota de destino.
2. **O passo 4 do cenário obrigatório do §7 não tem tela.** A fase 9 deixou pronta
   a regra (`isQuoteStale`/`staleQuoteItems`, função pura) e o servidor já devolve
   409 `quote_outdated`, mas não há botão "Confirmar" para bloquear. A fase 7 fecha
   o cenário: preço muda → aviso → confirmar barrado → recotar.
3. **`order.updated` não tem superfície visual** além do toast. Escreve em
   `orderKey(scope, id)` (`src/features/checkout/queries.ts`, já criado pela fase
   9); falta a tela que lê essa chave.
4. **Não há seletor de rede.** A cotação usa `'ethereum'` fixo. A escolha de rede é
   da fase 7 e já tem desenho (spec 07 §6.3 e §6.4).
5. **Os quatro cenários de mock nunca exercitados** continuam sem consumidor:
   `price-changed`, `sold-out`, `order-timeout`, `payment-declined`. O
   `order-timeout` é o mais importante — a recuperação por idempotência precisa
   devolver o **mesmo** pedido.

**Bloqueiam a fase 8 (perfil + carteiras)** — os três **fechados** na fase 8; ver
a seção "Fase 8" no fim deste arquivo.

6. **Estender o mock**, decidido pelo usuário (spec 08 §2.4 e §3.5): `Profile`
   ganha `username` (com 409 em colisão) e `ensName`; `Wallet` ganha `type` (enum
   metamask/walletconnect/coinbase) e `referralCode` (opcional). Fixtures e testes
   de contrato junto.
7. **Criar `DELETE /api/wallets/:id`** (spec 08 §3.5), com 409 ao remover a única
   primária e promoção da secundária mais antiga quando existe — avisando qual.
8. **Nenhuma das duas telas tem frame mobile.** A derivação está no spec 08 §5, com
   a referência de qual frame originou cada regra. Registrar como desvio consciente.

**Abertas, sem bloquear ninguém**

9. **Causa raiz do vazamento no logout não encontrada.** Dois investigadores
   independentes (o agente da fase 5 e a coordenação) leram `use-auth.ts`,
   `favorites.ts`, `use-session.ts` e a propagação de `scope` sem achar por que
   alguns observadores da mesma query não recebem a notificação após
   `queryClient.clear()`. O conserto em vigor — `clear()` + `location.reload()` —
   **garante** o requisito eliminatório do §11; o custo é perder a suavidade de SPA
   no logout. Vale investigar com calma depois da entrega.
10. **O "modal sobre o catálogo" não mantém a página de fundo montada.** O TanStack
    Router não tem intercepting routes; o retorno ao fluxo é por `redirect`. Atende
    o §3 funcionalmente, não visualmente.
11. **Não existe `specs/09-tempo-real.md`.** Todas as outras fases têm spec própria;
    o conteúdo da 9 está só aqui.
12. **A conexão declara o próprio dono** (`query: { userId: scope }` no handshake).
    Num mock rodando no contexto da página não há cookie por conexão, mas é o
    cliente afirmando identidade — aceitável aqui, jamais em produção.

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

**Correção de diagnóstico (fase 9).** O parágrafo acima explica o flake de *uma
ou duas* falhas por rodada. Ele **não** explica as rodadas que falham às dezenas
ou centenas — e atribuí-las à tolerância do `slow` faz quem lê perseguir o
problema errado.

Essas rodadas têm outra causa, e ela aparece no log:

```
/bin/sh: line 1: 42719 Killed: 9  pnpm preview --port 4173
```

O `vite preview` é morto com SIGKILL no meio da suíte por pressão de memória da
máquina (jetsam do macOS), e a partir daí todo teste falha com
`net::ERR_CONNECTION_REFUSED`. Não é regressão e não é flake de teste: é o
servidor morrendo.

Provado por controle: a mesma `dev`, **sem nenhuma mudança nova**, colapsou de
380/380 para 79 passed / 301 failed quando rodada com a máquina carregada, com a
mesma linha `Killed: 9`. Toda spec que falha nessas rodadas passa em isolamento.

Como evitar: `--workers=1` (o que o CI já faz), e nunca duas suítes ao mesmo
tempo na mesma máquina.

## Fase 9 — Tempo real com Socket.IO

Decisões e limitações do §7 do desafio e do transporte do §6.

23. **Transporte: `ws.link` do MSW + `@mswjs/socket.io-binding`, com um curinga
    no path.** O `WebSocketHandler` do MSW **remove o prefixo `/socket.io/` do
    path do cliente antes de casar** (acomodação interna para o protocolo), então
    qualquer padrão que mencione `socket.io` — `'*/socket.io/'` incluído — nunca
    casa: a conexão sai para a rede real e o handler não roda (na demo, um 200 do
    servidor de arquivos, com reconexão infinita). O link é `ws.link('*')`; é o
    único WebSocket do app, o curinga não gera ambiguidade.

24. **`socket.io-client` é carregado por `import()` dinâmico, e isso é
    obrigatório.** O `engine.io-client` captura o construtor de WebSocket uma
    única vez, na avaliação do módulo (`const WebSocketCtor =
    globalThis.WebSocket`). Importado estaticamente, ele é avaliado antes de
    `worker.start()` trocar o global e guarda o WebSocket nativo — a conexão então
    ignora o MSW por completo. Carregar depois dos mocks é o que faz o binding
    interceptar. Efeito colateral bem-vindo: o cliente sai do chunk principal.

25. **Contrato do evento.** `src/types/events.ts` (fase 1) já definia
    `eventId`/`type`/`resource`/`version`/`emittedAt`/`data`. `eventId` é
    `${resource.id}:v${version}` — identidade estável e derivável, não aleatória.

26. **Ponto único de emissão: `bumpNftVersion` (`src/mocks/db.ts`).** Toda mutação
    de edição já passava por ali (é o que recalcula `priceEth`/`available`), então
    emitir `nft.updated` dali é o que garante o §6: REST e evento não podem
    divergir, porque saem do mesmo lugar. Nenhum call site precisou mudar.

27. **`order.updated` tem dois gatilhos, um só efeito.** `resolveOrderIfDue`
    resolve o pagamento e emite; é chamado pelo `setTimeout` da criação (tempo
    real, sem polling) e pelo `GET /orders/:id` (recuperação após refresh, quando
    o timer morreu com a página). Quem chega segundo encontra `status !==
    'pending'` e sai. Pedido confirmado ou recusado é terminal.

28. **Duplicata e evento antigo são UMA guarda, não duas.** O cliente mantém um
    `ledger` (recurso → maior `version` aplicada) e só aceita `version`
    estritamente maior. Duplicata chega com versão igual, evento atrasado com
    versão menor: nenhum dos dois passa, nenhum efeito é reaplicado.

29. **O que o evento aplica direto e o que ele revalida.** O detalhe recebe patch
    direto do payload (preço, disponibilidade, edições) — sem ida ao servidor.
    Catálogo, destaque e carrinho são **invalidados**, não recalculados: menor
    preço entre edições, soma de disponíveis e subtotal são regra de negócio do
    mock, e reimplementá-las no cliente as duplicaria.

30. **Reconciliação pós-reconexão.** No evento `connect` que não é o primeiro
    daquele socket, `invalidateQueries({ refetchType: 'active' })` — literalmente
    "reconcilie os recursos ativos com o REST". O teste prova que funciona
    mudando o preço **enquanto o cliente está fora** (o evento sai para zero
    conexões) e exigindo que a tela chegue ao valor novo mesmo assim.

31. **Isolamento entre usuários: filtro no servidor + socket por escopo.** A
    conexão declara seu dono no handshake (`query.userId`, o mesmo `scope` das
    query keys) e o mock só entrega `order.updated` a conexões daquele dono;
    `nft.updated` é público. O efeito depende de `scope`, então login, logout e
    troca de usuário fecham o socket anterior (`removeAllListeners()` +
    `disconnect()`) e abrem outro — um evento de sessão anterior não tem para
    onde ir. Como o binding não tem rooms nem namespaces, o fan-out é um `Set` de
    conexões com esse filtro.

32. **Cenário obrigatório do §7, e o que ficou para a fase 7.** Passos 1–3 estão
    completos: NFT no carrinho, mudança de preço durante a navegação, aviso na
    interface (toast com o preço novo) e resumo atualizado (a query do carrinho é
    invalidada; o badge do header passou a ter contagem real). O passo 4 — o
    checkout impedir a confirmação — tem as duas metades prontas: o servidor já
    devolve 409 `quote_outdated`, e `src/features/checkout/quote-freshness.ts`
    expõe a mesma decisão como função pura (`isQuoteStale`, comparando o
    `nftVersion` da cotação com o do carrinho relido). **A tela que consome isso é
    a fase 7**; aqui ficam a regra e a chave de cache (`orderKey`, `cartKey`).

33. **Keepalive manual.** O binding sintetiza um handshake anunciando
    `pingInterval: 25000` e ninguém manda ping; sem isso o `engine.io-client`
    derrubaria a conexão por "ping timeout" em 30s e ficaria reconectando. O mock
    envia `'2'` (PING do engine.io) a cada 20s.

34. **`window.__realtime` é instrumento, não caminho de simulação.** Contadores
    (recebidos, aplicados, descartados, reconexões, reconciliações) para o
    Playwright poder assertar que a guarda de versão **descartou** — algo que não
    tem efeito visível na tela, por definição. Os eventos continuam chegando só
    pelo `socket.io-client`; `window.__mocks.realtime.*` mexe no db simulado, e é
    o db que emite.

35. **Os gates novos foram forçados a falhar.** Quatro mutações (guarda de versão,
    filtro por dono, reconciliação no `connect`, aviso no carrinho) foram aplicadas
    de uma vez: falharam exatamente os quatro testes correspondentes e os outros
    quatro continuaram verdes — os gates acusam e são específicos.

36. **Asserção de preço renderizado só no desktop.** Três testes ficaram em
    `test.describe('tempo real na interface (desktop)')`: no mobile o Buy Bar
    mostra preço × quantidade (formatado por `roundEth`, que corta zero à direita)
    e o carrossel de relacionados reusa o card de desktop — fixar texto de preço
    nas duas viewports testaria a formatação das fases 3/4, não o evento. Os cinco
    testes que cobrem os requisitos do §7 rodam nos dois projetos.

### Limitações do transporte no ambiente de mocks (exigência do §6)

- Sem namespaces, rooms ou broadcast do Socket.IO: o binding não os implementa.
- Só o transporte `websocket` é interceptado — o cliente força
  `transports: ['websocket']`; o long-polling default cairia em HTTP sem handler.
- Handshake e ping são sintetizados: não há servidor real, logo nem ACK de evento
  (`socket.emit` com callback) nem `volatile`/`binary` foram exercitados.
- "Servidor" e "cliente" compartilham o contexto da página: uma aba nunca vê
  evento de outra, e o isolamento entre usuários é por conexão, não por processo.
- O timer que resolve o pedido morre com a página. É *desejável* — é o cenário de
  "interrupção enquanto o pedido está pendente" do §7 — e a recuperação é o
  `GET /orders/:id`, que resolve na leitura sem criar outra compra.

## Fase 7 — Pagamento e confirmação

Decisões do §3 do desafio e do `specs/07-checkout.md`. As cinco dívidas listadas
como "Bloqueiam a fase 7" foram fechadas; o que abriu de novo está no fim.

37. **A confirmação é um diálogo, não uma rota** (`70376:239`, spec §1). Uma
    composição só (`order-receipt.tsx`) com as duas aparências por breakpoint:
    centralizada de 578 no desktop, folha inferior `rounded-t-[40px]` no mobile
    (derivação do §6.8, que não tem frame — segue o padrão do Payment Summary do
    carrinho mobile). Não são dois diálogos porque as duas composições do
    checkout montam ao mesmo tempo e dois diálogos no DOM seriam dois diálogos
    de verdade.

38. **O modal mora na ROTA, não nas composições**, pelo mesmo motivo. E ele só é
    renderizado na fase `confirmed`, que por construção de tipo só existe com um
    `Order` da API — a regra eliminatória 3 é garantida pelo tipo, não pela
    disciplina de quem escreve a tela.

39. **`ConfirmPhase`: uma união discriminada em vez de cinco booleanos.**
    `idle` · `submitting` · `timeout` · `revalidate` · `error` · `pending` ·
    `confirmed` · `declined`, derivada por `confirmPhaseOf` (pura, em
    `checkout-state.ts`). Booleanos separados permitiriam "confirmado e
    aguardando" e obrigariam cada composição a decidir a precedência sozinha.
    A precedência que importa: **o pedido ganha de tudo** (terminal é terminal) e
    **erro de rede vem antes de cotação obsoleta** — no cenário `order-timeout` o
    commit acontece ANTES do `HttpResponse.error()`, então a cotação fica
    obsoleta *por consequência do envio*; tratar isso como "recotar" mandaria o
    usuário criar um segundo pedido.

40. **A chave de idempotência é derivada, não sorteada:**
    `order:{quoteId}:{walletId}` (`checkout/mutations.ts`). Sem `useRef`, sem
    `sessionStorage`, e por isso sobrevive a refresh: o reenvio depois de um
    timeout recalcula a MESMA chave e recupera o pedido criado. `network` não
    entra porque já está na cotação (a query key do `POST /quote` inclui a rede,
    logo outra rede = outro `quoteId`); `payer` vem da sessão. A relação
    chave↔corpo é 1:1, então o 409 `idempotency_conflict` do contrato não é
    alcançável por navegação normal.

41. **`refetchInterval` enquanto o pedido está `pending` — correção da decisão 27
    da fase 9.** A fase 9 deixou `orderOptions` sem polling nenhum, com o
    argumento de que o estado chega por `order.updated`. Isso vale para a página
    que criou o pedido, mas **não** para a recuperação após refresh: o
    `setTimeout` que resolve o pagamento morre com a página anterior, e quem
    resolve na carga nova é o próprio `GET /orders/:id`. Sem uma segunda leitura,
    um pedido recarregado antes dos 1500ms ficava `pending` para sempre —
    exatamente o que o teste de refresh acusou. O intervalo é de 1s e **para
    sozinho no estado terminal**. Não substitui o evento; é a rede de segurança
    do caminho sem emissor vivo.

42. **Os nove campos do formulário desktop não foram construídos** — decisão do
    usuário já registrada no spec §3 e §6.7, aplicada aqui: o checkout coleta
    **carteira e rede**, e `payer` vem da sessão. O tratamento visual dos campos
    (40 de altura, `rounded-[3px]`, rótulo 15px com asterisco 22px em
    `text-coral`) foi preservado nos dois blocos que sobraram, e nome/e-mail
    aparecem como dado **exibido para revisão** (`<dl>`), não como input — é o
    que o §3 pede ("permitir revisão antes do envio") sem coletar o que a API
    ignora.

43. **"Carteira e rede" são as três REDES, não as três marcas de carteira.**
    O Figma rotula as três opções com `METAMASK`/`WALLETCONNECT`/`COINBASE`
    (desktop §2) e com WalletConnect/MetaMask/Coinbase Wallet (mobile §6.4).
    Provedor de carteira **não existe em contrato nenhum** — `Wallet.type` é a
    dívida 6, da fase 8 — e um radiogroup que a API ignora é o campo decorativo
    que o usuário proibiu. As três linhas passam a ser Ethereum/Polygon/Solana:
    mesma geometria, mesmo número de opções, e efeito real (`POST /quote`
    `{ network }` muda a taxa; o pedido grava a rede). Fecha a dívida 4.
    **Quando a fase 8 acrescentar `Wallet.type`, esta decisão pode ser revisada**
    — aí o provedor tem dono e caberia um segundo seletor.

44. **Rádios nativos, não `role="radiogroup"` à mão.** `<fieldset>` +
    `<input type="radio" class="peer sr-only">` com o círculo do Figma desenhado
    ao lado: papel, agrupamento, `checked`, setas do teclado e roving tabindex
    saem do navegador. O indicador **não é só cor** — o selecionado recebe um
    ponto sólido de 8px, e não apenas uma borda `primary` (§6.3 avisa que a
    sombra do Figma está no card ERRADO, então a elevação não pode ser o sinal).
    Consequência para quem escreve teste: o input é 1×1 e o círculo visível fica
    por cima, então `input.check()` do Playwright fica preso em "intercepts
    pointer events" — clica-se o **rótulo**, que é o alvo do usuário real
    (helper `chooseRadio` em `e2e/checkout.spec.ts`).

45. **`?order=` na URL é o mecanismo de recuperação**, junto de `?coupon=` e
    `?network=`. A carteira escolhida fica em `useState`: é seleção de
    formulário, e o §3 quer que ela seja conectável/desconectável dentro da
    sessão da tela. A barra "Carteira conectada" + "Trocar carteira" (§6.2) é a
    simulação de conexão/desconexão que o §3 pede: **a seleção É a conexão**. Não
    há endpoint de conectar carteira no contrato, e inventar um estado de conexão
    paralelo ao `GET /wallets` seria caminho de negócio fora do mock (regra
    eliminatória 1). A **recusa** da simulação é o cenário `payment-declined`.

46. **`QuoteItem` ganhou `imageUrl`.** O recibo desenha a arte de cada item (§3)
    e `Order.items` nunca pode reler o catálogo — sem o campo, a tela teria de
    derivar a URL da imagem no cliente, duplicando a regra da fixture
    (`/nft/ape-0{(i%4)+1}.webp`). É extensão de contrato de mock, o mesmo
    precedente da dívida 6. `SEED_VERSION` sobe de 5 para 6.

47. **`OrderSummary`: `Quote` e `Order` lidos pela mesma interface.** Antes de
    enviar, a coluna "Seus NFTs" lê a cotação; depois, lê o pedido — que é o
    snapshot imutável dela. Uma interface estrutural (`items`, `subtotalEth`,
    `discountEth`, `networkFeeEth`, `totalEth`, `coupon`) em vez de duas
    variantes na view.

48. **O link "Ver no Etherscan" é simulado e diz que é.** `href` aponta para
    `example.com` (domínio reservado pela IANA), a copy do Figma foi preservada e
    uma legenda de 12px declara "Link de exploração simulado". A nota de rodapé
    usa a rede DO pedido, não o "Ethereum" fixo do Figma — um recibo de Polygon
    dizendo "confirmada na Ethereum" mentiria.

49. **O CTA "Conectar e finalizar" virou `<Link>` para `/pagamento`** nas duas
    composições do carrinho (fecha a dívida 1), levando o cupom na URL, e fica
    `aria-disabled` + `pointer-events-none` com carrinho vazio. `/pagamento`
    entra em `isBareMobile` no `__root` (Screen Header próprio) com `pb-0`: o
    Confirm Button é o ÚLTIMO elemento da coluna, não barra fixa (§6, "107px de
    folga") — diferente do carrinho, que paga 358px de folha. E "Mercado" passa a
    ficar ativo no header em `/pagamento` (spec §2 desenha assim).

50. **Guarda do fluxo privado por `<Navigate>`, não por `beforeLoad`.** A sessão
    é uma query do TanStack Query (`useSession`); duplicá-la no `beforeLoad`
    criaria uma segunda fonte de verdade de sessão. O redirecionamento usa
    `?redirect=/pagamento`, o contrato que `/login` já lê desde a fase 5.

51. **Os quatro cenários órfãos ganharam consumidor** (fecha a dívida 5), cada um
    com teste em `e2e/checkout.spec.ts`: `price-changed` (409 barra e exige nova
    confirmação), `sold-out` (conflito preserva o carrinho), `order-timeout`
    (reenvio recupera o mesmo pedido — o gate assere que `ord_{n+1}` responde
    **404**), `payment-declined` (terminal, e o recibo nunca abre). O passo 4 do
    cenário obrigatório do §7 (dívida 2) tem teste próprio, disparado por
    `editNftPrice` via socket, não por 409.

52. **Os gates novos foram forçados a falhar.** Cinco mutações aplicadas de uma
    vez — chave de idempotência aleatória, recibo aberto também para pedido
    pendente, gate de cotação obsoleta desligado, `refetchInterval` removido,
    `onCloseAutoFocus` removido — derrubaram exatamente seis testes, um por
    requisito: "confirma só depois do mock", "recuperação após refresh",
    "timeout: reenviar", "§7 passo 4", "price-changed" e o de foco no modal.
    **O que NÃO caiu, e está registrado no próprio teste:** "clique repetido em
    Confirmar" continuou verde com a chave aleatória, porque o navegador não
    entrega `click` a um botão `disabled` — aquele teste prova a primeira
    barreira (o handler não roda duas vezes), e a segunda (idempotência com dois
    POSTs reais) é provada pelo teste de timeout e por `api-contracts.spec.ts`.

### Divergências e pendências abertas pela fase 7

- **O mock debita o carrinho e o estoque na CRIAÇÃO do pedido, não na
  confirmação** (`handlers/orders.ts`, o bloco de commit antes do `push`). O §3
  pede "após confirmação, remover do carrinho apenas os itens e quantidades
  comprados". No caminho de sucesso o efeito é o mesmo; num pedido **recusado**
  (`payment-declined`) o carrinho já foi esvaziado e o estoque já foi debitado, e
  nada devolve. É comportamento de contrato da fase 1, com testes existentes, e
  **não foi alterado nesta fase** — conserto correto: mover o débito para
  `resolveOrderIfDue` (reservando no `pending`) e estornar no `declined`.
- **Timeout + refresh sem `?order=` não é recuperável.** Quando o `POST` falha
  como erro de rede o cliente nunca recebe o id, então não há o que colocar na
  URL. Recarregando ali, o usuário vê um checkout limpo com o carrinho já
  debitado e nenhum aviso do pedido pendente. Faltaria um `GET /orders` (lista do
  usuário), que não existe no contrato — por isso o reenvio na mesma página é o
  caminho coberto.
- **A ilustração 80×80 do cabeçalho do recibo é placeholder** (glifo `Wallet` do
  lucide, com `ponytail:` no código): a transcrição do spec não a nomeia. Mesmo
  precedente dos ícones sociais do footer (fase 2).
- **A rede não é derivada da carteira escolhida.** Selecionar a carteira Polygon
  da Ana não muda `?network`. O contrato do pedido aceita os dois campos
  independentemente e o mock não valida coerência; acoplá-los exigiria escrever na
  URL durante o render. Decidido: ficam independentes.
- **Medidas do modal que o spec §3 não dá** (espaçamento entre o bloco de totais
  e a nota de rodapé, e o recorte mobile da folha) foram derivadas do padrão das
  outras telas, não medidas. Calibrar com `get_design_context` quando o MCP
  estiver disponível.
- **Provedor de carteira (MetaMask/WalletConnect/Coinbase) não é coletado** — ver
  decisão 43. Revisitar na fase 8, quando `Wallet.type` existir.
- **`pnpm-lock.yaml` foi regenerado**: `@mswjs/socket.io-binding` estava em
  `dependencies` no `package.json` e em `devDependencies` no lock (inconsistência
  herdada da fase 9). Correção mecânica do `pnpm install`, nenhuma versão mudou.
## Fase 8 — Perfil do colecionador e carteiras

Fecha as dívidas 6, 7 e 8 da seção "Dívidas para as fases 7 e 8". Spec:
`specs/08-perfil-carteiras.md`.

38. **Uma feature (`src/features/account/`) para as duas telas, não duas.** O
    `CLAUDE.md` prevê `profile` e `wallets` separadas, mas o Figma desenha UM
    layout: a mesma Account Sidebar de 310px (nodes `70420:4536` e
    `70420:4594`) com um painel diferente à direita. Perfil e carteiras
    dividem escopo de cache, primitivos de campo e shell — separá-los criaria
    um import cruzado entre features para cada um desses três. A sidebar em si
    é `src/components/account-sidebar.tsx`, que é onde o `CLAUDE.md` põe o que
    é compartilhado entre features.

39. **O mock ganhou quatro campos, decisão do usuário (spec §2.4 e §3.5).**
    `Profile.username` (único, **409** com `details.username` em colisão, como
    o endereço de carteira já fazia) e `Profile.ensName`; `Wallet.type` (enum
    `metamask`/`walletconnect`/`coinbase`, derivado do que o pagamento mobile
    oferece) e `Wallet.referralCode` (opcional). `SEED_VERSION` foi para 6 —
    sem o bump, um `localStorage` da fase anterior serviria perfil sem esses
    campos.

40. **`type` é obrigatório no `walletSchema`, e isso mudou três testes de
    contrato existentes.** O Figma marca o campo com asterisco e o §3.5 lista
    só `referralCode` como opcional. Consequência honesta: os três `POST
    /api/wallets` que já existiam em `e2e/api-contracts.spec.ts` passaram a
    mandar `type: 'metamask'`. Nenhuma asserção foi afrouxada — só o corpo da
    requisição acompanhou o contrato novo.

41. **`updateProfileSchema.avatarUrl` deixou de ser `.url()`.** Os avatares do
    mock são caminhos locais (`/nft/ape-01.webp`, fase 1) e o botão "Alterar"
    grava a imagem escolhida como `data:` URL — `.url()` recusava os dois, o
    que fazia **todo** PATCH de perfil voltar 400. Passou a aceitar caminho
    absoluto, `http(s)` ou `data:image/`, e `''` para limpar (o "Remover" do
    §2.1). O limite de 512 KB da imagem é do cliente, não do Figma: um data
    URL maior estouraria a cota do `localStorage` que serve de db, e a tela
    perderia estado que já parecia salvo.

42. **`DELETE /api/wallets/:id` com quatro regras** (spec §3.5): 404 para
    inexistente ou de outro dono (a lista é indexada por dono, então o
    isolamento sai de graça); **409** ao remover a única primária — sem
    primária o pagamento perde a carteira selecionada; promoção da secundária
    **mais antiga** quando existe; `persist()` ao fim. O 204 **não** nomeia a
    promovida: o cliente já tem a lista anterior em cache e a mesma regra, e
    inventar corpo num 204 divergiria do contrato dos outros DELETEs. O aviso
    de quem foi promovida (e de quem foi rebaixada, no `POST`/`PATCH` com
    `role: 'primary'`) sai de `src/features/account/mutations.ts` — promoção e
    rebaixamento silenciosos eram a armadilha que o spec pede para evitar.

43. **Rotas privadas de verdade, pelo router.** `/perfil` e `/carteiras` têm
    `beforeLoad` com `queryClient.ensureQueryData(sessionOptions)` e
    `throw redirect({ to: '/login', search: { redirect } })` — a proteção de
    fluxo privado que o §4 do desafio pede, no router e não no componente.
    `sessionOptions` foi extraído de `use-session.ts` para que a rota e o hook
    leiam a MESMA query, sem um segundo caminho de leitura de sessão.

44. **Um formulário e um "Salvar" no perfil.** O Figma desenha o botão
    **depois** do bloco "Alterar senha" (§2.3), então o submit faz `PATCH
    /profile` sempre e `POST /profile/password` só quando algum dos três
    campos de senha foi preenchido — os três se tornam obrigatórios entre si
    nesse caso. Dois botões seriam desenho que o arquivo não tem.

45. **O asterisco de obrigatório fica FORA do `<label>`.** Dentro dele, o nome
    acessível do campo virava "Nome de exibição*" — `aria-hidden` não remove o
    glifo do texto do label, e nenhum `getByLabel` exato casava. A
    obrigatoriedade viaja por `aria-required` no input; o asterisco é só a
    marca visual. Pego pelo teste, não suposto.

46. **O menu `⋮` não é um menu ARIA: é um disclosure no fluxo.** `⋮` com
    `aria-expanded`/`aria-controls` abre um painel de três botões (Definir como
    principal · Editar · Remover) **dentro** do card, empurrando o layout.
    Começou absoluto e sobreposto, como no Figma; no mobile caía sob a TabBar
    fixa de 126px e ficava inclicável — de novo, pego pelo teste. No fluxo, a
    página cresce e rola. Custo: não é o popover do desenho.

47. **Campos do Figma que saíram da tela de carteiras.** "Nome de exibição",
    "Nome do perfil", "E-mail" e "Nome ENS" são de perfil, duplicados na tela
    errada (§3.5). Saiu também o **input sem label da Field Row 3**
    (placeholder "ENS ou carteira secundária (opcional)"): o §3.5 não lhe dá
    destino no contrato, e campo que o usuário preenche e a API ignora é
    proibido pela regra 5 — decisão minha, não do spec. `referralCode` é
    renderizado **sem** asterisco, ao contrário do Figma, porque obrigatório
    trancaria quem não tem código. Pelo mesmo argumento, **"Nome ENS" também
    perdeu o asterisco**: exigir um domínio ENS trancaria quem não tem um, e
    asterisco que o formulário não cobra é mentira de UI. Esse segundo caso é
    decisão minha, não do spec.

48. **"Igual à carteira principal" é um checkbox com estado, não enfeite.**
    Marcado, copia rede, tipo e código da principal para o formulário da
    secundária; desmarcado, limpa. O **endereço não é copiado** — dois
    registros com o mesmo endereço é exatamente o 409 do `POST`.

49. **Os cinco itens de menu sem tela** (Atividade, Lista de interesse,
    Ofertas, Arquivos baixados, Suporte, decisão do usuário no §1) são
    `<span aria-disabled="true" title="Em breve">`, nunca `<a>`/`<Link>`: link
    para rota inexistente devolve 404, e "ação fora do escopo não deve
    aparentar sucesso funcional" (CHALLENGE §3). O item ativo da sidebar é só
    a barra de 6px no Figma — todos os rótulos já são `text-accent` —, então
    `aria-current="page"` é o que carrega o estado, e o teste cobra o caso
    negativo junto do positivo.

50. **`--color-text-coral` (#f0805f) existia em `src/index.css` desde a fase 2
    mas não constava da paleta do `CLAUDE.md`.** É o asterisco de obrigatório
    dos 19 campos destas duas telas; acrescentado lá.

### Desvio consciente: nenhuma das duas telas tem frame mobile

O Figma só desenha desktop (`9:1238` e `9:1670`). As cinco derivações do spec
§5, com o frame de origem de cada uma:

1. **Sidebar vira faixa de navegação no topo**, com rolagem horizontal dentro
   do próprio container (`overflow-x-auto`) — não drawer, porque o mobile desta
   base nunca teve um (decisões 1–2). A quebra é em `md` (768): abaixo disso a
   sidebar é faixa, acima é a coluna de 310. Origem: §5.1 do spec.
2. **Campos de 417 viram fluidos** (`w-full md:max-w-[417px]`) e as linhas de
   dois campos empilham. Origem: padrão dos frames mobile de 414 com margem 28
   (conteúdo 358), fases 3/4/6.
3. **Screen Header** com círculo de voltar 35×35 + título 20px bold, igual ao
   do carrinho mobile (`16:360`) e do detalhe (`15:5536`).
4. **CTA mobile** de largura total, `h-60`, raio 40, gradiente
   `108.5deg #d28a4c → rgba(210,138,76,0.8)`; o `131×40` raio 3 do desktop
   volta em `md`. Origem: `16:360`/`15:5536` — o botão mobile não é o desktop
   reescalado, lição das fases anteriores.
5. **Campo ENS composto** mantém os 78px do domínio e deixa o resto fluido.

O `<select>` do domínio ENS tem uma opção só (`.eth`): é o único TLD do
arquivo. É um select de verdade porque o Figma desenha a seta — não uma caixa
decorativa.
