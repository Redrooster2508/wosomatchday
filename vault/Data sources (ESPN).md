---
tags: [data, espn]
---
# Data sources (ESPN)

Unofficial and undocumented, so fields can change without notice.

## News feed caveat
`/news` for a women's competition can include men's stories (pundit clips auto-tagged with the women's fixture, stories also tagged with men's leagues or clubs). The hub filters them; see [[Log/2026-11-09]].

## Leagues
| Site key | ESPN slug |
|---|---|
| `wsl` | `eng.w.1` |
| `ligaf` | `esp.w.1` |
| `nwsl` | `usa.nwsl` |
| `ucl` | `uefa.wchampions` |

## Endpoints used
| Purpose | URL |
|---|---|
| Matches for a day | `site.api.espn.com/apis/site/v2/sports/soccer/<slug>/scoreboard?dates=YYYYMMDD` |
| Whole year of matches | `…/scoreboard?dates=YYYY&limit=1000` |
| Match detail: stats, line-ups, events, odds | `…/summary?event=<id>` |
| League table | `site.api.espn.com/apis/v2/sports/soccer/<slug>/standings` |
| News | `…/<slug>/news` |
| Season goal and assist leaders | `…/<slug>/statistics` |
| Play-by-play with pitch coordinates | `sports.core.api.espn.com/v2/sports/soccer/leagues/<slug>/events/<id>/competitions/<id>/plays?limit=1000&page=N` |
| Player profile | `site.web.api.espn.com/apis/common/v3/sports/soccer/athletes/<id>` |

## Quirks found
- **Date ranges fail.** `dates=YYYYMMDD-YYYYMMDD` returns HTTP 400. Use single days or a whole year (`dates=2026`).
- **Fixture calendars differ.** WSL and Liga F list every match date (`calendarType: day`). NWSL and the Champions League only list phases (`calendarType: list`), so the date arrows scan ahead a week at a time.
- **Headless browsers are blocked.** Requests from headless Chrome get 403 with no CORS headers. Real browsers are fine. See [[Testing]].
- **Odds are patchy.** WSL, NWSL and Champions League matches usually carry DraftKings moneylines; Liga F often has none, so the [[Probability model]] falls back to season goals.
- **No women's headshots.** `a.espncdn.com/i/headshots/soccer/players/full/<id>.png` returns 404 for women players. See [[Photos and licensing]].
- **Own goals.** In the scoreboard's event list the credited side isn't reliable, so the timeline replay flips own goals if the replayed score doesn't match the real one.
- **Season leaders text.** `displayValue` reads like `Matches: 6, Goals: 6`; the last number is the stat.
- **Event type names overlap.** "Goal Kick" starts with "Goal"; match exact names. See [[Heatmaps]].
- **Liga F play-by-play has no coordinates**: only key events. See [[Heatmaps]].
- **Play-by-play paging:** `limit=1000` works, so 2 pages per match.
- **No expected-goals (xG) data.** The feed has no xG, so probabilities come from odds or goals.
