---
tags: [log]
---
# Changelog

Newest first. Commit ids link the change to the repository history. The narrative is in [[Log/2026-11-06]], [[Log/2026-11-09]] and [[Log/2026-11-11]].

## Unreleased (local, not pushed)
- Nothing yet

## 2026-11-13 · Men's team photos, player competition links, phone tabs (build 25)
- 32 men's teams have freely licensed team photos (12 clubs, 20 World Cup teams), reviewed by eye; the rest keep the crest panel
- A player page links to every competition the player is in, with appearances
- On phones the competition tabs scroll in one row; wide tables show a shadow where there's more to scroll; the match centre's head to head no longer stretches across the card
- A player's initials show cleanly while the photo loads (dark initials for white or pale team colours)

## 2026-11-11 · Men's clubs, World Cup qualifying, smaller data (build 24)
- Men's clubs in the Premier League, LaLiga and the Champions League have squads, heatmaps and player pages; a men's national team player's page names his club and links to it
- World Cup qualifying from 2025 (all five confederations) is in the player database, so national team squads and player pages include it
- Match sheets are stored as rows, with names and teams listed once per file: half the size (6.2 → 2.9 MB), with identical season totals. Heatmap spots are whole numbers (1% of the pitch), about 10% smaller

## 2026-11-11 · Men's national team players (build 23)
- Men's national teams have squads, heatmaps and player pages: the player database now also covers men's friendlies, the 2026 World Cup, the UEFA and Concacaf Nations Leagues, AFCON 2025 and AFCON qualifying
- Men's player pages look for a freely licensed portrait the same way as women's (male Wikidata entries, 2023 or later), say "his" and "he", and link back to his national team

## 2026-11-11 · One page per team (build 22)
- A team has one page whichever competition it's opened from: Chelsea's shows WSL and Champions League results and fixtures together, its WSL record and Champions League position, both forecasts, and a squad, heatmaps and head to head covering both
- Results and fixtures are colour-coded by competition, with short labels ("Nations League", "World Cup qualifier"); both lists show ten
- Men's teams get a panel in their colours with the crest instead of an empty space; head to head no longer stretches across the card

## 2026-11-10 · Men's national teams too (build 21)
- A national team's fixtures now come from ESPN's all-competition schedule, so men's teams get theirs too: Spain men show UEFA Nations League v Czechia and England, then a friendly v Chile, each labelled
- Pages for men's competitions the site doesn't list open instead of saying "Team not found", without the drawn squad picture, squad or heatmaps

## 2026-11-10 · National team fixtures from every competition (build 20)
- A national team's page lists upcoming matches from all women's international competitions (friendlies, World Cup play-offs, Concacaf W Championship and the rest), each labelled with its competition under the date
- Before, it only showed the competition in the address: the United States' friendlies page showed no fixtures although they play El Salvador in the W Championship on 28 Nov
- Long opponent names (Papua New Guinea) wrap onto a second line in a team's results and fixtures instead of being cut off on phones

