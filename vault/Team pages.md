---
tags: [feature]
---
# Team pages

**One page per team, club or country**, whichever competition it's opened from: Chelsea's page is the same from the WSL tab and the Champions League tab. `team.html?id=<ESPN team id>&l=<league slug>` (`team-page.js`); `l` is optional and only sets the back link. Linked from the match centre's team names, the table, player pages and every result and fixture.

## Which competitions
ESPN's all-competition schedule (`/all/teams/<id>/schedule`, results, and `?fixture=true`, upcoming) names the competitions the team is playing in now: for Chelsea the WSL, the Champions League and its qualifying. It can come back empty (Barcelona's results did), so each competition the site covers is also asked for its own schedule. The competition in the address only counts when ESPN lists nothing current, so opening Spain from the 2023 World Cup tab gives this year's Spain, not the 2023 squad.

A club's **main competition** is its domestic league (WSL, Liga F, NWSL); otherwise it's the one in the address. The main competition sets the masthead and the hero record.

Women's clubs and national teams have their own ids, the same in every competition (Chelsea 19970 in the WSL and Champions League; Spain women 17640). Men's teams have different ids (Spain men 164) and the feed keeps them apart. A team counts as national if one of its competitions is a women's international one or ESPN flags it `isNational` (it doesn't flag every women's team: Chile, Peru, Uzbekistan aren't).

## Sections
- **Hero:** team photo or illustration ([[Photos and licensing]]), crest, the team's competitions, record in the main competition (position, points, played, record, goals, zone), a club's position in its other tables ("Champions League 3rd"), last-five form across all competitions.
- **Season forecast:** one block per competition with a `forecast.json` (WSL, Liga F, Champions League). See [[Season forecast]].
- **Results and fixtures:** every competition, ten each, newest results and soonest fixtures first. When a team plays in more than one competition, each row is labelled and colour-coded (a tinted label and a bar down the row's left edge; the main competition is blue, then orange, teal, purple: `--k0`…`--k3`). Labels are short: site competitions use NAMES; others use ESPN's name without the confederation ("Nations League", "World Cup"), with qualifiers and friendlies shortened ("Champions League qualifier", "World Cup qualifier", "Friendly").
- **Squad:** from the [[Player stats database]], every competition's numbers added together (apps, minutes, goals, assists, shots, progressive passes, cards), sorted by minutes. A player links to the competition she's played most minutes in.
- **How they play:** every squad player's data from each competition's `heat.json` added together (all grids are 24 × 16). A note says which competitions it's from and which have none (Liga F's play-by-play has no pitch positions). See [[Heatmaps]].
- **Head to head:** see below.

## Men's teams
Reached from men's national teams' fixtures (opponents in the Nations League, men's friendlies…) and, for clubs, from a men's national team player's page ("Club", from his ESPN profile). Competitions the site doesn't list take ESPN's names. They have results, fixtures and head to head (in the database's competitions, World Cup qualifying included; every competition for teams outside the database); instead of a picture, a panel in the team's colours with the crest (the illustrations draw women, and photos are keyed by women's team ids). Men's national teams have a squad and heatmaps from the men's competitions in the [[Player stats database]] (friendlies, World Cup, World Cup qualifying from 2025, Nations Leagues, AFCON and its qualifying); a player links to his own page, with a portrait where a free one exists. Men's clubs in the Premier League, LaLiga and the Champions League have the same, with their league record and Champions League position; other men's clubs (Bundesliga, Serie A, MLS…) have results, fixtures and head to head but no squad. A men's club id is the same in each of its competitions (Arsenal 359 in the Premier League and Champions League).

## Head to head (`h2h.js`)
ESPN team schedules for the last five seasons (`/teams/<id>/schedule?season=YYYY`), filtered to finished meetings with the opponent, in every one of the team's site competitions (or every competition, for men's teams), merged and labelled. Shows the wins/draws/losses summary, goals and a list. The opponent picker lists every team in those tables and schedules, starting on the next opponent. Also in the match centre ("earlier league meetings"; the current match is excluded), where it covers that one competition.
