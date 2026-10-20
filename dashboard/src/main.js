// Entry point. Vite bundles these files into one classic <script> inside cybergate-dashboard.html.
// The workbook is turned into JSON at build time (see vite.dashboard.config.js), so the page reads
// its data from inside itself and makes no requests of any kind.
import workbook from '../../data/cybergate-mock-data.xlsx'
import './styles.css'
import { buildModel } from './model.js'
import { renderDashboard } from './pages/dashboard.js'
import { renderTeams } from './pages/teams.js'
import { renderEmployee } from './pages/employee.js'
import { icon } from './ui.js'
import { esc } from './util.js'

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
        <span class="status-pill" title="All data is inside this file. No network requests are made."><span class="status-dot"></span>Offline · bundled data</span>
        <button class="icon-btn" id="theme-toggle" type="button"></button>
      </div>
    </div></header>
    <main id="app"></main>
    <footer class="footer"><div class="container"><span>CyberGate manager dashboard · pilot</span><span>Source: data/cybergate-mock-data.xlsx (fictional data) · built into this file</span></div></footer>`
}

function start() {
  applyTheme(initialTheme())
  shell()
  applyTheme(document.documentElement.dataset.theme)
  const model = buildModel(workbook)
  const app = document.getElementById('app')

  document.getElementById('theme-toggle').addEventListener('click', () => {
    const next = document.documentElement.dataset.theme === 'dark' ? 'light' : 'dark'
    applyTheme(next)
    try { localStorage.setItem(THEME_KEY, next) } catch { /* storage may be blocked on file:// */ }
  })

  // Rows with data-href act as links (the name inside stays a real link for keyboard users).
  document.addEventListener('click', (ev) => {
    const row = ev.target.closest('tr[data-href]')
    if (!row || ev.target.closest('a, button, input, summary')) return
    location.hash = row.dataset.href.replace(/^#/, '')
  })

  function render() {
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
  try {
    render()
  } catch (err) {
    app.innerHTML = `<div class="container page"><section class="hero"><h1>Something went wrong</h1><p class="sub">${esc(err && err.message)}</p></section></div>`
    throw err
  }
}

if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', start)
else start()
