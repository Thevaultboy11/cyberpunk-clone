// Page 1: the general dashboard the manager lands on.
import { esc, pct, num, teamsHref, empHref } from '../util.js'
import { BANDS, summarize } from '../model.js'
import { donut, barList, stackBar, progressLine } from '../charts.js'
import { kpi, icon, legendRows, fmtCount, readinessTone } from '../ui.js'

export function renderDashboard(model) {
  const all = model.employees
  const s = summarize(model, all)
  const departments = []
  for (const [division, deps] of model.divisions) {
    for (const [department, secs] of deps) {
      const people = [...secs.values()].flat()
      if (people.length < 3) continue // division offices: 1 person each, shown under critical positions
      departments.push({ division, department, people, s: summarize(model, people) })
    }
  }

  const kpis = [
    kpi({
      label: 'People assessed',
      ico: icon.users,
      value: fmtCount(s.assessedCount, s.count),
      sub: `${pct(s.assessedCount / s.count)} have completed self-assessment · ${num(s.validated)} validated by interview`,
      bar: stackBar([
        { value: s.reported, cls: 'b-ready', label: 'Report delivered' },
        { value: s.validated - s.reported, cls: 'b-soon', label: 'Validated, report pending' },
        { value: s.selfAssessed - s.validated, cls: 'b-growing', label: 'Self-assessed only' },
        { value: s.count - s.selfAssessed, cls: 'b-unassessed', label: 'Not assessed' },
      ], { height: 8 }),
      href: teamsHref({ band: 'unassessed' }),
    }),
    kpi({
      label: 'Critical positions',
      ico: icon.crown,
      tone: s.uncoveredPositions.length ? 'warn' : '',
      value: num(s.criticalPositions.length),
      sub: `${s.uncoveredPositions.length} have no successor ready within 12 months`,
      href: '#critical-positions',
    }),
    kpi({
      label: 'Critical gaps',
      ico: icon.alert,
      tone: 'bad',
      value: num(s.criticalGaps),
      sub: `High-priority competencies below requirement, across ${num(s.peopleWithCritical)} people`,
      href: teamsHref({ sort: 'critical' }),
    }),
    kpi({
      label: 'Training completed',
      ico: icon.check,
      value: pct(s.training.rate),
      sub: `${num(s.training.done)} of ${num(s.training.started)} started trainings · ${num(s.training.allDone)} people fully up to date`,
      bar: progressLine(s.training.rate),
    }),
    kpi({
      label: 'Ready for promotion',
      ico: icon.up,
      value: `${num(s.bands.ready)} <small>now · ${num(s.bands.soon)} in 6–12 months</small>`,
      sub: 'Based on readiness for the next role up',
      href: teamsHref({ band: 'ready' }),
    }),
    kpi({
      label: 'Key-person risk',
      ico: icon.key,
      tone: 'warn',
      value: `${num(s.singles.length)} <small>competencies</small>`,
      sub: `Held at expert level by only one person in their team · ${num(s.keyPeople.length)} key people`,
      href: teamsHref({ view: 'risk' }),
    }),
    kpi({
      label: 'Average role readiness',
      ico: icon.target,
      value: pct(s.avgRoleReadiness),
      sub: `${num(s.exceedsRole)} people exceed every requirement of their role`,
      bar: progressLine(s.avgRoleReadiness),
    }),
    kpi({
      label: `Certifications · ${esc(model.currentCycle)}`,
      ico: icon.badge,
      value: `${pct(s.certAchieved / s.certTotal)} <small>professional</small>`,
      sub: `${num(s.certAchieved)} achieved this cycle · AI certifications ${num(s.aiAchieved)} of ${num(s.aiTotal)}`,
      bar: progressLine(s.certAchieved / s.certTotal),
    }),
  ].join('')

  const funnel = barList([
    { label: 'In the roster', value: 1, text: num(s.count), cls: 'ink' },
    { label: 'Self-assessment completed', value: s.selfAssessed / s.count, text: `${num(s.selfAssessed)} · ${pct(s.selfAssessed / s.count)}`, cls: 'lime' },
    { label: 'Validation interview done', value: s.validated / s.count, text: `${num(s.validated)} · ${pct(s.validated / s.count)}`, cls: 'lime' },
    { label: 'Report delivered', value: s.reported / s.count, text: `${num(s.reported)} · ${pct(s.reported / s.count)}`, cls: 'lime' },
  ])

  const bandSegs = BANDS.map((b) => ({ value: s.bands[b.id], cls: `b-${b.id}`, label: b.label }))
  const bandLegend = legendRows(BANDS.map((b) => ({ cls: `b-${b.id}`, label: b.label, value: num(s.bands[b.id]), href: teamsHref({ band: b.id }) })))

  const deptCards = departments
    .map((d) => `<a class="card card-link dept-card" href="${teamsHref({ dept: d.department })}">
      <div class="row between"><div><div class="dept-name">${esc(d.department)}</div><div class="dept-div">${esc(d.division)}</div></div>
        <span class="tag">${d.people.length} people</span></div>
      <div style="margin-top:18px" class="row between"><span class="muted" style="font-size:12.5px">Role readiness</span><b style="font-weight:500">${pct(d.s.avgRoleReadiness)}</b></div>
      <div style="margin-top:6px">${progressLine(d.s.avgRoleReadiness, { cls: readinessTone(d.s.avgRoleReadiness) })}</div>
      <div class="dept-stats">
        <div><b>${d.s.criticalGaps}</b>critical gaps</div>
        <div><b>${d.s.bands.ready + d.s.bands.soon}</b>ready soon</div>
        <div><b>${d.s.singles.length}</b>key-person risks</div>
      </div></a>`)
    .join('')

  // Critical positions and their bench, in the dark band
  const positions = [...s.criticalPositions].sort((a, b) => (a.successors?.length || 0) - (b.successors?.length || 0) || a.department.localeCompare(b.department))
  const posRows = positions
    .map((h) => {
      const succ = h.successors || []
      const bench = succ.length
        ? succ.slice(0, 3).map((x) => `<a href="${empHref(x)}" class="tag tag-lime" title="${esc(x.role)} · next-role readiness ${pct(x.nextReadiness)}">${esc(x.name)} · ${pct(x.nextReadiness)}</a>`).join(' ') + (succ.length > 3 ? ` <span class="muted">+${succ.length - 3}</span>` : '')
        : '<span class="tag tag-bad">No ready successor</span>'
      return `<tr class="clickable" data-href="${empHref(h)}">
        <td><div class="person-name">${esc(h.role || h.title)}</div><div class="muted" style="font-size:12.5px">${esc(h.section === 'Leadership Team' || h.section === 'Department Management' ? h.department : `${h.section} · ${h.department}`)}</div></td>
        <td><a href="${empHref(h)}">${esc(h.name)}</a></td>
        <td class="num">${h.assessed ? pct(h.roleReadiness) : '<span class="muted">not assessed</span>'}</td>
        <td>${bench}</td></tr>`
    })
    .join('')

  return `<div class="page">
    <section class="hero container">
      <div class="eyebrow">Manager dashboard · Acme Corp</div>
      <h1>Who is ready, what is missing,<br/>and where to act next.</h1>
      <p class="sub">${num(s.count)} people across ${model.divisions.size} divisions and ${departments.length} departments. Every number below is calculated from the CyberGate assessment workbook bundled in this file. Nothing leaves this computer.</p>
      <div class="actions"><a class="btn btn-primary" href="${teamsHref()}">Open teams ${icon.arrow}</a><a class="btn btn-secondary" href="${teamsHref({ band: 'ready' })}">Ready for promotion</a></div>
    </section>

    <div class="container">
      <div class="grid g-4">${kpis}</div>

      <div class="grid g-2" style="margin-top:16px">
        <div class="card"><div class="card-head"><div><h3>Assessment progress</h3><div class="card-sub">How far the company is through self-assessment, validation and reports</div></div></div>${funnel}
          <p class="note">${num(s.count - s.selfAssessed)} people have not finished their self-assessment, so they have no competency data yet.</p></div>
        <div class="card"><div class="card-head"><div><h3>Promotion readiness</h3><div class="card-sub">Every employee, by readiness for their next role</div></div></div>
          <div class="row" style="gap:28px;align-items:center;flex-wrap:wrap">${donut(bandSegs, { center: num(s.bands.ready + s.bands.soon), sub: 'ready within 12 months' })}<div style="flex:1;min-width:220px">${bandLegend}</div></div>
          <p class="note"><b>Ready now</b>: 92%+ ready for the next role and no critical gaps. <b>6–12 months</b>: 85%+ with at most one critical gap.</p></div>
      </div>

      <div class="section">
        <div class="section-head"><div><h2>Departments</h2><p>Open a department to see its sections, gaps, key people and every employee.</p></div>
          <a class="link-cta" href="${teamsHref()}">All teams ${icon.arrow}</a></div>
        <div class="grid g-4">${deptCards}</div>
      </div>

      <section class="dark-band" id="critical-positions">
        <div class="section-head"><div><h2>Critical positions and their bench</h2>
          <p>${s.criticalPositions.length} lead, head and director roles. A successor is someone whose next role is this one and who is ready now or within 12 months.</p></div>
          <div class="row"><div class="stat"><div class="stat-value">${s.criticalPositions.length - s.uncoveredPositions.length}</div><div class="stat-label muted">covered</div></div>
          <div class="stat"><div class="stat-value" style="color:#ff9da1">${s.uncoveredPositions.length}</div><div class="stat-label muted">no successor</div></div></div></div>
        <div style="overflow-x:auto"><table class="table"><thead><tr><th>Position</th><th>Held by</th><th class="num">Role readiness</th><th>Ready successors</th></tr></thead><tbody>${posRows}</tbody></table></div>
      </section>
    </div>
  </div>`
}
