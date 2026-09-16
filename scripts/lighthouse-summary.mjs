// Resume os JSON crus de lighthouse-reports/ numa tabela versionavel (docs/lighthouse.md).
// Truncado (Math.floor), nunca arredondado para cima: 89.6 vira 89, nao 90.
import { readdirSync, readFileSync } from 'node:fs'
import { join } from 'node:path'

const dir = join(import.meta.dirname, '..', 'lighthouse-reports')
const CATS = ['performance', 'accessibility', 'best-practices', 'seo']
const METRICS = [
  ['first-contentful-paint', 'FCP'],
  ['largest-contentful-paint', 'LCP'],
  ['total-blocking-time', 'TBT'],
  ['cumulative-layout-shift', 'CLS'],
  ['speed-index', 'SI'],
]

const files = readdirSync(dir).filter((f) => f.endsWith('.json')).sort()
if (files.length === 0) throw new Error('nenhum JSON em lighthouse-reports/ — a auditoria falhou')

const rows = files.map((file) => {
  const lhr = JSON.parse(readFileSync(join(dir, file), 'utf8'))
  return {
    form: file.startsWith('desktop') ? 'desktop' : 'mobile',
    url:
      new URL(lhr.finalDisplayedUrl).pathname +
      (file.includes('-auth') ? ' (sessão ANA, cache quente)' : ''),
    scores: CATS.map((c) => {
      const s = lhr.categories[c]?.score
      return s == null ? 'n/a' : String(Math.floor(s * 100))
    }),
    metrics: METRICS.map(([id]) => lhr.audits[id]?.displayValue ?? 'n/a'),
    version: lhr.lighthouseVersion,
  }
})

const line = (cells) => `| ${cells.join(' | ')} |`
const out = []
out.push('# Lighthouse — resultados', '')
out.push(`Lighthouse ${rows[0].version} · build de produção servido por \`vite preview\` na porta ${process.env.LH_PORT ?? 4173}.`)
out.push('Reproduzir: `pnpm lighthouse`. Scores truncados, não arredondados.', '')

for (const form of ['desktop', 'mobile']) {
  const subset = rows.filter((r) => r.form === form)
  if (subset.length === 0) continue
  out.push(`## ${form}`, '')
  out.push(line(['Rota', 'Perf', 'A11y', 'Best practices', 'SEO', ...METRICS.map(([, l]) => l)]))
  out.push(line(Array(5 + METRICS.length).fill('---')))
  for (const r of subset) out.push(line([`\`${r.url}\``, ...r.scores, ...r.metrics]))
  out.push('')
}

out.push(
  '## Como reproduzir',
  '',
  '```bash',
  'pnpm lighthouse   # build + vite preview :4173 + 8 auditorias',
  '```',
  '',
  'Os JSON crus ficam em `lighthouse-reports/` (não versionado — ~600 KB cada);',
  'só esta tabela entra no repositório. `CHROME_PATH` é resolvido pelo Chromium do',
  'Playwright quando não há Chrome instalado; `LH_PORT` muda a porta.',
  '',
  '## Limitações da medição',
  '',
  '- **O MSW vai para produção por design.** O bundle inclui `mockServiceWorker` +',
  '  handlers + fixtures (`browser-*.js`, ~456 KB / 169 KB gzip) porque a demo não',
  '  tem backend. É o maior peso do JS não usado no primeiro paint e a maior parte',
  '  da distância para 100 em mobile. Explicação, não desculpa: sem essa camada o',
  '  app não funciona no deploy.',
  '- **`/perfil` exige sessão.** Anônimo ele redireciona para `/login`, então a',
  '  auditoria roda com um perfil do Chrome semeado (`scripts/lh-seed.mjs`, usuário',
  '  ANA) e `--disable-storage-reset`. Esse flag também impede a limpeza de cache:',
  '  o run de `/perfil` sai com **cache quente** e não é comparável com os demais.',
  '- **`errors-in-console` reprova por causa do 401 de `GET /api/auth/session`**',
  '  para visitante anônimo — o mesmo ruído de boot que `e2e/helpers.ts` já filtra',
  '  explicitamente. É resposta tratada, não erro de aplicação.',
  '- **`robots-txt` e `llms-txt`** reprovam porque a SPA não serve esses arquivos;',
  '  não é requisito do desafio.',
  '- Números medidos numa máquina só, sem CI dedicado: tratam-se de ordem de',
  '  grandeza, não de baseline com tolerância.',
  '',
)

console.log(out.join('\n'))
