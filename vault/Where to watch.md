---
tags: [feature]
---
# Where to watch

A panel in the match centre, under the match: who shows the selected match's competition in the viewer's region, and, in the United States, the channels ESPN lists for that exact match. Both sites have it, with the same `watch.js`; each has its own `broadcasters.json` listing only its competitions (the men's site's has the Premier League, LaLiga and Champions League).

## Where the information comes from
- **ESPN, per match, United States only.** Scoreboard events carry `competitions[0].geoBroadcasts` (`media.shortName`, `type.shortName` TV or STREAMING, `region: "us"`) and `broadcasts` (names only). `Watch.fromEvent` reads them into `match.tv` when the app parses a match. ESPN gives no listings for other countries, and none for Liga F. Short names are expanded: "USA Net" to USA Network, "Tele" to Telemundo.
- **`broadcasters.json`, per competition and region, researched by hand** on 2026-11-19. Each competition has its season, an official "where to watch" link shown under the panel, the sources used, rights holders by region (`[name, note]`), and optionally:
  - `elsewhere`: options for countries with no local deal, such as the WSL YouTube channel or NWSL+;
  - `none`: a sentence for regions without a broadcaster, such as Liga F outside Spain.
- Regions: United Kingdom, Ireland, United States, Canada, Spain, France, Germany, Australia, China and Hong Kong, plus "Elsewhere".
- International competitions (national teams) aren't in the file. Their matches are sold by the home team's federation, so the panel says so, and in the US shows ESPN's listing when there is one.

## Sources (2026/27)
- Women's Champions League: UEFA's official "where to watch" pages, 2026/27 season.
- WSL: FourFourTwo's 2026/27 guide and Inside World Football (Sportdigital in Germany). There's no league-published list of international partners for 2026/27.
- NWSL: the league's "How to watch the NWSL in 2026" page (13 May 2026).
- Liga F: Sportcal and Advanced Television (August 2026). Domestic rights went to DAZN, RTVE and TV3; international rights were unassigned.

## The region
Guessed from the browser's time zone. Europe/London is the United Kingdom, Asia/Shanghai is China, America/ zones are matched to US or Canadian cities, and Australia/ zones are Australia. A time zone outside the list means "Elsewhere". The browser's language is used only when the time zone is UTC or missing, because en-US is many browsers' default everywhere. A region picked from the menu is remembered (`wmh-region` on this site, `mmh-region` on the men's).

## Keeping it right
Rights change between seasons, and sometimes during one. Recheck `broadcasters.json` each summer against the official pages above and update `updated`. The panel shows the date it was checked.

Gaps on 2026-11-19:
- **WSL:** no confirmed partner for Spain, France or Hong Kong. Those regions see "No broadcaster found" and the WSL YouTube channel.
- **NWSL:** nothing for China or Hong Kong apart from NWSL+.
