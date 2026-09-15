# Review

## Verdict
NEEDS WORK

## Rationale

O núcleo da fase está certo e verificado em três camadas independentes: o estado de compra elevado à rota (`src/routes/nft.$nftId.tsx`) implementa exatamente as regras do spec (primeira edição disponível, clamp `[1, available]`, reset ao trocar, `null` quando tudo esgotado); a compra é honesta — `useAddToCart` só emite toast no `onSuccess`, e o E2E confirma o item por `GET /api/cart`, o 409 sem toast de sucesso, e um único POST sob latência; a migração de fixtures é determinística por construção (funções puras de `i`, zero PRNG, `images[0] === imageUrl` preservado) e o contrato está coberto. As duas composições batem com `specs/04-detalhe-nft.md` medida a medida onde a transcrição existe, e os provisórios estão marcados com `ponytail:` e registrados.

Respondendo aos oito pontos do radar:

1. **Chips de edição (`Standard`/`Deluxe` vs `1/1`…`ABERTA`)** — é um desvio de fidelidade real e **não documentado**, e isso o torna finding. O critério 6 do `.pipeline/spec.md` sancionou "os `label`s da API" sem nunca confrontar o conteúdo do Figma (spec 04 §2 lista as larguras 36/42/46/66 exatamente porque o conteúdo é `1/1`/`1/10`/`1/50`/`ABERTA`) — a decisão foi tomada por omissão, não por julgamento. O precedente do projeto (categorias 4→9 na fase 2, `network` na fase 3) é alinhar o dado ao design, e `1/{totalSupply}` é derivável do modelo que já existe (`fixtures.ts:125-142`). Não é blocker — o dado vem do mock, a forma está fiel, e há leitura defensável de que `Standard`/`Deluxe` é conteúdo. Mas o desvio precisa de decisão consciente: ou alinhar os labels na fixture, ou registrar em ARCHITECTURE. **[major]**

2. **Dots do carrossel ausentes** — concordo com o Coder: correto. Com 48 NFTs e `category = i % 9`, nenhuma categoria passa de 6 itens; após excluir o corrente, o máximo é 5 relacionados = 1 página, e `related-carousel.tsx:66` só renderiza dots com `totalPages > 1`. Dot único que não pagina seria exatamente a decoração-com-cara-de-função que o desafio proíbe. Mas é divergência visível do Figma e não está no ARCHITECTURE (a decisão 10 registra a padronização dos cards, não a ausência dos dots). Uma linha resolve. **[minor]**

3. **Terceira ocorrência da família de flake** — deixa de ser aceitável caracterizar caso a caso, porque desta vez o flake fura o gate: o critério 24 exige `pnpm test` verde, e o E2E reproduziu a falha de `catalog.spec.ts:834` em 4/6 sob paralelismo default (o Coder viu 373/374). Um `pnpm test` que falha na maioria das rodadas completas não é "passando". A medida estrutural certa é barata e cirúrgica: em vez de 5 `ArrowRight` cegos, asserir o efeito de cada tecla (`aria-valuenow` do thumb Radix avançou) antes da próxima — converte timing em espera determinística, mesmo espírito do round-trip de macrotask da fase 2. E nomear a classe em ARCHITECTURE, como o E2E propôs, para que a próxima interação de teclado contra Radix já nasça com o helper. **[major]**

4. **Correções do Ponytail** — ambas corretas e verificadas por mim no diff: o comentário em `nft-detail-mobile.tsx:208-212` explica o porquê (padding redundante com `justify-center`, geometria 196×60 preservada), e o título do teste em `api-contracts.spec.ts:932` agora diz "is 4" coerente com a asserção da linha 952. Atenção: **as duas correções, mais os 3 testes do E2E, estão uncommitted no working tree** — precisam entrar nos commits da fase, senão o push entrega o botão quebrando em duas linhas.

5. **Migração de fixtures** — confirmada limpa. `SEED_VERSION = 4`, `ratingAvg`/`ratingCount`/`attributes` são funções puras do índice, `images` cicla os 4 assets com `images[0] === imageUrl`, `toSummary` intocado descarta os campos novos. Catálogo 110/110 sem regressão.

6. **Compra honesta** — confirmada no código (`use-add-to-cart.ts`: toast só em `onSuccess`; erro usa a mensagem da API com fallback) e no E2E (item chega ao `GET /api/cart`; 409 com toast de erro e asserção negativa do toast de sucesso; duplo clique sob `slow` = 1 POST). Falha da API não produz sucesso aparente.

