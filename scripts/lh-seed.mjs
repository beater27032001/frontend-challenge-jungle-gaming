// Semeia um perfil persistente do Chrome com sessão da ANA, para que o
// Lighthouse consiga auditar `/perfil` de verdade em vez de ser redirecionado
// para `/login`. A sessão vive num cookie `gm_session` + `db.sessions` no
// localStorage (src/mocks/handlers/auth.ts), ambos presos ao perfil.
import { chromium } from '@playwright/test'

const [profileDir, origin] = process.argv.slice(2)
if (!profileDir || !origin) throw new Error('uso: lh-seed.mjs <profileDir> <origin>')

const ctx = await chromium.launchPersistentContext(profileDir, { headless: true })
const page = await ctx.pages()[0] ?? await ctx.newPage()
await page.goto(`${origin}/?mock-reset=1`)
await page.waitForFunction(() => !!window.__mocks)

const status = await page.evaluate(async () => {
  const login = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ email: 'ana@greenmint.dev', password: 'GreenMint#1' }),
  })
  if (!login.ok) return login.status
  return (await fetch('/api/auth/session')).status
})
await ctx.close()

// Sem esta checagem o seed "passaria" em silêncio e o Lighthouse mediria a
// tela de login achando que mediu o perfil.
if (status !== 200) throw new Error(`seed falhou: /api/auth/session devolveu ${status}`)
console.log('seed ok: sessão ANA gravada em', profileDir)
