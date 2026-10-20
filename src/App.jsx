import { useCallback, useRef, useState } from 'react'
import bundled from '../data/mock-data.xlsx' // parsed to JSON at build time
import { normalizeWorkbook } from './lib/normalize.js'
import DataTable from './components/DataTable.jsx'

const BUNDLED = { name: 'mock-data.xlsx', sheets: bundled }

export default function App() {
  const [workbook, setWorkbook] = useState(BUNDLED)
  const [sheetIdx, setSheetIdx] = useState(0)
  const [status, setStatus] = useState(null) // { kind: 'busy' | 'error', text }
  const [dragging, setDragging] = useState(false)
  const inputRef = useRef(null)

  // Reads a user-chosen .xlsx entirely in the browser — nothing is uploaded anywhere.
  const loadFile = useCallback(async (file) => {
    if (!file) return
    if (!/\.xlsx$/i.test(file.name)) {
      setStatus({ kind: 'error', text: `${file.name}: only .xlsx files are supported.` })
      return
    }
    setStatus({ kind: 'busy', text: `Reading ${file.name}…` })
    try {
      const { default: readExcelFile } = await import('read-excel-file/universal')
      const sheets = normalizeWorkbook(await readExcelFile(file))
      if (sheets.length === 0) throw new Error('the workbook has no data')
      setWorkbook({ name: file.name, sheets })
      setSheetIdx(0)
      setStatus(null)
    } catch (err) {
      setStatus({ kind: 'error', text: `Couldn't read ${file.name}: ${err.message}` })
    }
  }, [])

  const onDrop = (e) => {
    e.preventDefault()
    setDragging(false)
    loadFile(e.dataTransfer.files?.[0])
  }

  const sheet = workbook.sheets[sheetIdx]

  return (
    <div
      className={`app ${dragging ? 'dragging' : ''}`}
      onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
      onDragLeave={(e) => { if (e.currentTarget === e.target) setDragging(false) }}
      onDrop={onDrop}
    >
      <header className="top">
        <div className="brand">
          <span className="glitch" data-text="NIGHT CITY DATA">NIGHT CITY DATA</span>
          <span className="sub">offline viewer · {workbook.name}</span>
        </div>
        <div className="actions">
          {workbook !== BUNDLED && (
            <button className="ghost" onClick={() => { setWorkbook(BUNDLED); setSheetIdx(0) }}>Back to mock data</button>
          )}
          <button className="primary" onClick={() => inputRef.current?.click()}>Load .xlsx</button>
          <input
            ref={inputRef}
            type="file"
            accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
            hidden
            onChange={(e) => { loadFile(e.target.files?.[0]); e.target.value = '' }}
          />
        </div>
      </header>

      {status && <div className={`status ${status.kind}`} role="status">{status.text}</div>}

      {workbook.sheets.length > 1 && (
        <div className="tabs" role="tablist">
          {workbook.sheets.map((s, i) => (
            <button key={s.name + i} role="tab" aria-selected={i === sheetIdx} className={i === sheetIdx ? 'active' : ''} onClick={() => setSheetIdx(i)}>
              {s.name} <span className="muted">{s.rows.length.toLocaleString()}</span>
            </button>
          ))}
        </div>
      )}

      <DataTable sheet={sheet} />

      <footer className="foot">Runs fully offline · drop an .xlsx anywhere on the page · ← → to change pages</footer>
      {dragging && <div className="drop-hint">Drop .xlsx to load</div>}
    </div>
  )
}
