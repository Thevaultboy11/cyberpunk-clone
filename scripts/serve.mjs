// npm run serve
// Serves this repository on your own computer (127.0.0.1 only), so the dashboard page can read
// data/skills-data.xlsx by itself. No internet needed; nothing is reachable from other machines.
// Plain Node, no dependencies. Also used by scripts/screenshots.mjs.
import http from 'node:http'
import fs from 'node:fs'
import path from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
export const PAGE = '/build/skills-dashboard.html'

const TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.xlsx': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.md': 'text/plain; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
}

export function startServer(port = 4321) {
  const server = http.createServer((req, res) => {
    if (req.method !== 'GET' && req.method !== 'HEAD') { res.writeHead(405).end(); return }
    const urlPath = decodeURIComponent(new URL(req.url, 'http://localhost').pathname)
    if (urlPath === '/') { res.writeHead(302, { Location: PAGE }).end(); return }
    const file = path.normalize(path.join(ROOT, urlPath))
    // Only files inside the repo, never node_modules or .git.
    if (!file.startsWith(ROOT + path.sep) || /[\\/](node_modules|\.git)([\\/]|$)/.test(file)) { res.writeHead(403).end(); return }
    fs.stat(file, (err, stat) => {
      if (err || !stat.isFile()) { res.writeHead(404, { 'Content-Type': 'text/plain' }).end('Not found'); return }
      res.writeHead(200, { 'Content-Type': TYPES[path.extname(file)] || 'application/octet-stream', 'Content-Length': stat.size, 'Cache-Control': 'no-store' })
      if (req.method === 'HEAD') { res.end(); return }
      fs.createReadStream(file).pipe(res)
    })
  })
  return new Promise((resolve, reject) => {
    server.once('error', reject)
    server.listen(port, '127.0.0.1', () => resolve(server))
  })
}

// Run directly: `npm run serve`
if (import.meta.url === pathToFileURL(process.argv[1]).href) {
  const port = Number(process.env.PORT) || 4321
  if (!fs.existsSync(path.join(ROOT, PAGE))) {
    console.error(`Missing ${PAGE.slice(1)}. Run "npm run build" first.`)
    process.exit(1)
  }
  startServer(port)
    .then(() => {
      console.log(`\n  Skills dashboard → http://localhost:${port}${PAGE}`)
      console.log(`  Reading data from    ${path.join(ROOT, 'data', 'skills-data.xlsx')}`)
      console.log('  Press Ctrl+C to stop.\n')
    })
    .catch((err) => {
      console.error(err.code === 'EADDRINUSE' ? `Port ${port} is busy. Try: PORT=4322 npm run serve` : err.message)
      process.exit(1)
    })
}
