// Small helpers shared by every page. Every value from the sheet goes through esc() before it is put in HTML.

export function esc(value) {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export const pct = (x, digits = 0) => (x == null || Number.isNaN(x) ? '–' : `${(x * 100).toFixed(digits)}%`)
export const num = (x) => (x == null ? '–' : Number(x).toLocaleString('en-US'))
export const dec = (x, digits = 1) => (x == null ? '–' : Number(x).toFixed(digits))
export const clamp = (x, lo, hi) => Math.max(lo, Math.min(hi, x))

export function date(iso) {
  if (!iso) return '–'
  const d = new Date(iso)
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric', timeZone: 'UTC' })
}
export function shortDate(iso) {
  if (!iso) return '–'
  return new Date(iso).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', timeZone: 'UTC' })
}

export function initials(name) {
  return String(name || '')
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0].toUpperCase())
    .join('')
}

export const empHref = (e) => `#/employee/${encodeURIComponent(e.email)}`

export function teamsHref(params = {}) {
  const q = Object.entries(params)
    .filter(([, v]) => v != null && v !== '')
    .map(([k, v]) => `${k}=${encodeURIComponent(v)}`)
    .join('&')
  return `#/teams${q ? `?${q}` : ''}`
}

export function plural(n, one, many = `${one}s`) {
  return `${num(n)} ${n === 1 ? one : many}`
}
