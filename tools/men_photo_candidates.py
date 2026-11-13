#!/usr/bin/env python3
"""Collect candidate team photos for men's teams from Wikimedia Commons, for a person to review.

The same rules as the women's search (tools/photo_candidates.py): freely licensed, taken in 2023
or later, at least 1000 px wide, the team named in the title. Covers the clubs in the men's
competitions of the player database (Premier League, LaLiga, Champions League) and the national
teams at the 2026 World Cup. Women's, youth and B sides are left out by their titles.

Writes tools/men_candidates.json; make contact sheets with --sheets, then pick with
  python3 tools/fetch_photos.py --pick <team id>="File:..."

Usage:
  python3 tools/men_photo_candidates.py             # every team not searched yet
  python3 tools/men_photo_candidates.py 359 83      # only these ESPN team ids (searched again)
  python3 tools/men_photo_candidates.py --sheets    # contact sheets in tools/sheets/, six teams each
  python3 tools/men_photo_candidates.py --sheets 359 83   # sheets for these teams only
"""
import json, os, re, sys, time, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_photos import OK_LICENCE, WOMEN, get, plain  # noqa: E402
from photo_candidates import SINCE, TEAMISH, SPLIT, YEAR  # noqa: E402

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "tools", "men_candidates.json")
SHEETS = os.path.join(ROOT, "tools", "sheets")
CLUBS = ["eng.1", "esp.1", "uefa.champions"]
NATIONAL = ["fifa.world"]
# not a first-team photo: badges, grounds, kit, fans, youth and B sides
BAD = re.compile(r"\b(logo|crest|badge|emblem|kit|shirt|jersey|scarf|stadium|stadion|estadio|ground|ticket|map|mural|statue|fans|supporters|"
                 r"u-?\d\d|under-?\d\d|sub-?\d\d|youth|academy|masia|graduation|juvenil|reserves|b team|ii\b|futsal|beach|esports|legends|"
                 r"basket\w*|b[aà]squet|handbol|handball|hockey|nba|euroleague|acb|liga endesa|after party|reina)\b", re.I)
SKIP_CAT = re.compile(r"(players|people|managers|coaches|presidents|staff|stadium|kits|logos|women|femen|femin|ladies|youth|academy|"
                      r"juvenil|reserves|u-?\d\d|under-\d\d|futsal|basketball|handball|fans|supporters|history|trophies|buses|mascot)", re.I)
# search names where ESPN's name differs from Commons' usual naming
NAMES = {}


def league_teams(slug):
    d = json.loads(get(f"https://site.api.espn.com/apis/site/v2/sports/soccer/{slug}/teams"))
    out = []
    for x in d["sports"][0]["leagues"][0]["teams"]:
        t = x["team"]
        out.append({"id": str(t["id"]), "name": t.get("displayName") or t.get("name"), "national": slug in NATIONAL, "league": slug})
    return out


def teams():
    seen = {}
    for slug in CLUBS + NATIONAL:
        for t in league_teams(slug):
            seen.setdefault(t["id"], t)
    return list(seen.values())


WD = "https://www.wikidata.org/w/api.php?format=json&"
# Wikidata classes: association football club (two items, FC Barcelona uses the newer one), and national association
# football team, generic or men's (most men's national teams now use the latter)
CLUB, NATIONAL_TEAM = {"Q476028", "Q103229495"}, {"Q6979593", "Q135408445"}
_wd = {}
RESERVES = re.compile(r"under-|\bU-?\d\d|\bB$|\bB\b|\bII\b|reserves|atl[eè]tic$|castilla|juvenil|youth|academy", re.I)
# a club photo found by search must be about football: "Barcelona 2026" is mostly the city
FOOTBALL = re.compile(r"\b(f\.?c\.?|c\.?f\.?|a\.?f\.?c\.?|football|f[uú]tbol|soccer|calcio|fu[sß]ball|v|vs|xi|line-?up|squad|team|players|"
                      r"celebrat\w*|parade|champions|league|liga|premier|copa|cup|match|derby|kick-?off|goal)\b", re.I)


def wikidata(t):
    """The team's Wikidata label and Commons category: "Arsenal" is Arsenal F.C., not the many other Arsenals."""
    if t["id"] in _wd:
        return _wd[t["id"]]
    qs = [t["name"] + " national football team"] if t["national"] else [t["name"], t["name"] + " F.C.", "FC " + t["name"], t["name"] + " CF"]
    hit = None
    try:
        for q in qs:
            ids = [x["id"] for x in json.loads(get(WD + "action=wbsearchentities&language=en&type=item&limit=10&search=" + urllib.parse.quote(q))).get("search", [])]
            if not ids:
                continue
            ents = json.loads(get(WD + "action=wbgetentities&props=claims|labels&languages=en&ids=" + "|".join(ids)))["entities"]
            for i in ids:
                c = ents[i].get("claims", {})
                kinds = {(x["mainsnak"].get("datavalue") or {}).get("value", {}).get("id") for x in c.get("P31", [])}
                label = ents[i].get("labels", {}).get("en", {}).get("value", "")
                if kinds & (NATIONAL_TEAM if t["national"] else CLUB) and not WOMEN.search(label) and not RESERVES.search(label):
                    hit = (label, c.get("P373", [{}])[0].get("mainsnak", {}).get("datavalue", {}).get("value"))
                    break
            if hit:
                break
    except Exception as e:
        print("  wikidata failed", t["name"], e)
    _wd[t["id"]] = hit
    return hit


