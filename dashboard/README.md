# CyberGate manager dashboard (pilot)

The dashboard is one HTML file, `build/cybergate-dashboard.html`, that contains the whole app: HTML, CSS and JavaScript. **It reads its data from the Excel workbook in this repo, `data/cybergate-mock-data.xlsx`.** No data is built into the page. Reading that workbook is the only thing the page ever loads, and a Content-Security-Policy blocks every request to anywhere else. Everything works in airplane mode.

## Opening it

| How | What happens |
| --- | --- |
| `npm run dashboard:serve`, then open the printed address | The page reads `data/cybergate-mock-data.xlsx` from the repo by itself every time it opens. This is a tiny Node server bound to 127.0.0.1 with no dependencies, so it still works offline. |
| Double-click `build/cybergate-dashboard.html` | Browsers don't let a page opened from disk read other files by itself. The first time, choose or drop `data/cybergate-mock-data.xlsx`. The browser keeps a copy on this computer, so next time the dashboard opens straight away. |
| Load another version | Click the data button in the header (it shows the file name and number of people) or drop an .xlsx anywhere on the page. |

The workbook is checked when it is read. If a sheet or key column is missing, the page says exactly what is missing instead of showing wrong numbers.

## How it's built

- Plain JavaScript, with no framework, no chart library and no runtime modules. Charts are hand-drawn SVG and components are plain functions that return HTML.
- **The Excel reader (`src/xlsx.js`) is written from scratch.** It reads the zip, unpacks it with the browser's built-in `DecompressionStream`, and reads the sheet XML with `DOMParser`. It was checked cell by cell against `read-excel-file` on all 8 sheets, and the output is identical.
- Vite (the same setup as the table viewer in this repo) bundles `src/` into **one classic `<script>`**, with no `type="module"` and no `import` at runtime, and inlines it with `vite-plugin-singlefile`.

```bash
npm install
npm run dashboard:dev     # live-reload while editing; also serves data/ so the workbook loads
npm run dashboard:build   # → dashboard/build/cybergate-dashboard.html
npm run dashboard:serve   # open the built page with the repo's workbook loaded automatically
```

To use other data, replace `data/cybergate-mock-data.xlsx` with a workbook that has the same sheet and column names. You don't need to rebuild.

## Pages

1. **Dashboard** (`#/`)
   - KPI cards: people assessed, critical positions, critical gaps, training completed, ready for promotion, key-person risk, average role readiness, certifications.
   - Assessment progress and promotion readiness.
   - Department cards.
   - A dark section listing every critical position and its ready successors.
2. **Teams** (`#/teams`)
   - Department buttons, then section buttons.
   - For the chosen scope:
     - most common gaps
     - promotion overview
     - tasks done by assessment
     - key-person risk
     - performance × potential 9-box
     - readiness by team
     - competency heatmap and observed-behaviour heatmap
   - Employee table with a progress line toward each person's next role. It has search, sorting, filtering by promotion group, and pages of 50.
3. **Employee** (`#/employee/<email>`)
   - Role readiness, next-role readiness, critical gaps, key position, whether they exceed their role, and whether they did the training.
   - Competency radar, the gaps to the next role with the behaviours expected at that level, and a competency table.
   - Behaviour heatmap by training day, day-by-day trend and trainer notes.
   - Training list, certifications per IDP cycle, and learning plan.

## How the numbers are calculated (`src/model.js`)

| Metric | Definition |
| --- | --- |
| Role readiness | Σ w·min(Level, Required) ÷ Σ w·Required, with Priority weights High 3, Medium 2, Low 1 |
| Next role | The closest more-senior assessed role in the same section. If there is none, the line manager's role. If that manager hasn't been assessed, the requirements come from an assessed peer at the same level, and the role is marked "est." |
| Next-role readiness | The same formula, applied to the next role's required levels |
| Critical gap | A High-priority competency where Level < Required |
| Exceeds role | Meets every requirement and is above requirement in at least one competency |
| Key person | The only person in their team (3+ assessed staff) at level 4+ in a competency |
| Critical position | A role with Lead, Head, Director or Chief in the title. A successor is someone whose next role is that position and who is Ready now or Ready in 6–12 months |
| Ready now | Next-role readiness of 92% or more, and no critical gaps |
| Ready in 6–12 months | Next-role readiness of 85% or more, and at most one critical gap |
| Growing in role | Role readiness of 85% or more |
| Needs support | Everyone else who has been assessed |
| Tasks done | Completed ÷ started trainings in the Training Records sheet (started = completed, incomplete or in progress) |
| Potential (9-box) | Latest Leadership + Agility average from the Training Day Scores sheet |
| Coachability | Average of the openness to feedback, learning speed, applies feedback and reflection quality scores on the latest attended day |
