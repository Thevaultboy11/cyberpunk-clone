// Hand-drawn charts: plain SVG and HTML strings, no chart library.
// Colours come from CSS classes (styles.css), so light and dark themes both work.
import { esc, clamp, pct } from './util.js'

const f = (x) => Math.round(x * 100) / 100

// Circular progress ring with the value in the middle.
export function ring(value, { size = 84, stroke = 8, label = pct(value), cls = 'tone-accent' } = {}) {
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  const v = value == null ? 0 : clamp(value, 0, 1)
  return `<svg class="ring ${cls}" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(label)}">
    <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${f(r)}" stroke-width="${stroke}" fill="none"/>
    <circle class="ring-value" cx="${size / 2}" cy="${size / 2}" r="${f(r)}" stroke-width="${stroke}" fill="none"
      stroke-dasharray="${f(c * v)} ${f(c)}" stroke-linecap="round" transform="rotate(-90 ${size / 2} ${size / 2})"/>
    <text x="50%" y="50%" dy="0.35em" text-anchor="middle" class="ring-label">${esc(value == null ? '–' : label)}</text>
  </svg>`
}

// Donut made of segments [{ value, cls, label }].
export function donut(segments, { size = 168, stroke = 22, center = '', sub = '' } = {}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  const r = (size - stroke) / 2
  const c = 2 * Math.PI * r
  let offset = 0
  const arcs = segments
    .filter((s) => s.value > 0)
    .map((s) => {
      const len = (s.value / total) * c
      const gap = segments.filter((x) => x.value > 0).length > 1 ? 2 : 0
      const arc = `<circle class="donut-seg ${s.cls}" cx="${size / 2}" cy="${size / 2}" r="${f(r)}" stroke-width="${stroke}" fill="none"
        stroke-dasharray="${f(Math.max(0, len - gap))} ${f(c)}" stroke-dashoffset="${f(-offset)}" transform="rotate(-90 ${size / 2} ${size / 2})">
        <title>${esc(s.label)}: ${s.value}</title></circle>`
      offset += len
      return arc
    })
    .join('')
  return `<svg class="donut" width="${size}" height="${size}" viewBox="0 0 ${size} ${size}" role="img" aria-label="${esc(center)} ${esc(sub)}">
    <circle class="ring-track" cx="${size / 2}" cy="${size / 2}" r="${f(r)}" stroke-width="${stroke}" fill="none"/>
    ${arcs}
    <text x="50%" y="48%" text-anchor="middle" class="donut-center">${esc(center)}</text>
    <text x="50%" y="62%" text-anchor="middle" class="donut-sub">${esc(sub)}</text>
  </svg>`
}

// Horizontal bar list. items: [{ label, href, value (0..1), part (0..1, darker overlay), text, sub, cls }]
export function barList(items, { empty = 'Nothing to show', stacked = false } = {}) {
  if (!items.length) return `<p class="empty">${esc(empty)}</p>`
  return `<div class="barlist ${stacked ? 'stacked' : ''}">${items
    .map((it) => {
      const label = it.href ? `<a href="${it.href}">${esc(it.label)}</a>` : esc(it.label)
      return `<div class="barlist-row" ${it.title ? `title="${esc(it.title)}"` : ''}>
        <div class="barlist-label">${label}${it.sub ? `<span class="barlist-sub">${esc(it.sub)}</span>` : ''}</div>
        <div class="barlist-track"><div class="barlist-fill ${it.cls || ''}" style="width:${f(clamp(it.value || 0, 0, 1) * 100)}%"></div>
          ${it.part != null ? `<div class="barlist-part" style="width:${f(clamp(it.part, 0, 1) * 100)}%"></div>` : ''}
          ${it.marker != null ? `<div class="barlist-marker" style="left:${f(clamp(it.marker, 0, 1) * 100)}%"></div>` : ''}</div>
        <div class="barlist-value">${esc(it.text)}</div>
      </div>`
    })
    .join('')}</div>`
}

// One horizontal bar split into segments [{ value, cls, label, href }].
export function stackBar(segments, { height = 12 } = {}) {
  const total = segments.reduce((s, x) => s + x.value, 0) || 1
  return `<div class="stackbar" style="height:${height}px">${segments
    .filter((s) => s.value > 0)
    .map((s) => `<div class="stackbar-seg ${s.cls}" style="width:${f((s.value / total) * 100)}%" title="${esc(s.label)}: ${s.value}"></div>`)
    .join('')}</div>`
}

// Thin progress line, used in tables ("how far to the next role").
export function progressLine(value, { cls = '' } = {}) {
  const v = value == null ? 0 : clamp(value, 0, 1)
  return `<div class="pline ${cls}" title="${esc(pct(value))}"><div class="pline-fill" style="width:${f(v * 100)}%"></div></div>`
}

