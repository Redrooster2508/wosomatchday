---
tags: [feature]
---
# Team pages

`team.html?l=<league slug>&id=<ESPN team id>` (`team-page.js`). Linked from the match centre's team names, the table and player pages.

## Sections
- **Hero:** team photo or illustration ([[Photos and licensing]]), crest, position, points, record, goals, zone, last-five form.
- **Season forecast:** title or top-spot chance, projected points and zone chances, from `forecast.json`. See [[Season forecast]].
- **Results and fixtures:** ESPN team schedule. Results come by default; **upcoming matches need `?fixture=true`**, so both are requested and merged.
- **National teams, men's and women's:** fixtures come from every competition, not just the one in the address, from ESPN's all-competition schedule (`/all/teams/<id>/schedule?fixture=true`, one request), each labelled with its competition (Friendly, World Cup play-off, W Championship, UEFA Nations League…). Men's and women's national teams have different ids (Spain: 164 men, 17640 women) and the feed keeps them apart. A team counts as national if the page's competition is a women's international one or ESPN flags it `isNational` (it doesn't flag every women's team: Chile, Peru, Uzbekistan aren't). Opponent links go to that match's competition. Results, form and head to head stay with the page's competition.
- **Men's teams:** opponents in men's matches link to pages for competitions the site doesn't list (`fifa.friendly`, `uefa.nations`, `concacaf.nations.league`…), headed with ESPN's competition name ("Men's International Friendly"). They have results, fixtures and head to head, but no picture (the illustrations draw women, and photos are keyed by women's team ids), squad or heatmaps (the player database only covers women's competitions).
- **Squad:** from the [[Player stats database]], sorted by minutes, with goals per 90 (270+ minutes) and progressive passes.
- **How they play:** every squad player's season data from `heat.json` added together: touches, shots, progressive passes (newest 120) and goal mouth. See [[Heatmaps]].
- **Head to head:** pick any opponent. See below.

## Head to head (`h2h.js`)
ESPN team schedules for the last five seasons (`/teams/<id>/schedule?season=YYYY`), filtered to finished meetings with the opponent. Shows the wins/draws/losses summary, goals and a list. Also in the match centre ("earlier league meetings"; the current match is excluded). It only covers the same competition, since schedules are per competition.
