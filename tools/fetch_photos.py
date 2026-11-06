#!/usr/bin/env python3
"""Find freely licensed team photos on Wikimedia Commons and save them for the site.

For every team in the WSL, Liga F, NWSL and Women's Champions League tables, this searches
Commons, keeps only CC BY / CC BY-SA / CC0 / public-domain images, downloads a 960px copy to
photos/<espn team id>.<ext>, and records the photographer and licence in photos/manifest.json
(the site shows that credit under the photo, as the licences require).

Usage:
  python3 tools/fetch_photos.py                 # fill in teams that have no photo yet
  python3 tools/fetch_photos.py --force 19970   # search again for one team
  python3 tools/fetch_photos.py --skip 19970    # never pick a photo for this team (keeps the illustration)
"""
import html, json, os, re, sys, time, urllib.parse, urllib.request

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
PHOTOS = os.path.join(ROOT, "photos")
MANIFEST = os.path.join(PHOTOS, "manifest.json")
UA = "WomensMatchdayHub/1.0 (https://github.com/Redrooster2508/wosomatchday)"
LEAGUES = ["eng.w.1", "esp.w.1", "usa.nwsl", "uefa.wchampions"]
OK_LICENCE = re.compile(r"^(cc[ -]by(-sa)?([ -][\d.]+)?|cc0|public domain|pd)", re.I)
TEAMISH = re.compile(r"\b(team|squad|line-?up|starting|eleven|xi|players|celebrat|equipo|equip|plantilla|onze|formazione|mannschaft)\b", re.I)
BAD = re.compile(r"\b(logo|crest|badge|emblem|kit|shirt|jersey|scarf|stadium|stadion|estadio|ticket|map|men's|mens|u-?\d\d)\b", re.I)
# Clubs with no men's side, where the club name alone is enough.
WOMEN_ONLY = {"21425", "21053", "21175", "21149"}
WOMEN = re.compile(r"(women|woman|wfc|ladies|femen|femin|femm|frauen|damer|dam|kvinde|lionesses|w\.f\.c)", re.I)

# Search names where the table name alone is ambiguous or differs from Commons' usual naming.
NAMES = {
    "19256": ["Olympique Lyonnais Féminin", "OL Lyonnes"], "20091": ["FC Barcelona Femení"], "21128": ["Real Madrid Femenino"],
    "20093": ["Atlético Madrid Femenino"], "19258": ["Paris Saint-Germain Féminine"], "21640": ["Paris FC féminine"],
    "20103": ["FC Bayern München Frauen"], "20092": ["Juventus Women"], "131635": ["Inter Women"], "21685": ["AS Roma Women"],
    "20830": ["Benfica feminino"], "20835": ["Servette FC Chênois Féminin"], "21124": ["BK Häcken FF"], "21127": ["HB Køge Kvinder"],
    "131643": ["FK Austria Wien Frauen"], "131423": ["OH Leuven women"], "15364": ["NJ/NY Gotham FC", "Gotham FC"],
    "15363": ["Seattle Reign FC", "OL Reign"], "21372": ["Athletic Club Femenino"], "21428": ["Real Sociedad Femenino"],
    "21145": ["Deportivo Abanca"], "21175": ["DUX Logroño"], "131393": ["UD Tenerife femenino", "Costa Adeje Tenerife"],
    "21425": ["Madrid CFF"], "21053": ["London City Lionesses"],
}


def get(url, tries=3):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA})
            with urllib.request.urlopen(req, timeout=60) as r:
                return r.read()
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2 * (i + 1))


def teams():
    seen = {}
    for slug in LEAGUES:
        d = json.loads(get(f"https://site.api.espn.com/apis/v2/sports/soccer/{slug}/standings"))
        for e in d["children"][0]["standings"]["entries"]:
            t = e["team"]
            seen.setdefault(str(t["id"]), {"id": str(t["id"]), "name": t["displayName"], "league": slug})
    return list(seen.values())


