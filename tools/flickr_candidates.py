#!/usr/bin/env python3
"""Add recent, freely licensed Flickr photos to the review shortlist (tools/candidates.json).

Flickr records when each photo was taken, so this searches only photos taken on or after
2023-01-01, under licences that allow reuse with credit: CC BY, CC BY-SA, CC BY-NC,
CC BY-NC-SA (2.0 and 4.0), CC0 and public domain. ND licences are left out because the site
resizes and crops photos.

Needs a free Flickr API key (https://www.flickr.com/services/apps/create/), read from the
FLICKR_API_KEY environment variable or from tools/.flickr_key (ignored by git).

Pick one with:  python3 tools/fetch_photos.py --pick <team id>=fl:<flickr photo id>

Usage:
  python3 tools/flickr_candidates.py              # all clubs
  python3 tools/flickr_candidates.py 19973 19257  # only these ESPN team ids
"""
import json, os, re, sys, time, urllib.parse

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
from fetch_photos import NAMES, BAD, WOMEN, WOMEN_ONLY, get, teams  # noqa: E402
from photo_candidates import OUT, SINCE, TEAMISH, club_words  # noqa: E402

KEY_FILE = os.path.join(os.path.dirname(os.path.abspath(__file__)), ".flickr_key")
API = "https://api.flickr.com/services/rest/"
# Flickr licence ids → name, for licences that allow reuse with credit and changes
LICENCES = {"1": "CC BY-NC-SA 2.0", "2": "CC BY-NC 2.0", "4": "CC BY 2.0", "5": "CC BY-SA 2.0", "9": "CC0", "10": "Public domain",
            "11": "CC BY 4.0", "12": "CC BY-SA 4.0", "14": "CC BY-NC 4.0", "15": "CC BY-NC-SA 4.0"}


def api_key():
    k = os.environ.get("FLICKR_API_KEY") or (open(KEY_FILE).read().strip() if os.path.exists(KEY_FILE) else "")
    if not re.fullmatch(r"[0-9a-f]{32}", k):
        sys.exit("No Flickr API key: set FLICKR_API_KEY or put the 32-character key in tools/.flickr_key")
    return k


def call(method, **params):
    params.update({"method": method, "api_key": api_key(), "format": "json", "nojsoncallback": "1"})
    d = json.loads(get(API + "?" + urllib.parse.urlencode(params)))
    if d.get("stat") != "ok":
        raise RuntimeError(d.get("message", "Flickr error"))
    return d


def search(text):
    d = call("flickr.photos.search", text=text, license=",".join(LICENCES), min_taken_date=f"{SINCE}-01-01", content_type="1", media="photos",
             sort="relevance", per_page="60", extras="date_taken,owner_name,license,tags,url_z,o_dims,url_l")
    return d["photos"]["photo"]


def judge(p, t, words):
    title, tags = p.get("title") or "", p.get("tags") or ""
    text = (title + " " + tags).lower()
    w, h = int(p.get("width_l") or p.get("o_width") or 0), int(p.get("height_l") or p.get("o_height") or 1)
    if p.get("license") not in LICENCES or w < 800 or BAD.search(title) or not any(x in text for x in words):
        return None
    if not (t["league"] == "usa.nwsl" or t["id"] in WOMEN_ONLY or WOMEN.search(text)):
        return None
    year = int((p.get("datetaken") or "0")[:4] or 0)
    if year < SINCE:
        return None
    s, why = 1, [str(year)]
    if TEAMISH.search(title):
        s += 5; why.insert(0, "team")
    s += 4 if year >= 2025 else 2
    if 1.25 <= w / h <= 2.2:
        s += 1
    return s, ",".join(why), year


def main():
    only = set(sys.argv[1:])
    api_key()  # fail early if missing
    data = json.load(open(OUT)) if os.path.exists(OUT) else {}
    for t in teams():
        if only and t["id"] not in only:
            continue
        entry = data.setdefault(t["id"], {"team": t["name"], "league": t["league"], "categories": [], "candidates": []})
        if not only and entry.get("flickr_done"):
            continue
        words = club_words(t)
        name = (NAMES.get(t["id"]) or [t["name"]])[0]
        women = "" if (t["league"] == "usa.nwsl" or t["id"] in WOMEN_ONLY) else (" femenino" if t["league"] == "esp.w.1" else " women")
        found = {}
        for q in [f"{name}{women}", f"{t['name']}{women} team", f"{t['name']}{women} football"]:
            try:
                for p in search(q):
                    j = judge(p, t, words)
                    if j and p["id"] not in found:
                        found[p["id"]] = (j, p)
            except Exception as e:
                print("  search failed", t["name"], e)
            time.sleep(0.5)
        best = sorted(found.values(), key=lambda x: -x[0][0])[:8]
        entry["candidates"] = [c for c in entry["candidates"] if c.get("provider") != "flickr"] + [{
            "provider": "flickr", "id": "fl:" + p["id"], "title": p.get("title") or "", "score": j[0], "why": j[1], "year": j[2],
            "licence": LICENCES[p["license"]], "creator": p.get("ownername") or "", "site": "flickr",
            "landing": f"https://www.flickr.com/photos/{p['owner']}/{p['id']}", "thumb": p.get("url_z"), "size": [p.get("width_l"), p.get("height_l")]} for j, p in best]
        entry["flickr_done"] = True
        print(f"  {t['name']:<26} {len(found):>3} found  best: {best[0][0][0] if best else '-':>3} {(best[0][1].get('title') or '')[:50] if best else ''}", flush=True)
        with open(OUT, "w") as f:
            json.dump(data, f, indent=1, ensure_ascii=False)


if __name__ == "__main__":
    main()
