// Probe for the black strip after the footer on short pages.
import { chromium } from '@playwright/test'

const paths = process.env.PATHS?.split(',') ?? ['/login', '/']
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })

for (const p of paths) {
  await page.goto(`http://localhost:4173${p}`)
  await page.waitForFunction(() => !!window.__mocks).catch(() => {})
  await page.waitForTimeout(700)
  const m = await page.evaluate(() => {
    const footer = document.querySelector('footer')
    const fr = footer.getBoundingClientRect()
    const shell = footer.parentElement
    const sr = shell.getBoundingClientRect()
    return {
      viewportH: innerHeight,
      docH: document.documentElement.scrollHeight,
      bodyChildren: [...document.body.children].map((c) => ({
        tag: c.tagName,
        cls: (c.className || '').toString().slice(0, 60),
        h: c.getBoundingClientRect().height,
      })),
      shellCls: (shell.className || '').toString().slice(0, 80),
      shellRect: { top: sr.top, bottom: sr.bottom, height: sr.height },
      footerBottom: fr.bottom,
      stripBelowFooter: document.documentElement.scrollHeight - fr.bottom,
    }
  })
  console.log(p, JSON.stringify(m, null, 1))
}
await browser.close()
