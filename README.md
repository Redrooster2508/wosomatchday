# Women's Matchday Hub

Live scores, match statistics, win probabilities, season forecasts and player stats for the **WSL**, **Liga F**, **NWSL**, **Women's Champions League** and **national teams** (friendlies, World Cup qualifying, Concacaf W Championship, Africa Cup of Nations, Asian Cup, and the World Cup, Euro, Copa América and Olympics when they're on).

**Live site:** https://redrooster2508.github.io/wosomatchday/ (add `#wsl`, `#ligaf`, `#nwsl` or `#ucl` to open one competition)

A static site with no build step and no server. Visitors' browsers read ESPN's public soccer feed directly, every 30 seconds while a match is live. The player stats database is a set of JSON files in this repository, rebuilt from finished matches by a script.

Project notes, decisions and the change log are in the Obsidian vault in [`vault/`](vault/). Open that folder as a vault in Obsidian, or read the Markdown files on GitHub.

## What it shows

| Section | What's in it |
|---|---|
| Matches | Each match on the selected matchday: live score and clock, plus a home/draw/away probability bar. The arrows jump between matchdays. Times are in the viewer's own time zone, which is named on the page. |
| Match centre | Team photos with crests; win, draw and loss chances with fair odds; expected goals; a final-score probability grid; over/under, both teams to score and clean sheets; win probability by minute; match stats; **touch heatmap** for either team or any player and a **shot map**, updating every minute while live; line-ups with each player's numbers; the event timeline |
| News | The five latest ESPN stories for the competition |
| Season forecast | Predicted winner and each team's chance of the title and each table zone, from 10,000 simulations of the remaining fixtures (NWSL: from the playoff bracket) |
| Bracket | NWSL playoffs with title chances worked out through the bracket. Champions League knockouts, projected from the league-phase table until they start. |
| League table | Standings with qualification and relegation zones, goals scored and conceded per game |
| Player stats | Season table for every player: search, club and position filters, sortable columns |
| Player pages | `player.html?l=<league>&id=<ESPN player id>`: portrait, profile, season numbers, league percentiles, a per-match chart, **season heatmap and shot map**, and the full match log |

## Files

| File | Purpose |
|---|---|
| `index.html`, `styles.css` | The hub page and all styles (light and dark themes) |
| `app.js` | Loads the feed, polls during live matches, renders the hub |
| `model.js` | Probability model: pure functions, testable without a browser |
| `tools/build_forecast.py` | Season forecasts (`data/<league>/forecast.json`) |
| `bracket.js` | Knockout bracket, title chances, pre-knockout projection |
| `players.js` | Player stats table and match-centre line-ups |
| `heat.js` | Pitch drawing, touch heatmaps and shot maps from play-by-play |
| `player.html`, `player-page.js` | Individual player pages |
| `photos.js` | Team photos: uploaded, shared (`photos/manifest.json`) or illustrated |
| `data/<league>/` | Player stats database (`players.json`, `matches.json`, `heat.json`) |
| `photos/` | Shared team photos and `manifest.json` with credits |
| `tools/` | Scripts that build the database and find photos |
| `vault/` | Obsidian vault: project notes and change log |

## How the probabilities work

1. **Market rates.** When bookmaker moneyline odds are listed, the margin is removed and two goal rates are fitted so a Poisson model reproduces the market's home and away win chances.
2. **Form rates.** When odds are missing (common in Liga F), the rates come from goals scored and conceded per game against the league average. They're shrunk toward average early in the season and include home advantage.
3. **Scorelines.** Poisson goals with the Dixon–Coles low-score correction (ρ = −0.08).
4. **In play.** Only the time left is simulated, on top of the current score, assuming 96 minutes including stoppage time. A red card cuts that side's rate by 25% and raises the opponent's by 15%.
5. **Season forecasts.** `tools/build_forecast.py` plays out every remaining fixture 10,000 times. Team strength comes from this season's goals, eased toward average by 8 games' worth of league-average form, with home advantage and a per-simulation strength spread (σ = 0.15 on a log scale) to allow for uncertainty.
6. **National teams.** Most friendlies have no odds, so teams are rated on goals for and against in every international match this year in the database.
7. **Brackets.** Title chances combine each tie's chance to advance through the bracket. A level score after 90 minutes is split by relative strength.