def queries(t):
    base = NAMES.get(t["id"]) or [t["name"]]
    out = []
    for n in base:
        if t["league"] == "usa.nwsl" or WOMEN.search(n):
            out += [f'"{n}" team', n]
        else:
            out += [f'"{n}" women team', f"{n} women", f"{n} femenino" if t["league"] == "esp.w.1" else f"{n} WFC"]
    return out


def search(q):
    p = {"action": "query", "format": "json", "generator": "search", "gsrsearch": q + " filetype:bitmap", "gsrnamespace": "6",
         "gsrlimit": "20", "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": "960"}
    d = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(p)))
    return list((d.get("query") or {}).get("pages", {}).values())


def plain(s):
    return html.unescape(re.sub(r"<[^>]+>", "", s or "")).strip()


def score(page, t):
    title = page["title"].lower()
    ii = (page.get("imageinfo") or [{}])[0]
    meta = ii.get("extmetadata", {})
    lic = plain(meta.get("LicenseShortName", {}).get("value"))
    if not OK_LICENCE.search(lic) or BAD.search(title) or ii.get("width", 0) < 800:
        return None
    words = [w for w in re.split(r"[^a-z0-9à-ÿ]+", " ".join(NAMES.get(t["id"], []) + [t["name"]]).lower()) if len(w) > 2 and w not in ("club", "the", "women", "united", "city")]
    if not any(w in title for w in words):
        return None
    women_side = t["league"] == "usa.nwsl" or t["id"] in WOMEN_ONLY
    if not women_side and not WOMEN.search(title):
        return None  # most clubs have a men's team too; only accept photos named as the women's side
    s = 2
    if TEAMISH.search(title): s += 4
    if ii.get("width", 0) > ii.get("height", 1): s += 1
    if re.search(r"\b(19|200\d|201[0-5])\b", title): s -= 1  # prefer recent seasons
    return s, lic


def credit(page):
    meta = (page.get("imageinfo") or [{}])[0].get("extmetadata", {})
    artist = plain(meta.get("Artist", {}).get("value")) or "Unknown author"
    artist = re.sub(r"\s+", " ", artist)[:80]
    return artist, plain(meta.get("LicenseShortName", {}).get("value"))


def main():
    args = sys.argv[1:]
    force = set(args[args.index("--force") + 1:]) if "--force" in args else set()
    skip = set(args[args.index("--skip") + 1:]) if "--skip" in args else set()
    os.makedirs(PHOTOS, exist_ok=True)
    man = json.load(open(MANIFEST)) if os.path.exists(MANIFEST) else {}
    for sid in skip:
        man[sid] = None
    for t in teams():
        if t["id"] in man and t["id"] not in force:
            continue
        best = None
        for q in queries(t):
            try:
                pages = search(q)
            except Exception as e:
                print(f"  search failed  {t['name']}: {e}")
                pages = []
            for page in pages:
                r = score(page, t)
                if r and (not best or r[0] > best[0]):
                    best = (r[0], page)
            time.sleep(0.3)
            if best and best[0] >= 6:
                break
        if not best or best[0] < 3:
            print(f"  no photo   {t['name']}")
            continue
        page = best[1]
        ii = page["imageinfo"][0]
        url = ii.get("thumburl") or ii["url"]
        ext = os.path.splitext(urllib.parse.urlparse(url).path)[1].lower()
        if ext not in (".jpg", ".jpeg", ".png", ".webp"):
            ext = ".jpg"
        fname = t["id"] + ext
        try:
            data = get(url)
        except Exception as e:
            print(f"  download failed  {t['name']}: {e}")
            continue
        with open(os.path.join(PHOTOS, fname), "wb") as f:
            f.write(data)
        artist, lic = credit(page)
        man[t["id"]] = {"file": fname, "team": t["name"], "credit": f"{artist}, {lic}, via Wikimedia Commons",
                        "source": ii.get("descriptionurl", "")}
        print(f"  {best[0]:>2}  {t['name']:<28} {page['title'][:70]}")
        time.sleep(0.3)
    with open(MANIFEST, "w") as f:
        json.dump(man, f, indent=1, ensure_ascii=False, sort_keys=True)


if __name__ == "__main__":
    main()
