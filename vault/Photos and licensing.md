---
tags: [photos, licensing]
---
# Photos and licensing

## Rule
Only freely licensed images: CC BY, CC BY-SA, CC0, public domain, plus CC BY-NC and CC BY-NC-SA because the site is non-commercial. ND (no-derivatives) is excluded because the site resizes and crops. Every photo shows the **photographer, licence and source site**.

Crediting a photographer does **not** make a copyrighted photo free to use, so club, agency and news photos are not used. See [[Decisions]].

## Recency
Team photos must be from **2023 or later**: the camera's recorded date (`DateTimeOriginal`) or, failing that, a year in the title. Openverse results have no capture date, so their title or tags must name the year. Older photos show old squads and kits.

Audit on 2026-11-06: only 9 of 26 photos qualified. 17 were removed (PSG and Espanyol 2012, Seattle 2014, Arsenal and West Ham 2016, through Real Madrid, Madrid CFF and Real Sociedad 2021).

## Team photos
Shown in this order:
1. A viewer's own upload, kept only in their browser
2. A shared photo listed in `photos/manifest.json`, with `{file, team, credit, source}`
3. An illustrated squad line-up drawn on a canvas in club colours

### Sources and tools
- `tools/photo_candidates.py`: Wikimedia Commons search and club categories, scored for team or line-up shots, recent years and the women's side
- `tools/openverse_candidates.py`: Openverse (Flickr and others), anonymous API with page size ≤ 20
- `tools/fetch_photos.py --pick <id>=<File:…|ov:…>`: downloads the chosen photo and writes its credit

### Review
The automatic picks were often wrong: the opponent in a match photo, a men's side, even a basketball game and a WWII-era image. So photos are now **reviewed by eye** on contact sheets before picking.

First pass (2026-11-06): 26 of 47 kept, 21 rejected and marked `null` in the manifest.

## Player portraits
`player-page.js` searches Wikidata for the player's name and keeps the first result that is an association football player (`P106 = Q937857`), female (`P21 = Q6581072`) and has an image (`P18`). It then reads the Commons licence and credit and only shows the image if the licence is free. Otherwise the page shows initials in club colours. ESPN has no women's headshots.
