// Build for the CyberGate manager dashboard (separate from the Night City viewer in vite.config.js).
//
//   npm run dashboard:dev     local dev server
//   npm run dashboard:build   → dashboard/build/cybergate-dashboard.html (one file, open it by double-click)
//
//   npm run dashboard:serve   serve the repo on this computer, so the page reads data/cybergate-mock-data.xlsx by itself
//
// What ends up in the HTML: all CSS and JS, inlined. The JS is one classic <script> (no type="module", no
// imports at runtime). The data is NOT built in: at startup the page reads data/cybergate-mock-data.xlsx
// from the repo (or the copy the manager picked). A Content-Security-Policy allows reading files from the
// page's own origin only and blocks everything else, so the page cannot reach the internet.
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vite'
import { viteSingleFile } from 'vite-plugin-singlefile'

const DATA_DIR = fileURLToPath(new URL('./data/', import.meta.url))

// Dev server only: serve the repo's data/ folder at /data/, so the page can read the workbook while editing.
function serveRepoData() {
  return {
    name: 'serve-repo-data',
    configureServer(server) {
      server.middlewares.use('/data', (req, res, next) => {
        const name = decodeURIComponent((req.url || '').split('?')[0]).replace(/^\/+/, '')
        const file = path.join(DATA_DIR, name)
        if (!name.endsWith('.xlsx') || !file.startsWith(DATA_DIR) || !fs.existsSync(file)) return next()
        res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet')
        res.setHeader('Cache-Control', 'no-store')
        fs.createReadStream(file).pipe(res)
      })
    },
  }
}

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
  root: 'dashboard',
  base: './',
  plugins: [serveRepoData(), viteSingleFile(), offlineCsp(), classicScript()],
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
