// Builds the dashboard model from the 8 sheets of data/skills-data.xlsx.
// Everything is joined on the employee email. No network, no libraries: plain data in, plain objects out.
//
// Definitions used across the app (also shown in the UI's "How it's calculated" notes):
//   Role readiness   Σ w·min(Level, Required) ÷ Σ w·Required, with Priority weights High 3, Medium 2, Low 1
//   Next role        the closest more-senior role in the same section; otherwise the line manager's role
//   Next-role ready  the same formula against the next role's required levels
//   Critical gap     a High-priority competency where Level < Required
//   Key person       the only person in their team (3+ assessed staff) at expert level (4+) in a competency
//   Critical position  a lead, head, director or chief role

export const PRIORITY_WEIGHT = { High: 3, Medium: 2, Low: 1 }
export const EXPERT_LEVEL = 4
export const LEAD_FW = 'Club Leadership Framework'

export const BANDS = [
  { id: 'ready', label: 'Ready now', short: 'Ready now' },
  { id: 'soon', label: 'Ready in 6–12 months', short: '6–12 months' },
  { id: 'growing', label: 'Growing in role', short: 'Growing' },
  { id: 'support', label: 'Needs support', short: 'Support' },
  { id: 'unassessed', label: 'Not assessed yet', short: 'Not assessed' },
]

const COACHABILITY = ['Openness to feedback', 'Learning speed', 'Applies feedback', 'Reflection quality']
const CRITICAL_TITLE = /\b(Lead|Head|Director|Chief)\b/
export const sectionKey = (department, section) => `${department}::${section}`

function sheetRows(workbook, name) {
  const sheet = workbook.find((s) => s.name === name)
  if (!sheet) return { columns: [], rows: [] }
  const rows = sheet.rows.map((r) => {
    const o = {}
    sheet.columns.forEach((c, i) => { o[c] = r[i] })
    return o
  })
  return { columns: sheet.columns, rows }
}

export function readiness(items) {
  let num = 0
  let den = 0
  for (const it of items) {
    const w = PRIORITY_WEIGHT[it.priority] || 1
    num += w * Math.min(it.level, it.req)
    den += w * it.req
  }
  return den > 0 ? num / den : null
}

function parseHours(text) {
  if (text == null || text === '') return 0
  if (typeof text === 'number') return text
  const h = /(\d+(?:\.\d+)?)\s*h/.exec(text)
  const m = /(\d+)\s*m/.exec(text)
  return (h ? parseFloat(h[1]) : 0) + (m ? parseInt(m[1], 10) / 60 : 0)
}

const avg = (xs) => (xs.length ? xs.reduce((a, b) => a + b, 0) / xs.length : null)

