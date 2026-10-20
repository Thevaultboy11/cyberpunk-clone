// npm run screenshots (also runs automatically at the end of `npm run build`)
//
// Opens the freshly built page in a headless browser and saves screenshots to docs/screenshots/.
// While doing so it acts as a network audit: every request is checked, anything that is not the page
// itself or data/skills-data.xlsx on this computer is blocked and reported, and the run fails.
//
// Browser: Playwright's Chromium if installed (npx playwright install chromium), otherwise the Chrome or
// Edge already on the computer, otherwise the path in CHROME_PATH. If none is found the build still
// succeeds and only the screenshots are skipped.
import fs from 'node:fs'
import path from 'node:path'
import { pathToFileURL } from 'node:url'
import { startServer, ROOT, PAGE } from './serve.mjs'

const OUT = path.join(ROOT, 'docs', 'screenshots')
const PORT = Number(process.env.SCREENSHOT_PORT) || 4390
const BASE = `http://127.0.0.1:${PORT}${PAGE}`
const VIEW = { width: 1440, height: 900 }

async function launch() {
  let playwright
  try {
    playwright = await import('playwright')
  } catch {
    return { error: 'the "playwright" package is not installed (run npm install)' }
  }
  const { chromium } = playwright
  const attempts = [
    ['Playwright Chromium', {}],
    ['Google Chrome', { channel: 'chrome' }],
    ['Microsoft Edge', { channel: 'msedge' }],
  ]
  if (process.env.CHROME_PATH) attempts.unshift(['CHROME_PATH', { executablePath: process.env.CHROME_PATH }])
  for (const [name, opts] of attempts) {
    try {
      return { browser: await chromium.launch(opts), name }
    } catch {
      /* try the next browser */
    }
  }
  return { error: 'no browser found. Run "npx playwright install chromium" once, or set CHROME_PATH to Chrome/Chromium' }
}

async function main() {
  if (!fs.existsSync(path.join(ROOT, PAGE))) {
    console.error(`screenshots: ${PAGE.slice(1)} is missing, run "npm run build" first.`)
    process.exit(1)
  }
  const { browser, name, error } = await launch()
  if (!browser) {
    console.warn(`\n  screenshots skipped: ${error}.\n  The build itself is fine: build/skills-dashboard.html is ready.\n`)
    return
  }
  fs.mkdirSync(OUT, { recursive: true })
  const server = await startServer(PORT)
  const external = []
  const pageErrors = []
  const saved = []

  async function newPage(theme) {
    const context = await browser.newContext({ viewport: VIEW, colorScheme: theme, reducedMotion: 'reduce', deviceScaleFactor: 1 })
    // Network audit: allow only this computer (the page and the workbook) and inline data: URLs.
    await context.route('**/*', (route) => {
      const url = route.request().url()
      if (url.startsWith(`http://127.0.0.1:${PORT}/`) || url.startsWith('data:') || url.startsWith('file:') || url.startsWith('blob:')) return route.continue()
      external.push(url)
      return route.abort()
    })
    const page = await context.newPage()
    page.on('pageerror', (e) => pageErrors.push(String(e)))
    page.on('console', (m) => { if (m.type() === 'error') pageErrors.push(m.text()) })
    return page
  }
  async function open(page, hash, waitFor) {
    await page.goto(BASE + hash)
    await page.waitForSelector(waitFor, { timeout: 30000 })
    await page.waitForTimeout(250)
  }
  async function shot(page, file, { scrollTo, element } = {}) {
    const target = path.join(OUT, file)
    if (element) {
      await page.locator(element).first().screenshot({ path: target })
    } else {
      if (scrollTo) {
        await page.locator(scrollTo).first().evaluate((el) => el.scrollIntoView({ block: 'start' }))
        await page.evaluate(() => window.scrollBy(0, -72)) // keep the sticky header from covering the heading
        await page.waitForTimeout(150)
      }
      await page.screenshot({ path: target })
    }
    saved.push(file)
  }

  try {
    for (const theme of ['light', 'dark']) {
      const page = await newPage(theme)
      const sfx = theme === 'dark' ? '-dark' : ''

      await open(page, '#/', '.kpi')
      await shot(page, `01-dashboard${sfx}.png`)
      await shot(page, `02-critical-positions${sfx}.png`, { scrollTo: '#critical-positions' })

      await open(page, '#/teams?dept=Security%20Operations', '#emp-body tr')
      await shot(page, `03-teams${sfx}.png`)
      await shot(page, `04-gaps-and-risk${sfx}.png`, { scrollTo: '.grid.g-2' })
      await shot(page, `05-heatmaps${sfx}.png`, { scrollTo: '.section' })
      await shot(page, `06-employees${sfx}.png`, { scrollTo: '#people' })

      // A deterministic employee with trainer observations: the first name in the top-right cells of the
      // Security Operations 9-box (everyone in the 9-box has observation scores).
      const href = await page.locator('.nb-cell.hot .nb-names a').first().getAttribute('href')
      await open(page, href, '.kpi')
      await shot(page, `07-employee${sfx}.png`)
      await shot(page, `08-employee-competencies${sfx}.png`, { scrollTo: '.section' })
      await shot(page, `09-employee-behaviours${sfx}.png`, { scrollTo: 'h2:has-text("Observed behaviours")' })
      await page.context().close()
    }

    // The screen shown when the page is opened by double-click (file://) and no workbook is remembered yet.
    const page = await newPage('light')
    await page.goto(pathToFileURL(path.join(ROOT, PAGE.slice(1))).href)
    await page.waitForSelector('#dropzone', { timeout: 15000 })
    await page.waitForTimeout(250)
    await shot(page, '10-load-workbook.png')
    await page.context().close()
  } finally {
    await browser.close()
    server.close()
  }

  console.log(`\n  screenshots: ${saved.length} images in docs/screenshots/ (browser: ${name})`)
  if (pageErrors.length) {
    console.error(`  page errors:\n    ${pageErrors.join('\n    ')}`)
    process.exitCode = 1
  }
  if (external.length) {
    console.error(`  NETWORK AUDIT FAILED, the page tried to reach:\n    ${[...new Set(external)].join('\n    ')}`)
    process.exitCode = 1
  } else {
    console.log('  network audit: no request left this computer (only the page and data/skills-data.xlsx were loaded)\n')
  }
}

main().catch((err) => {
  console.error(`screenshots failed: ${err.message}`)
  process.exitCode = 1
})
