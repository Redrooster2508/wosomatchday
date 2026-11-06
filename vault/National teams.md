---
tags: [feature, data]
---
# National teams

The **National teams** tab with a competition picker. Each competition uses the same machinery as the club leagues.

| Key | ESPN code | Status (Nov 2026) |
|---|---|---|
| friendlies | `fifa.friendly.w` | 122 matches in 2026, 28 to come |
| wcq | `fifa.wwcq.ply` | World Cup qualifying play-offs from 28 Nov |
| wchamp | `concacaf.womens.championship` | From 27 Nov |
| wafcon | `caf.w.nations` | Finished Aug 2026 (Cameroon won) |
| asian | `afc.w.asian.cup` | Finished Mar 2026 |
| wwc, weuro, copa, olympics, wnl | `fifa.wwc`, `uefa.weuro`, `conmebol.america.femenina`, `fifa.w.olympics`, `uefa.w.nations` | No matches in 2026; World Cup 2027 in Brazil |

Codes were found from ESPN's competition list (`sports.core.api.espn.com/v2/sports/soccer/leagues?limit=1000`); several guessed codes returned 400.

## Past editions
For tournaments with no 2026 matches, ESPN's current season is the latest edition, so the player database holds the **2023 World Cup** (64 matches), **Euro 2025** (31), **2024 Olympics** (26), **Copa América 2025** (25) and the **2025 Nations League** (170).

## Heatmap coverage
Play-by-play with pitch positions exists for friendlies, the World Cup, Euro, Olympics, Copa América and Asian Cup. **Not** for the Africa Cup of Nations (like [[Heatmaps|Liga F]]).

## What's different from club leagues
- **Group tables:** standings come back as several groups, so the table renders one block per group. Friendlies have no table, so that section is hidden.
- **Brackets:** matches are assigned to rounds by ESPN's round tag (`season.slug`: `quarterfinals`, `semifinals`, `final`), not by dates; the phase dates overlap. Groups, 3rd-place matches and play-ins are left out. Each round is ordered so feeder ties sit together, and group positions aren't shown as seeds.
- **Probabilities:** most friendlies have no odds, so teams are rated on goals for and against in every international match this year in the [[Player stats database]]. Teams with no results fall back to league-average rates, and the page says so.
- **Crests:** smaller nations have no logo in the feed, so a small abbreviation badge stands in.
- Player stats and heatmaps are built for international competitions too.