export function buildModel(workbook) {
  // ---------------------------------------------------------------- framework
  const competencies = new Map()
  for (const r of sheetRows(workbook, 'Competencies').rows) {
    competencies.set(r['Competency Code'], {
      code: r['Competency Code'],
      name: r['Competency Name'],
      category: r['Category Name'],
      categoryCode: r['Category Code'],
      framework: r['Framework Name'],
      min: r['Competency Minimum Level'],
      max: r['Competency Maximum Level'],
      description: r['Competency Description'],
      supporting: r['Supporting Text'],
    })
  }
  const competencyOrder = [...competencies.keys()]

  const behaviorsByLevel = new Map() // code -> level -> [text]
  for (const r of sheetRows(workbook, 'Competency Behaviors').rows) {
    const code = r['Competency Code']
    if (!behaviorsByLevel.has(code)) behaviorsByLevel.set(code, new Map())
    const byLevel = behaviorsByLevel.get(code)
    const lvl = r['CompetencyLevel']
    if (!byLevel.has(lvl)) byLevel.set(lvl, [])
    byLevel.get(lvl).push(r['Competency Behavior'])
  }

  // ---------------------------------------------------------------- people
  const employees = sheetRows(workbook, 'Employees').rows.map((r) => ({
    name: r['User Name'],
    email: r['User Email'],
    title: r['Job Title'],
    titleExtended: r['Job Title Extended'],
    section: r['Section'],
    department: r['Department'],
    division: r['Division'],
    lineManager: r['Line Manager'],
    selfAssessment: r['Self-Assessment'],
    validation: r['Validation Interview'],
    report: r['Validation Interview Report'],
    crossFunctional: r['Cross-Functional Training'],
    role: null,
    family: null,
    team: null,
    teamManager: null,
    gaps: [],
    training: [],
    obs: [],
    idp: [],
    plan: null,
  }))
  const byEmail = new Map(employees.map((e) => [e.email, e]))

  // ---------------------------------------------------------------- competency gaps
  const roles = new Map()
  for (const r of sheetRows(workbook, 'Competency Gaps').rows) {
    const e = byEmail.get(r['Person Email'])
    if (!e) continue
    e.role = r['Job Role']
    e.family = r['Job Role Family']
    e.team = r['Team Name']
    e.teamManager = r['Team Manager Name']
    e.lineManagerEmail = r['Line Manager Email']
    const code = r['Competency Code']
    e.gaps.push({
      code,
      name: r['Competency'],
      category: r['Category'],
      framework: r['Framework'],
      level: r['Level'],
      req: r['Required Level'],
      gap: r['Competency Gap'],
      min: r['Minimum Level'],
      max: r['Maximum Level'],
      priority: r['Priority'],
    })
    if (!roles.has(e.role)) {
      roles.set(e.role, { role: e.role, family: e.family, req: {}, priority: {}, holders: new Set() })
    }
    const p = roles.get(e.role)
    p.req[code] = r['Required Level']
    p.priority[code] = r['Priority']
    p.holders.add(e.email)
  }
  for (const p of roles.values()) {
    const codes = Object.keys(p.req)
    const lead = codes.filter((c) => competencies.get(c)?.framework === LEAD_FW)
    p.seniority = (lead.length ? lead : codes).reduce((s, c) => s + p.req[c], 0)
    const holders = [...p.holders].map((m) => byEmail.get(m))
    p.sections = new Set(holders.map((h) => h.section))
    p.departments = new Set(holders.map((h) => h.department))
    p.divisions = new Set(holders.map((h) => h.division))
    p.critical = CRITICAL_TITLE.test(p.role)
  }

  // ---------------------------------------------------------------- training
  for (const r of sheetRows(workbook, 'Training Records').rows) {
    const e = byEmail.get(r['Employee Email'])
    if (!e) continue
    e.training.push({
      code: r['Training Record Code'],
      type: r['Training Type'],
      start: r['Training Start Date'],
      end: r['Training End Date'],
      title: r['Training Title'],
      attendance: r['Attendance'],
      status: r['Status'],
      mode: r['Mode'],
      hours: r['Hours'] || 0,
    })
  }

  // ---------------------------------------------------------------- observations
  const obsSheet = sheetRows(workbook, 'Training Day Scores')
  const behaviorColumns = obsSheet.columns.filter((c) => c.includes(' | '))
  const behaviors = behaviorColumns.map((c) => {
    const [behavior, competency] = c.split(' | ')
    const comp = [...competencies.values()].find((x) => x.name === competency)
    return { column: c, behavior, competency, code: comp ? comp.code : null }
  })
  for (const r of obsSheet.rows) {
    const e = byEmail.get(r['Employee Email'])
    if (!e) continue
    e.obs.push({
      code: r['Training Record Code'],
      type: r['Training Type'],
      batch: r['Batch'],
      day: r['Training Day'],
      date: r['Training Date'],
      title: r['Training Title'],
      trainer: r['Trainer Name'],
      present: r['Attendance'] === 'Present',
      overall: r['Overall Day Avg'],
      leadershipAgility: r['Leadership + Agility Avg'],
      note: r['Potential / Risk Note'],
      assessorNotes: r['Assessor Notes'],
      scores: behaviors.map((b) => r[b.column]),
    })
  }

  // ---------------------------------------------------------------- IDP + plans
  for (const r of sheetRows(workbook, 'IDP Certifications').rows) {
    const e = byEmail.get(r['User Email'])
    if (!e) continue
    e.idp.push({
      cycle: r['IDP Cycle'],
      prof: r['Prof Cert'],
      profStatus: r['Prof Cert Status'],
      profDescription: r['Prof Cert Description'],
      ai: r['AI Cert'],
      aiStatus: r['AI Cert Status'],
      aiDescription: r['AI Cert Description'],
    })
  }
  const cycles = [...new Set(employees.flatMap((e) => e.idp.map((i) => i.cycle)))].sort()
  const currentCycle = cycles[cycles.length - 1] || null

  for (const r of sheetRows(workbook, 'Learning Plans').rows) {
    const e = byEmail.get(r['Email'])
    if (!e) continue
    const segments = []
    for (let i = 1; i <= 5; i++) {
      if (r[`Segment ${i}`]) segments.push({ title: r[`Segment ${i}`], time: r[`Estimated Time ${i}`], hours: parseHours(r[`Estimated Time ${i}`]) })
    }
    const part2 = r['Part 2: Department Training Needs']
      ? { title: r['Part 2: Department Training Needs'], time: r['Estimated Time Part 2'], hours: parseHours(r['Estimated Time Part 2']) }
      : null
    e.plan = { segments, part2, hours: segments.reduce((s, x) => s + x.hours, 0) + (part2 ? part2.hours : 0) }
  }

  // ---------------------------------------------------------------- per-person metrics
  for (const e of employees) {
    e.idp.sort((a, b) => (a.cycle < b.cycle ? -1 : 1))
    e.training.sort((a, b) => (a.start < b.start ? 1 : -1))
    e.obs.sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : a.day - b.day))
    e.assessed = e.gaps.length > 0
    e.criticalPosition = CRITICAL_TITLE.test(e.role || e.title || '')

    if (e.assessed) {
      e.gaps.sort((a, b) => competencyOrder.indexOf(a.code) - competencyOrder.indexOf(b.code))
      e.roleReadiness = readiness(e.gaps)
      e.metShare = e.gaps.filter((g) => g.level >= g.req).length / e.gaps.length
      e.criticalGaps = e.gaps.filter((g) => g.priority === 'High' && g.gap > 0)
      e.allGaps = e.gaps.filter((g) => g.gap > 0)
      e.exceeds = e.gaps.filter((g) => g.level > g.req)
      e.exceedsRole = e.allGaps.length === 0 && e.exceeds.length > 0
      e.gapPoints = e.allGaps.reduce((s, g) => s + g.gap, 0)
    } else {
      e.roleReadiness = null
      e.criticalGaps = []
      e.allGaps = []
      e.exceeds = []
      e.exceedsRole = false
      e.gapPoints = 0
    }

    // training ("tasks")
    const t = { done: 0, incomplete: 0, inProgress: 0, upcoming: 0, cancelled: 0, hours: 0 }
    for (const x of e.training) {
      if (x.status === 'Completed') t.done++
      else if (x.status === 'Incomplete') t.incomplete++
      else if (x.status === 'In Progress') t.inProgress++
      else if (x.status === 'Not Started') t.upcoming++
      else if (x.status === 'Cancelled') t.cancelled++
      t.hours += x.hours || 0
    }
    t.started = t.done + t.incomplete + t.inProgress
    t.rate = t.started ? t.done / t.started : null
    t.allDone = t.started > 0 && t.incomplete === 0 && t.inProgress === 0
    t.finishing = t.inProgress > 0 && t.incomplete === 0
    e.trainingStats = t

    // observations
    const present = e.obs.filter((o) => o.present)
    if (present.length) {
      const last = present[present.length - 1]
      const firstOfLastProgram = present.find((o) => o.code === last.code)
      const idx = (name) => behaviors.findIndex((b) => b.behavior === name)
      e.potential = last.leadershipAgility
      e.lastOverall = last.overall
      e.growth = last.overall - firstOfLastProgram.overall
      e.coachability = avg(COACHABILITY.map((n) => last.scores[idx(n)]).filter((v) => v != null))
      e.potentialNote = last.note
      e.behaviorAvg = behaviors.map((_, i) => avg(present.map((o) => o.scores[i]).filter((v) => v != null)))
      const byComp = new Map()
      behaviors.forEach((b, i) => {
        if (!b.code) return
        if (!byComp.has(b.code)) byComp.set(b.code, [])
        byComp.get(b.code).push(e.behaviorAvg[i])
      })
      e.observedByCompetency = new Map([...byComp].map(([c, xs]) => [c, avg(xs)]))
    } else {
      e.potential = null
    }

    const cur = e.idp.find((i) => i.cycle === currentCycle)
    e.currentCert = cur || null
  }

  // ---------------------------------------------------------------- next role
  // 1. The closest more-senior assessed role inside the person's own section.
  // 2. Otherwise the role of their line manager (the natural next step for leads and heads).
  //    If that manager has not been assessed, requirements are borrowed from an assessed peer
  //    at the same level (same boss, critical title) and the result is marked as estimated.
  const byName = new Map(employees.map((e) => [e.name, e]))
  function profileFor(holder, e) {
    if (holder.role && roles.has(holder.role)) return { profile: roles.get(holder.role), estimated: false }
    const peers = employees.filter((p) => p !== holder && p.assessed && p.lineManager === holder.lineManager && CRITICAL_TITLE.test(p.role))
    if (!peers.length) return null
    const mine = new Set(e.gaps.map((g) => g.code))
    peers.sort((a, b) => b.gaps.filter((g) => mine.has(g.code)).length - a.gaps.filter((g) => mine.has(g.code)).length)
    return { profile: roles.get(peers[0].role), estimated: true }
  }
  for (const e of employees) {
    e.nextRole = null
    e.nextReadiness = null
    if (!e.assessed) continue
    const own = roles.get(e.role)
    let target = null
    let estimated = false
    let holder = null
    const inSection = [...roles.values()].filter((p) => p.seniority > own.seniority && p.sections.has(e.section) && p.departments.has(e.department))
    if (inSection.length) {
      inSection.sort((a, b) => a.seniority - b.seniority || b.holders.size - a.holders.size)
      target = inSection[0]
      e.nextRole = target.role
      e.nextScope = 'section'
    } else {
      holder = byName.get(e.lineManager)
      if (!holder || holder === e) continue
      const found = profileFor(holder, e)
      if (!found) continue
      target = found.profile
      estimated = found.estimated
      e.nextRole = holder.role || holder.title
      e.nextScope = 'manager'
      e.nextHolder = holder
    }
    const mine = new Map(e.gaps.map((g) => [g.code, g]))
    const items = []
    const missing = []
    for (const [code, req] of Object.entries(target.req)) {
      const g = mine.get(code)
      if (!g) { missing.push(code); continue }
      items.push({ code, name: g.name, level: g.level, req, priority: target.priority[code], gap: req - g.level })
    }
    e.nextEstimated = estimated
    e.nextReadiness = readiness(items)
    e.nextItems = items
    e.nextGaps = items.filter((x) => x.gap > 0).sort((a, b) => b.gap * PRIORITY_WEIGHT[b.priority] - a.gap * PRIORITY_WEIGHT[a.priority])
    e.nextMissing = missing
  }

  // ---------------------------------------------------------------- bands
  for (const e of employees) {
    if (!e.assessed) e.band = 'unassessed'
    else if (e.nextRole && e.nextReadiness >= 0.92 && e.criticalGaps.length === 0) e.band = 'ready'
    else if (e.nextRole && e.nextReadiness >= 0.85 && e.criticalGaps.length <= 1) e.band = 'soon'
    else if (e.roleReadiness >= 0.85) e.band = 'growing'
    else e.band = 'support'
  }

  // ---------------------------------------------------------------- key people per section
  const sectionStats = new Map()
  const divisions = new Map()
  for (const e of employees) {
    if (!divisions.has(e.division)) divisions.set(e.division, new Map())
    const deps = divisions.get(e.division)
    if (!deps.has(e.department)) deps.set(e.department, new Map())
    const secs = deps.get(e.department)
    if (!secs.has(e.section)) secs.set(e.section, [])
    secs.get(e.section).push(e)
  }
  for (const e of employees) e.keyFor = []
  for (const [division, deps] of divisions) {
    for (const [department, secs] of deps) {
      for (const [section, people] of secs) {
        const assessed = people.filter((p) => p.assessed && !p.criticalPosition)
        if (assessed.length < 3) {
          sectionStats.set(sectionKey(department, section), { division, department, section, people, singles: [], none: [] })
          continue
        }
        const codes = new Set(assessed.flatMap((p) => p.gaps.map((g) => g.code)))
        const singles = []
        const none = []
        for (const code of codes) {
          const holders = assessed.filter((p) => p.gaps.some((g) => g.code === code))
          const experts = holders.filter((p) => p.gaps.find((g) => g.code === code).level >= EXPERT_LEVEL)
          const high = holders.some((p) => p.gaps.find((g) => g.code === code).priority === 'High')
          if (experts.length === 1) {
            singles.push({ code, name: competencies.get(code)?.name || code, person: experts[0], holders: holders.length, section, department })
            experts[0].keyFor.push(code)
          } else if (experts.length === 0 && high && holders.length >= 3) {
            none.push({ code, name: competencies.get(code)?.name || code, holders: holders.length, section, department })
          }
        }
        sectionStats.set(sectionKey(department, section), { division, department, section, people, singles, none })
      }
    }
  }
  for (const e of employees) e.keyPerson = e.keyFor.length > 0

  // ---------------------------------------------------------------- succession for critical positions
  for (const h of employees) {
    if (!h.criticalPosition) continue
    h.successors = employees.filter(
      (e) => e !== h && (e.band === 'ready' || e.band === 'soon') &&
        (e.nextHolder === h || (e.nextScope === 'section' && e.nextRole === (h.role || h.title) && e.section === h.section && e.department === h.department)),
    )
  }

  return {
    employees,
    byEmail,
    competencies,
    competencyOrder,
    behaviorsByLevel,
    behaviors,
    roles,
    divisions,
    sectionStats,
    cycles,
    currentCycle,
  }
}

