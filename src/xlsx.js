// Minimal .xlsx reader for the browser, with no library.
// An .xlsx file is a zip of XML files. We read the zip's central directory, inflate each part with the
// browser's built-in DecompressionStream('deflate-raw'), and read the XML with DOMParser.
// Output matches what read-excel-file returns: [{ sheet: name, data: rows[][] }] with Dates for date cells,
// so it can go straight into normalizeWorkbook() from src/lib/normalize.js.

const td = new TextDecoder('utf-8')

// ---------------------------------------------------------------- zip
function readZipEntries(buf) {
  const view = new DataView(buf)
  // End of central directory record: signature 0x06054b50, searched from the end (comment may follow).
  let eocd = -1
  for (let i = buf.byteLength - 22; i >= Math.max(0, buf.byteLength - 22 - 0xffff); i--) {
    if (view.getUint32(i, true) === 0x06054b50) { eocd = i; break }
  }
  if (eocd < 0) throw new Error('This is not a valid .xlsx file (no zip directory found).')
  const count = view.getUint16(eocd + 10, true)
  let p = view.getUint32(eocd + 16, true)
  const entries = new Map()
  for (let i = 0; i < count; i++) {
    if (view.getUint32(p, true) !== 0x02014b50) throw new Error('Damaged .xlsx file (bad zip directory).')
    const method = view.getUint16(p + 10, true)
    const compSize = view.getUint32(p + 20, true)
    const nameLen = view.getUint16(p + 28, true)
    const extraLen = view.getUint16(p + 30, true)
    const commentLen = view.getUint16(p + 32, true)
    const localOffset = view.getUint32(p + 42, true)
    const name = td.decode(new Uint8Array(buf, p + 46, nameLen))
    entries.set(name, { method, compSize, localOffset })
    p += 46 + nameLen + extraLen + commentLen
  }
  return entries
}

async function inflateRaw(bytes) {
  if (typeof DecompressionStream === 'undefined') {
    throw new Error('This browser cannot unzip files. Please use a current version of Chrome, Edge, Firefox or Safari.')
  }
  const stream = new Blob([bytes]).stream().pipeThrough(new DecompressionStream('deflate-raw'))
  return new Uint8Array(await new Response(stream).arrayBuffer())
}

async function readEntry(buf, entries, name) {
  const e = entries.get(name)
  if (!e) return null
  const view = new DataView(buf)
  const nameLen = view.getUint16(e.localOffset + 26, true)
  const extraLen = view.getUint16(e.localOffset + 28, true)
  const start = e.localOffset + 30 + nameLen + extraLen
  const raw = new Uint8Array(buf, start, e.compSize)
  if (e.method === 0) return td.decode(raw)
  if (e.method === 8) return td.decode(await inflateRaw(raw))
  throw new Error(`Unsupported compression in ${name}.`)
}

// ---------------------------------------------------------------- xml helpers
const parseXml = (text) => new DOMParser().parseFromString(text, 'application/xml')
const all = (node, tag) => Array.from(node.getElementsByTagNameNS('*', tag))
const first = (node, tag) => node.getElementsByTagNameNS('*', tag)[0] || null

function columnIndex(ref) {
  let n = 0
  for (const ch of ref) {
    const c = ch.charCodeAt(0)
    if (c < 65 || c > 90) break
    n = n * 26 + (c - 64)
  }
  return n - 1
}

// Text of a string item (<si>/<is>), including rich-text runs, without phonetic hints (<rPh>).
function richText(node) {
  let out = ''
  for (const t of all(node, 't')) {
    if (t.parentNode && t.parentNode.localName === 'rPh') continue
    out += t.textContent
  }
  return out
}

const BUILTIN_DATE_FORMATS = new Set([14, 15, 16, 17, 18, 19, 20, 21, 22, 27, 30, 36, 45, 46, 47, 50, 57])

