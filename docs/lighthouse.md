# Lighthouse — resultados

Lighthouse 13.4.1 · build de produção servido por `vite preview` na porta 4173.
Reproduzir: `pnpm lighthouse`. Scores truncados, não arredondados.

## desktop

| Rota | Perf | A11y | Best practices | SEO | FCP | LCP | TBT | CLS | SI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/carrinho` | 99 | 100 | 96 | 91 | 0.7 s | 0.8 s | 0 ms | 0.063 | 0.7 s |
| `/` | 99 | 95 | 96 | 92 | 0.7 s | 0.8 s | 0 ms | 0 | 0.7 s |
| `/nft/nft-001` | 95 | 95 | 96 | 92 | 0.7 s | 0.9 s | 0 ms | 0.116 | 0.7 s |
| `/perfil (sessão ANA, cache quente)` | 99 | 96 | 100 | 92 | 0.7 s | 0.9 s | 0 ms | 0 | 0.7 s |

## mobile

| Rota | Perf | A11y | Best practices | SEO | FCP | LCP | TBT | CLS | SI |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| `/carrinho` | 83 | 100 | 96 | 91 | 3.1 s | 3.8 s | 0 ms | 0 | 3.1 s |
| `/` | 80 | 98 | 96 | 92 | 3.0 s | 4.2 s | 10 ms | 0 | 3.0 s |
| `/nft/nft-001` | 81 | 100 | 96 | 92 | 3.1 s | 4.0 s | 10 ms | 0 | 3.1 s |
| `/perfil (sessão ANA, cache quente)` | 83 | 96 | 100 | 92 | 3.1 s | 3.8 s | 10 ms | 0 | 3.1 s |

## Como reproduzir

```bash
pnpm lighthouse   # build + vite preview :4173 + 8 auditorias
```

Os JSON crus ficam em `lighthouse-reports/` (não versionado — ~600 KB cada);
só esta tabela entra no repositório. `CHROME_PATH` é resolvido pelo Chromium do
Playwright quando não há Chrome instalado; `LH_PORT` muda a porta.

## Limitações da medição

- **O MSW vai para produção por design.** O bundle inclui `mockServiceWorker` +
  handlers + fixtures (`browser-*.js`, **446 KB / 164 KB gzip** — medido; o valor varia alguns KB entre builds) porque a demo não
  tem backend. É o maior peso do JS não usado no primeiro paint e a maior parte
  da distância para 100 em mobile. Explicação, não desculpa: sem essa camada o
  app não funciona no deploy.
- **`/perfil` exige sessão.** Anônimo ele redireciona para `/login`, então a
  auditoria roda com um perfil do Chrome semeado (`scripts/lh-seed.mjs`, usuário
  ANA) e `--disable-storage-reset`. Esse flag também impede a limpeza de cache:
  o run de `/perfil` sai com **cache quente** e não é comparável com os demais.
- **`errors-in-console` reprova por causa do 401 de `GET /api/auth/session`**
  para visitante anônimo — o mesmo ruído de boot que `e2e/helpers.ts` já filtra
  explicitamente. É resposta tratada, não erro de aplicação.
- **`robots-txt` e `llms-txt`** reprovam porque a SPA não serve esses arquivos;
  não é requisito do desafio.
- Números medidos numa máquina só, sem CI dedicado: tratam-se de ordem de
  grandeza, não de baseline com tolerância.

