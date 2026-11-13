---
tags: [data, players]
---
# Player stats database

Built by `tools/build_players.py` from ESPN match sheets ([[Data sources (ESPN)]]).

## Files
- `data/<slug>/matches.json` (layout `v: 2`, build 24): `{v, updated, stats, row, names: {<athlete id>: name}, teams: {<id>: {name, abbr, logo}}, matches: {<event id>: {date, home, away, score, players[]}}}`. Each player line is a row, `[id, team, pos, no, start, G, A, SHOT, SOG, SV, GA, YC, RC, FC, FA, OG]` (the `row` field names the columns). Names and teams are listed once per file instead of in every match, and goals conceded come from the score. That halved the match sheets (6.2 → 2.9 MB across all competitions). Older files are converted on the next build without re-reading any match.
- `data/<slug>/players.json`: season totals per player, plus `teams` with name, abbreviation, logo and colour.
- `data/index/<n>.json` (build 25): `{<athlete id>: [[competition, apps], ...]}`, most appearances first, for the links to a player's other competitions on player pages. A player is in file `int(id) % 20`, so a page loads one file of about 25 KB instead of every competition. Written at the end of every build run; a file is only rewritten when it changed.

## Competitions
Women's: the four club competitions and the ten international ones the hub has tabs for. **Men's national teams** (since build 23, for their team and player pages): `fifa.friendly`, `fifa.world` (2026), `uefa.nations` (2026-27), `concacaf.nations.league` (2026-27), `caf.nations_qual` (AFCON 2027 qualifying), `caf.nations` (AFCON 2025, played Dec 2025–Jan 2026). World Cup qualifying is left out: it finished in 2025 outside Europe and in March 2026 in Europe. **World Cup qualifying** (build 24): the five confederations' `fifa.worldq.*`, from 2025 only (`SINCE` in the builder): the campaign started in 2023, and its early rounds would fill squads with old players. **Men's clubs** (build 24): `eng.1`, `esp.1`, `uefa.champions`, the leagues most national team players are in, reached from his player page. MLS (`usa.1`, 511 matches in 2026) is left out for size; adding it to `LEAGUES` in both builders is all it takes.

## Build
- Reads every finished match of the current season: whole-year scoreboards, filtered by season start and end dates.
- **Incremental:** match ids already stored are skipped, so later runs only read new results.
- A player is counted only if she started or came on.
- Position: the latest real position. A substitute's line says `SUB`, which is never recorded.
- Clean sheet: a goalkeeper who started and whose team conceded 0.

## Size (2026-11-13, compact layout)
All four files per competition (players, matches, heatmaps, minutes): **women's 5.4 MB, men's 13.3 MB**, plus 0.5 MB of player index. Before the compact match sheets (build 24) the same data would have been about 25 MB.

| Competition | Players | Matches | Size |
|---|---|---|---|
| WSL | 287 | 63 | 0.7 MB |
| Liga F | 356 | 79 | 0.3 MB |
| NWSL | 405 | 244 | 1.6 MB |
| Women's Champions League | 368 | 36 | 0.5 MB |
| Men's friendlies | 3,802 | 342 | 2.6 MB |
| Men's World Cup 2026 | 1,039 | 104 | 1.4 MB |
| UEFA Nations League | 1,272 | 112 | 1.6 MB |
| World Cup qualifying, Europe (2025–26) | 1,590 | 204 | 1.1 MB |
| Premier League | 459 | 100 | 1.0 MB |
| LaLiga | 490 | 119 | 1.2 MB |
| Men's Champions League | 763 | 72 | 1.0 MB |

## Keeping it current
`.github/workflows/players.yml` runs the player, heatmap and forecast builders every three hours and commits only real changes. **Live since 2026-11-06**; the first run succeeded. See [[Deployment]].

## Used by
- Player table on the hub (`players.js`)
- Player pages (`player-page.js`): percentiles among players with 3+ appearances, with goalkeepers compared to goalkeepers
