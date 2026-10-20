// Build for the CyberGate manager dashboard (separate from the Night City viewer in vite.config.js).
//
//   npm run dashboard:dev     local dev server
//   npm run dashboard:build   → dashboard/build/cybergate-dashboard.html (one file, open it by double-click)
//
// What ends up in the HTML:
//   - the workbook data/cybergate-mock-data.xlsx, parsed here at build time into JSON
//   - all CSS and JS inlined; the JS is one classic <script> (no type="module", no imports at runtime)
//   - a Content-Security-Policy that blocks every network request, so the page works in airplane mode
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'
import readExcelFile from 'read-excel-file/node'
import { normalizeWorkbook } from './src/lib/normalize.js'

function xlsxAsJson() {
  return {
    name: 'xlsx-as-json',
    async load(id) {
      if (!id.endsWith('.xlsx')) return null
      this.addWatchFile(id)
      const sheets = normalizeWorkbook(await readExcelFile(id))
      return `export default JSON.parse(${JSON.stringify(JSON.stringify(sheets))})`
    },
  }
}

function offlineCsp() {
  const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:"
  return {
    name: 'offline-csp',
    apply: 'build',
    transformIndexHtml: () => [{ tag: 'meta', attrs: { 'http-equiv': 'Content-Security-Policy', content: csp }, injectTo: 'head-prepend' }],
  }
}

// The app is a single chunk with no imports left after bundling. Wrap it in a self-running
// function and drop type="module", so the page runs as one plain classic <script>.
function classicScript() {
  return {
    name: 'classic-script',
    apply: 'build',
    enforce: 'post',
    renderChunk(code, chunk) {
      if (!chunk.isEntry) return null
      return { code: `(function () {\n${code}\n})();\n`, map: null }
    },
    // Runs after vite-plugin-singlefile has inlined everything and the file is on disk.
    writeBundle(options, bundle) {
      for (const name of Object.keys(bundle)) {
        if (!name.endsWith('.html')) continue
        const file = path.join(options.dir, name)
        const html = fs.readFileSync(file, 'utf8')
        fs.writeFileSync(file, html.replace(/<script type="module"[^>]*>/g, '<script>'))
      }
    },
  }
}

export default defineConfig({
  root: 'dashboard',
  base: './',
  plugins: [xlsxAsJson(), viteSingleFile(), offlineCsp(), classicScript()],
  server: { fs: { allow: ['..'] } },
  build: {
    outDir: 'build',
    emptyOutDir: true,
    target: 'es2019',
    chunkSizeWarningLimit: 8000,
    assetsInlineLimit: Infinity,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: fileURLToPath(new URL('./dashboard/cybergate-dashboard.html', import.meta.url)),
    },
  },
})
