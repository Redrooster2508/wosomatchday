---
tags: [data, players]
---
# Player stats database

Built by `tools/build_players.py` from ESPN match sheets ([[Data sources (ESPN)]]).

## Files
- `data/<slug>/matches.json` (layout `v: 2`, build 24): `{v, updated, stats, row, names: {<athlete id>: name}, teams: {<id>: {name, abbr, logo}}, matches: {<event id>: {date, home, away, score, players[]}}}`. Each player line is a row, `[id, team, pos, no, start, G, A, SHOT, SOG, SV, GA, YC, RC, FC, FA, OG]` (the `row` field names the columns). Names and teams are listed once per file instead of in every match, and goals conceded come from the score. That halved the match sheets. Older files are converted on the next build without re-reading any match.
- `data/<slug>/players.json`: season totals per player, plus `teams` with name, abbreviation, logo and colour.
- `data/index/<n>.json` (build 25): `{<athlete id>: [[competition, apps], ...]}`, most appearances first, for the links to a player's other competitions on player pages. A player is in file `int(id) % 20`, so a page loads one file of about 25 KB instead of every competition. Written at the end of every build run; a file is only rewritten when it changed.

## Competitions
The four club competitions and the ten international ones the hub has tabs for. From build 23 to 28 the database also held men's national teams and clubs, for men's team and player pages; on 2026-11-23 they were removed, because the men's site (`Redrooster2508/footie`) has its own database. See [[Log/2026-11-11]].

## Build
- Reads every finished match of the current season: whole-year scoreboards, filtered by season start and end dates.
- **Incremental:** match ids already stored are skipped, so later runs only read new results.
- A player is counted only if she started or came on.
- Position: the latest real position. A substitute's line says `SUB`, which is never recorded.
- Clean sheet: a goalkeeper who started and whose team conceded 0.

## Size (2026-11-23, compact layout)
All four files per competition (players, matches, heatmaps, minutes): **6.0 MB** across the fourteen competitions, plus 0.14 MB of player index. Before the compact match sheets (build 24) the same data would have been about twice that.

| Competition | Players | Matches | Size |
|---|---|---|---|
| WSL | 295 | 77 | 0.8 MB |
| Liga F | 366 | 94 | 0.3 MB |
| NWSL | 405 | 247 | 1.7 MB |
| Women's Champions League | 374 | 45 | 0.6 MB |

## Keeping it current
`.github/workflows/players.yml` runs the player, heatmap and forecast builders every three hours and commits only real changes. **Live since 2026-11-06**; the first run succeeded. See [[Deployment]].

## Used by
- Player table on the hub (`players.js`)
- Player pages (`player-page.js`): percentiles among players with 3+ appearances, with goalkeepers compared to goalkeepers
