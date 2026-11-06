---
tags: [todo]
---
# Known issues and next steps

## Open
- [ ] **Add the scheduled workflow** `.github/workflows/players.yml` on GitHub (the token lacks the `workflow` scope). See [[Deployment]].
- [ ] **Team photo review:** pick the best photos from the Commons and Openverse shortlist (59 clubs, 361 candidates). 10 clubs have no candidates: Tenerife, Dux Logroño, Alavés, Boston Legacy, Racing Louisville, Juventus, HB Køge, Benfica, Servette, OH Leuven.
- [ ] **Recent team photos:** 17 old photos were removed; finding 2023+ replacements is in progress. See [[Photos and licensing]].
- [ ] Some kept photos are action shots or single players rather than squad photos.
- [ ] Play-by-play goal counts can differ from the match sheet (Russo, Champions League: 4 vs 3). See [[Heatmaps]].
- [ ] NWSL whole-year scoreboard is about 2.5 MB; the builder and bracket avoid it where they can.
- [ ] The ESPN feed is unofficial; if it changes shape, the site and builder need updating. See [[Data sources (ESPN)]].

## Ideas
- Goal-mouth chart: where shots crossed the line (`goalPositionY`/`Z` are in the feed)
- Pass maps and progressive passes from the same play-by-play
- Minutes played (needs substitution times from the event timeline), for per-90 stats
- Team pages, like the player pages
- Head-to-head history between two clubs
