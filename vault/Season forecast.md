---
tags: [feature, model]
---
# Season forecast

`tools/build_forecast.py` → `data/<league>/forecast.json`, shown as **Season forecast** on the hub.

## Method
- Current table and every remaining fixture from ESPN ([[Data sources (ESPN)]]).
- Team attack and defence from this season's goals per game against the league average, eased toward average by **8 games** of average form. Home ×1.12, away ×0.9.
- **10,000 simulations.** In each one, every team's strength gets its own random spread (σ = 0.15 on a log scale) to allow for uncertainty, then every fixture is played out with Poisson goals. Ties are broken by points, goal difference, goals scored, then at random.
- Output: title chance, projected points, the full finishing-position distribution, and the chance of each zone.

## Zones
Taken from the notes in ESPN's table (e.g. WSL: Champions League 1st–2nd, qualifying 3rd, relegation playoff **12th**, as ESPN marks it). The Champions League league phase uses fixed zones: 1st–4th straight to the quarter-finals, 5th–12th knockout play-offs. Column headings show the positions.

## Calibration
The first version used 3 games of easing and no strength spread. It gave Barcelona 99.96% in Liga F with a two-point lead, and Chelsea 89% while level on points. That was far too sure, so the easing and spread were added. Results on 2026-11-06:

| League | Favourite | Next |
|---|---|---|
| WSL | Chelsea 73% | Man City 21% |
| Liga F | Barcelona 97% | Real Madrid 2% |
| Champions League (top spot) | Barcelona 74% | Lyonnes 13% |
| NWSL (playoffs, from [[Bracket]]) | Gotham 25% | San Diego 23% |

Barcelona stay high in Liga F because their goal record is far ahead, despite the small points gap.

## Not covered
- Champions League **overall** winner: the knockout draw isn't known yet.
- National-team tournaments: not forecast yet. See [[National teams]].
