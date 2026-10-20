// Reusable UI pieces (plain functions that return HTML strings).
import { esc, pct, num, initials, empHref } from './util.js'
import { BANDS } from './model.js'
import { progressLine, gapClass, avgGapClass, scoreClass } from './charts.js'

const svg = (d) => `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">${d}</svg>`

export const icon = {
  logo: `<svg viewBox="0 0 24 24" fill="none" stroke="#141e12" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 3l7 3v5c0 4.5-3 8-7 10-4-2-7-5.5-7-10V6z"/><path d="M9 12l2 2 4-4"/></svg>`,
  users: svg('<path d="M16 19v-1a4 4 0 0 0-4-4H7a4 4 0 0 0-4 4v1"/><circle cx="9.5" cy="7.5" r="3.5"/><path d="M21 19v-1a4 4 0 0 0-3-3.87M16 4.13a3.5 3.5 0 0 1 0 6.75"/>'),
  target: svg('<circle cx="12" cy="12" r="8"/><circle cx="12" cy="12" r="4"/><circle cx="12" cy="12" r=".5"/>'),
  alert: svg('<path d="M12 4l9 16H3z"/><path d="M12 10v4M12 17.5v.01"/>'),
  check: svg('<circle cx="12" cy="12" r="9"/><path d="M8 12.5l2.5 2.5L16 9.5"/>'),
  up: svg('<path d="M7 17L17 7M9 7h8v8"/>'),
  key: svg('<circle cx="8" cy="14" r="4"/><path d="M11 11l8-8M16 6l2 2M14 8l2 2"/>'),
  crown: svg('<path d="M4 18h16M5 15l-1-9 5 4 3-6 3 6 5-4-1 9z"/>'),
  badge: svg('<circle cx="12" cy="9" r="5"/><path d="M8.5 13l-1.5 8 5-3 5 3-1.5-8"/>'),
  book: svg('<path d="M4 5a2 2 0 0 1 2-2h13v16H6a2 2 0 0 0-2 2z"/><path d="M4 19V5M8 7h7"/>'),
  sun: svg('<circle cx="12" cy="12" r="4"/><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4"/>'),
  moon: svg('<path d="M20 14.5A8 8 0 0 1 9.5 4a8 8 0 1 0 10.5 10.5z"/>'),
  search: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
  arrow: '<span class="arrow">→</span>',
}

export function kpi({ label, value, sub = '', ico = '', tone = '', bar = '', href = '', compact = false }) {
  const inner = `<div class="kpi-label">${ico ? `<span class="kpi-icon">${ico}</span>` : ''}${esc(label)}</div>
    <div class="kpi-value">${value}</div>
    ${sub ? `<div class="kpi-sub">${sub}</div>` : ''}
    ${bar ? `<div class="kpi-bar">${bar}</div>` : ''}`
  const cls = `card kpi ${tone} ${compact ? 'compact' : ''} ${href ? 'card-link' : ''}`
  return href ? `<a class="${cls}" href="${href}">${inner}</a>` : `<div class="${cls}">${inner}</div>`
}

export const bandById = Object.fromEntries(BANDS.map((b) => [b.id, b]))

export function bandTag(id) {
  const b = bandById[id]
  const cls = { ready: 'tag-lime', soon: 'tag-lime', growing: '', support: 'tag-warn', unassessed: 'tag-muted' }[id]
  return `<span class="tag ${cls}"><span class="dot b-${id}"></span>${esc(b.short)}</span>`
}

export function statusTag(status) {
  const map = {
    Completed: 'tag-lime', Delivered: 'tag-lime', Achieved: 'tag-lime',
    'In Progress': '', Scheduled: '', 'Exam Scheduled': '', 'In Draft': '',
    'Not Started': 'tag-muted', 'Not Scheduled': 'tag-muted', Pending: 'tag-muted', 'Not Required': 'tag-muted', Recommended: '',
    Incomplete: 'tag-warn', Deferred: 'tag-warn', Cancelled: 'tag-muted', Failed: 'tag-bad',
  }
  if (!status) return '<span class="muted">–</span>'
  return `<span class="tag ${map[status] ?? ''}">${esc(status)}</span>`
}

export function assessmentTag(e) {
  if (e.report === 'Delivered') return '<span class="tag tag-lime">Report delivered</span>'
  if (e.validation === 'Completed') return '<span class="tag">Validated</span>'
  if (e.selfAssessment === 'Completed') return '<span class="tag">Self-assessed</span>'
  if (e.selfAssessment === 'In Progress') return '<span class="tag tag-muted">Self-assessment in progress</span>'
  return '<span class="tag tag-muted">Not started</span>'
}

export function person(e, { sub } = {}) {
  return `<div class="person"><span class="avatar">${esc(initials(e.name))}</span><div style="min-width:0">
    <a class="person-name" href="${empHref(e)}">${esc(e.name)}</a>
    <div class="person-role">${esc(sub ?? e.role ?? e.title)}</div></div></div>`
}

