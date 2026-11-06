---
tags: [data, players]
---
# Player stats database

Built by `tools/build_players.py` from ESPN match sheets ([[Data sources (ESPN)]]).

## Files
- `data/<slug>/matches.json`: `{updated, stats, matches: {<event id>: {date, home, away, score, teams, players[]}}}`. Each player line is `{id, name, team, pos, no, start, s: [G, A, SHOT, SOG, SV, GA, YC, RC, FC, FA, OG], conceded}`.
- `data/<slug>/players.json`: season totals per player, plus `teams` with name, abbreviation, logo and colour.

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
`.github/workflows/players.yml` runs the builder every three hours and commits changes. **Not pushed yet**: the access token lacks the `workflow` scope. See [[Known issues and next steps]].

## Used by
- Player table on the hub (`players.js`)
- Player pages (`player-page.js`): percentiles among players with 3+ appearances, with goalkeepers compared to goalkeepers