def search_names(t):
    if t["id"] in NAMES:
        return NAMES[t["id"]]
    hit = wikidata(t)
    if hit and hit[0]:
        return [hit[0]] + ([t["name"]] if not t["national"] and t["name"] != hit[0] else [])
    if t["national"]:
        return [t["name"] + " national football team"]
    return [t["name"]]


def words(t):
    stop = {"club", "the", "united", "city", "real", "athletic", "sporting", "town", "national", "football", "team", "association", "men", "de", "fc", "cf", "afc", "sc"}
    ws = set()
    for n in search_names(t) + [t["name"]]:
        for w in re.split(r"[^a-z0-9à-ÿ]+", n.lower()):
            if len(w) > 2 and w not in stop:
                ws.add(w)
    return ws or {t["name"].lower()}


def api(params):
    params.update({"format": "json", "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": "420"})
    return json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)))


def queries(t):
    qs = []
    for n in search_names(t)[:2]:
        if t["national"]:
            c = t["name"]
            qs += [f'"{c}" national team starting XI', f'"{c}" national football team line up', f'{c} national team squad 2026',
                   f'{c} national football team 2026', f'{c} national football team 2025', f'"{c}" starting XI 2026', f'{c} World Cup 2026 team']
        else:
            qs += [f'"{n}" team photo', f'"{n}" starting XI', f'"{n}" line up', f'{n} squad 2025', f"{n} 2026", f"{n} 2025"]
    return qs


def category_files(t, ws):
    """Files in the team's Commons category and its newest sub-folders (seasons, matches)."""
    # the Wikidata category first (it can be an empty redirect), then the closest matches by name
    hit = wikidata(t)
    n = search_names(t)[0]
    d = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(
        {"action": "query", "format": "json", "list": "search", "srsearch": n, "srnamespace": "14", "srlimit": "8"})))
    found = [r["title"] for r in (d.get("query") or {}).get("search", [])
             if all(w in r["title"].lower() for w in words({"id": "", "name": n, "national": t["national"]}))
             and not SKIP_CAT.search(r["title"]) and not WOMEN.search(r["title"])
             and (t["national"] or re.search(r"\b(f\.?c|c\.?f|football|futbol|club)\b", r["title"], re.I))
             and max([int(y) for y in YEAR.findall(r["title"])] or [9999]) >= SINCE]
    cats = (["Category:" + hit[1]] if hit and hit[1] else []) + [c for c in found if not hit or c != "Category:" + str(hit[1])]
    seen, frontier = set(), cats[:3]
    for depth in range(3):
        nxt = []
        for c in frontier:
            if c in seen or len(seen) > 30:
                continue
            seen.add(c)
            try:
                sub = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(
                    {"action": "query", "format": "json", "list": "categorymembers", "cmtitle": c, "cmtype": "subcat", "cmlimit": "300"})))
            except Exception:
                continue
            for m in (sub.get("query") or {}).get("categorymembers", []):
                ys = [int(y) for y in YEAR.findall(m["title"])]
                if ys and max(ys) >= SINCE and not SKIP_CAT.search(m["title"]) and not WOMEN.search(m["title"]):
                    nxt.append(m["title"])
                elif not ys and re.search(r"\b(matches|squad|team photographs|group photographs|line-?ups|celebrations|in \d{4})\b", m["title"], re.I) and not SKIP_CAT.search(m["title"]):
                    nxt.append(m["title"])
            time.sleep(0.2)
        nxt.sort(key=lambda x: -max([int(y) for y in YEAR.findall(x)] or [0]))
        frontier = nxt[:12]
    files = []
    for c in sorted(seen, key=lambda x: -max([int(y) for y in YEAR.findall(x)] or [0]))[:10]:
        try:
            dd = api({"action": "query", "generator": "categorymembers", "gcmtitle": c, "gcmtype": "file", "gcmlimit": "100", "gcmsort": "timestamp", "gcmdir": "desc"})
            files += list((dd.get("query") or {}).get("pages", {}).values())
        except Exception:
            pass
        time.sleep(0.3)
    return files, sorted(seen)


