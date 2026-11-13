---
tags: [data, players]
---
# Player stats database

Built by `tools/build_players.py` from ESPN match sheets ([[Data sources (ESPN)]]).

## Files
- `data/<slug>/matches.json` (layout `v: 2`, build 24): `{v, updated, stats, row, names: {<athlete id>: name}, teams: {<id>: {name, abbr, logo}}, matches: {<event id>: {date, home, away, score, players[]}}}`. Each player line is a row, `[id, team, pos, no, start, G, A, SHOT, SOG, SV, GA, YC, RC, FC, FA, OG]` (the `row` field names the columns). Names and teams are listed once per file instead of in every match, and goals conceded come from the score. That halved the match sheets (6.2 → 2.9 MB across all competitions). Older files are converted on the next build without re-reading any match.
- `data/<slug>/players.json`: season totals per player, plus `teams` with name, abbreviation, logo and colour.

## Competitions
Women's: the four club competitions and the ten international ones the hub has tabs for. **Men's national teams** (since build 23, for their team and player pages): `fifa.friendly`, `fifa.world` (2026), `uefa.nations` (2026-27), `concacaf.nations.league` (2026-27), `caf.nations_qual` (AFCON 2027 qualifying), `caf.nations` (AFCON 2025, played Dec 2025–Jan 2026). World Cup qualifying is left out: it finished in 2025 outside Europe and in March 2026 in Europe. **World Cup qualifying** (build 24): the five confederations' `fifa.worldq.*`, from 2025 only (`SINCE` in the builder): the campaign started in 2023, and its early rounds would fill squads with old players. **Men's clubs** (build 24): `eng.1`, `esp.1`, `uefa.champions`, the leagues most national team players are in, reached from his player page. MLS (`usa.1`, 511 matches in 2026) is left out for size; adding it to `LEAGUES` in both builders is all it takes.

## Build
- Reads every finished match of the current season: whole-year scoreboards, filtered by season start and end dates.
- **Incremental:** match ids already stored are skipped, so later runs only read new results.
- A player is counted only if she started or came on.
- Position: the latest real position. A substitute's line says `SUB`, which is never recorded.
- Clean sheet: a goalkeeper who started and whose team conceded 0.

## Size (2026-11-06)
| League | Players | Matches | Size |
|---|---|---|---|
| WSL | 283 | 56 | ~290 KB |
| Liga F | 353 | 72 | ~370 KB |
| NWSL | 404 | 240 | ~1.1 MB |
| Champions League | 355 | 27 | ~190 KB |

## Keeping it current
`.github/workflows/players.yml` runs the player, heatmap and forecast builders every three hours and commits only real changes. **Live since 2026-11-06**; the first run succeeded. See [[Deployment]].

## Used by
- Player table on the hub (`players.js`)
- Player pages (`player-page.js`): percentiles among players with 3+ appearances, with goalkeepers compared to goalkeepers
