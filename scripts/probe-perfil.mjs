import { chromium } from '@playwright/test'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto('http://localhost:4173/')
await page.waitForFunction(() => !!window.__mocks)
const login = await page.evaluate(async () => {
  const r = await fetch('/api/auth/login', {
    method: 'POST',
    headers: { 'content-type': 'application/json' },
    body: JSON.stringify({ email: 'ana@greenmint.dev', password: 'GreenMint#1' }),
  })
  return r.status
})
await page.goto('http://localhost:4173/perfil')
await page.waitForFunction(() => !!window.__mocks)
await page.waitForTimeout(1200)
console.log(JSON.stringify({
  login,
  url: page.url(),
  footers: await page.locator('footer').count(),
  bodyStart: (await page.locator('main').innerText().catch(() => '')).slice(0, 80),
}))
await browser.close()