## 2026-11-09 · Men's stories filtered out of the news (build 19)
- ESPN's women's news feeds include men's stories; the news card now drops stories tagged with a men's league or a men's club, and video clips with nothing women's about them (no player tag, no women's wording, no player from the competition named)
- The feed is asked for 25 stories, so five are still left after filtering

## 2026-11-06 · Team photo framing (build 18)
- Photos can carry framing in `photos/manifest.json`: `"pos": "50% 20%"` moves the card's crop, `"fit": "whole"` shows a tall photo in full on a blurred copy of itself
- Utah Royals (a tall single-player portrait, cropped through her eyes) now shows whole; Brighton's line-up no longer loses heads

## 2026-11-06 · Four more team photos
- Arsenal, West Ham, Benfica and Real Madrid now have freely licensed photos from 2023–2025, found by the Commons sub-folder search; 33 clubs have photos

## 2026-11-06 · Illustrated squads drawn as women (build 17)
- The stand-in team picture (for clubs with no free recent photo) now shows women: ponytails, top knots, long hair, braids, curls and bobs, hair ties in the second kit colour, simple faces
- Fix: a figure's arms and legs now match her face's skin tone

## 2026-11-06 · Player photos must show the player (build 16)
- Commons "depicts" tags are checked: a file tagged as showing something or someone else is skipped, a file tagged as her gets a bonus
- Portrait shape and tags now outweigh a year or two of recency (Bonmatí had a 2026 photo of a sign with her name on it; she now gets her 2024 portrait)

## 2026-11-06 · Player career history and birthplace (build 15)
- Player pages get a **Career** section: every club and national team from Wikidata, with years, country, and appearances and goals where recorded (with the date they were counted to)
- "Born in" fact (birthplace and country) and a Wikipedia link
- Wikidata lookup now matches ESPN's date of birth, so a namesake isn't picked; it also fixes Khadija Shaw, who wasn't found before
- Fix: ESPN dates of birth are day-first (8/2/1999 is 8 February)
- On phones the country and stats date sit under the team name, so the table fits at 360 px

## 2026-11-06 · Profile-style portraits; Getty dropped (build 14)
- Player photos are scored to look like a profile photo (head and shoulders, portrait shape, one player, newest)
- Player tiles fall back to starts and raw counts until a competition's minutes are built
- Getty embeds don't display in the user's browser (Getty's image server refuses it), so the idea is dropped and the test page removed

## 2026-11-06 · Team pages, head to head, passes, goal mouth, minutes (build 13)
- **Team pages** with forecast, results and fixtures, squad, team maps and head to head
- **Head to head** in the match centre and on team pages (last five seasons)
- **Progressive pass maps** and **goal-mouth charts** in the match centre, on player pages and on team pages
- **Minutes played** and **per-90** rates: player table columns, player tiles, per-90 percentiles, minutes in match logs
- `heat.json` v3: passes, goal-line spots and minutes; corners and out-of-play passes don't count as progressive
- Getty Images embed test page (`getty-test.html`, not linked) to check whether Getty's free embeds display

## 2026-11-06 · Recent team photos
- 24 team photos from 2023–2026 picked by eye from 200 candidates (Commons and Openverse), with credits. 29 clubs now have a recent photo; the rest keep the illustration.

## 2026-11-06 · `a347ee4` / `d15e239` · Scheduled updates live
- The user added `.github/workflows/players.yml` on GitHub; its first run committed fresh data
- The builders now skip writing when nothing changed, so there are no empty commits every three hours

## 2026-11-06 · National teams and season forecasts (build 12)
- **National teams** tab: friendlies, World Cup qualifying play-offs, Concacaf W Championship, Africa Cup of Nations, Asian Cup, plus the World Cup, Euro, Copa América, Olympics and Nations League when active
- Group tables for tournaments; brackets placed by ESPN's round tags; national teams rated on this year's international results; badges for teams without crests
- Player stats and heatmaps for international competitions
- **Season forecast:** predicted winner, title and zone chances, projected points from 10,000 simulations (`tools/build_forecast.py`); NWSL from the playoff bracket
- Scheduled workflow now also builds forecasts (still to be added on GitHub)

## 2026-11-06 · Self-refreshing pages (build 11)
- Pages compare their build number with `version.json` and refresh once when the site has been updated. A user still saw the old blank heatmap from a cached page after the fix went live.

## 2026-11-06 · Firefox heatmap fix, recent portraits, measurements, time zones
- Heatmaps are now drawn as blurred SVG instead of canvas pixels. Firefox's fingerprinting protection can blank canvas pixel data; SVG renders in every browser and follows the theme.
- NWSL season heatmaps built
- Player portraits must be from 2023 or later: the main Wikidata image if it's recent, otherwise the newest suitable photo in the player's Commons category, otherwise initials. The credit shows the year.
- Height and weight in metric and imperial
- The hub names the viewer's time zone; every kick-off time was already in local time

## 2026-11-06 · WSL heatmaps; Liga F coverage note
- Season heatmaps and shot maps built for the WSL (281 players, 56 matches)
- Liga F: ESPN's play-by-play has no pitch positions, so the site says there's no heatmap instead of showing an empty one

## 2026-11-06 · Heatmaps; old photos removed
- **Match centre:** touch heatmap for either team or any player, and a shot map with both teams, refreshed every minute while live (`heat.js`)
- **Player pages:** season heatmap and shot map from `data/<league>/heat.json`, built by `tools/build_heat.py` (incremental)
- **Photos:** 17 team photos taken before 2023 removed (9 remain). The photo tools now refuse photos from before 2023.
- Fix: goal kicks were counted as goals in shot maps
- Fix: the heatmap panel shared an id with the score grid

## 2026-11-06 · `dba68e8` · Documentation
- README rewritten: features, files, model, database, photos, publishing
- This Obsidian vault: architecture, data sources, model, database, bracket, photos, testing, deployment, decisions, open issues, session log

## 2026-11-06 13:09 · `8199aba` · News, player stats, player pages
- News: five latest ESPN stories per competition, newest as a lead story
- Player stats database: `data/<league>/players.json` and `matches.json`, built by `tools/build_players.py` (incremental)
- Player table: search, club and position filters, sortable columns
- Player pages: Wikidata/Commons portrait with credit, ESPN profile, season numbers, league percentiles, per-match chart (goalkeepers get saves and goals conceded), match log
- Match-centre line-ups with each player's goals, assists, shots, saves and cards
- Photo tools: Commons and Openverse shortlists, `--pick` with full credit
- Fix: logos in table cells were sized as 0px wide, so text overlapped the next column
- Fix: the builder re-read every match instead of only new ones
- Fix: substitutes were recorded with position `SUB`

## 2026-11-06 12:33 · `6b0c765` · Housekeeping
- `.gitignore` for the Python cache and photo shortlist

## 2026-11-06 12:33 · `8312c3a` · Layout fixes from a real-browser check
- Fixture cards and bracket ties clip to their own width
- Version tags on CSS and JS
- League table: row lines align, club column takes the spare width
- Projection notes sit under their own list; "1 pt" not "1 pts"
- Bracket only requests rounds that have started, and says when loading fails
- Timeline leaves out injury-delay events

## 2026-11-06 12:09 · `7cc64e4` · Card width
- Long venue names cut off with "…" instead of pushing past the card edge

## 2026-11-06 11:53 · `70db716` · Champions League, bracket, team photos
- Women's Champions League tab
- NWSL playoff bracket with title chances; Champions League projection
- Date arrows jump between matchdays
- 26 freely licensed team photos from Wikimedia Commons, with credits
- Fix: empty timeline message wrapped one word per line

## 2026-11-06 11:15 · `a0e39d4` · First live version
- WSL, Liga F and NWSL from ESPN's public feed, polling every 30 s while live
- Match cards with live probabilities; match centre with probabilities, fair odds, score grid, win probability by minute, stats and timeline
- League tables; illustrated team photos with uploads
- Published to GitHub Pages

## 2026-11-06 · Prototype (claude.ai artifact)
- First version: a fictional 12-club league with drawn team photos, a Poisson matchup model, a score grid, a league table and an attack-vs-defence chart
