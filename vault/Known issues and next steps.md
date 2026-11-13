---
tags: [todo]
---
# Known issues and next steps

## Open
- [x] Scheduled workflow added on GitHub (2026-11-06); first run succeeded. See [[Deployment]].
- [ ] **Team photo review:** pick the best photos from the Commons and Openverse shortlist (59 clubs, 361 candidates). 10 clubs have no candidates: Tenerife, Dux Logroño, Alavés, Boston Legacy, Racing Louisville, Juventus, HB Køge, Benfica, Servette, OH Leuven.
- [x] Recent team photos: 33 clubs have photos from 2023 on. 26 still use the illustration because no free recent photo exists (Man City, Lyon, PSG, Everton, most of Liga F...). See [[Photos and licensing]].
- [ ] Some kept photos are action shots or single players rather than squad photos.
- [ ] **Men's team photos:** 32 of 114 teams (12 clubs, 20 World Cup teams). No usable photo from 2023 on in Commons for Chelsea, Liverpool, both Manchester clubs, Real Madrid, Barcelona, PSG, Bayern, England, the USA, Mexico, the Netherlands and others; Flickr and Openverse not yet searched for men's teams. See [[Photos and licensing]].
- [ ] MLS (`usa.1`, about 500 matches) is left out of the player database for size; add it to `LEAGUES` in `build_players.py` and `build_heat.py` to include it. See [[Player stats database]].
- [ ] Play-by-play goal counts can differ from the match sheet (Russo, Champions League: 4 vs 3). See [[Heatmaps]].
- [ ] Career history depends on Wikidata: some players have no item or incomplete spells, and appearance counts lag. Edits on Wikidata show up on the site straight away.
- [ ] NWSL whole-year scoreboard is about 2.5 MB; the builder and bracket avoid it where they can.
- [ ] The ESPN feed is unofficial; if it changes shape, the site and builder need updating. See [[Data sources (ESPN)]].

## Done (2026-11-06)
- [x] Goal-mouth chart · pass maps and progressive passes · minutes and per-90 · team pages · head to head. See [[Heatmaps]] and [[Team pages]].

## Ideas
- Head to head across competitions (schedules are per competition)
- Expected goals (xG) model from shot positions
