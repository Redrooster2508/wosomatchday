#!/usr/bin/env python3
"""Build season heatmaps and shot maps per player from ESPN play-by-play.

Run after tools/build_players.py: it takes the season's finished matches from
data/<league>/matches.json, reads each match's play-by-play once, and writes
data/<league>/heat.json:

  {"grid": [24, 16], "done": [match ids], "players": {id: {"n": touches, "c": {cell: count},
   "s": [[x, y, kind, opponent, date], ...]}}}

Cells count touches on a 24 x 16 grid in the player's attacking direction (x along the pitch).
Shot kinds: goal, on (saved), off, blocked. Only matches not in "done" are read.

Usage:
  python3 tools/build_heat.py                 # all competitions
  python3 tools/build_heat.py eng.w.1         # one competition
  python3 tools/build_heat.py --rebuild       # read every match again
"""
import gzip, json, os, re, sys, time, urllib.request
from concurrent.futures import ThreadPoolExecutor
from datetime import datetime

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data")
CORE = "https://sports.core.api.espn.com/v2/sports/soccer/leagues/"
LEAGUES = ["eng.w.1", "esp.w.1", "usa.nwsl", "uefa.wchampions",
           # national teams
           "fifa.friendly.w", "fifa.wwcq.ply", "concacaf.womens.championship", "caf.w.nations", "afc.w.asian.cup",
           "fifa.wwc", "uefa.weuro", "conmebol.america.femenina", "fifa.w.olympics", "uefa.w.nations"]
UA = "WomensMatchdayHub/1.0 (https://github.com/Redrooster2508/wosomatchday)"
GX, GY = 24, 16
SKIP = re.compile(r"^(Substitution|Start Delay|End Delay|Halftime|Start 2nd Half|End Regular Time|Kickoff|Out|Corner Awarded|Drop of Ball|Assist|Assists Shot|End Extra Time|Start Extra Time)$", re.I)


def get(url, tries=4):
    for i in range(tries):
        try:
            req = urllib.request.Request(url, headers={"User-Agent": UA, "Accept-Encoding": "gzip"})
            with urllib.request.urlopen(req, timeout=60) as r:
                raw = r.read()
                if r.headers.get("Content-Encoding") == "gzip":
                    raw = gzip.decompress(raw)
                return json.loads(raw)
        except Exception:
            if i == tries - 1:
                raise
            time.sleep(2 * (i + 1))


def shot_kind(t):
    if re.search(r"own goal", t, re.I):
        return None
    if re.match(r"^Goal($| - )", t, re.I):  # not "Goal Kick"
        return "goal"
    if re.match(r"^(Shot On Target|Penalty - Saved)$", t, re.I):
        return "on"
    if re.match(r"^Shot Blocked$", t, re.I):
        return "blocked"
    if re.match(r"^(Shot Off Target|Penalty - Missed)$", t, re.I) or re.search(r"woodwork|post", t, re.I):
        return "off"
    return None


def ref_id(ref, kind):
    m = re.search(kind + r"/(\d+)", ref or "")
    return m.group(1) if m else None


def plays(slug, mid):
    first = get(f"{CORE}{slug}/events/{mid}/competitions/{mid}/plays?limit=1000&page=1")
    pages = [first] + [get(f"{CORE}{slug}/events/{mid}/competitions/{mid}/plays?limit=1000&page={n}") for n in range(2, (first.get("pageCount") or 1) + 1)]
    out = []
    for pg in pages:
        for p in pg.get("items", []):
            t = (p.get("type") or {}).get("text", "")
            if p.get("fieldPositionX") is None or SKIP.match(t):
                continue
            part = (p.get("participants") or [{}])[0]
            ath = ref_id((part.get("athlete") or {}).get("$ref"), "athletes")
            if ath:
                out.append((ath, ref_id((p.get("team") or {}).get("$ref"), "teams"), float(p["fieldPositionX"]), float(p["fieldPositionY"]), shot_kind(t)))
    return out


def safe(slug, mid):
    try:
        return plays(slug, mid)
    except Exception as e:
        print(f"  skipped {mid}: {e}", flush=True)
        return None


def build(slug, rebuild=False):
    folder = os.path.join(DATA, slug)
    mfile, hfile = os.path.join(folder, "matches.json"), os.path.join(folder, "heat.json")
    if not os.path.exists(mfile):
        print(f"{slug}: run tools/build_players.py first"); return
    matches = json.load(open(mfile))["matches"]
    heat = {"grid": [GX, GY], "done": [], "players": {}}
    if not rebuild and os.path.exists(hfile):
        heat = json.load(open(hfile))
    done = set(heat["done"]) & set(matches)  # matches dropped from the season are forgotten on --rebuild
    todo = [m for m in matches if m not in done]
    print(f"{slug}: {len(matches)} matches, {len(todo)} new", flush=True)
    with ThreadPoolExecutor(6) as pool:
        for mid, res in zip(todo, pool.map(lambda m: safe(slug, m), todo)):
            if res is None:
                continue
            m = matches[mid]
            when = datetime.fromisoformat(m["date"].replace("Z", "+00:00")).strftime("%-d %b")
            for ath, team, x, y, kind in res:
                p = heat["players"].setdefault(ath, {"n": 0, "c": {}, "s": []})
                cell = str(min(GY - 1, int(y / 100 * GY)) * GX + min(GX - 1, int(x / 100 * GX)))
                p["c"][cell] = p["c"].get(cell, 0) + 1
                p["n"] += 1
                if kind:
                    opp = m["teams"].get(m["away"] if team == m["home"] else m["home"], {}).get("name", "")
                    p["s"].append([round(x, 1), round(y, 1), kind, opp, when])
            done.add(mid)
    heat["done"] = sorted(done)
    with open(hfile, "w") as f:
        json.dump(heat, f, separators=(",", ":"), ensure_ascii=False)
    print(f"  {len(heat['players'])} players, {len(done)} matches, {os.path.getsize(hfile) // 1024} KB", flush=True)


if __name__ == "__main__":
    args = [a for a in sys.argv[1:] if not a.startswith("--")]
    for slug in args or LEAGUES:
        build(slug, rebuild="--rebuild" in sys.argv)
