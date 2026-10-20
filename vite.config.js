// Build for the CyberGate manager dashboard.
//
//   npm run dev     live-reload dev server (serves data/ too, so the workbook loads)
//   npm run build   → build/cybergate-dashboard.html, then fresh screenshots in docs/screenshots/
//   npm run serve   serve the repo on this computer so the built page reads data/cybergate-mock-data.xlsx itself
//
// What ends up in the HTML: all CSS and JS, inlined. The JS is one classic <script> (no type="module", no
// imports at runtime). The data is NOT built in: at startup the page reads data/cybergate-mock-data.xlsx
// (or the copy the manager picked). A Content-Security-Policy allows reading files from the page's own
// origin only and blocks every other request, so the page cannot reach the internet.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

function offlineCsp() {
  const csp = "default-src 'none'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src data:; font-src data:; connect-src 'self'"
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
  base: './',
  plugins: [viteSingleFile(), offlineCsp(), classicScript()],
  server: { open: '/cybergate-dashboard.html' },
  build: {
    outDir: 'build',
    emptyOutDir: true,
    target: 'es2019',
    assetsInlineLimit: Infinity,
    cssCodeSplit: false,
    modulePreload: false,
    rollupOptions: {
      input: fileURLToPath(new URL('./cybergate-dashboard.html', import.meta.url)),
    },
  },
})
