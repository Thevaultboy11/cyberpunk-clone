// Page 3: detailed analysis for one employee.
import { esc, pct, num, dec, date, shortDate, initials, teamsHref, empHref, plural } from '../util.js'
import { LEAD_FW } from '../model.js'
import { ring, donut, radar, lineChart, barList, scoreClass, progressLine } from '../charts.js'
import { kpi, icon, bandTag, statusTag, assessmentTag, legendRows, readinessTone } from '../ui.js'

const TRAINING_STATUSES = [
  { id: 'Completed', cls: 's-done', label: 'Completed' },
  { id: 'In Progress', cls: 's-progress', label: 'In progress' },
  { id: 'Incomplete', cls: 's-incomplete', label: 'Incomplete' },
  { id: 'Not Started', cls: 's-upcoming', label: 'Upcoming' },
  { id: 'Cancelled', cls: 's-cancelled', label: 'Cancelled' },
]

function toneOf(x) {
  return x == null ? '' : x >= 0.9 ? 'tone-accent' : x >= 0.75 ? 'tone-warn' : 'tone-bad'
}

function shortName(name) {
  return name.replace('Identity & Access Management', 'IAM').replace('Threat Detection & Monitoring', 'Threat Detection').replace('Tolerance for Uncertainty', 'Uncertainty').replace('Operational Effectiveness', 'Op. Effectiveness').replace('Cross-Team Integration', 'Cross-Team').replace('Stakeholder Management', 'Stakeholders').replace('Performance Management', 'Performance Mgmt').replace('Presentation Delivery', 'Presenting').replace('Security Policy & Audit', 'Policy & Audit')
}

function behaviorsFor(model, code, from, to) {
  const byLevel = model.behaviorsByLevel.get(code)
  if (!byLevel) return []
  const out = []
  for (let l = from; l <= to; l++) for (const b of byLevel.get(l) || []) out.push({ level: l, text: b })
  return out
}

