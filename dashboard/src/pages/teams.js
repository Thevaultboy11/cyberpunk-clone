// Page 2: teams. Department buttons, then section buttons, then everything for that scope:
// most common gaps, key-person risk, tasks by assessment, promotion overview, 9-box, heatmaps and the employee table.
import { esc, pct, num, teamsHref, empHref, plural } from '../util.js'
import { BANDS, summarize, LEAD_FW } from '../model.js'
import { barList, stackBar } from '../charts.js'
import {
  kpi, icon, legendRows, bandById, peopleHeatmap, groupHeatmap, behaviorHeatmap,
  employeeRows, employeeTableHead, TABLE_COLUMNS, fmtCount,
} from '../ui.js'

const PERF_CUTS = [0.86, 0.95] // role readiness
const POT_CUTS = [2.8, 3.4] // Leadership + Agility average (1–5)
const NINE = [
  ['Rough diamond', 'High potential', 'Star'],
  ['Inconsistent', 'Core player', 'High performer'],
  ['Under-performer', 'Effective', 'Trusted professional'],
]

function tier(x, cuts) {
  return x < cuts[0] ? 0 : x < cuts[1] ? 1 : 2
}

// Division offices hold one person (the division head); they are reachable from the dashboard, not as a department button.
function departmentsOf(model) {
  const out = []
  for (const [division, deps] of model.divisions) {
    for (const [department, secs] of deps) {
      const people = [...secs.values()].flat()
      if (people.length < 3) continue
      out.push({ division, department, sections: [...secs.keys()], people })
    }
  }
  return out
}
const sectionLabel = (sec) => (sec === 'Department Management' ? 'Head of department' : sec)

