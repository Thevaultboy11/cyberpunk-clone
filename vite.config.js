import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import { viteSingleFile } from 'vite-plugin-singlefile'
import readExcelFile from 'read-excel-file/node'
import { normalizeWorkbook } from './src/lib/normalize.js'

// `import workbook from './data/file.xlsx'` → the workbook as plain JSON, parsed
// at build time. The browser never has to unzip or parse the bundled data.
function xlsxAsJson() {
  return {
    name: 'xlsx-as-json',
    async load(id) {
      if (!id.endsWith('.xlsx')) return null
      this.addWatchFile(id)
      const sheets = normalizeWorkbook(await readExcelFile(id))
      // JSON.parse of a string literal is faster for engines than a big object literal.
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(sheets))})`
    },
  }
}

// Production only: a CSP that forbids every network request, so the built page
// provably can't call a server, CDN or font host. (Dev needs Vite's websocket.)
function offlineCsp() {
  const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data: blob:; font-src data:; worker-src blob:"
  return {
    name: 'offline-csp',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' }],
  }
}

export default defineConfig({
  base: './',
  plugins: [xlsxAsJson(), react(), viteSingleFile(), offlineCsp()],
  build: {
    target: 'es2020',
    assetsInlineLimit: Infinity,
    cssCodeSplit: false,
    modulePreload: false,
  },
})
