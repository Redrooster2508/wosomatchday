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

**Sub-folder pass (2026-11-06):** searching Commons club sub-folders (match categories) found candidates for 12 of the 30 remaining clubs. **4 picked:** Arsenal (v Vålerenga, Dec 2024), West Ham (pre-season at Lewes, 2023), Benfica (line-up v Juventus, 2025; released by the club itself under CC BY 3.0) and Real Madrid (substitution v Vålerenga, 2023). Rejected: Deportivo (the players shown may be Barcelona's), Valencia (basketball again), PSG (France national team), Man City (Pride parade, unclear kit), Inter, Badalona, NC Courage and Paris FC as before. **33 clubs** now have photos.

**Still on illustrations (26 clubs):** among them Man City, Aston Villa, Tottenham, Liverpool, Everton, Lyon, PSG and most of Liga F, where no free photo from 2023 on was found. The illustration shows a women's squad (see Team photos below).

## Men's team photos (2026-11-13, build 25)
Same rules: freely licensed, 2023 or later, reviewed by eye on contact sheets and checked at the 16:10 card crop. Searched: the 66 clubs in the Premier League, LaLiga and men's Champions League, and the 48 teams at the 2026 World Cup. **32 picked**: 12 clubs (Arsenal, Bournemouth, Brentford, Crystal Palace, Everton, Fulham, Hull, Leeds, Nottingham Forest, Sunderland, Inter, Real Sociedad) and 20 national teams (mostly 2026 World Cup starting XIs: Argentina, Australia, Belgium, Brazil, Canada, Colombia, Croatia, Ecuador, Egypt, France, Germany, Ghana, Japan, Norway, Panama, Portugal, Saudi Arabia, Scotland, Spain (World Cup winners' celebration), Uzbekistan). Licences: CC BY-SA 4.0 (19), CC BY 4.0 (6), CC0 (5), CC BY 2.0, public domain.

**Tool:** `tools/men_photo_candidates.py` finds each team's Commons category through Wikidata (club classes `Q476028` and `Q103229495`, FC Barcelona uses the newer one; national team classes `Q6979593` and the men's `Q135408445`, which most men's national teams now use), follows season, match, celebration and group-photo sub-folders, and searches titles. It skips women's, youth, B and reserve sides, other sports (basketball, handball, hockey) and the Copa de la Reina, and keeps at most two photos of one series. `--sheets` makes the contact sheets. `tools/fetch_photos.py --pick` names men's teams from the player database.

**Rejected on review:** the opponent's line-up filed under this team's name was the most common trap (England's results were Ghana's and Panama's XIs, Uruguay's were Saudi Arabia's, Porto's were Salzburg's, Osasuna's were Bordeaux players, Málaga's was Las Palmas); also Manchester City's under-18s, Sweden's women, Paraguay's women's under-17s, a 1916 USA team, and two that didn't work at card size (Napoli, blurry; Bayern's title celebration, players too small on the balcony). Chelsea's only team photo has a politician front and centre.

**No photo yet:** most big clubs (Chelsea, Liverpool, both Manchester clubs, Real Madrid, Barcelona, Atlético, PSG, Bayern, Dortmund…) and 28 World Cup teams, including England, the USA, Mexico, the Netherlands and Morocco. They keep the crest on their colours. Openverse/Flickr wasn't searched for men's teams yet.

## Team photos
**Framing:** cards are 16:10 and crop from the centre. A manifest entry can add `"pos": "<x>% <y>%"` (focus point, e.g. `50% 20%` for a line-up in the top half) or `"fit": "whole"` (show a tall photo whole on a blurred copy). Check each new photo at the card crop before adding it.
Shown in this order:
1. A viewer's own upload, kept only in their browser
2. A shared photo listed in `photos/manifest.json`, with `{file, team, credit, source}`
3. An illustrated squad line-up drawn on a canvas in club colours: women with varied hairstyles (ponytails, top knots, long hair, braids, curls, bobs) and skin tones

### Sources and tools
- `tools/photo_candidates.py`: Wikimedia Commons search and club categories, scored for team or line-up shots, recent years and the women's side
- `tools/openverse_candidates.py`: Openverse (Flickr and others), anonymous API with page size ≤ 20
- `tools/fetch_photos.py --pick <id>=<File:…|ov:…>`: downloads the chosen photo and writes its credit

### Review
The automatic picks were often wrong: the opponent in a match photo, a men's side, even a basketball game and a WWII-era image. So photos are now **reviewed by eye** on contact sheets before picking.

First pass (2026-11-06): 26 of 47 kept, 21 rejected and marked `null` in the manifest.

## Player portraits
Men's players (build 23) use the same search with male (`P21 = Q6581097`) Wikidata entries. ESPN has men's headshots, but they're copyrighted agency photos, so they're not used.

**Target look** (user's example, Cloé Lacasse): a recent, head-and-shoulders portrait, taller than wide, one player, in kit. The page scores every 2023+ candidate (her main Wikidata image and her Commons category): year ×4, tagged on Commons as depicting her +6 (files tagged only as something or someone else are skipped, e.g. a sign named after her), portrait shape +8 (ratio ≥ 1.15) or +3 (roughly square), "(cropped)" +6, match or group scenes −6, several people named −4, main image +2.

The same **2023 or later** rule applies: the main Wikidata image (`P18`) if it's recent, otherwise the newest licensed photo in the player's Commons category (`P373`) whose title names her, preferring portrait shape. If there isn't one, the page shows initials. The credit shows the year.

Official club and federation squad headshots are copyrighted, so they're not used. Free crops from Commons team photos are, and the category search finds them.

`player-page.js` searches Wikidata for the player's name and keeps the first result that is an association football player (`P106 = Q937857`), female (`P21 = Q6581072`) and has an image (`P18`). It then reads the Commons licence and credit and only shows the image if the licence is free. Otherwise the page shows initials in club colours. ESPN has no women's headshots.
