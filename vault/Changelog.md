---
tags: [log]
---
# Changelog

Newest first. Commit ids link the change to the repository history. The narrative is in [[Log/2026-11-06]].

## Unreleased (local, not pushed)
- `.github/workflows/players.yml`: scheduled rebuild of player stats and heatmaps, refused by GitHub (the token has no `workflow` scope)
- Recent (2023+) team photo shortlist from Commons and Openverse, under review

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
