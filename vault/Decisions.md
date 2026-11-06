---
tags: [decisions]
---
# Decisions

| Date | Decision | Why |
|---|---|---|
| 2026-11-06 | First prototype used a **fictional league** | Real club names with invented stats would mislead |
| 2026-11-06 | **ESPN public API** for live data | No key, covers all four competitions, allows requests from any website, so a static site can poll it |
| 2026-11-06 | **Static site on GitHub Pages** | The user chose GitHub; live data still works because browsers fetch ESPN directly |
| 2026-11-06 | **No neural network** for odds | The user didn't want one; small samples; market odds are a strong baseline. See [[Probability model]] |
| 2026-11-06 | **Odds-first probabilities**, season-goals fallback | Market odds include team news; Liga F often lacks odds |
| 2026-11-06 | **Freely licensed photos only, with credits** | Credit alone doesn't grant permission. See [[Photos and licensing]] |
| 2026-11-06 | Photos **reviewed by eye** | Automatic matching picked wrong teams |
| 2026-11-06 | **Player database as JSON in the repository**, scheduled rebuild | Keeps the site static; fast loads; incremental updates |
| 2026-11-06 | Player portraits from **Wikidata / Commons** | ESPN has no women's headshots; Commons gives licence and credit data |
| 2026-11-06 | Team photos only from **2023 or later** | The user found a 2016 photo; old photos show old squads and kits |
| 2026-11-06 | Heatmaps from **ESPN play-by-play coordinates** | About 1,500 located events per match, free and live; season grids stored per player |
| 2026-11-06 | **Version tags** on CSS and JS | Pages caches for 10 minutes; stale CSS hid a fix from the user |
