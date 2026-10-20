// Where the dashboard gets its data: the Excel workbook in the repo (data/skills-data.xlsx).
// Nothing is ever requested from the internet. The order is:
//   1. read the workbook from the repo folder (works when the page is served from the repo: npm run serve / npm run dev)
//   2. the copy of the workbook last opened in this browser (kept in IndexedDB on this computer)
//   3. ask the manager to choose or drop the file (needed when the page is opened by double-click,
//      because browsers do not let a file:// page read other files on disk by itself)
import { readXlsx } from './xlsx.js'
import { normalizeWorkbook } from './normalize.js'

export const DATA_FILE = 'skills-data.xlsx'
export const DATA_PATH = `data/${DATA_FILE}`

// Relative to the built page (build/), the dev server (repo root), or a copy of the page placed next to the xlsx.
const CANDIDATES = [`../data/${DATA_FILE}`, `./data/${DATA_FILE}`, `./${DATA_FILE}`, `/data/${DATA_FILE}`]

export const REQUIRED = {
  Employees: ['User Name', 'User Email', 'Job Title', 'Section', 'Department', 'Division', 'Line Manager', 'Self-Assessment', 'Validation Interview', 'Validation Interview Report'],
  'Competency Gaps': ['Person Email', 'Job Role', 'Competency Code', 'Level', 'Required Level', 'Competency Gap', 'Priority'],
  Competencies: ['Framework Name', 'Category Name', 'Competency Code', 'Competency Name'],
  'Competency Behaviors': ['Competency Code', 'Competency Behavior', 'CompetencyLevel'],
  'Training Records': ['Training Record Code', 'Employee Email', 'Training Title', 'Status', 'Hours'],
  'Training Day Scores': ['Training Record Code', 'Employee Email', 'Training Day', 'Attendance', 'Overall Day Avg', 'Leadership + Agility Avg'],
  'IDP Certifications': ['IDP Cycle', 'User Email', 'Prof Cert', 'Prof Cert Status'],
  'Learning Plans': ['Name', 'Email', 'Segment 1', 'Estimated Time 1'],
}

export async function parseWorkbook(arrayBuffer) {
  const sheets = normalizeWorkbook(await readXlsx(arrayBuffer))
  const problems = []
  for (const [name, cols] of Object.entries(REQUIRED)) {
    const sheet = sheets.find((s) => s.name === name)
    if (!sheet) { problems.push(`missing sheet "${name}"`); continue }
    const missing = cols.filter((c) => !sheet.columns.includes(c))
    if (missing.length) problems.push(`sheet "${name}" is missing ${missing.map((c) => `"${c}"`).join(', ')}`)
  }
  if (problems.length) {
    const found = Object.keys(REQUIRED).filter((n) => sheets.some((x) => x.name === n))
    const msg = found.length === 0
      ? `none of the 8 expected sheets (${Object.keys(REQUIRED).join(', ')}) are in this workbook. Sheets found: ${sheets.map((x) => x.name).join(', ') || 'none'}`
      : problems.join('; ')
    const err = new Error(`This workbook doesn't match the expected layout: ${msg}.`)
    err.problems = problems
    throw err
  }
  return sheets
}

// 1. From the repo folder
export async function fetchFromRepo() {
  if (typeof fetch !== 'function' || location.protocol === 'file:') return null
  for (const url of CANDIDATES) {
    try {
      const res = await fetch(url, { cache: 'no-store' })
      if (!res.ok) continue
      const type = res.headers.get('content-type') || ''
      if (type.includes('text/html')) continue // a dev server's fallback page, not the workbook
      const buf = await res.arrayBuffer()
      if (buf.byteLength < 100) continue
      return { buffer: buf, name: DATA_FILE, source: 'repo', where: new URL(url, location.href).pathname, loadedAt: new Date().toISOString() }
    } catch {
      /* try the next location */
    }
  }
  return null
}

// 2. The copy remembered in this browser
const DB = 'skills-dashboard'
const STORE = 'workbook'

function openDb() {
  return new Promise((resolve, reject) => {
    if (typeof indexedDB === 'undefined') { reject(new Error('no IndexedDB')); return }
    const req = indexedDB.open(DB, 1)
    req.onupgradeneeded = () => req.result.createObjectStore(STORE)
    req.onsuccess = () => resolve(req.result)
    req.onerror = () => reject(req.error)
  })
}

export async function loadRemembered() {
  try {
    const db = await openDb()
    return await new Promise((resolve) => {
      const req = db.transaction(STORE, 'readonly').objectStore(STORE).get('last')
      req.onsuccess = () => resolve(req.result || null)
      req.onerror = () => resolve(null)
    })
  } catch {
    return null
  }
}

export async function remember(record) {
  try {
    const db = await openDb()
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).put({ buffer: record.buffer, name: record.name, loadedAt: record.loadedAt, size: record.buffer.byteLength }, 'last')
      tx.oncomplete = resolve
      tx.onerror = resolve
    })
  } catch {
    /* private window or storage blocked: the dashboard still works, it just won't remember the file */
  }
}

export async function forget() {
  try {
    const db = await openDb()
    await new Promise((resolve) => {
      const tx = db.transaction(STORE, 'readwrite')
      tx.objectStore(STORE).delete('last')
      tx.oncomplete = resolve
      tx.onerror = resolve
    })
  } catch {
    /* nothing to forget */
  }
}

// 3. A file the manager picked or dropped
export async function readPickedFile(file) {
  const buffer = await file.arrayBuffer()
  return { buffer, name: file.name, source: 'picked', loadedAt: new Date().toISOString(), modified: file.lastModified ? new Date(file.lastModified).toISOString() : null }
}
