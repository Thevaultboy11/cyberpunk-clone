// Entry point. Vite bundles these files into one classic <script> inside build/cybergate-dashboard.html.
// The data is NOT inside the page: it is read at startup from the Excel workbook in the repo,
// data/cybergate-mock-data.xlsx (see data.js). The only thing the page ever reads is that file.
import './styles.css'
import { buildModel } from './model.js'
import { renderDashboard } from './pages/dashboard.js'
import { renderTeams } from './pages/teams.js'
import { renderEmployee } from './pages/employee.js'
import { icon } from './ui.js'
import { esc, num } from './util.js'
import { DATA_FILE, DATA_PATH, parseWorkbook, fetchFromRepo, loadRemembered, remember, forget, readPickedFile } from './data.js'

const THEME_KEY = 'cybergate-theme'

function storedTheme() {
  try { return localStorage.getItem(THEME_KEY) } catch { return null }
}
function applyTheme(theme) {
  document.documentElement.dataset.theme = theme
  const btn = document.getElementById('theme-toggle')
  if (btn) {
    btn.innerHTML = theme === 'dark' ? icon.sun : icon.moon
    btn.title = theme === 'dark' ? 'Switch to light theme' : 'Switch to dark theme'
    btn.setAttribute('aria-label', btn.title)
  }
}
function initialTheme() {
  const saved = storedTheme()
  if (saved === 'dark' || saved === 'light') return saved
  return window.matchMedia && window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

function parseHash() {
  const raw = location.hash.replace(/^#/, '') || '/'
  const [path, query = ''] = raw.split('?')
  const params = {}
  for (const part of query.split('&')) {
    if (!part) continue
    const [k, v = ''] = part.split('=')
    params[decodeURIComponent(k)] = decodeURIComponent(v)
  }
  return { path, params }
}

function shell() {
  document.body.innerHTML = `
    <header class="header"><div class="container">
      <a class="brand" href="#/"><span class="brand-mark">${icon.logo}</span>cybergate<span class="brand-sub">Manager</span></a>
      <nav class="nav"><a href="#/" data-nav="dashboard">Dashboard</a><a href="#/teams" data-nav="teams">Teams</a></nav>
      <div class="header-right">
        <button class="status-pill data-pill" id="data-pill" type="button" title="Load another workbook"><span class="status-dot"></span><span id="data-pill-text">No data loaded</span></button>
        <button class="icon-btn" id="theme-toggle" type="button"></button>
      </div>
    </div></header>
    <main id="app"></main>
    <input type="file" id="file-input" accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" hidden />
    <div class="drop-overlay" id="drop-overlay"><div>Drop the .xlsx workbook to load it</div></div>
    <footer class="footer"><div class="container"><span>CyberGate manager dashboard · pilot · works offline</span><span id="footer-source">Data: ${esc(DATA_PATH)}</span></div></footer>`
}

function dataScreen({ error = '', remembered = null } = {}) {
  return `<div class="page"><section class="hero container">
    <div class="eyebrow">Manager dashboard · Acme Corp</div>
    <h1>Load the assessment workbook</h1>
    <p class="sub">The dashboard reads everything from <span class="mono">${esc(DATA_PATH)}</span> in the repository. Pages opened by double-click aren't allowed to read other files on their own, so choose the file once. It is read on this computer only and never uploaded anywhere.</p>
  </section>
  <div class="container">
    ${error ? `<div class="alert">${esc(error)}</div>` : ''}
    <div class="dropzone" id="dropzone">
      <div class="dz-icon">${icon.book}</div>
      <h3>Drop <span class="mono">${esc(DATA_FILE)}</span> here</h3>
      <p class="muted">or</p>
      <button class="btn btn-primary" type="button" data-pick>Choose the workbook</button>
      <p class="note" style="margin-top:16px">Find it in the repo at <span class="mono">${esc(DATA_PATH)}</span>.</p>
    </div>
    <div class="grid g-2" style="margin-top:16px">
      <div class="card subtle"><h3>Load it automatically</h3><p class="card-sub" style="margin-top:6px">From the repository folder, run <span class="mono">npm run serve</span> and open the address it prints. The page then reads <span class="mono">${esc(DATA_PATH)}</span> by itself every time it opens. That runs on your own computer, so it works in airplane mode too.</p></div>
      <div class="card subtle"><h3>Remembered on this computer</h3><p class="card-sub" style="margin-top:6px">After you choose the file once, this browser keeps a copy, so double-clicking the page next time opens the dashboard straight away. Use the data button in the header to load a newer version.</p>
        ${remembered ? `<p class="note">Last loaded: <b>${esc(remembered.name)}</b>, ${esc(new Date(remembered.loadedAt).toLocaleString('en-GB'))}.</p>` : ''}</div>
    </div>
  </div></div>`
}

function start() {
  applyTheme(initialTheme())
  shell()
  applyTheme(document.documentElement.dataset.theme)
  const app = document.getElementById('app')
  const pillText = document.getElementById('data-pill-text')
  const pill = document.getElementById('data-pill')
  const fileInput = document.getElementById('file-input')
  let model = null

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    try { localStorage.setItem(THEME_KEY, next) } catch { /* storage may be blocked on file:// */ }
  })

  // Rows with data-href act as links (the name inside stays a real link for keyboard users).
  document.addEventListener('click', (ev) => {
    if (ev.target.closest('[data-pick]')) { fileInput.click(); return }
    if (ev.target.closest('[data-forget]')) { forget().then(() => location.reload()); return }
    const row = ev.target.closest('tr[data-href]')
    if (!row || ev.target.closest('a, button, input, summary')) return
    location.hash = row.dataset.href.replace(/^#/, '')
  })

  // ---------------------------------------------------------------- loading the workbook
  function showData(record, sheets) {
    model = buildModel(sheets)
    const when = new Date(record.modified || record.loadedAt).toLocaleString('en-GB', { day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
    const from = record.source === 'repo' ? `read from ${record.where}` : record.source === 'remembered' ? `remembered copy, loaded ${when}` : `chosen file, ${when}`
    pillText.textContent = `${record.name} · ${num(model.employees.length)} people`
    pill.title = `Data: ${record.name} (${from}). Click to load another workbook.`
    pill.classList.remove('empty')
    document.getElementById('footer-source').textContent = `Data: ${record.name} · ${from}`
    render()
  }

  async function openRecord(record, { save = true } = {}) {
    pillText.textContent = `Reading ${record.name}…`
    const sheets = await parseWorkbook(record.buffer)
    if (save) remember(record)
    showData(record, sheets)
  }

  async function openFile(file) {
    if (!file) return
    if (!/\.xlsx$/i.test(file.name)) {
      app.innerHTML = dataScreen({ error: `"${file.name}" is not an .xlsx workbook. Choose ${DATA_FILE}.` })
      return
    }
    try {
      await openRecord(await readPickedFile(file))
    } catch (err) {
      app.innerHTML = dataScreen({ error: `Couldn't read "${file.name}": ${err.message}` })
      pillText.textContent = model ? pillText.textContent : 'No data loaded'
    }
  }

  pill.addEventListener('click', () => fileInput.click())
  fileInput.addEventListener('change', () => { openFile(fileInput.files[0]); fileInput.value = '' })

  const overlay = document.getElementById('drop-overlay')
  let dragDepth = 0
  window.addEventListener('dragenter', (ev) => { if (ev.dataTransfer && [...ev.dataTransfer.types].includes('Files')) { dragDepth++; overlay.classList.add('show') } })
  window.addEventListener('dragleave', () => { dragDepth = Math.max(0, dragDepth - 1); if (!dragDepth) overlay.classList.remove('show') })
  window.addEventListener('dragover', (ev) => ev.preventDefault())
  window.addEventListener('drop', (ev) => {
    ev.preventDefault()
    dragDepth = 0
    overlay.classList.remove('show')
    const file = ev.dataTransfer && ev.dataTransfer.files[0]
    if (file) openFile(file)
  })

  async function boot() {
    app.innerHTML = `<div class="container page"><section class="hero"><div class="eyebrow">Loading</div><h1>Reading ${esc(DATA_FILE)}…</h1><p class="sub">Looking for the workbook in the repository folder.</p></section></div>`
    pillText.textContent = 'Loading…'
    try {
      const fromRepo = await fetchFromRepo()
      if (fromRepo) { await openRecord(fromRepo); return }
    } catch (err) {
      app.innerHTML = dataScreen({ error: `Found ${DATA_PATH} but couldn't read it: ${err.message}` })
      pillText.textContent = 'No data loaded'
      return
    }
    const saved = await loadRemembered()
    if (saved) {
      try {
        await openRecord({ ...saved, source: 'remembered' }, { save: false })
        return
      } catch {
        /* the remembered copy is unreadable: ask for the file */
      }
    }
    pill.classList.add('empty')
    pillText.textContent = 'No data loaded'
    app.innerHTML = dataScreen({ remembered: saved })
  }

  function render() {
    if (!model) return
    const { path, params } = parseHash()
    if (!path.startsWith('/')) {
      // In-page anchor (e.g. #critical-positions on the dashboard): render the dashboard if needed, then scroll.
      if (!document.getElementById(path)) {
        app.innerHTML = renderDashboard(model)
        document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === 'dashboard'))
      }
      const target = document.getElementById(path)
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    let view
    let nav = 'dashboard'
    if (path.startsWith('/employee/')) {
      view = renderEmployee(model, decodeURIComponent(path.slice('/employee/'.length)))
      nav = 'teams'
    } else if (path === '/teams') {
      view = renderTeams(model, params)
      nav = 'teams'
    } else {
      view = { html: renderDashboard(model), title: 'Dashboard' }
    }
    app.innerHTML = view.html
    document.title = `${view.title} · CyberGate`
    document.querySelectorAll('[data-nav]').forEach((a) => a.classList.toggle('active', a.dataset.nav === nav))
    window.scrollTo(0, 0)
    if (view.mount) {
      view.mount(app, (changes) => {
        const cur = parseHash()
        const next = { ...cur.params, ...changes }
        const q = Object.entries(next).filter(([, v]) => v != null && v !== '').map(([k, v]) => `${encodeURIComponent(k)}=${encodeURIComponent(v)}`).join('&')
        history.replaceState(null, '', `#${cur.path}${q ? `?${q}` : ''}`)
      })
    }
  }
  window.addEventListener('hashchange', render)
  boot().catch((err) => {
    app.innerHTML = `<div class="container page"><section class="hero"><h1>Something went wrong</h1><p class="sub">${esc(err && err.message)}</p></section></div>`
    throw err
  })
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
else start()
