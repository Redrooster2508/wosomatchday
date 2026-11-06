---
tags: [architecture]
---
# Architecture

A static site served by GitHub Pages ([[Deployment]]). No build step, no server.

## Live data in the browser
Each visitor's browser calls ESPN's public API directly ([[Data sources (ESPN)]]). ESPN allows requests from any website, so no proxy is needed.

Polling in `app.js`:
- every **30 s** while any match on screen is live
- every **60 s** when a match kicks off within 3 hours
- every **5 min** otherwise
- paused while the tab is hidden

## Files
| File | Role |
|---|---|
| `index.html`, `styles.css` | Hub page, light and dark themes |
| `app.js` | Feed loading, polling, fixtures, match centre, table, news |
| `model.js` | [[Probability model]]: pure functions |
| `bracket.js` | [[Bracket]] and title chances |
| `players.js` | Player table and match-centre line-ups |
| `player.html`, `player-page.js` | Player pages |
| `photos.js` | Team photos ([[Photos and licensing]]) |
| `data/<league>/` | [[Player stats database]] |
| `tools/*.py` | Database builder and photo tools |

## Data that isn't live
The [[Player stats database]] is JSON in the repository, rebuilt by `tools/build_players.py`. Pages fetch it from the same site.

## Per-viewer storage
`localStorage` keeps only conveniences: the last league viewed and photos a viewer uploaded. Every read and write is wrapped so the site works without it.