7. **Dívidas** — registro honesto. Fechadas nesta fase: 1 (preâmbulo de Tabs), 2 (prop `total`), 4 (fusão E2E, nenhum teste perdido — contagens conferem), 7 (sombreamento documentado em `index.css`); 3 aceita e 5 cross-referenciada (decisões 13/11); 8, 10, 11 adiadas com justificativa que aceito (nenhum consumidor desta fase toca Card/Badge; 11 é observação de UX fiel ao Figma); 6 e 9 fantasmas já corrigidas e apenas cobertas por teste (critério 15). A nota de processo sobre verificar contra a árvore antes de registrar está no lugar certo.

8. **Fidelidade** — desktop e mobile conferidos linha a linha contra a transcrição: breadcrumb, galeria 100/444/404, lupa 30×30 com Dialog honesto, elipse `border-radius: 50%` com radios nativos, stepper 33×49,5/glifo 26,4, metadados em `secondary` (#b39463, não `text-secondary` — acertaram a armadilha), gradiente do hero, sheet -114/31px, Buy Bar 40px/sombra/gradiente do CTA. Um furo pequeno: `--color-amber` foi adicionado mas **nunca consumido** — o spec 04 §1 diz que ele "aparece no pill de avaliação mobile", e a estrela do pill usa `text-text-accent` (#e89b55).

## Findings

- **[major]** `src/mocks/fixtures.ts:127-142` / `specs/04-detalhe-nft.md` §2 — conteúdo dos chips de edição (`Standard`/`Deluxe`) diverge do Figma (`1/1`, `1/10`, `1/50`, `ABERTA`) sem registro em ARCHITECTURE.md; decisão tomada por omissão no critério 6 do spec do pipeline. Precedente do projeto é alinhar dado ao design; `1/{totalSupply}` é derivável do modelo existente.
- **[major]** `e2e/catalog.spec.ts:834` — `pnpm test` completo falha de forma quase determinística sob paralelismo default (4/6 na reprodução do E2E): `ArrowRight` no Radix Slider perde keydowns sob contenção de CPU. Critério 24 ("pnpm test passa") não está de fato verde. Terceira ocorrência da mesma família — pede a medida estrutural (asserir `aria-valuenow` após cada tecla, ou helper equivalente) e o registro da classe em ARCHITECTURE.md.
- **[minor]** Working tree — a correção do botão "Comprar NFT" (`src/features/nft/components/nft-detail-mobile.tsx`), o título corrigido em `e2e/api-contracts.spec.ts:932` e os 3 testes do E2E em `e2e/nft-detail.spec.ts` estão uncommitted; sem eles o defeito do rótulo em duas linhas vai junto no push.
- **[minor]** `src/index.css:34` — `--color-amber` declarado e nunca usado; o spec 04 §1 o destina ao pill de avaliação mobile (`nft-detail-mobile.tsx:108` usa `text-text-accent` na estrela). Usar o token ou registrar por que não.
- **[minor]** `src/features/nft/components/related-carousel.tsx:66` — ausência dos dots com o seed atual (máx. 5 relacionados por categoria) é correta, mas é divergência visível do Figma sem linha própria em ARCHITECTURE.md.
- **[minor]** `nft-detail-desktop.tsx:114-117` e `nft-detail-mobile.tsx:104-107` — `aria-label` num `<div>` sem `role` não é exposto de forma confiável por leitores de tela; `role="img"` no container da avaliação fecharia a intenção do spec de verdade.

## Required before merge

1. Decidir conscientemente o conteúdo dos chips de edição: alinhar os `label`s da fixture ao design (`1/{totalSupply}`, precedente das fases 2/3) **ou** registrar o desvio em ARCHITECTURE.md fase 4 — qualquer dos dois, mas não o silêncio atual.
2. Tornar `pnpm test` verde sob paralelismo default: em `catalog.spec.ts:834`, asserir o efeito de cada `ArrowRight` no thumb Radix antes da próxima tecla (ou helper equivalente), e nomear a classe de flake em ARCHITECTURE.md.
3. Garantir que as mudanças uncommitted (fix do botão mobile, título do teste de contrato, 3 testes do E2E) entrem nos commits da fase.
4. (Junto com o item 1 ou em passe rápido) usar ou justificar `--color-amber`; uma linha em ARCHITECTURE para os dots ausentes do carrossel.

Os minors 6 (role do container de avaliação) não bloqueiam — podem entrar na fase 5.

---

**Decisão do usuário sobre o item 1: opção A** — alinhar os `label`s da fixture ao design.