export function renderTeams(model, params) {
  const deps = departmentsOf(model)
  const dept = deps.find((d) => d.department === params.dept) || null
  const section = dept && dept.sections.includes(params.section) ? params.section : null
  const scope = model.employees.filter((e) => (!dept || e.department === dept.department) && (!section || e.section === section))
  const s = summarize(model, scope)
  const assessed = scope.filter((e) => e.assessed)
  const scopeName = section ? sectionLabel(section) : dept ? dept.department : 'All departments'
  const scopeSub = section ? `${dept.department} · ${dept.division}` : dept ? dept.division : `${deps.length} departments · ${model.divisions.size} divisions`

  // ---------------------------------------------------------------- filters
  const deptChips = [`<a class="chip-btn ${!dept ? 'active' : ''}" href="${teamsHref()}">All <span class="count">${model.employees.length}</span></a>`]
    .concat(deps.map((d) => `<a class="chip-btn ${dept && dept.department === d.department ? 'active' : ''}" href="${teamsHref({ dept: d.department })}">${esc(d.department)} <span class="count">${d.people.length}</span></a>`))
    .join('')
  const sectionChips = dept
    ? [`<a class="chip-btn ${!section ? 'active' : ''}" href="${teamsHref({ dept: dept.department })}">All sections <span class="count">${dept.people.length}</span></a>`]
        .concat(dept.sections.map((sec) => {
          const n = dept.people.filter((e) => e.section === sec).length
          return `<a class="chip-btn ${section === sec ? 'active' : ''}" href="${teamsHref({ dept: dept.department, section: sec })}">${esc(sectionLabel(sec))} <span class="count">${n}</span></a>`
        }))
        .join('')
    : ''

  // ---------------------------------------------------------------- KPI strip
  const kpis = [
    kpi({ compact: true, label: 'People', value: fmtCount(s.count), sub: `${s.assessedCount} assessed · ${s.count - s.assessedCount} not yet` }),
    kpi({ compact: true, label: 'Avg role readiness', value: pct(s.avgRoleReadiness), sub: `next role: ${pct(s.avgNextReadiness)}` }),
    kpi({ compact: true, tone: 'bad', label: 'Critical gaps', value: num(s.criticalGaps), sub: `${s.peopleWithCritical} people affected` }),
    kpi({ compact: true, tone: 'warn', label: 'Key-person risk', value: num(s.singles.length), sub: `${plural(s.keyPeople.length, 'key person', 'key people')}` }),
    kpi({ compact: true, label: 'Ready for promotion', value: `${s.bands.ready} <small>+ ${s.bands.soon}</small>`, sub: 'now + in 6–12 months' }),
    kpi({ compact: true, label: 'Training done', value: pct(s.training.rate), sub: `${s.training.done} of ${s.training.started} started` }),
  ].join('')

  // ---------------------------------------------------------------- most common gaps
  const topGaps = barList(
    s.topGaps.slice(0, 10).map((g) => ({
      label: g.name,
      value: g.withGap / g.assessed,
      part: g.critical / g.assessed,
      text: `${g.withGap} of ${g.assessed}`,
      cls: 'warn',
      title: `${g.name}: ${g.withGap} people below requirement (${g.critical} on a High-priority competency). Average gap ${(g.gapSum / g.withGap).toFixed(1)} levels.`,
    })),
    { empty: 'No gaps in this scope.' },
  )

  // ---------------------------------------------------------------- promotion overview
  const bandSegs = BANDS.map((b) => ({ value: s.bands[b.id], cls: `b-${b.id}`, label: b.label }))
  const bandLegend = legendRows(BANDS.map((b) => ({
    cls: `b-${b.id}`, label: b.label, value: num(s.bands[b.id]), action: `data-band="${b.id}"`, active: params.band === b.id,
  })))

  // ---------------------------------------------------------------- tasks by assessment
  const byBand = barList(
    s.bandTraining.filter((b) => b.people).map((b) => ({
      label: b.label, value: b.rate || 0, text: `${pct(b.rate)} · ${b.done}/${b.started}`, cls: b.id === 'support' ? 'warn' : 'lime',
      title: `${b.people} people in "${b.label}" completed ${b.done} of the ${b.started} trainings they started.`,
    })),
  )
  const stages = [
    { label: 'Report delivered', test: (e) => e.report === 'Delivered' },
    { label: 'Validated, no report yet', test: (e) => e.validation === 'Completed' && e.report !== 'Delivered' },
    { label: 'Self-assessed only', test: (e) => e.selfAssessment === 'Completed' && e.validation !== 'Completed' },
    { label: 'Not assessed', test: (e) => e.selfAssessment !== 'Completed' },
  ]
  const byStage = barList(
    stages.map((st) => {
      const grp = scope.filter(st.test)
      const done = grp.reduce((a, e) => a + e.trainingStats.done, 0)
      const started = grp.reduce((a, e) => a + e.trainingStats.started, 0)
      return { label: st.label, sub: `${grp.length}`, value: started ? done / started : 0, text: started ? `${pct(done / started)} · ${done}/${started}` : '–', cls: 'lime' }
    }).filter((x) => x.sub !== '0'),
  )

  // ---------------------------------------------------------------- key-person risk
  const singles = [...s.singles].sort((a, b) => b.holders - a.holders)
  const riskList = singles.length
    ? `<div class="table-wrap" style="max-height:320px;overflow:auto"><table class="table"><thead><tr><th>Competency</th><th>Only expert</th><th>Team</th></tr></thead><tbody>${singles
        .map((r) => `<tr><td>${esc(r.name)}</td><td><a href="${empHref(r.person)}">${esc(r.person.name)}</a></td><td class="muted">${esc(r.section)} <span class="muted">· 1 of ${r.holders}</span></td></tr>`)
        .join('')}</tbody></table></div>`
    : '<p class="empty">No competency depends on a single expert here.</p>'
  const noExpert = s.none.length
    ? `<p class="note"><b>No expert at all</b> in a High-priority competency: ${s.none.map((r) => `${esc(r.name)} (${esc(r.section)})`).join(', ')}.</p>`
    : ''

  // ---------------------------------------------------------------- 9-box
  const boxed = assessed.filter((e) => e.potential != null)
  const cells = [[[], [], []], [[], [], []], [[], [], []]]
  for (const e of boxed) {
    const row = 2 - tier(e.potential, POT_CUTS)
    const col = tier(e.roleReadiness, PERF_CUTS)
    cells[row][col].push(e)
  }
  const nine = `<div class="ninebox">
    ${[0, 1, 2].map((r) => `<div class="nb-axis y">${['High', 'Medium', 'Low'][r]}</div>${[0, 1, 2].map((c) => {
      const list = cells[r][c].sort((a, b) => b.roleReadiness - a.roleReadiness)
      const hot = (r === 0 && c >= 1) || (r === 1 && c === 2)
      const cold = r === 2 && c === 0
      return `<div class="nb-cell ${hot ? 'hot' : ''} ${cold ? 'cold' : ''}"><div class="nb-title">${NINE[r][c]}</div><div class="nb-count">${list.length}</div>
        <div class="nb-names">${list.slice(0, 4).map((e) => `<a href="${empHref(e)}">${esc(e.name)}</a>`).join(', ')}${list.length > 4 ? ` +${list.length - 4}` : ''}</div></div>`
    }).join('')}`).join('')}
    <div></div><div class="nb-axis">Low</div><div class="nb-axis">Medium</div><div class="nb-axis">High</div>
  </div>
  <p class="note"><b>Across</b>: role readiness (below ${pct(PERF_CUTS[0])} · to ${pct(PERF_CUTS[1])} · above). <b>Up</b>: Leadership + Agility average from the trainers' observation days (below ${POT_CUTS[0]} · to ${POT_CUTS[1]} · above). ${boxed.length} of ${assessed.length} assessed people have observation scores.</p>`

  // ---------------------------------------------------------------- readiness by team
  let groups = []
  if (!dept) groups = deps.filter((d) => d.people.length >= 3).map((d) => ({ label: d.department, people: d.people.filter((e) => e.assessed), href: teamsHref({ dept: d.department }) }))
  else if (!section) groups = dept.sections.map((sec) => ({ label: sec, people: dept.people.filter((e) => e.section === sec && e.assessed), href: teamsHref({ dept: dept.department, section: sec }) }))
  groups = groups.filter((g) => g.people.length >= 2)
  const byTeam = groups.length > 1
    ? barList(groups.map((g) => {
        const r = g.people.reduce((a, e) => a + e.roleReadiness, 0) / g.people.length
        const ready = g.people.filter((e) => e.band === 'ready' || e.band === 'soon').length
        return { label: g.label, href: g.href, value: r, text: `${pct(r)} · ${ready} ready`, cls: r >= 0.9 ? 'lime' : 'warn' }
      }).sort((a, b) => b.value - a.value))
    : ''

  // ---------------------------------------------------------------- heatmaps
  const codes = model.competencyOrder.filter((c) => assessed.some((e) => e.gaps.some((g) => g.code === c)))
  const leadCodes = codes.filter((c) => model.competencies.get(c).framework === LEAD_FW)
  const techCodes = codes.filter((c) => model.competencies.get(c).framework !== LEAD_FW)
  let gapHeat
  if (!assessed.length) gapHeat = '<p class="empty">Nobody in this scope has been assessed yet.</p>'
  else if (assessed.length <= 80) {
    const rows = [...assessed].sort((a, b) => a.roleReadiness - b.roleReadiness)
    gapHeat = peopleHeatmap(model, rows, [...leadCodes, ...techCodes])
  } else {
    const secGroups = []
    for (const d of deps) {
      if (dept && d !== dept) continue
      for (const sec of d.sections) {
        const people = d.people.filter((e) => e.section === sec && e.assessed)
        if (people.length >= 2) secGroups.push({ label: `${sec}`, people, href: teamsHref({ dept: d.department, section: sec }) })
      }
    }
    gapHeat = groupHeatmap(model, secGroups, [...leadCodes, ...techCodes])
  }
  const observed = scope.filter((e) => e.behaviorAvg).sort((a, b) => b.potential - a.potential)
  const behHeat = observed.length ? behaviorHeatmap(model, observed) : '<p class="empty">Nobody in this scope has attended an observed program yet.</p>'

  // ---------------------------------------------------------------- page
  const html = `<div class="page">
    <section class="hero container" style="padding-bottom:24px">
      <div class="crumbs"><a href="#/">Dashboard</a><span class="sep">/</span><a href="${teamsHref()}">Teams</a>${dept ? `<span class="sep">/</span><a href="${teamsHref({ dept: dept.department })}">${esc(dept.department)}</a>` : ''}${section ? `<span class="sep">/</span><span>${esc(section)}</span>` : ''}</div>
      <h1>${esc(scopeName)}</h1>
      <p class="sub">${esc(scopeSub)} · ${plural(s.count, 'person', 'people')}</p>
    </section>

    <div class="container">
      <div class="filters">
        <div class="filter-row"><div class="filter-label">Department</div><div class="chips">${deptChips}</div></div>
        ${dept ? `<div class="filter-row"><div class="filter-label">Section</div><div class="chips">${sectionChips}</div></div>` : ''}
      </div>

      <div class="grid g-6" style="margin-top:16px">${kpis}</div>

      <div class="grid g-2" style="margin-top:16px">
        <div class="card"><div class="card-head"><div><h3>Most common gaps</h3><div class="card-sub">Share of assessed people below the level their role requires</div></div></div>${topGaps}
          <div class="legend inline" style="margin-top:14px"><span class="legend-row"><span class="dot" style="background:var(--band-support)"></span>Below requirement</span><span class="legend-row"><span class="dot" style="background:var(--bad)"></span>…on a High-priority competency (critical)</span></div></div>
        <div class="card"><div class="card-head"><div><h3>Promotion overview</h3><div class="card-sub">Readiness for the next role up. Click a group to filter the employee list.</div></div></div>
          ${stackBar(bandSegs, { height: 14 })}
          <div class="grid g-3" style="margin:16px 0">
            <div class="stat"><div class="stat-value">${s.bands.ready}</div><div class="stat-label">should be promoted now</div></div>
            <div class="stat"><div class="stat-value">${s.bands.soon}</div><div class="stat-label">ready in 6–12 months</div></div>
            <div class="stat"><div class="stat-value">${s.training.finishing}</div><div class="stat-label">finishing their tasks now</div></div>
          </div>${bandLegend}</div>
      </div>

      <div class="grid g-2" style="margin-top:16px">
        <div class="card"><div class="card-head"><div><h3>Tasks done, by assessment</h3><div class="card-sub">Completed ÷ started trainings for each group</div></div></div>
          <div class="eyebrow" style="font-size:11.5px;margin-bottom:10px">By promotion band</div>${byBand}
          <div class="eyebrow" style="font-size:11.5px;margin:20px 0 10px">By assessment stage</div>${byStage}
          <p class="note">Tasks are the trainings assigned in the Training Records sheet. ${s.training.allDone} people have finished everything they started; ${s.training.finishing} have only in-progress items left.</p></div>
        <div class="card" id="key-risk"><div class="card-head"><div><h3>Key-person risk</h3><div class="card-sub">Competencies only one person in their team holds at expert level (4+)</div></div>
          <div class="row"><div class="stat"><div class="stat-value">${s.singles.length}</div><div class="stat-label">risks</div></div><div class="stat"><div class="stat-value">${s.keyPeople.length}</div><div class="stat-label">key people</div></div></div></div>
          ${riskList}${noExpert}</div>
      </div>

      <div class="grid ${byTeam ? 'g-2' : ''}" style="margin-top:16px">
        <div class="card"><div class="card-head"><div><h3>Performance × potential</h3><div class="card-sub">9-box of assessed people with observation scores</div></div></div>${nine}</div>
        ${byTeam ? `<div class="card"><div class="card-head"><div><h3>Readiness by ${dept ? 'section' : 'department'}</h3><div class="card-sub">Average role readiness of assessed people · click to drill in</div></div></div>${byTeam}</div>` : ''}
      </div>

      <div class="section">
        <div class="section-head"><div><h2>Competency heatmap</h2><p>${assessed.length <= 80 ? 'Every assessed person against every competency, weakest first. Leadership competencies, then technical.' : 'Sections against every competency. Pick a department or section to see individual people.'}</p></div></div>
        ${gapHeat}
      </div>

      <div class="section">
        <div class="section-head"><div><h2>Observed behaviours</h2><p>The 25 behaviours trainers scored during leadership programs, averaged per person. Sorted by Leadership + Agility.</p></div></div>
        ${behHeat}
      </div>

      <div class="section" id="people">
        <div class="section-head"><div><h2>Employees</h2><p>The line under each next role shows how close the person is to it. Click anyone for the full analysis.</p></div></div>
        <div class="table-tools">
          <div class="search-wrap">${icon.search}<input class="search" id="emp-search" type="search" placeholder="Search name, role or team" value="${esc(params.q || '')}" autocomplete="off"/></div>
          <div class="chips" id="band-chips">${['all', ...BANDS.map((b) => b.id)].map((id) => `<button class="chip-btn ${(params.band || 'all') === id ? 'active' : ''}" data-band="${id}">${id === 'all' ? 'Everyone' : esc(bandById[id].short)}</button>`).join('')}</div>
        </div>
        <div class="table-wrap"><table class="table"><thead id="emp-head"></thead><tbody id="emp-body"></tbody></table></div>
        <div class="more-row"><button class="btn btn-secondary hidden" id="emp-more" type="button">Show more</button></div>
        <p class="note" id="emp-count" style="text-align:center"></p>
      </div>
    </div>
  </div>`

  // ---------------------------------------------------------------- behaviour after render
  function mount(root, setParams) {
    const PAGE = 50
    const state = { q: params.q || '', band: params.band || 'all', sort: params.sort || 'next', dir: params.dir ? Number(params.dir) : -1, limit: PAGE }
    const more = root.querySelector('#emp-more')
    if (params.sort === 'critical' && !params.dir) state.dir = -1
    const head = root.querySelector('#emp-head')
    const body = root.querySelector('#emp-body')
    const count = root.querySelector('#emp-count')
    function draw() {
      const q = state.q.trim().toLowerCase()
      let rows = scope.filter((e) => (state.band === 'all' || e.band === state.band) &&
        (!q || `${e.name} ${e.role || e.title} ${e.section} ${e.department} ${e.nextRole || ''}`.toLowerCase().includes(q)))
      const col = TABLE_COLUMNS.find((c) => c.key === state.sort) || TABLE_COLUMNS[0]
      rows = rows.sort((a, b) => {
        const x = col.sort(a)
        const y = col.sort(b)
        return (x < y ? -1 : x > y ? 1 : 0) * state.dir || a.name.localeCompare(b.name)
      })
      head.innerHTML = employeeTableHead(state.sort, state.dir)
      body.innerHTML = employeeRows(rows.slice(0, state.limit))
      const shown = Math.min(rows.length, state.limit)
      count.textContent = `Showing ${shown} of ${rows.length} ${rows.length !== scope.length ? `matching people (${scope.length} in scope)` : 'people'}.`
      more.classList.toggle('hidden', rows.length <= state.limit)
      more.textContent = `Show ${Math.min(PAGE, rows.length - state.limit)} more`
      root.querySelectorAll('[data-band]').forEach((b) => b.classList.toggle('active', b.dataset.band === state.band))
    }
    draw()
    root.querySelector('#emp-search').addEventListener('input', (ev) => { state.q = ev.target.value; state.limit = PAGE; draw() })
    more.addEventListener('click', () => { state.limit += PAGE; draw() })
    head.addEventListener('click', (ev) => {
      const th = ev.target.closest('[data-sort]')
      if (!th) return
      if (state.sort === th.dataset.sort) state.dir = -state.dir
      else { state.sort = th.dataset.sort; state.dir = th.dataset.sort === 'name' || th.dataset.sort === 'team' ? 1 : -1 }
      draw()
    })
    root.addEventListener('click', (ev) => {
      const b = ev.target.closest('[data-band]')
      if (!b) return
      state.band = state.band === b.dataset.band ? 'all' : b.dataset.band
      state.limit = PAGE
      setParams({ band: state.band === 'all' ? null : state.band })
      draw()
      if (b.closest('.legend')) root.querySelector('#people').scrollIntoView({ behavior: 'smooth', block: 'start' })
    })
    if (params.view === 'risk') root.querySelector('#key-risk').scrollIntoView({ block: 'center' })
    else if (params.band || params.sort) root.querySelector('#people').scrollIntoView({ block: 'start' })
  }

  return { html, mount, title: scopeName }
}
