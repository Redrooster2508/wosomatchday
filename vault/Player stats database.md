---
tags: [data, players]
---
# Player stats database

Built by `tools/build_players.py` from ESPN match sheets ([[Data sources (ESPN)]]).

## Files
- `data/<slug>/matches.json`: `{updated, stats, matches: {<event id>: {date, home, away, score, teams, players[]}}}`. Each player line is `{id, name, team, pos, no, start, s: [G, A, SHOT, SOG, SV, GA, YC, RC, FC, FA, OG], conceded}`.
- `data/<slug>/players.json`: season totals per player, plus `teams` with name, abbreviation, logo and colour.

## Competitions
Women's: the four club competitions and the ten international ones the hub has tabs for. **Men's national teams** (since build 23, for their team and player pages): `fifa.friendly`, `fifa.world` (2026), `uefa.nations` (2026-27), `concacaf.nations.league` (2026-27), `caf.nations_qual` (AFCON 2027 qualifying), `caf.nations` (AFCON 2025, played Dec 2025–Jan 2026). World Cup qualifying is left out: it finished in 2025 outside Europe and in March 2026 in Europe. Men's clubs aren't covered (their ESPN ids collide in the all-competition feed, see [[Team pages]]).

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
