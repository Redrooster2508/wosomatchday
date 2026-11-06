---
tags: [feature]
---
# Team pages

`team.html?l=<league slug>&id=<ESPN team id>` (`team-page.js`). Linked from the match centre's team names, the table and player pages.

## Sections
- **Hero:** team photo or illustration ([[Photos and licensing]]), crest, position, points, record, goals, zone, last-five form.
- **Season forecast:** title or top-spot chance, projected points and zone chances, from `forecast.json`. See [[Season forecast]].
- **Results and fixtures:** ESPN team schedule. Results come by default; **upcoming matches need `?fixture=true`**, so both are requested and merged.
- **Squad:** from the [[Player stats database]], sorted by minutes, with goals per 90 (270+ minutes) and progressive passes.
- **How they play:** every squad player's season data from `heat.json` added together: touches, shots, progressive passes (newest 120) and goal mouth. See [[Heatmaps]].
- **Head to head:** pick any opponent. See below.

## Head to head (`h2h.js`)
ESPN team schedules for the last five seasons (`/teams/<id>/schedule?season=YYYY`), filtered to finished meetings with the opponent. Shows the wins/draws/losses summary, goals and a list. Also in the match centre ("earlier league meetings"; the current match is excluded). It only covers the same competition, since schedules are per competition.
