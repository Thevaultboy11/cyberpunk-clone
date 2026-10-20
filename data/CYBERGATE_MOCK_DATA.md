# CyberGate mock data (300 employees)

`cybergate-mock-data.xlsx` is fictional data for the CyberGate manager dashboard. The dashboard reads this file at startup (see the main README).

Regenerate it with `npm run data` (runs `python3 scripts/generate_cybergate_mock.py`; needs `openpyxl`). The seed is fixed, so each run produces the same data.

All people, emails (`@acme-corp.example`) and the client "Acme Corp" are made up. "Today" for the data is 2026-10-20, so past training sessions are finished, current ones are in progress and future ones haven't started.

## Sheets (same columns, in the same order, as the original tables)

| Sheet | Original table | Rows | One row = |
| --- | --- | --- | --- |
| Employees | 1. Employee roster & assessment status | 300 | one employee |
| Competency Gaps | 2. Competency gap matrix | ~5,300 | employee × competency |
| Competencies | 3. Competency dictionary | 32 | competency |
| Competency Behaviors | 4. Behaviors per level | 320 | behavior at one level |
| Training Records | 5. Training log | ~2,000 | employee × training session |
| Training Day Scores | 6. Training day observations | ~360 | employee × program day |
| IDP Certifications | 7. IDP certifications | 760 | employee × IDP cycle |
| Learning Plans | 8. Personal learning plan | 196 | employee |

## Built-in variety

- **Org:** 3 divisions → 8 departments → 17 sections. Includes 3 division heads, 8 department heads and 17 section leads. About 8% of staff have a line manager who differs from their team manager (a matrix setup).
- **Employee profiles:** each employee is randomly assigned one of six profiles: rising star, solid, technical expert, developing, new joiner or struggling. The profile shapes their competency levels, training, certification outcomes and observed scores. Some employees are therefore ready to move up and others need attention.
- **Two frameworks:** Leadership (16 competencies, scale 1–5) and Technical (16 competencies, scale 0–5). Every employee is assessed on all 16 leadership competencies plus 4–6 technical competencies relevant to their section.
- **Gaps:** Competency Gap = Required Level − Level. A negative gap means the employee is above the requirement. Priority is High, Medium or Low.
- **Missing data, on purpose:**
  - 47 people haven't completed self-assessment, so they have no rows in Competency Gaps.
  - Only people whose report is Delivered (196) have a Learning Plan.
  - Some AI cert cells are empty, meaning no AI goal was set.
- **Training Record Code** identifies one session; everyone who attended that session shares the same code.
- **Training Day Scores:** behaviors are scored 1–5. Overall Day Avg is the average of all 25 behaviors. Leadership + Agility Avg is the average of these 11:
  - Influence in group
  - Conflict handling
  - Guiding others
  - Presence / authority
  - Decision quality
  - Initiative
  - Ownership
  - Emotional regulation
  - Openness to feedback
  - Learning speed
  - Applies feedback

  Scores rise across the days of a program. Each trainer scores slightly more leniently or strictly than the others. Absent days have no scores.
- **Potential / Risk Note** takes one of six fixed values: High potential, Strong potential, Solid, Emerging, Watch, Risk.
- **IDP cycles:** 2025 H2 and 2026 H1 are closed; 2026 H2 is the current cycle. New joiners only appear in 2026 H2.
- **Estimated Time** in Learning Plans is text such as `6h` or `4h 30m`.
