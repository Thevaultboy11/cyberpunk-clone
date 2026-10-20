// Turns the reader's output ([{ sheet, data: [[...], ...] }], see xlsx.js) into a compact,
// JSON-safe shape: the first non-empty row is the header, empty rows are dropped.
//
// Output: [{ name, columns: string[], types: ('number'|'date'|'boolean'|'text')[], rows: any[][] }]
// Dates become ISO strings so the result survives JSON serialization.

export function normalizeWorkbook(sheets) {
  return sheets
    .map(({ sheet, data }) => normalizeSheet(sheet, data))
    .filter((s) => s.columns.length > 0)
}

function normalizeSheet(name, data) {
  // Drop leading empty rows; first non-empty row is the header.
  const start = data.findIndex((r) => r && r.some((c) => c !== null && c !== ''))
  if (start === -1) return { name, columns: [], types: [], rows: [] }

  const headerRow = data[start]
  const width = Math.max(...data.slice(start).map((r) => r.length))
  const columns = Array.from({ length: width }, (_, i) => {
    const h = headerRow[i]
    return h === null || h === undefined || h === '' ? `Column ${i + 1}` : String(h)
  })

  const rows = []
  for (let r = start + 1; r < data.length; r++) {
    const src = data[r]
    if (!src || src.every((c) => c === null || c === '')) continue
    const row = new Array(width)
    for (let c = 0; c < width; c++) {
      const v = src[c]
      row[c] = v instanceof Date ? v.toISOString() : v === undefined ? null : v
    }
    rows.push(row)
  }

  return { name, columns, types: inferTypes(data.slice(start + 1), width), rows }
}

function inferTypes(dataRows, width) {
  const types = []
  for (let c = 0; c < width; c++) {
    let t = null
    for (let r = 0; r < dataRows.length && r < 500; r++) {
      const v = dataRows[r]?.[c]
      if (v === null || v === undefined || v === '') continue
      const vt = v instanceof Date ? 'date' : typeof v === 'number' ? 'number' : typeof v === 'boolean' ? 'boolean' : 'text'
      if (t === null) t = vt
      else if (t !== vt) { t = 'text'; break }
    }
    types.push(t ?? 'text')
  }
  return types
}
