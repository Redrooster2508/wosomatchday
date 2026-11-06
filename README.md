# Women's Matchday Hub

Live scores, match statistics and win probabilities for the WSL, Liga F, NWSL and Women's Champions League.

A static site with no build step and no server. The browser reads ESPN's public soccer feed directly, every 30 seconds while a match is live.

## What it shows

- Matches for the selected matchday: live score and clock, plus a home/draw/away probability bar
- Match centre:
  - team photos (an illustrated line-up in club colours, or your own upload) with crests
  - win, draw and loss chances with fair odds
  - expected goals
  - final-score probability grid
  - over/under, both teams to score and clean sheets
- Win probability by minute, replayed from the goal and red-card timeline
- Match stats (possession, shots, passes, saves, cards and more) and the event timeline
- League table with qualification and relegation zones
- Bracket for knockout rounds:
  - NWSL playoffs, with each team's title chances worked out through the bracket
  - Champions League knockouts, with a projection from the league-phase table until they start

## How the probabilities work

`model.js` holds the model as pure functions:

1. **Market rates.** When bookmaker moneyline odds are listed, the margin is removed and two goal rates are fitted so that a Poisson model reproduces the market's home and away win chances.
2. **Form rates.** When odds are missing (common in Liga F), the goal rates come from goals scored and conceded per game against the league average. They're shrunk toward average early in the season and include home advantage.
3. **Scorelines.** Independent Poisson goals with the Dixon–Coles low-score correction (ρ = −0.08).
4. **In play.** Only the time left is simulated, on top of the current score, assuming 96 minutes including stoppage time. A red card cuts that side's rate by 25% and raises the opponent's by 15%.

## Run locally

Any static file server works:

```sh
python3 -m http.server 8000
# open http://localhost:8000/#wsl  (or #ligaf, #nwsl, #ucl)
```

## Publish on GitHub Pages

Push this folder to a GitHub repository, then go to **Settings → Pages → Deploy from a branch → `main` / root**. The site appears at `https://<user>.github.io/<repo>/`.

## Team photos

The match centre shows the first of these that exists:

1. A photo the viewer uploaded. This is saved only in their own browser.
2. A shared photo listed in `photos/manifest.json`. Every visitor sees these.
3. An illustrated squad line-up in the club's colours.

`tools/fetch_photos.py` fills `photos/` from Wikimedia Commons. It only takes freely licensed images (CC BY, CC BY-SA, CC0 or public domain), and records each photographer and licence so the site can credit them under the photo. Commands:

```sh
python3 tools/fetch_photos.py               # teams without a photo yet
python3 tools/fetch_photos.py --force 19970 # search again for one team (ESPN team id)
python3 tools/fetch_photos.py --skip 19970  # keep the illustration for this team
```

To add your own photo, put the file in `photos/` and add an entry to `manifest.json`:

```json
"19970": {"file": "19970.jpg", "credit": "Photographer, licence", "source": ""}
```

Only add photos you have the right to publish.

## Data

The data comes from ESPN's public site API (`site.api.espn.com`). It's unofficial and undocumented, so its fields can change without notice. Odds are shown for analysis only.