export function readinessTone(x) {
  if (x == null) return 'muted'
  if (x >= 0.9) return ''
  if (x >= 0.75) return 'warn'
  return 'bad'
}

// Competency heatmap: rows = people, columns = competencies, cell = Level, colour = Level − Required.
export function peopleHeatmap(model, people, codes) {
  const comps = codes.map((c) => model.competencies.get(c))
  let prevCat = null
  const head = comps
    .map((c) => {
      const start = prevCat !== null && prevCat !== c.category
      prevCat = c.category
      return `<th class="${start ? 'cat-start' : ''}" title="${esc(c.name)} · ${esc(c.category)}"><div class="vlabel">${esc(c.name)}</div></th>`
    })
    .join('')
  const rows = people
    .map((e) => {
      const byCode = new Map(e.gaps.map((g) => [g.code, g]))
      const cells = codes
        .map((code) => {
          const g = byCode.get(code)
          if (!g) return '<td class="cell heat-none"></td>'
          const tip = `${e.name} · ${g.name}: level ${g.level}, required ${g.req}${g.gap > 0 ? `, gap ${g.gap}` : g.gap < 0 ? `, ${-g.gap} above` : ''} (${g.priority})`
          return `<td class="cell ${gapClass(g.level, g.req)}" title="${esc(tip)}">${g.level}</td>`
        })
        .join('')
      return `<tr><th class="rowhead"><a href="${empHref(e)}">${esc(e.name)}</a><span class="rh-sub">${esc(pct(e.roleReadiness))}</span></th>${cells}</tr>`
    })
    .join('')
  return `<div class="heat-scroll"><table class="heat"><thead><tr><th class="rowhead">Employee · role readiness</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="heat-legend">Cell = assessed level. Colour = level against the role's requirement:
      <span><i class="heat-ex"></i>Above</span><span><i class="heat-ok"></i>Meets</span><span><i class="heat-g1"></i>1 below</span><span><i class="heat-g2"></i>2+ below</span><span><i class="heat-none"></i>Not assessed</span></div>`
}

// Group heatmap: rows = groups (sections/departments), cell = average (Level − Required).
export function groupHeatmap(model, groups, codes) {
  const comps = codes.map((c) => model.competencies.get(c))
  let prevCat = null
  const head = comps
    .map((c) => {
      const start = prevCat !== null && prevCat !== c.category
      prevCat = c.category
      return `<th class="${start ? 'cat-start' : ''}" title="${esc(c.name)} · ${esc(c.category)}"><div class="vlabel">${esc(c.name)}</div></th>`
    })
    .join('')
  const rows = groups
    .map((grp) => {
      const cells = codes
        .map((code) => {
          const vals = []
          for (const e of grp.people) {
            const g = e.gaps.find((x) => x.code === code)
            if (g) vals.push(g.level - g.req)
          }
          if (!vals.length) return '<td class="cell heat-none"></td>'
          const d = vals.reduce((a, b) => a + b, 0) / vals.length
          const below = vals.filter((v) => v < 0).length
          const tip = `${grp.label} · ${model.competencies.get(code).name}: average ${d >= 0 ? '+' : ''}${d.toFixed(2)} vs requirement · ${below} of ${vals.length} below`
          const label = Math.abs(d) < 0.05 ? '0' : `${d > 0 ? '+' : '−'}${Math.abs(d).toFixed(1)}`
          return `<td class="cell ${avgGapClass(d)}" title="${esc(tip)}">${label}</td>`
        })
        .join('')
      return `<tr><th class="rowhead"><a href="${grp.href}">${esc(grp.label)}</a><span class="rh-sub">${grp.people.length}</span></th>${cells}</tr>`
    })
    .join('')
  return `<div class="heat-scroll"><table class="heat"><thead><tr><th class="rowhead">Team · assessed people</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="heat-legend">Cell = average of (level − required). Colour:
      <span><i class="heat-ex"></i>Above</span><span><i class="heat-ok"></i>About right</span><span><i class="heat-g1"></i>Slightly below</span><span><i class="heat-g2"></i>Well below</span></div>`
}

// Observed behaviour heatmap: rows = people, columns = the 25 behaviours (average over attended days).
export function behaviorHeatmap(model, people) {
  const head = model.behaviors
    .map((b) => `<th title="${esc(b.behavior)} → ${esc(b.competency)}"><div class="vlabel">${esc(b.behavior)}</div></th>`)
    .join('')
  const rows = people
    .map((e) => {
      const cells = e.behaviorAvg
        .map((v, i) => `<td class="cell ${scoreClass(v)}" title="${esc(`${e.name} · ${model.behaviors[i].behavior}: ${v == null ? '–' : v.toFixed(1)}`)}">${v == null ? '' : Math.round(v)}</td>`)
        .join('')
      return `<tr><th class="rowhead"><a href="${empHref(e)}">${esc(e.name)}</a><span class="rh-sub">L+A ${e.potential != null ? e.potential.toFixed(1) : '–'}</span></th>${cells}</tr>`
    })
    .join('')
  return `<div class="heat-scroll"><table class="heat"><thead><tr><th class="rowhead">Employee · Leadership + Agility</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
    <div class="heat-legend">Trainer score, averaged over attended program days (1–5):
      <span><i class="score-5"></i>5</span><span><i class="score-4"></i>4</span><span><i class="score-3"></i>3</span><span><i class="score-2"></i>2</span><span><i class="score-1"></i>1</span></div>`
}

