---
tags: [model]
---
# Probability model

All in `model.js`, as pure functions.

1. **Market rates.** Convert the bookmaker's American moneylines to probabilities, remove the margin by scaling the three to sum to 1, then fit two Poisson goal rates whose home and away win chances match the market's. The fit is a coarse grid search, then refinement (about 36 ms).
2. **Form rates** (no odds): goals scored and conceded per game against the league average, shrunk toward average by `gp / (gp + 3)`, home ×1.12 and away ×0.9.
3. **Scorelines:** Poisson with the Dixon–Coles low-score correction, ρ = −0.08, goals 0–10.
4. **In play:** goals still to come = full rate × share of 96 minutes left, added to the current score. A red card scales that side's rate ×0.75 and the opponent's ×1.15.
5. **Win probability by minute:** replays goals and red cards through step 4 for each minute.
6. **Knockouts:** chance to advance = win + draw × (win share). See [[Bracket]].

## Checks
- DraftKings Chelsea v Everton: 80 / 12 / 8 market, 79.8 / 11.9 / 8.3 after fitting.
- 0–1 at 70 minutes swings to about 19 / 30 / 51.

## Decisions
- No neural network. The user didn't want one, and with roughly 130–240 matches a season, a neural net would overfit while market odds already include the information. See [[Decisions]].