"Draw" always means level after 90 minutes.

## Player stats database

`tools/build_players.py` reads every finished match of the current season from ESPN's match sheets and writes, for each competition:

- `data/<league>/matches.json`: every finished match, with each player's line (goals, assists, shots, shots on target, saves, goals conceded, cards, fouls, own goals)
- `data/<league>/players.json`: season totals per player, plus club names, logos and colours

`tools/build_heat.py` then reads each match's play-by-play (about 1,500 events with pitch coordinates) and writes `data/<league>/heat.json`: each player's touches on a 24 × 16 grid in her attacking direction, plus every shot with its spot and outcome. ESPN's Liga F play-by-play has no pitch positions, so Liga F has no heatmaps.

Both only fetch matches they haven't stored yet.

```sh
python3 tools/build_players.py              # all four competitions
python3 tools/build_players.py usa.nwsl     # one competition
python3 tools/build_players.py --rebuild    # read every match again
python3 tools/build_heat.py                 # season heatmaps (after build_players)
```

**Automatic updates:** the workflow file `.github/workflows/players.yml` runs both scripts every three hours and commits any changes. It is not in the repository yet, because the access token used to push can't add workflows. Add it through GitHub's web editor (**Add file → Create new file**), or give the token the `workflow` scope.

## Photos

**Team photos.** The match centre shows the first of these that exists:

1. A photo the viewer uploaded. This is saved only in their own browser.
2. A shared photo listed in `photos/manifest.json`. Every visitor sees these.
3. An illustrated squad line-up in the club's colours.

Shared photos are chosen by hand from a shortlist:

```sh
python3 tools/photo_candidates.py      # shortlist from Wikimedia Commons
python3 tools/openverse_candidates.py  # add Flickr and other Creative Commons sites, via Openverse
python3 tools/fetch_photos.py --pick 19970="File:Example.jpg"   # use a Commons file
python3 tools/fetch_photos.py --pick 19970=ov:<openverse id>    # use an Openverse result
python3 tools/fetch_photos.py --skip 19970                      # keep the illustration
```

**Player portraits.** A player page looks the player up on Wikidata. If she has a freely licensed portrait on Wikimedia Commons, the page shows it; otherwise it shows her initials in club colours. ESPN has no headshots for women players.

**Recency.** Team photos must have been taken in **2023 or later**, going by the camera's recorded date or, failing that, a year in the title. Older photos show old squads and kits. The shortlist tools and `--pick` enforce this.

**Licences.** Every photo shows its photographer, licence and source site. Only freely licensed images are used: CC BY, CC BY-SA, CC0, public domain, and, because the site is non-commercial, CC BY-NC and CC BY-NC-SA. Crediting a photographer doesn't make a copyrighted photo free to use, so photos from club or news sites are not used.

## Run locally

```sh
python3 -m http.server 8000
# open http://localhost:8000/#wsl
```

## Publishing

GitHub Pages serves the `main` branch root and lets browsers cache files for 10 minutes. On each release, raise the build number in three places: the `?v=` tags on CSS and JS links, the number at the end of the version-check script in `index.html` and `player.html`, and `version.json`. Pages that find a newer `version.json` reload themselves once.

## Data

ESPN's public APIs (`site.api.espn.com`, `site.web.api.espn.com`, `sports.core.api.espn.com` for play-by-play) supply scores, stats, line-ups, odds, standings, news and player profiles. It's unofficial and undocumented, so its fields can change without notice. Odds are shown for analysis only.
