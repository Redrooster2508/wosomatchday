---
tags: [feature, data]
---
# Heatmaps

Built from ESPN's play-by-play ([[Data sources (ESPN)]]): about 1,500 events per match, each with pitch coordinates.

## Coordinates
- `fieldPositionX` 0–100: own goal → opponent goal, **for the team making the play**
- `fieldPositionY` 0–100: 100 = the attacking side's **left** (checked against "shot from the left side of the box" at y≈66)
- Shots also have `goalPositionY` and `goalPositionZ`: where they crossed the goal line. Not used yet.
- Drawn on a 105 × 68 m pitch. The away side is mirrored so it attacks left on the shared shot map.

## What counts
- **Touches:** every play with a spot, except non-actions and repeats (substitutions, delays, half markers, kick-off, "Out", "Corner Awarded", "Assist", "Assists Shot").
- **Shots:** `Goal` and `Goal - …` (but **not "Goal Kick"**, see below), `Shot On Target`, `Shot Off Target`, `Shot Blocked`, `Penalty - Saved` / `Missed`. Own goals excluded.

## Match centre (`heat.js`)
- Touch heatmap for either team, or any player who played (picked from a list). Always drawn attacking right.
- Shot map with both teams: home attacking right, away attacking left. Markers: goal (large), saved (filled), off target (ring), blocked (cross). Hover for player and minute.
- Play-by-play is fetched when a match is opened (2 requests, about 110 KB compressed) and refreshed every minute while live.

## Player pages (`data/<league>/heat.json`)
- `tools/build_heat.py` adds up each player's touches on a **24 × 16 grid** and keeps every shot (spot, outcome, opponent, date). Incremental, like the [[Player stats database]].
- The page draws the grid as a smoothed heatmap and a season shot map.

## Coverage
| League | Pitch positions |
|---|---|
| WSL | Yes |
| NWSL | Yes |
| Champions League | Yes |
| Liga F | **No**: only goals, cards and substitutions (about 16 events per match), no coordinates |

The site says so on Liga F match centres and player pages.

## Passes, goal mouth and minutes (heat.json v3)
- **Progressive passes:** `Pass` or `Cross` ending at least 25% closer to the opponent's goal and in the attacking half. **Corners** (starting on the goal line) and passes **ending on the goal line** (mostly out of play) are excluded. That was added in v3, after a match-centre check showed 74 "progressive" passes for one side. ESPN doesn't mark completed passes, so these are attempts.
- **Goal mouth:** `goalPositionY` (posts at about 44.6 and 55.4) and `goalPositionZ` (crossbar at about 38). Drawn from the shooter's side, so the attacker's left is on the left; very high shots are pinned to the top edge.
- **Minutes:** starters (from `matches.json`) from 0'; `Substitution` plays carry participants typed `subbed-in` and `subbed-out` with the clock; red cards end a player's match. A match lasts 90 minutes (120 with extra time); stoppage time isn't counted, which is standard practice. Per-90 rates need 270+ minutes.
- **Rounding** (build 24): touch and shot spots are stored as whole numbers on the 0–100 scale (1% of the pitch); pass ends are rounded down, so a pass ending at 98.6 stays short of the goal line where the maps cut off. That saved about 10%.
- The builder rebuilds everything when the file version changes (v1 → v2 for these fields, v2 → v3 for the pass rule).

## Gotchas
- **Firefox blank heatmap.** The heat layer was first drawn as canvas pixels. In a user's Firefox it stayed blank while the shot map showed, most likely because fingerprinting protection blanks canvas pixel data. Now drawn as SVG cells with a Gaussian blur, tested in Chrome, Firefox, and Firefox with protection on.
- **"Goal Kick" starts with "Goal".** The first version counted every goal kick as a goal: Aston Villa showed 21 shots on target instead of 1. Now only `Goal` or `Goal - …` count.
- **ID clash:** the first panel used `id="heat"`, already used by the score-probability grid, so both drew into the same box. Renamed to `pitchHeat`.
- **Play-by-play vs match sheet:** counts can differ slightly. Russo's Champions League goals are 4 on the match sheet but 3 goal events in the play-by-play. See [[Known issues and next steps]].