function dateStyles(stylesXml) {
  const isDate = []
  if (!stylesXml) return isDate
  const doc = parseXml(stylesXml)
  const custom = new Map()
  for (const f of all(doc, 'numFmt')) custom.set(Number(f.getAttribute('numFmtId')), f.getAttribute('formatCode') || '')
  const cellXfs = first(doc, 'cellXfs')
  if (!cellXfs) return isDate
  for (const xf of Array.from(cellXfs.children).filter((n) => n.localName === 'xf')) {
    const id = Number(xf.getAttribute('numFmtId') || 0)
    let date = BUILTIN_DATE_FORMATS.has(id)
    if (!date && custom.has(id)) {
      // A custom format is a date if it has d/m/y/h/s outside quotes and [colour] brackets.
      const code = custom.get(id).replace(/"[^"]*"/g, '').replace(/\[[^\]]*\]/g, '')
      date = /[dmyhs]/i.test(code)
    }
    isDate.push(date)
  }
  return isDate
}

function excelDate(serial) {
  // Excel's day 0 is 1899-12-30 (accounting for the 1900 leap-year bug). Keep it in UTC.
  return new Date(Math.round((serial - 25569) * 86400000))
}

// ---------------------------------------------------------------- workbook
export async function readXlsx(arrayBuffer) {
  const entries = readZipEntries(arrayBuffer)
  const workbookXml = await readEntry(arrayBuffer, entries, 'xl/workbook.xml')
  if (!workbookXml) throw new Error('This file has no workbook inside. Is it really an .xlsx file?')
  const relsXml = await readEntry(arrayBuffer, entries, 'xl/_rels/workbook.xml.rels')
  const shared = []
  const sharedXml = await readEntry(arrayBuffer, entries, 'xl/sharedStrings.xml')
  if (sharedXml) for (const si of all(parseXml(sharedXml), 'si')) shared.push(richText(si))
  const isDate = dateStyles(await readEntry(arrayBuffer, entries, 'xl/styles.xml'))

  const targets = new Map()
  if (relsXml) {
    for (const r of all(parseXml(relsXml), 'Relationship')) {
      let target = r.getAttribute('Target') || ''
      target = target.startsWith('/') ? target.slice(1) : `xl/${target}`
      targets.set(r.getAttribute('Id'), target.replace(/\/\.\//g, '/'))
    }
  }

  const sheets = []
  const wb = parseXml(workbookXml)
  let index = 0
  for (const s of all(wb, 'sheet')) {
    index++
    const name = s.getAttribute('name')
    const rid = s.getAttributeNS('http://schemas.openxmlformats.org/officeDocument/2006/relationships', 'id') || s.getAttribute('r:id')
    const path = targets.get(rid) || `xl/worksheets/sheet${index}.xml`
    const xml = await readEntry(arrayBuffer, entries, path)
    if (!xml) continue
    const doc = parseXml(xml)
    const data = []
    for (const row of all(doc, 'row')) {
      const r = Number(row.getAttribute('r')) - 1
      const values = []
      let col = 0
      for (let c = row.firstElementChild; c; c = c.nextElementSibling) {
        if (c.localName !== 'c') continue
        const ref = c.getAttribute('r')
        if (ref) col = columnIndex(ref)
        const type = c.getAttribute('t')
        // Walk the cell's children directly (much faster than a tag search on large sheets).
        let raw = null
        let is = null
        for (let k = c.firstElementChild; k; k = k.nextElementSibling) {
          if (k.localName === 'v') raw = k.textContent
          else if (k.localName === 'is') is = k
        }
        let value = null
        if (type === 's') value = raw == null ? null : shared[Number(raw)] ?? null
        else if (type === 'inlineStr') value = is ? richText(is) : null
        else if (type === 'str') value = raw
        else if (type === 'b') value = raw == null ? null : raw === '1'
        else if (type === 'e') value = null
        else if (raw != null && raw !== '') {
          const n = Number(raw)
          value = isDate[Number(c.getAttribute('s') || 0)] ? excelDate(n) : n
        }
        values[col] = value
        col++
      }
      for (let i = 0; i < values.length; i++) if (values[i] === undefined) values[i] = null
      data[Number.isFinite(r) && r >= 0 ? r : data.length] = values
    }
    for (let i = 0; i < data.length; i++) if (!data[i]) data[i] = []
    sheets.push({ sheet: name, data })
  }
  return sheets
}