// Employee table with the "distance to next role" line under each person.
export const TABLE_COLUMNS = [
  { key: 'name', label: 'Employee', sort: (e) => e.name },
  { key: 'team', label: 'Team', sort: (e) => `${e.department} ${e.section}` },
  { key: 'assessment', label: 'Assessment', sort: (e) => (e.report === 'Delivered' ? 0 : e.validation === 'Completed' ? 1 : e.selfAssessment === 'Completed' ? 2 : 3) },
  { key: 'ready', label: 'Role readiness', sort: (e) => e.roleReadiness ?? -1, num: true },
  { key: 'critical', label: 'Critical gaps', sort: (e) => (e.assessed ? e.criticalGaps.length : -1), num: true },
  { key: 'training', label: 'Training done', sort: (e) => e.trainingStats.rate ?? -1, num: true },
  { key: 'next', label: 'Next role · progress', sort: (e) => e.nextReadiness ?? -1 },
  { key: 'band', label: 'Promotion', sort: (e) => BANDS.findIndex((b) => b.id === e.band) },
]

export function employeeRows(people) {
  if (!people.length) return `<tr><td colspan="${TABLE_COLUMNS.length}" class="empty" style="padding:24px">No employees match.</td></tr>`
  return people
    .map((e) => {
      const t = e.trainingStats
      const flags = `${e.criticalPosition ? ' <span class="tag tag-dark" title="Critical position">Critical role</span>' : ''}${e.keyPerson ? ` <span class="tag" title="Sole expert in ${e.keyFor.length} competencies">Key person</span>` : ''}`
      const next = e.nextRole
        ? `<div class="next-top"><span class="next-role" title="${esc(e.nextRole)}">→ ${esc(e.nextRole)}${e.nextEstimated ? ' <span class="muted">(est.)</span>' : ''}</span><span class="next-pct">${pct(e.nextReadiness)}</span></div>${progressLine(e.nextReadiness, { cls: readinessTone(e.nextReadiness) })}`
        : `<div class="next-top"><span class="next-role muted">${e.assessed ? 'Top of ladder' : 'Assess first'}</span><span class="next-pct muted">–</span></div>${progressLine(null, { cls: 'muted' })}`
      return `<tr class="clickable" data-href="${empHref(e)}">
        <td>${person(e)}${flags ? `<div style="margin:6px 0 0 40px" class="row wrap">${flags}</div>` : ''}</td>
        <td><div>${esc(e.section)}</div><div class="person-role">${esc(e.department)}</div></td>
        <td>${assessmentTag(e)}</td>
        <td class="num">${e.assessed ? pct(e.roleReadiness) : '<span class="muted">–</span>'}</td>
        <td class="num">${e.assessed ? (e.criticalGaps.length ? `<span class="tag tag-bad">${e.criticalGaps.length}</span>` : '<span class="muted">0</span>') : '<span class="muted">–</span>'}</td>
        <td class="num">${t.started ? `${pct(t.rate)} <span class="muted">· ${t.done}/${t.started}</span>` : '<span class="muted">–</span>'}</td>
        <td class="next-cell">${next}</td>
        <td>${bandTag(e.band)}</td>
      </tr>`
    })
    .join('')
}

export function employeeTableHead(sortKey, sortDir) {
  return `<tr>${TABLE_COLUMNS.map((c) => `<th class="sortable ${c.num ? 'num' : ''}" data-sort="${c.key}">${esc(c.label)}${sortKey === c.key ? `<span class="sort-ind">${sortDir === 1 ? '↑' : '↓'}</span>` : ''}</th>`).join('')}</tr>`
}

export function legendRows(items) {
  return `<div class="legend">${items
    .map((it) => {
      const inner = `<span class="dot ${it.cls}"></span><span>${esc(it.label)}</span><span class="val">${it.value}</span>`
      if (it.action) return `<button class="legend-row ${it.active ? 'active' : ''}" ${it.action}>${inner}</button>`
      if (it.href) return `<a class="legend-row" href="${it.href}">${inner}</a>`
      return `<div class="legend-row">${inner}</div>`
    })
    .join('')}</div>`
}

export const fmtCount = (n, of) => `${num(n)}${of != null ? ` <small>/ ${num(of)}</small>` : ''}`
