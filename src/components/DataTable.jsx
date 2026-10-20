import { useDeferredValue, useEffect, useMemo, useState } from 'react'

const PAGE_SIZES = [25, 50, 100, 250]
const collator = new Intl.Collator(undefined, { numeric: true, sensitivity: 'base' })
const numberFmt = new Intl.NumberFormat(undefined, { maximumFractionDigits: 2 })

function formatCell(value, type) {
  if (value === null || value === undefined || value === '') return <span className="muted">—</span>
  switch (type) {
    case 'number': return typeof value === 'number' ? numberFmt.format(value) : String(value)
    case 'date': return typeof value === 'string' ? value.slice(0, 10) : String(value)
    case 'boolean': return <span className={`badge ${value ? 'yes' : 'no'}`}>{value ? 'Yes' : 'No'}</span>
    default: return String(value)
  }
}

function compare(a, b, type) {
  const aEmpty = a === null || a === undefined || a === ''
  const bEmpty = b === null || b === undefined || b === ''
  if (aEmpty || bEmpty) return aEmpty === bEmpty ? 0 : aEmpty ? 1 : -1 // empties last
  if (type === 'number' && typeof a === 'number' && typeof b === 'number') return a - b
  if (type === 'boolean') return Number(a) - Number(b)
  if (type === 'date') return a < b ? -1 : a > b ? 1 : 0 // ISO strings sort correctly
  return collator.compare(String(a), String(b))
}

// Page buttons: 1 … 4 5 [6] 7 8 … 40
function pageWindow(page, total) {
  if (total <= 9) return Array.from({ length: total }, (_, i) => i + 1)
  const out = [1]
  const from = Math.max(2, page - 2)
  const to = Math.min(total - 1, page + 2)
  if (from > 2) out.push('…a')
  for (let p = from; p <= to; p++) out.push(p)
  if (to < total - 1) out.push('…b')
  out.push(total)
  return out
}

export default function DataTable({ sheet }) {
  const { columns, types, rows } = sheet
  const [query, setQuery] = useState('')
  const [sort, setSort] = useState(null) // { col, dir: 1 | -1 }
  const [pageSize, setPageSize] = useState(50)
  const [page, setPage] = useState(1)
  const deferredQuery = useDeferredValue(query)

  // Reset view state when a different sheet/file is shown.
  useEffect(() => { setQuery(''); setSort(null); setPage(1) }, [sheet])

  // One lowercase string per row, built once per sheet, makes search a single includes().
  const searchIndex = useMemo(
    () => rows.map((r) => r.map((v) => (v === null ? '' : String(v))).join('\u0001').toLowerCase()),
    [rows],
  )

  // Work with row indices so filtering/sorting never copies row data.
  const filtered = useMemo(() => {
    const q = deferredQuery.trim().toLowerCase()
    const idx = []
    for (let i = 0; i < rows.length; i++) if (!q || searchIndex[i].includes(q)) idx.push(i)
    return idx
  }, [rows, searchIndex, deferredQuery])

  const ordered = useMemo(() => {
    if (!sort) return filtered
    const { col, dir } = sort
    const t = types[col]
    return [...filtered].sort((a, b) => dir * compare(rows[a][col], rows[b][col], t) || a - b)
  }, [filtered, sort, rows, types])

  const pageCount = Math.max(1, Math.ceil(ordered.length / pageSize))
  const current = Math.min(page, pageCount)
  const startAt = (current - 1) * pageSize
  const pageRows = ordered.slice(startAt, startAt + pageSize)

  useEffect(() => { setPage(1) }, [deferredQuery, sort, pageSize])

  // ← / → change page when you're not typing in a field.
  useEffect(() => {
    const onKey = (e) => {
      if (e.target instanceof HTMLInputElement || e.target instanceof HTMLSelectElement) return
      if (e.key === 'ArrowRight') setPage((p) => Math.min(p + 1, pageCount))
      if (e.key === 'ArrowLeft') setPage((p) => Math.max(p - 1, 1))
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [pageCount])

  const toggleSort = (col) =>
    setSort((s) => (!s || s.col !== col ? { col, dir: 1 } : s.dir === 1 ? { col, dir: -1 } : null))

  const go = (p) => setPage(Math.min(Math.max(1, p), pageCount))
  const stale = query !== deferredQuery

  return (
    <section className="table-panel">
      <div className="toolbar">
        <label className="search">
          <span aria-hidden="true">⌕</span>
          <input
            type="search"
            placeholder={`Search ${rows.length.toLocaleString()} rows…`}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="Search rows"
          />
        </label>
        <div className="count">
          {ordered.length === 0
            ? 'No matches'
            : `${(startAt + 1).toLocaleString()}–${Math.min(startAt + pageSize, ordered.length).toLocaleString()} of ${ordered.length.toLocaleString()}`}
          {ordered.length !== rows.length && <span className="muted"> (filtered from {rows.length.toLocaleString()})</span>}
        </div>
      </div>

      <div className={`table-wrap ${stale ? 'stale' : ''}`}>
        <table>
          <thead>
            <tr>
              <th className="rownum">#</th>
              {columns.map((c, i) => {
                const active = sort?.col === i
                return (
                  <th
                    key={i}
                    className={`${types[i] === 'number' ? 'num' : ''} ${active ? 'sorted' : ''}`}
                    aria-sort={active ? (sort.dir === 1 ? 'ascending' : 'descending') : 'none'}
                  >
                    <button onClick={() => toggleSort(i)} title="Sort">
                      {c}
                      <span className="arrow">{active ? (sort.dir === 1 ? '▲' : '▼') : '↕'}</span>
                    </button>
                  </th>
                )
              })}
            </tr>
          </thead>
          <tbody>
            {pageRows.map((ri, n) => (
              <tr key={ri}>
                <td className="rownum">{startAt + n + 1}</td>
                {columns.map((_, ci) => (
                  <td key={ci} className={types[ci] === 'number' ? 'num' : ''}>
                    {formatCell(rows[ri][ci], types[ci])}
                  </td>
                ))}
              </tr>
            ))}
            {pageRows.length === 0 && (
              <tr><td className="empty" colSpan={columns.length + 1}>Nothing matches “{deferredQuery}”.</td></tr>
            )}
          </tbody>
        </table>
      </div>

      <nav className="pager" aria-label="Pagination">
        <div className="pages">
          <button onClick={() => go(1)} disabled={current === 1} aria-label="First page">«</button>
          <button onClick={() => go(current - 1)} disabled={current === 1} aria-label="Previous page">‹</button>
          {pageWindow(current, pageCount).map((p) =>
            typeof p === 'string'
              ? <span key={p} className="gap">…</span>
              : <button key={p} className={p === current ? 'active' : ''} aria-current={p === current ? 'page' : undefined} onClick={() => go(p)}>{p}</button>,
          )}
          <button onClick={() => go(current + 1)} disabled={current === pageCount} aria-label="Next page">›</button>
          <button onClick={() => go(pageCount)} disabled={current === pageCount} aria-label="Last page">»</button>
        </div>
        <label className="page-size">
          Rows per page
          <select value={pageSize} onChange={(e) => setPageSize(Number(e.target.value))}>
            {PAGE_SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </label>
      </nav>
    </section>
  )
}