def judge(page, t, ws, from_cat):
    title = page["title"]
    low = title.lower()
    ii = (page.get("imageinfo") or [{}])[0]
    meta = ii.get("extmetadata", {})
    lic = plain(meta.get("LicenseShortName", {}).get("value"))
    w, h = ii.get("width", 0), ii.get("height", 1)
    if not OK_LICENCE.search(lic) or BAD.search(low) or WOMEN.search(low) or w < 1000 or not re.search(r"\.(jpe?g|png|webp)$", low):
        return None
    if not any(x in low for x in ws):
        return None
    if not t["national"] and not from_cat and not FOOTBALL.search(low):
        return None
    s, why = 0, []
    clauses = SPLIT.split(low)
    # a team word only counts if this team is named in the same part of the title ("X starting XI v Y")
    if any(TEAMISH.search(c) and any(x in c for x in ws) for c in clauses):
        s += 6; why.append("team")
    elif len(clauses) > 1:
        s -= 1; why.append("match")
    if from_cat:
        s += 2; why.append("category")
    taken = YEAR.findall(plain(meta.get("DateTimeOriginal", {}).get("value")))
    years = [int(y) for y in (taken or YEAR.findall(title))]
    if not years or max(years) < SINCE:
        return None
    y = max(years)
    s += 4 if y >= 2025 else 2
    why.append(str(y))
    if 1.25 <= w / max(h, 1) <= 2.2:
        s += 1
    if w >= 2000:
        s += 1
    return s, lic, ",".join(why), y


def search(only):
    import threading
    from concurrent.futures import ThreadPoolExecutor
    data = json.load(open(OUT)) if os.path.exists(OUT) else {}
    lock = threading.Lock()
    todo = [t for t in teams() if (t["id"] in only if only else t["id"] not in data)]  # without ids: resume after an interrupted run
    with ThreadPoolExecutor(4) as pool:   # four teams at a time; each one's requests stay sequential and spaced
        list(pool.map(lambda t: one(t, data, lock), todo))


def one(t, data, lock):
    ws, found = words(t), {}
    try:
        files, cats = category_files(t, ws)
    except Exception as e:
        print("  category failed", t["name"], e); files, cats = [], []
    for p in files:
        r = judge(p, t, ws, True)
        if r: found[p["title"]] = (r, p)
    for q in queries(t):
        try:
            pages = list((api({"action": "query", "generator": "search", "gsrsearch": q + " filetype:bitmap", "gsrnamespace": "6", "gsrlimit": "25"})
                          .get("query") or {}).get("pages", {}).values())
        except Exception as e:
            print("  search failed", t["name"], q, e); pages = []
        for p in pages:
            if p["title"] not in found:
                r = judge(p, t, ws, False)
                if r: found[p["title"]] = (r, p)
        time.sleep(0.3)
    # at most two from one series ("Arsenal Parade 31052026 (1)", "(2)"...), so a contact sheet shows different events
    best, per = [], {}
    for r, p in sorted(found.values(), key=lambda x: (-x[0][0], -x[0][3])):
        key = re.sub(r"[\d\s()_.,-]+", " ", p["title"].lower()).strip()[:30]
        if per.get(key, 0) < 2:
            per[key] = per.get(key, 0) + 1; best.append((r, p))
        if len(best) == 6:
            break
    with lock:
        data[t["id"]] = {"team": t["name"], "league": t["league"], "categories": cats, "candidates": [
            {"title": p["title"], "score": r[0], "why": r[2], "year": r[3], "licence": r[1], "thumb": p["imageinfo"][0].get("thumburl"),
             "size": [p["imageinfo"][0].get("width"), p["imageinfo"][0].get("height")]} for r, p in best]}
        print(f"  {t['name']:<28} {len(found):>3} found  best: {best[0][0][0] if best else '-':>3} {best[0][1]['title'][:60] if best else ''}", flush=True)
        with open(OUT, "w") as f:
            json.dump(data, f, indent=1, ensure_ascii=False)


def sheets(only):
    """Contact sheets: one row per team, its candidates numbered left to right."""
    from io import BytesIO
    from PIL import Image, ImageDraw
    data = json.load(open(OUT))
    os.makedirs(SHEETS, exist_ok=True)
    ids = [k for k, v in data.items() if v["candidates"] and (not only or k in only)]
    TW, TH, PER = 300, 190, 6
    for n in range(0, len(ids), PER):
        group = ids[n:n + PER]
        sheet = Image.new("RGB", (TW * 6 + 10, (TH + 34) * len(group)), "white")
        d = ImageDraw.Draw(sheet)
        for row, tid in enumerate(group):
            v = data[tid]
            y0 = row * (TH + 34)
            d.text((4, y0 + 4), f"{tid} {v['team']}", fill="black")
            for col, c in enumerate(v["candidates"]):
                try:
                    im = Image.open(BytesIO(get(c["thumb"]))).convert("RGB")
                    im.thumbnail((TW - 6, TH))
                    sheet.paste(im, (col * TW + 2, y0 + 20))
                except Exception:
                    pass
                d.text((col * TW + 4, y0 + 22), f"{col + 1} ({c['year']})", fill="yellow")
                time.sleep(0.1)
        path = os.path.join(SHEETS, f"sheet-{group[0]}.jpg")
        sheet.save(path, quality=80)
        print(path, ", ".join(data[t]["team"] for t in group), flush=True)


if __name__ == "__main__":
    if "--sheets" in sys.argv:
        sheets({a for a in sys.argv[1:] if not a.startswith("--")})
    else:
        search({a for a in sys.argv[1:] if not a.startswith("--")})