// Radar chart. axes: [{ label }], series: [{ name, values: number[], cls }], scale 0..max
export function radar(axes, series, { max = 5, width = 600, height = 440 } = {}) {
  const n = axes.length
  if (n < 3) return '<p class="empty">Not enough competencies for a radar chart.</p>'
  const cx = width / 2
  const cy = height / 2
  const R = height / 2 - 52
  const pt = (i, v) => {
    const a = -Math.PI / 2 + (2 * Math.PI * i) / n
    const rr = (clamp(v, 0, max) / max) * R
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)]
  }
  const rings = []
  for (let l = 1; l <= max; l++) {
    rings.push(`<polygon class="radar-grid" points="${axes.map((_, i) => pt(i, l).map(f).join(',')).join(' ')}"/>`)
  }
  const spokes = axes.map((_, i) => { const [x, y] = pt(i, max); return `<line class="radar-grid" x1="${cx}" y1="${cy}" x2="${f(x)}" y2="${f(y)}"/>` }).join('')
  const labels = axes
    .map((a, i) => {
      const ang = -Math.PI / 2 + (2 * Math.PI * i) / n
      const sin = Math.sin(ang)
      const cos = Math.cos(ang)
      const x = cx + (R + 12) * cos
      const y = cy + (R + 12) * sin + (sin < -0.85 ? -6 : sin > 0.85 ? 8 : 0)
      const anchor = Math.abs(cos) < 0.08 ? 'middle' : cos > 0 ? 'start' : 'end'
      return `<text class="radar-label" x="${f(x)}" y="${f(y)}" dy="0.35em" text-anchor="${anchor}"><title>${esc(a.title || a.label)}</title>${esc(a.label)}</text>`
    })
    .join('')
  const shapes = series
    .map((s) => {
      const pts = s.values.map((v, i) => pt(i, v ?? 0).map(f).join(',')).join(' ')
      const dots = s.dots === false ? '' : s.values.map((v, i) => { const [x, y] = pt(i, v ?? 0); return `<circle class="radar-dot ${s.cls}" cx="${f(x)}" cy="${f(y)}" r="2.5"><title>${esc(axes[i].title || axes[i].label)} · ${esc(s.name)}: ${v}</title></circle>` }).join('')
      return `<polygon class="radar-shape ${s.cls}" points="${pts}"/>${dots}`
    })
    .join('')
  return `<svg class="radar" viewBox="0 0 ${width} ${height}" role="img" aria-label="Competency radar">${rings.join('')}${spokes}${shapes}${labels}</svg>`
}

// Line chart. series: [{ name, cls, values: (number|null)[] }], labels: string[]
export function lineChart(labels, series, { yMin = 1, yMax = 5, height = 200, width = 560 } = {}) {
  const padL = 32
  const padR = 12
  const padT = 12
  const padB = 28
  const n = labels.length
  const X = (i) => padL + (n <= 1 ? (width - padL - padR) / 2 : (i * (width - padL - padR)) / (n - 1))
  const Y = (v) => padT + ((yMax - v) / (yMax - yMin)) * (height - padT - padB)
  const grid = []
  for (let v = yMin; v <= yMax; v++) {
    grid.push(`<line class="chart-grid" x1="${padL}" x2="${width - padR}" y1="${f(Y(v))}" y2="${f(Y(v))}"/><text class="chart-tick" x="${padL - 8}" y="${f(Y(v))}" dy="0.35em" text-anchor="end">${v}</text>`)
  }
  const xl = labels.map((l, i) => `<text class="chart-tick" x="${f(X(i))}" y="${height - 8}" text-anchor="middle">${esc(l)}</text>`).join('')
  const lines = series
    .map((s) => {
      let d = ''
      let pen = false
      s.values.forEach((v, i) => {
        if (v == null) { pen = false; return }
        d += `${pen ? 'L' : 'M'}${f(X(i))} ${f(Y(v))}`
        pen = true
      })
      const dots = s.values.map((v, i) => (v == null ? '' : `<circle class="line-dot ${s.cls}" cx="${f(X(i))}" cy="${f(Y(v))}" r="3.5"><title>${esc(labels[i])} · ${esc(s.name)}: ${v}</title></circle>`)).join('')
      return `<path class="line-path ${s.cls}" d="${d}" fill="none"/>${dots}`
    })
    .join('')
  return `<svg class="linechart" viewBox="0 0 ${width} ${height}" role="img" aria-label="Trend">${grid.join('')}${xl}${lines}</svg>`
}

// Colour class for a competency cell: Level − Required.
export function gapClass(level, req) {
  const d = level - req
  if (d >= 1) return 'heat-ex'
  if (d === 0) return 'heat-ok'
  if (d === -1) return 'heat-g1'
  return 'heat-g2'
}

// Colour class for an average gap (Level − Required averaged over people).
export function avgGapClass(d) {
  if (d == null) return 'heat-none'
  if (d >= 0.5) return 'heat-ex'
  if (d >= -0.15) return 'heat-ok'
  if (d >= -0.6) return 'heat-g1'
  return 'heat-g2'
}

// Colour class for an observed behaviour score (1–5).
export function scoreClass(v) {
  if (v == null) return 'heat-none'
  if (v >= 4.5) return 'score-5'
  if (v >= 3.5) return 'score-4'
  if (v >= 2.5) return 'score-3'
  if (v >= 1.5) return 'score-2'
  return 'score-1'
}
