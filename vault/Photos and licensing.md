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

## Recent photo review (2026-11-06)
The searches gave 200 candidates from 2023 on, for 37 of 59 clubs. All were reviewed by eye on contact sheets. **24 picked**, for **29 clubs with photos** in total (2023–2026), mostly squad photos, line-ups and celebrations.

**Rejected:** a Pride parade and a Birmingham player (Man City); trophies and stadium shots (Arsenal, Aston Villa); a 1909 team photo uploaded recently (Badalona); basketball and sailing (Valencia); cricket and an unrelated tournament (Inter); a distant final (Paris FC); a wreath ceremony (NC Courage); a musician (Orlando).

**Still on illustrations (30 clubs):** among them Arsenal, Man City, Aston Villa, Tottenham, Liverpool, Everton, West Ham, Real Madrid, Lyon, PSG and most of Liga F, where no free photo from 2023 on was found.

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
**Target look** (user's example, Cloé Lacasse): a recent, head-and-shoulders portrait, taller than wide, one player, in kit. The page scores every 2023+ candidate (her main Wikidata image and her Commons category): year ×4, tagged on Commons as depicting her +6 (files tagged only as something or someone else are skipped, e.g. a sign named after her), portrait shape +8 (ratio ≥ 1.15) or +3 (roughly square), "(cropped)" +6, match or group scenes −6, several people named −4, main image +2.

The same **2023 or later** rule applies: the main Wikidata image (`P18`) if it's recent, otherwise the newest licensed photo in the player's Commons category (`P373`) whose title names her, preferring portrait shape. If there isn't one, the page shows initials. The credit shows the year.

Official club and federation squad headshots are copyrighted, so they're not used. Free crops from Commons team photos are, and the category search finds them.

`player-page.js` searches Wikidata for the player's name and keeps the first result that is an association football player (`P106 = Q937857`), female (`P21 = Q6581072`) and has an image (`P18`). It then reads the Commons licence and credit and only shows the image if the licence is free. Otherwise the page shows initials in club colours. ESPN has no women's headshots.