// Aggregates for any group of employees (whole company, a department or a section).
export function summarize(model, people) {
  const assessed = people.filter((e) => e.assessed)
  const bands = Object.fromEntries(BANDS.map((b) => [b.id, 0]))
  for (const e of people) bands[e.band]++

  const t = { done: 0, started: 0, hours: 0, allDone: 0, finishing: 0, withTraining: 0 }
  for (const e of people) {
    const s = e.trainingStats
    t.done += s.done
    t.started += s.started
    t.hours += s.hours
    if (s.allDone) t.allDone++
    if (s.finishing) t.finishing++
    if (s.started) t.withTraining++
  }

  const gapCount = new Map()
  for (const e of assessed) {
    for (const g of e.gaps) {
      if (!gapCount.has(g.code)) gapCount.set(g.code, { code: g.code, name: g.name, category: g.category, assessed: 0, withGap: 0, critical: 0, gapSum: 0, levelSum: 0, reqSum: 0 })
      const c = gapCount.get(g.code)
      c.assessed++
      c.levelSum += g.level
      c.reqSum += g.req
      if (g.gap > 0) {
        c.withGap++
        c.gapSum += g.gap
        if (g.priority === 'High') c.critical++
      }
    }
  }
  const topGaps = [...gapCount.values()].filter((c) => c.withGap > 0).sort((a, b) => b.withGap - a.withGap || b.critical - a.critical)

  const sections = new Set(people.map((e) => sectionKey(e.department, e.section)))
  const singles = []
  const none = []
  for (const s of sections) {
    const st = model.sectionStats.get(s)
    if (!st) continue
    singles.push(...st.singles)
    none.push(...st.none)
  }

  const current = people.map((e) => e.currentCert).filter(Boolean)
  const criticalPositions = people.filter((e) => e.criticalPosition)

  const bandTraining = BANDS.map((b) => {
    const grp = people.filter((e) => e.band === b.id)
    const done = grp.reduce((s, e) => s + e.trainingStats.done, 0)
    const started = grp.reduce((s, e) => s + e.trainingStats.started, 0)
    return { ...b, people: grp.length, done, started, rate: started ? done / started : null }
  })

  return {
    count: people.length,
    assessedCount: assessed.length,
    selfAssessed: people.filter((e) => e.selfAssessment === 'Completed').length,
    validated: people.filter((e) => e.validation === 'Completed').length,
    reported: people.filter((e) => e.report === 'Delivered').length,
    avgRoleReadiness: avg(assessed.map((e) => e.roleReadiness)),
    avgNextReadiness: avg(assessed.filter((e) => e.nextReadiness != null).map((e) => e.nextReadiness)),
    criticalGaps: assessed.reduce((s, e) => s + e.criticalGaps.length, 0),
    peopleWithCritical: assessed.filter((e) => e.criticalGaps.length > 0).length,
    exceedsRole: assessed.filter((e) => e.exceedsRole).length,
    bands,
    training: { ...t, rate: t.started ? t.done / t.started : null },
    topGaps,
    keyPeople: people.filter((e) => e.keyPerson),
    singles,
    none,
    criticalPositions,
    uncoveredPositions: criticalPositions.filter((h) => !(h.successors && h.successors.length)),
    certAchieved: current.filter((c) => c.profStatus === 'Achieved').length,
    certTotal: current.length,
    aiAchieved: current.filter((c) => c.aiStatus === 'Achieved').length,
    aiTotal: current.filter((c) => c.ai).length,
    bandTraining,
  }
}
