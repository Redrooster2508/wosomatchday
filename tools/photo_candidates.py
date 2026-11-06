#!/usr/bin/env python3
"""Collect candidate team photos from Wikimedia Commons for a person to review.

Searches Commons for each club's women's team (team photos, line-ups, starting XIs, recent
seasons first, in English, Spanish, German and French) and its Commons category, keeps only
freely licensed images, and writes the best few per club to tools/candidates.json with small
preview URLs. Pick from them with:

  python3 tools/fetch_photos.py --pick <team id>=<"File:... title">

Usage:
  python3 tools/photo_candidates.py              # all clubs
  python3 tools/photo_candidates.py 19970 15364  # only these ESPN team ids
"""
import json, os, re, sys, time, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_photos import NAMES, OK_LICENCE, BAD, WOMEN, WOMEN_ONLY, get, plain, teams  # noqa: E402

OUT = os.path.join(os.path.dirname(os.path.abspath(__file__)), "candidates.json")
SINCE = 2023  # only photos taken in this year or later: older photos show old squads and kits
TEAMISH = re.compile(r"(team photo|team picture|team portrait|squad|line-?up|lining up|starting (xi|eleven|11)|\bxi\b|starting lineup|"
                     r"mannschaft|teamfoto|once inicial|alineaci|plantilla|equipo titular|onze|composition|formazione|\bteam\b|\bequip|\bequipo)", re.I)
SPLIT = re.compile(r"\s(?:v|vs\.?|versus|against|contra|gegen|-|–)\s", re.I)
YEAR = re.compile(r"\b(19[5-9]\d|20[0-3]\d)\b")


def club_words(t):
    names = NAMES.get(t["id"], []) + [t["name"]]
    stop = {"club", "the", "women", "united", "city", "real", "athletic", "atlético", "sporting", "town", "racing", "royals", "wave", "summit", "stars", "legacy"}
    words = set()
    for n in names:
        for w in re.split(r"[^a-z0-9à-ÿ]+", n.lower()):
            if len(w) > 2 and w not in stop:
                words.add(w)
    return words or {t["name"].lower()}


def query_list(t):
    lg = t["league"]
    names = NAMES.get(t["id"]) or [t["name"]]
    qs = []
    for n in names[:2]:
        women = "" if (lg == "usa.nwsl" or t["id"] in WOMEN_ONLY or WOMEN.search(n)) else (" femenino" if lg == "esp.w.1" else " women")
        qs += [f'"{n}"{women} team photo', f'"{n}"{women} starting XI', f'"{n}"{women} line up', f'{n}{women} squad']
        qs += [f"{n}{women} {y}" for y in (2026, 2025, 2024)]
        if lg == "esp.w.1":
            qs += [f"{n} femenino once inicial", f"{n} femenino equipo"]
        if t["id"] in ("20103", "131643"):
            qs += [f"{n} Mannschaftsfoto"]
        if t["id"] in ("19256", "19258", "21640", "20835"):
            qs += [f"{n} équipe féminine"]
    return qs


def api(params):
    params.update({"format": "json", "prop": "imageinfo", "iiprop": "url|extmetadata|size", "iiurlwidth": "420"})
    return json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(params)))


def search_files(q):
    d = api({"action": "query", "generator": "search", "gsrsearch": q + " filetype:bitmap", "gsrnamespace": "6", "gsrlimit": "25"})
    return list((d.get("query") or {}).get("pages", {}).values())


def category_files(t, words):
    """Files in the club's women's-team category on Commons, newest uploads first."""
    n = (NAMES.get(t["id"]) or [t["name"]])[0]
    d = json.loads(get("https://commons.wikimedia.org/w/api.php?" + urllib.parse.urlencode(
        {"action": "query", "format": "json", "list": "search", "srsearch": f"{n} women" if t["league"] != "usa.nwsl" else n, "srnamespace": "14", "srlimit": "8"})))
    cats = []
    for r in (d.get("query") or {}).get("search", []):
        title = r["title"].lower()
        if any(w in title for w in words) and (t["league"] == "usa.nwsl" or t["id"] in WOMEN_ONLY or WOMEN.search(title)) and not BAD.search(title):
            cats.append(r["title"])
    files = []
    for c in cats[:2]:
        dd = api({"action": "query", "generator": "categorymembers", "gcmtitle": c, "gcmtype": "file", "gcmlimit": "200", "gcmsort": "timestamp", "gcmdir": "desc"})
        files += list((dd.get("query") or {}).get("pages", {}).values())
        time.sleep(0.3)
    return files, cats


def judge(page, t, words, from_cat):
    title = page["title"]
    low = title.lower()
    ii = (page.get("imageinfo") or [{}])[0]
    meta = ii.get("extmetadata", {})
    lic = plain(meta.get("LicenseShortName", {}).get("value"))
    w, h = ii.get("width", 0), ii.get("height", 1)
    if not OK_LICENCE.search(lic) or BAD.search(low) or w < 1000 or not re.search(r"\.(jpe?g|png|webp)$", low):
        return None
    women_ok = t["league"] == "usa.nwsl" or t["id"] in WOMEN_ONLY or WOMEN.search(low) or from_cat
    if not women_ok or not any(x in low for x in words):
        return None
    s, why = 0, []
    clauses = SPLIT.split(low)
    # a team word only counts if our club is named in the same part of the title ("X starting XI v Y")
    if any(TEAMISH.search(c) and any(x in c for x in words) for c in clauses):
        s += 6; why.append("team")
    elif len(clauses) > 1:
        s -= 1; why.append("match")
    if from_cat:
        s += 2; why.append("category")
    # the year it was taken: the camera's date if recorded, otherwise a year in the title
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


def main():
    only = set(sys.argv[1:])
    data = json.load(open(OUT)) if os.path.exists(OUT) else {}
    for t in teams():
        if only and t["id"] not in only:
            continue
        if not only and t["id"] in data:
            continue  # resume after an interrupted run
        words = club_words(t)
        found = {}
        try:
            files, cats = category_files(t, words)
        except Exception as e:
            print("  category failed", t["name"], e); files, cats = [], []
        for p in files:
            r = judge(p, t, words, True)
            if r: found[p["title"]] = (r, p)
        for q in query_list(t):
            try:
                pages = search_files(q)
            except Exception as e:
                print("  search failed", t["name"], q, e); pages = []
            for p in pages:
                if p["title"] in found:
                    continue
                r = judge(p, t, words, False)
                if r: found[p["title"]] = (r, p)
            time.sleep(0.3)
        best = sorted(found.values(), key=lambda x: -x[0][0])[:6]
        data[t["id"]] = {"team": t["name"], "league": t["league"], "categories": cats, "candidates": [
            {"title": p["title"], "score": r[0], "why": r[2], "year": r[3], "licence": r[1], "thumb": p["imageinfo"][0].get("thumburl"),
             "size": [p["imageinfo"][0].get("width"), p["imageinfo"][0].get("height")]} for r, p in best]}
        print(f"  {t['name']:<26} {len(found):>3} found  best: {best[0][0][0] if best else '-':>3} {best[0][1]['title'][:60] if best else ''}", flush=True)
        with open(OUT, "w") as f:
            json.dump(data, f, indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
