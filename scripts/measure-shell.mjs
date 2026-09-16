// Ad-hoc shell geometry probe (not part of the suite). Run: node scripts/measure-shell.mjs
import { chromium } from '@playwright/test'

const URL = process.env.URL ?? 'http://localhost:4173/'
const browser = await chromium.launch()
const page = await browser.newPage({ viewport: { width: 1440, height: 900 } })
await page.goto(URL)
await page.waitForFunction(() => !!window.__mocks)
await page.waitForSelector('header')
await page.waitForTimeout(800)

const out = await page.evaluate(() => {
  const r = (el) => (el ? el.getBoundingClientRect() : null)
  const header = document.querySelector('header')
  const headerRow = header?.firstElementChild
  const main = document.querySelector('main')
  const hero = main?.querySelector('h1')
  const footer = document.querySelector('footer')
  const bands = footer ? [...footer.children] : []
  const activeNav = document.querySelector('nav[aria-label="Navegação"] [aria-current="page"]')

  const scrollTop = document.documentElement.scrollHeight
  return {
    scrollY: window.scrollY,
    docScrollHeight: scrollTop,
    header: r(header),
    headerRow: r(headerRow),
    headerRowStyle: headerRow
      ? (({ paddingTop, borderBottomWidth, height }) => ({ paddingTop, borderBottomWidth, height }))(
          getComputedStyle(headerRow),
        )
      : null,
    headerPadTop: header ? getComputedStyle(header).paddingTop : null,
    main: r(main),
    mainPadTop: main ? getComputedStyle(main).paddingTop : null,
    heroH1Top: r(hero)?.top,
    activeNav: activeNav
      ? {
          text: activeNav.textContent,
          rect: r(activeNav),
          textDecorationLine: getComputedStyle(activeNav).textDecorationLine,
          bar: (() => {
            const b = activeNav.querySelector('span[aria-hidden]')
            if (!b) return null
            const br = r(b)
            const ar = r(activeNav)
            return {
              rect: br,
              height: br.height,
              width: br.width,
              gapBelowText: br.top - ar.bottom,
              color: getComputedStyle(b).backgroundColor,
            }
          })(),
        }
      : null,
    footer: r(footer),
    bands: bands.map((b) => ({
      text: b.textContent.slice(0, 40),
      bg: getComputedStyle(b).backgroundColor,
      rect: r(b),
    })),
    htmlBg: getComputedStyle(document.documentElement).backgroundColor,
    bodyBg: getComputedStyle(document.body).backgroundColor,
    bodyRect: r(document.body),
    rootDivRect: r(document.body.firstElementChild),
    rootDivBg: getComputedStyle(document.body.firstElementChild).backgroundColor,
    // Is there painted area below the footer inside the document?
    gapAfterFooter: r(footer) ? document.documentElement.scrollHeight - (r(footer).bottom + window.scrollY) : null,
    rootDivBottomVsFooter: r(footer) && r(document.body.firstElementChild)
      ? r(document.body.firstElementChild).bottom - r(footer).bottom
      : null,
  }
})

console.log(JSON.stringify(out, null, 2))

// sample pixel colors down the page bottom
await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight))
await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/kurio-bottom.png' })
await page.evaluate(() => window.scrollTo(0, 0))
await page.waitForTimeout(300)
await page.screenshot({ path: '/tmp/kurio-top.png' })
await browser.close()