export function renderEmployee(model, email) {
  const e = model.byEmail.get(email)
  if (!e) {
    return { title: 'Not found', html: `<div class="page container"><section class="hero"><h1>Employee not found</h1><p class="sub">There is no one with the email ${esc(email)} in the workbook.</p><div class="actions"><a class="btn btn-primary" href="${teamsHref()}">Back to teams</a></div></section></div>` }
  }
  const t = e.trainingStats
  const manager = model.employees.find((x) => x.name === e.lineManager)

  // ---------------------------------------------------------------- tags & meta
  const tags = [
    bandTag(e.band),
    assessmentTag(e),
    e.criticalPosition ? '<span class="tag tag-dark">Critical position</span>' : '',
    e.keyPerson ? `<span class="tag tag-warn">Key person · ${e.keyFor.length}</span>` : '',
    e.exceedsRole ? '<span class="tag tag-lime">Exceeds role</span>' : '',
  ].join(' ')
  const meta = [
    ['Email', `<span class="mono">${esc(e.email)}</span>`],
    ['Line manager', manager ? `<a href="${empHref(manager)}"><b>${esc(e.lineManager)}</b></a>` : `<b>${esc(e.lineManager || '–')}</b>`],
    ['Team', `<b>${esc(e.team || e.section)}</b>`],
    ['Role family', `<b>${esc(e.family || '–')}</b>`],
    ['Division', `<b>${esc(e.division)}</b>`],
    ['Cross-functional', `<b>${esc(e.crossFunctional)}</b>`],
  ].map(([k, v]) => `<span>${k}: ${v}</span>`).join('')

  // ---------------------------------------------------------------- KPI cards
  const metCount = e.gaps.filter((g) => g.level >= g.req).length
  const ringCard = (label, value, sub, extra = '') => `<div class="card kpi"><div class="kpi-label">${label}</div>
    <div class="kpi-ring" style="margin-top:12px">${ring(value, { cls: toneOf(value) })}<div style="min-width:0">${sub}</div></div>${extra}</div>`
  const cards = []
  if (e.assessed) {
    cards.push(ringCard('Role readiness', e.roleReadiness, `<div style="font-size:13.5px">Meets <b>${metCount}</b> of ${e.gaps.length} requirements</div><div class="muted" style="font-size:12.5px;margin-top:4px">as ${esc(e.role)}</div>`))
    cards.push(ringCard('Next role readiness', e.nextReadiness,
      e.nextRole
        ? `<div style="font-size:13.5px">→ <b>${esc(e.nextRole)}</b></div><div class="muted" style="font-size:12.5px;margin-top:4px">${plural(e.nextGaps.length, 'gap')} to close${e.nextEstimated ? ' · requirements estimated from a peer role' : ''}</div>`
        : '<div style="font-size:13.5px"><b>Top of the ladder</b></div><div class="muted" style="font-size:12.5px;margin-top:4px">No more senior role in this organisation</div>'))
    cards.push(kpi({
      label: 'Critical gaps', ico: icon.alert, tone: e.criticalGaps.length ? 'bad' : '',
      value: num(e.criticalGaps.length),
      sub: e.criticalGaps.length ? e.criticalGaps.map((g) => esc(g.name)).join(', ') : 'No High-priority competency is below requirement',
    }))
  } else {
    cards.push(`<div class="card notice span-2" style="grid-column:span 2">${icon.alert.replace('<svg', '<svg style="width:18px;height:18px;vertical-align:-3px;margin-right:6px"')}<b style="color:var(--fg)">Not assessed yet.</b> Self-assessment: ${esc(e.selfAssessment)} · Validation interview: ${esc(e.validation)} · Report: ${esc(e.report)}. Readiness, gaps and next role appear once the self-assessment is completed.</div>`)
    cards.push(kpi({ label: 'Critical gaps', ico: icon.alert, value: '–', sub: 'Needs an assessment' }))
  }
  const keyWhy = [
    e.criticalPosition ? `Holds a critical position (${esc(e.role || e.title)})` : '',
    e.keyPerson ? `Only expert in the team for ${e.keyFor.map((c) => esc(model.competencies.get(c).name)).join(', ')}` : '',
  ].filter(Boolean)
  cards.push(`<div class="card kpi ${e.keyPerson || e.criticalPosition ? 'warn' : ''}"><div class="kpi-label"><span class="kpi-icon">${icon.key}</span>Key position</div>
    <div class="yesno">${e.keyPerson || e.criticalPosition ? 'Yes' : 'No'}</div><div class="kpi-sub">${keyWhy.length ? keyWhy.join('. ') : 'Not a critical role and nobody depends on them alone for a competency'}</div></div>`)
  cards.push(`<div class="card kpi"><div class="kpi-label"><span class="kpi-icon">${icon.up}</span>Exceeds role competencies</div>
    <div class="yesno">${e.assessed ? (e.exceedsRole ? 'Yes' : e.exceeds.length ? 'Partly' : 'No') : '–'}</div>
    <div class="kpi-sub">${e.assessed ? (e.exceeds.length ? `Above requirement in ${plural(e.exceeds.length, 'competency', 'competencies')}: ${e.exceeds.slice(0, 5).map((g) => esc(g.name)).join(', ')}${e.exceeds.length > 5 ? ` and ${e.exceeds.length - 5} more` : ''}. ${e.exceedsRole ? 'Meets every other requirement.' : `Still below in ${e.allGaps.length}.`}` : 'Not above requirement anywhere') : 'Needs an assessment'}</div></div>`)
  cards.push(ringCard('Did the training', t.rate,
    t.started
      ? `<div style="font-size:13.5px"><b>${t.allDone ? 'Yes' : t.done ? 'Partly' : 'No'}</b> · ${t.done} of ${t.started} started trainings done</div><div class="muted" style="font-size:12.5px;margin-top:4px">${t.inProgress} in progress · ${t.incomplete} incomplete · ${t.upcoming} upcoming</div>`
      : '<div style="font-size:13.5px"><b>No training started yet</b></div>'))

  // ---------------------------------------------------------------- competency profile
  let profile = ''
  if (e.assessed) {
    const nextReq = new Map((e.nextItems || []).map((x) => [x.code, x.req]))
    const axes = e.gaps.map((g) => ({ label: shortName(g.name), title: `${g.name} (${g.category})` }))
    const series = [
      { name: 'Required now', cls: 'r-req', values: e.gaps.map((g) => g.req), dots: false },
      ...(e.nextRole ? [{ name: `Required as ${e.nextRole}`, cls: 'r-next', values: e.gaps.map((g) => nextReq.get(g.code) ?? g.req), dots: false }] : []),
      { name: 'Assessed level', cls: 'r-level', values: e.gaps.map((g) => g.level) },
    ]
    const radarCard = `<div class="card"><div class="card-head"><div><h3>Competency profile</h3><div class="card-sub">Assessed level against today's role${e.nextRole ? ' and the next one' : ''}</div></div></div>
      ${radar(axes, series)}
      <div class="legend inline" style="justify-content:center;margin-top:8px"><span class="legend-row"><span class="dot" style="background:var(--accent)"></span>Assessed level</span><span class="legend-row"><span class="swatch-line dashed"></span>Required now</span>${e.nextRole ? `<span class="legend-row"><span class="swatch-line warn"></span>Required as ${esc(e.nextRole)}</span>` : ''}</div></div>`

    const focus = e.nextRole ? e.nextGaps : e.allGaps.map((g) => ({ ...g }))
    const focusTitle = e.nextRole ? `To become ${esc(e.nextRole)}` : 'Gaps in the current role'
    const focusList = focus.length
      ? focus.map((x) => {
          const comp = model.competencies.get(x.code)
          const bs = behaviorsFor(model, x.code, x.level + 1, x.req)
          return `<div class="gap-item"><div class="gi-top"><span class="gi-name">${esc(comp.name)}</span><span class="row" style="gap:8px">${x.priority === 'High' ? '<span class="tag tag-bad">High</span>' : `<span class="tag">${esc(x.priority)}</span>`}<span class="gi-levels">level ${x.level} → ${x.req}</span></span></div>
            ${bs.length ? `<details class="behaviors"><summary>What level ${x.req} looks like</summary><ul>${bs.filter((b) => b.level === x.req).map((b) => `<li>${esc(b.text)}</li>`).join('')}</ul></details>` : ''}</div>`
        }).join('')
      : `<p class="empty">${e.nextRole ? 'Already meets every requirement of the next role.' : 'No gaps in the current role.'}</p>`
    const focusCard = `<div class="card"><div class="card-head"><div><h3>${focusTitle}</h3><div class="card-sub">${focus.length ? `${plural(focus.length, 'competency', 'competencies')} to grow, most important first. Open one to see the behaviours expected.` : ''}</div></div>
      ${e.nextRole ? `<div style="min-width:120px;text-align:right"><div style="font-size:22px;font-weight:500">${pct(e.nextReadiness)}</div>${progressLine(e.nextReadiness, { cls: readinessTone(e.nextReadiness) })}</div>` : ''}</div>
      <div style="max-height:420px;overflow:auto;margin-right:-8px;padding-right:8px">${focusList}</div>
      ${e.nextEstimated ? `<p class="note">The next role's holder has not been assessed yet, so its requirements are estimated from a peer role at the same level.</p>` : ''}</div>`

    const rows = e.gaps.map((g) => {
      const max = g.max || 5
      const nx = nextReq.get(g.code)
      const obsAvg = e.observedByCompetency ? e.observedByCompetency.get(g.code) : null
      const lvCls = g.gap <= 0 ? '' : g.gap === 1 ? 'warn' : 'bad'
      return `<tr>
        <td><div style="font-weight:500">${esc(g.name)}</div><div class="muted" style="font-size:12px">${esc(g.category)}</div></td>
        <td>${g.priority === 'High' ? '<span class="tag tag-bad">High</span>' : `<span class="tag">${esc(g.priority)}</span>`}</td>
        <td style="min-width:180px"><div class="levelbar" title="Level ${g.level}, required ${g.req}${nx != null ? `, next role ${nx}` : ''} (scale ${g.min}–${max})">
          <div class="lv ${lvCls}" style="width:${(g.level / max) * 100}%"></div><div class="rq" style="left:calc(${(g.req / max) * 100}% - 1px)"></div>${nx != null && nx !== g.req ? `<div class="nx" style="left:calc(${(nx / max) * 100}% - 1px)"></div>` : ''}</div></td>
        <td class="num">${g.level} / ${g.req}${nx != null ? ` <span class="muted">· ${nx}</span>` : ''}</td>
        <td class="num">${g.gap > 0 ? `<span class="tag tag-bad">−${g.gap}</span>` : g.gap < 0 ? `<span class="tag tag-lime">+${-g.gap}</span>` : '<span class="muted">0</span>'}</td>
        <td class="num">${obsAvg != null ? `<span class="tag ${scoreClass(obsAvg)}" style="border:0">${dec(obsAvg)}</span>` : '<span class="muted">–</span>'}</td>
      </tr>`
    }).join('')
    const lead = e.gaps.filter((g) => g.framework === LEAD_FW).length
    profile = `<div class="section"><div class="section-head"><div><h2>Competencies</h2><p>${lead} leadership and ${e.gaps.length - lead} technical competencies, validated in the assessment.</p></div></div>
      <div class="grid g-2">${radarCard}${focusCard}</div>
      <div class="table-wrap" style="margin-top:16px"><table class="table comp-table"><thead><tr><th>Competency</th><th>Priority</th><th>Level against requirement</th><th class="num">Level / req.${e.nextRole ? ' · next' : ''}</th><th class="num">Gap</th><th class="num">Observed</th></tr></thead><tbody>${rows}</tbody></table></div>
      <p class="note"><b>Bar</b>: assessed level. <b>Dark tick</b>: required now. <b>Amber tick</b>: required in the next role. <b>Observed</b>: trainers' average score (1–5) for the behaviours linked to that competency.</p></div>`
  }

  // ---------------------------------------------------------------- observed behaviours
  let observed
  const present = e.obs.filter((o) => o.present)
  if (e.obs.length) {
    const head = e.obs.map((o) => `<th title="${esc(o.title)} · ${esc(o.batch)} · ${date(o.date)} · ${esc(o.trainer)}"><div class="vlabel">${esc(shortDate(o.date))} · D${o.day}</div></th>`).join('')
    const rows = model.behaviors.map((b, i) => `<tr><th class="rowhead">${esc(b.behavior)}<span class="rh-sub">${esc(b.competency)}</span></th>${e.obs.map((o) => {
      const v = o.scores[i]
      return o.present ? `<td class="cell ${scoreClass(v)}" title="${esc(`${b.behavior} · ${date(o.date)}: ${v}`)}">${v ?? ''}</td>` : '<td class="cell heat-none" title="Absent">–</td>'
    }).join('')}</tr>`).join('')
    const labels = present.map((o) => `${shortDate(o.date)}`)
    const chart = present.length
      ? lineChart(labels, [
          { name: 'Overall day average', cls: 'l-overall', values: present.map((o) => o.overall) },
          { name: 'Leadership + Agility', cls: 'l-la', values: present.map((o) => o.leadershipAgility) },
        ])
      : '<p class="empty">Absent on every program day.</p>'
    const programs = [...new Set(e.obs.map((o) => `${o.title} · ${o.batch}`))]
    const notes = present.map((o) => `<div class="tl-item"><div class="tl-cycle">${esc(shortDate(o.date))}<br/>Day ${o.day}</div><div><div class="tl-line"><span>${esc(o.note || '')}</span><span class="muted" style="font-size:12px">${esc(o.trainer)}</span></div><div class="quote">${esc(o.assessorNotes || '')}</div></div></div>`).join('')
    observed = `<div class="section"><div class="section-head"><div><h2>Observed behaviours</h2><p>${esc(programs.join(', '))}. Trainers scored 25 behaviours on each day (1–5).</p></div>
      ${e.potentialNote ? `<span class="tag ${/High|Strong|Emerging/.test(e.potentialNote) ? 'tag-lime' : /Risk|Watch/.test(e.potentialNote) ? 'tag-bad' : ''}" style="font-size:13px;padding:4px 12px">${esc(e.potentialNote)}</span>` : ''}</div>
      <div class="grid g-2-1">
        <div><div class="heat-scroll" style="max-height:none"><table class="heat ${e.obs.length <= 8 ? 'wide' : ''}"><thead><tr><th class="rowhead">Behaviour · competency</th>${head}</tr></thead><tbody>${rows}</tbody></table></div>
          <div class="heat-legend"><span><i class="score-5"></i>5</span><span><i class="score-4"></i>4</span><span><i class="score-3"></i>3</span><span><i class="score-2"></i>2</span><span><i class="score-1"></i>1</span><span><i class="heat-none"></i>Absent</span></div></div>
        <div class="stack">
          <div class="grid g-3">
            <div class="stat"><div class="stat-value">${dec(e.potential)}</div><div class="stat-label">Leadership + Agility</div></div>
            <div class="stat"><div class="stat-value">${dec(e.coachability)}</div><div class="stat-label">Coachability</div></div>
            <div class="stat"><div class="stat-value">${e.growth != null ? `${e.growth >= 0 ? '+' : ''}${dec(e.growth, 2)}` : '–'}</div><div class="stat-label">Growth in program</div></div>
          </div>
          <div class="card"><h3>Day by day</h3><div class="card-sub" style="margin-bottom:10px">Average score per attended day</div>${chart}
            <div class="legend inline" style="margin-top:6px"><span class="legend-row"><span class="swatch-line"></span>Overall</span><span class="legend-row"><span class="swatch-line dashed"></span>Leadership + Agility</span></div></div>
          <div class="card"><h3>Trainer notes</h3><div class="timeline" style="margin-top:6px">${notes || '<p class="empty">No notes.</p>'}</div>
            <p class="note"><b>Coachability</b> = average of openness to feedback, learning speed, applies feedback and reflection quality on the latest day.</p></div>
        </div>
      </div></div>`
  } else {
    observed = `<div class="section"><div class="section-head"><div><h2>Observed behaviours</h2><p>Trainer scores from leadership programs.</p></div></div>
      <div class="notice">${esc(e.name)} has not attended an observed leadership program yet, so there is no behaviour heatmap.</div></div>`
  }

  // ---------------------------------------------------------------- training
  const tSegs = TRAINING_STATUSES.map((s) => ({ value: e.training.filter((x) => x.status === s.id).length, cls: s.cls, label: s.label }))
  const tLegend = legendRows(TRAINING_STATUSES.map((s, i) => ({ cls: s.cls, label: s.label, value: tSegs[i].value })))
  const tRows = e.training.map((x) => `<tr><td><div style="font-weight:500">${esc(x.title)}</div><div class="muted" style="font-size:12px">${esc(x.type)} · ${esc(x.mode)} · <span class="mono">${esc(x.code)}</span></div></td>
    <td class="muted" style="white-space:nowrap">${date(x.start)} – ${date(x.end)}</td><td>${statusTag(x.status)}</td><td class="muted">${esc(x.attendance || '–')}</td><td class="num">${x.hours ? `${dec(x.hours, x.hours % 1 ? 1 : 0)} h` : '<span class="muted">–</span>'}</td></tr>`).join('')
  const training = `<div class="section"><div class="section-head"><div><h2>Training</h2><p>${t.started ? `${t.allDone ? 'Yes, finished everything started' : t.done ? 'Partly done' : 'Not done yet'}: ${t.done} of ${t.started} started trainings completed, ${dec(t.hours, 1)} hours credited.` : 'No training started yet.'}</p></div></div>
    <div class="grid g-2-1" style="grid-template-columns:minmax(0,1fr) minmax(0,2.2fr)">
      <div class="card"><div class="row" style="justify-content:center">${donut(tSegs, { center: `${t.done}/${t.started}`, sub: 'started done' })}</div><div style="margin-top:16px">${tLegend}</div></div>
      <div class="table-wrap"><table class="table"><thead><tr><th>Training</th><th>Dates</th><th>Status</th><th>Attendance</th><th class="num">Hours</th></tr></thead><tbody>${tRows || '<tr><td colspan="5" class="empty">No training records.</td></tr>'}</tbody></table></div>
    </div></div>`

  // ---------------------------------------------------------------- certifications + plan
  const idp = e.idp.length
    ? `<div class="timeline">${[...e.idp].reverse().map((c) => `<div class="tl-item"><div class="tl-cycle">${esc(c.cycle)}${c.cycle === model.currentCycle ? '<br/><span class="tag tag-lime" style="margin-top:4px">current</span>' : ''}</div><div class="stack" style="gap:10px">
        <div><div class="tl-line"><span><b style="font-weight:500">${esc(c.prof)}</b> <span class="muted">· professional</span></span>${statusTag(c.profStatus)}</div><div class="tl-desc">${esc(c.profDescription || '')}</div></div>
        ${c.ai ? `<div><div class="tl-line"><span><b style="font-weight:500">${esc(c.ai)}</b> <span class="muted">· AI</span></span>${statusTag(c.aiStatus)}</div><div class="tl-desc">${esc(c.aiDescription || '')}</div></div>` : '<div class="tl-desc">No AI certification goal this cycle.</div>'}
      </div></div>`).join('')}</div>`
    : '<p class="empty">No IDP cycles.</p>'
  let plan
  if (e.plan) {
    const maxH = Math.max(...e.plan.segments.map((s) => s.hours), e.plan.part2 ? e.plan.part2.hours : 0, 1)
    plan = barList([
      ...e.plan.segments.map((s, i) => ({ label: s.title, sub: `Segment ${i + 1}`, value: s.hours / maxH, text: s.time, cls: 'lime' })),
      ...(e.plan.part2 ? [{ label: e.plan.part2.title, sub: 'Department need', value: e.plan.part2.hours / maxH, text: e.plan.part2.time, cls: 'ink' }] : []),
    ], { stacked: true }) + `<div class="grid g-2" style="margin-top:16px"><div class="stat"><div class="stat-value">${dec(e.plan.hours, 1)} h</div><div class="stat-label">planned</div></div><div class="stat"><div class="stat-value">${dec(t.hours, 1)} h</div><div class="stat-label">training hours credited</div></div></div>`
  } else {
    plan = `<p class="empty">No learning plan yet: it is created when the validation report is delivered (report: ${esc(e.report)}).</p>`
  }
  const dev = `<div class="section"><div class="section-head"><div><h2>Development plan</h2><p>Certification goals per IDP cycle and the learning plan from the individual report.</p></div></div>
    <div class="grid g-2"><div class="card"><div class="card-head"><div><h3>Certifications</h3><div class="card-sub">Professional and AI goals, newest cycle first</div></div></div>${idp}</div>
    <div class="card"><div class="card-head"><div><h3>Learning plan</h3><div class="card-sub">Segments from the individual report, with estimated time</div></div></div>${plan}</div></div></div>`

  const html = `<div class="page">
    <section class="hero container" style="padding-bottom:24px">
      <div class="crumbs"><a href="#/">Dashboard</a><span class="sep">/</span><a href="${teamsHref({ dept: e.department })}">${esc(e.department)}</a><span class="sep">/</span><a href="${teamsHref({ dept: e.department, section: e.section })}">${esc(e.section)}</a><span class="sep">/</span><span>${esc(e.name)}</span></div>
      <div class="profile-head" style="margin-top:18px"><span class="avatar lg">${esc(initials(e.name))}</span>
        <div style="min-width:0"><h1>${esc(e.name)}</h1><p class="sub" style="margin-top:4px">${esc(e.titleExtended || e.role || e.title)}</p></div></div>
      <div class="row wrap" style="margin-top:16px;gap:6px">${tags}</div>
      <div class="profile-meta">${meta}</div>
    </section>
    <div class="container">
      <div class="grid g-3">${cards.join('')}</div>
      ${profile}
      ${observed}
      ${training}
      ${dev}
    </div>
  </div>`
  return { html, title: e.name }
}
