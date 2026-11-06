#!/usr/bin/env python3
"""Add freely licensed photos from beyond Wikimedia Commons (mostly Flickr) to the review shortlist.

Uses the Openverse search engine (openverse.org), which indexes Creative Commons images and
records each one's creator, licence and source site. Results are merged into
tools/candidates.json next to the Commons ones, for a person to review. Pick one with:

  python3 tools/fetch_photos.py --pick <team id>=ov:<openverse id>

NC (non-commercial) licences are allowed: the site is non-commercial. ND (no-derivatives)
licences are left out because the site resizes and crops photos.

Usage:
  python3 tools/openverse_candidates.py              # all clubs
  python3 tools/openverse_candidates.py 19970 15364  # only these ESPN team ids
"""
import json, os, re, sys, time, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_photos import NAMES, BAD, WOMEN, WOMEN_ONLY, get, teams  # noqa: E402
from photo_candidates import OUT, SINCE, TEAMISH, YEAR, club_words  # noqa: E402

LICENCES = "by,by-sa,cc0,pdm,by-nc,by-nc-sa"


def search(q):
    p = {"q": q, "license": LICENCES, "page_size": "20"}
    d = json.loads(get("https://api.openverse.org/v1/images/?" + urllib.parse.urlencode(p)))
    return d.get("results", [])


def judge(r, t, words):
    if r.get("source") == "wikimedia" or (r.get("width") or 0) < 900:
        return None
    text = " ".join([r.get("title") or ""] + [x.get("name", "") for x in r.get("tags") or []]).lower()
    if BAD.search(r.get("title") or "") or not any(w in text for w in words):
        return None
    if not (t["league"] == "usa.nwsl" or t["id"] in WOMEN_ONLY or WOMEN.search(text)):
        return None
    s, why = 1, []
    if TEAMISH.search(r.get("title") or ""):
        s += 5; why.append("team")
    # Openverse has no capture date, so the title or tags must name a recent year
    years = [int(y) for y in YEAR.findall(text)]
    if not years or max(years) < SINCE:
        return None
    y = max(years); s += 4 if y >= 2025 else 2; why.append(str(y))
    w, h = r.get("width") or 0, r.get("height") or 1
    if 1.25 <= w / h <= 2.2:
        s += 1
    return s, ",".join(why), y


def main():
    only = set(sys.argv[1:])
    data = json.load(open(OUT)) if os.path.exists(OUT) else {}
    for t in teams():
        if only and t["id"] not in only:
            continue
        entry = data.setdefault(t["id"], {"team": t["name"], "league": t["league"], "categories": [], "candidates": []})
        if not only and entry.get("openverse_done"):
            continue
        words = club_words(t)
        names = NAMES.get(t["id"]) or [t["name"]]
        women = "" if (t["league"] == "usa.nwsl" or t["id"] in WOMEN_ONLY) else (" femenino" if t["league"] == "esp.w.1" else " women")
        found = {}
        for q in [f"{names[0]}{women} team", f"{names[0]}{women} 2025", f"{names[0]}{women} 2026", f"{t['name']}{women} football"]:
            try:
                res = search(q)
            except Exception as e:
                print("  search failed", t["name"], e); res = []
            for r in res:
                j = judge(r, t, words)
                if j and r["id"] not in found:
                    found[r["id"]] = (j, r)
            time.sleep(1.2)  # stay well inside the anonymous rate limit
        best = sorted(found.values(), key=lambda x: -x[0][0])[:6]
        entry["candidates"] = [c for c in entry["candidates"] if c.get("provider") != "openverse"] + [{
            "provider": "openverse", "id": "ov:" + r["id"], "title": r.get("title") or "", "score": j[0], "why": j[1], "year": j[2],
            "licence": f"CC {r.get('license', '').upper()} {r.get('license_version') or ''}".strip().replace("CC CC0", "CC0").replace("CC PDM", "Public domain"),
            "creator": r.get("creator") or "", "site": r.get("source") or r.get("provider") or "", "landing": r.get("foreign_landing_url") or "",
            "thumb": r.get("thumbnail"), "size": [r.get("width"), r.get("height")]} for j, r in best]
        entry["openverse_done"] = True
        print(f"  {t['name']:<26} {len(found):>3} found  best: {best[0][0][0] if best else '-':>3} {(best[0][1].get('title') or '')[:50] if best else ''}", flush=True)
        with open(OUT, "w") as f:
            json.dump(data, f, indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
